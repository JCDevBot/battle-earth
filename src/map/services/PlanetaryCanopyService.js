import { boundsFromCenter, METERS_PER_DEGREE_LAT } from "../utils/geo";

const STAC_SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const DATA_API_URL = "https://planetarycomputer.microsoft.com/api/data/v1";
const SAS_SIGN_URL = "https://planetarycomputer.microsoft.com/api/sas/v1/sign";

function lonLatToTilePixel(lon, lat, z) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n;
  return {
    tileX: Math.floor(x),
    tileY: Math.floor(y),
    pixelX: Math.floor((x - Math.floor(x)) * 256),
    pixelY: Math.floor((y - Math.floor(y)) * 256)
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("NAIP image failed to load."));
    img.src = src;
  });
}

function estimateCanopyFromPixel(r, g, b) {
  // D38.5 classifier calibration. NAIP rendered previews are RGB-only, so this
  // cannot separate every lawn from every tree. The goal is a practical urban
  // canopy signal: green vegetation that is also somewhat dark/saturated is more
  // likely to be mature canopy, while bright flat lawns score lower.
  const max = Math.max(r, g, b, 1);
  const min = Math.min(r, g, b);
  const total = Math.max(1, r + g + b);
  const greenRatio = g / total;
  const greenDominance = (g - Math.max(r, b)) / 255;
  const exg = (2 * g - r - b) / 510;
  const saturation = (max - min) / max;
  const darkness = 1 - max / 255;

  // Mature tree crowns in summer imagery are often not neon green. They tend to
  // be moderately green, saturated, and darker than turf. This weighted score is
  // intentionally more permissive than the D38.4 green-only score.
  const score =
    greenRatio * 0.36 +
    Math.max(0, exg) * 0.25 +
    Math.max(0, greenDominance) * 0.20 +
    saturation * 0.11 +
    darkness * 0.18;
  return Math.max(0, Math.min(1, score));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatBbox(bbox) {
  return bbox.map((v) => Number(v.toFixed(6))).join(", ");
}

function createCanvas(width = 256, height = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function imageToPixelData(img, width = 256, height = 256) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

export class PlanetaryCanopyService {
  constructor({ logger } = {}) {
    this.logger = logger;
  }

  async fetchCanopyGrid({ lat, lon, sizeMeters, gridSize = 32 }) {
    const startedAt = Date.now();
    const bounds = boundsFromCenter(lat, lon, sizeMeters);
    const bbox = [bounds.west, bounds.south, bounds.east, bounds.north];
    let stac = null;
    try {
      stac = await this.searchNaip(bbox);
    } catch (error) {
      return {
        enabled: true,
        available: false,
        source: "planetary-computer-naip",
        mode: "planetaryNaip",
        queryExecuted: true,
        querySucceeded: false,
        stage: "stac-search",
        bbox: formatBbox(bbox),
        message: `STAC search failed: ${error.message}`,
        elapsedMs: Date.now() - startedAt
      };
    }
    const item = stac.features?.[0];
    if (!item?.id) {
      return {
        enabled: true,
        available: false,
        source: "planetary-computer-naip",
        mode: "planetaryNaip",
        queryExecuted: true,
        querySucceeded: true,
        stage: "stac-no-items",
        bbox: formatBbox(bbox),
        message: "No NAIP item found for this bbox.",
        itemCount: 0,
        elapsedMs: Date.now() - startedAt
      };
    }

    const assetKeys = Object.keys(item.assets ?? {});
    const imageAssetHref = item.assets?.image?.href ?? null;
    const renderedPreviewHref = item.assets?.rendered_preview?.href ?? item.assets?.preview?.href ?? null;
    const signedAssetResult = imageAssetHref ? await this.testSignedAsset(imageAssetHref) : {
      attempted: false,
      succeeded: false,
      status: null,
      contentType: null,
      message: "No image asset href present on STAC item."
    };

    const z = sizeMeters <= 500 ? 17 : 16;
    const tileResult = await this.sampleTileGrid({ lat, lon, sizeMeters, gridSize, item, z });
    let result = tileResult;

    // Planetary Computer's item tile endpoint can return HTTP 500 for some NAIP
    // items even when STAC discovery succeeds. In that case, fall back to the
    // Data API preview endpoint and sample a small bbox crop instead of XYZ tiles.
    if (!tileResult.sampled) {
      const previewResult = await this.samplePreviewGrid({ lat, lon, sizeMeters, gridSize, item, bbox, renderedPreviewHref });
      if (previewResult.sampled > 0) {
        result = {
          ...previewResult,
          tileSampled: tileResult.sampled,
          tileFailedTiles: tileResult.failedTiles,
          tileStage: tileResult.stage,
          fallbackUsed: true
        };
      } else {
        result = {
          ...tileResult,
          previewAttempted: true,
          previewSucceeded: false,
          previewStage: previewResult.stage,
          previewFailures: previewResult.previewFailures,
          previewEndpoint: previewResult.previewEndpoint,
          fallbackUsed: false,
          message: `NAIP item found, but tile and preview sampling both failed. Tile stage=${tileResult.stage}; preview stage=${previewResult.stage}.`
        };
      }
    }

    const flat = result.values?.flat?.() ?? [];
    const avg = flat.reduce((sum, value) => sum + value, 0) / Math.max(1, flat.length);
    const minScore = flat.length ? Math.min(...flat) : 0;
    const maxScore = flat.length ? Math.max(...flat) : 0;
    const canopyCandidateThreshold = 0.24;
    const mediumCanopyThreshold = 0.20;
    const highCanopyThreshold = 0.32;
    const canopyCells = flat.filter((v) => v >= canopyCandidateThreshold).length;
    const mediumCanopyCells = flat.filter((v) => v >= mediumCanopyThreshold).length;
    const highCanopyCells = flat.filter((v) => v >= highCanopyThreshold).length;
    const totalCells = gridSize * gridSize;

    return {
      enabled: true,
      available: result.sampled > 0,
      source: "planetary-computer-naip",
      mode: "planetaryNaip",
      queryExecuted: true,
      querySucceeded: true,
      stage: result.sampled > 0 ? result.stage : "sampling-empty",
      collection: "naip",
      bbox: formatBbox(bbox),
      itemId: item.id,
      itemDatetime: item.properties?.datetime ?? item.properties?.start_datetime ?? "unknown",
      itemCount: stac.features?.length ?? 0,
      assetKeys,
      hasImageAsset: Boolean(imageAssetHref),
      hasRenderedPreview: Boolean(renderedPreviewHref),
      signedAssetAttempted: Boolean(signedAssetResult?.attempted),
      signedAssetSucceeded: Boolean(signedAssetResult?.succeeded),
      signedAssetStatus: signedAssetResult?.status,
      signedAssetContentType: signedAssetResult?.contentType,
      signedAssetMessage: signedAssetResult?.message,
      signedAssetHrefPreview: signedAssetResult?.hrefPreview,
      zoom: z,
      gridSize,
      values: result.values ?? Array.from({ length: gridSize }, () => Array(gridSize).fill(0)),
      avgScore: avg,
      minScore,
      maxScore,
      canopyCandidateThreshold,
      mediumCanopyThreshold,
      highCanopyThreshold,
      canopyCells,
      mediumCanopyCells,
      highCanopyCells,
      sampled: result.sampled,
      failedTiles: result.failedTiles ?? 0,
      totalCells,
      tileFailuresPct: totalCells ? (result.failedTiles ?? 0) / totalCells : 0,
      previewAttempted: Boolean(result.previewAttempted),
      previewSucceeded: Boolean(result.previewSucceeded),
      previewEndpoint: result.previewEndpoint,
      previewFailures: result.previewFailures ?? 0,
      tileSampled: result.tileSampled,
      tileFailedTiles: result.tileFailedTiles,
      tileStage: result.tileStage,
      fallbackUsed: Boolean(result.fallbackUsed),
      elapsedMs: Date.now() - startedAt,
      message: result.sampled > 0
        ? `${result.previewSucceeded ? "Preview fallback" : "Tile"} canopy probe sampled ${result.sampled}/${totalCells} cells from ${item.id}.`
        : result.message ?? "NAIP item found, but imagery could not be sampled."
    };
  }

  async sampleTileGrid({ lat, lon, sizeMeters, gridSize, item, z }) {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const tileCache = new Map();
    const values = [];
    let sampled = 0;
    let failedTiles = 0;

    const loadTile = async (tileX, tileY) => {
      const key = `${z}/${tileX}/${tileY}`;
      if (tileCache.has(key)) return tileCache.get(key);
      const url = `${DATA_API_URL}/item/tiles/WebMercatorQuad/${z}/${tileX}/${tileY}@1x?collection=naip&item=${encodeURIComponent(item.id)}&assets=image&format=png`;
      const promise = loadImage(url)
        .then((img) => {
          ctx.clearRect(0, 0, 256, 256);
          ctx.drawImage(img, 0, 0, 256, 256);
          return ctx.getImageData(0, 0, 256, 256).data;
        })
        .catch((error) => {
          failedTiles++;
          this.logger?.log?.(`Canopy tile failed: ${error.message}`, "warn");
          return null;
        });
      tileCache.set(key, promise);
      return promise;
    };

    for (let row = 0; row < gridSize; row++) {
      const outRow = [];
      for (let col = 0; col < gridSize; col++) {
        const x = -sizeMeters / 2 + ((col + 0.5) / gridSize) * sizeMeters;
        const zWorld = -sizeMeters / 2 + ((row + 0.5) / gridSize) * sizeMeters;
        const sampleLat = lat - zWorld / METERS_PER_DEGREE_LAT;
        const sampleLon = lon + x / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
        const tp = lonLatToTilePixel(sampleLon, sampleLat, z);
        const data = await loadTile(tp.tileX, tp.tileY);
        if (!data) {
          outRow.push(0);
          continue;
        }
        const idx = (tp.pixelY * 256 + tp.pixelX) * 4;
        outRow.push(estimateCanopyFromPixel(data[idx], data[idx + 1], data[idx + 2]));
        sampled++;
      }
      values.push(outRow);
    }

    return {
      stage: sampled > 0 ? "tile-sampling-complete" : "tile-sampling-empty",
      values,
      sampled,
      failedTiles
    };
  }

  async samplePreviewGrid({ lat, lon, sizeMeters, gridSize, item, bbox, renderedPreviewHref = null }) {
    const width = 512;
    const height = 512;
    const previewUrls = [
      renderedPreviewHref,
      item.assets?.rendered_preview?.href,
      item.assets?.preview?.href,
      `${DATA_API_URL}/item/preview.png?collection=naip&item=${encodeURIComponent(item.id)}&assets=image&bbox=${bbox.join(",")}&width=${width}&height=${height}`,
      `${DATA_API_URL}/item/preview.png?collection=naip&item=${encodeURIComponent(item.id)}&asset=image&bbox=${bbox.join(",")}&width=${width}&height=${height}`,
      `${DATA_API_URL}/item/preview.png?collection=naip&item=${encodeURIComponent(item.id)}&assets=image&width=${width}&height=${height}`
    ].filter(Boolean);

    let data = null;
    let usedUrl = null;
    let usedItemBbox = false;
    let previewFailures = 0;
    for (const url of previewUrls) {
      try {
        const img = await loadImage(url);
        data = await imageToPixelData(img, width, height);
        usedUrl = url;
        usedItemBbox = url === renderedPreviewHref || url === item.assets?.rendered_preview?.href || url === item.assets?.preview?.href;
        break;
      } catch (error) {
        previewFailures++;
        this.logger?.log?.(`Canopy preview failed: ${error.message}`, "warn");
      }
    }

    if (!data) {
      return {
        stage: "preview-sampling-empty",
        previewAttempted: true,
        previewSucceeded: false,
        previewFailures,
        previewEndpoint: "item/preview.png",
        values: [],
        sampled: 0,
        failedTiles: 0
      };
    }

    const values = [];
    let sampled = 0;
    const samplingBbox = usedItemBbox && Array.isArray(item.bbox) ? item.bbox : bbox;
    const lonSpan = samplingBbox[2] - samplingBbox[0];
    const latSpan = samplingBbox[3] - samplingBbox[1];

    for (let row = 0; row < gridSize; row++) {
      const outRow = [];
      for (let col = 0; col < gridSize; col++) {
        const x = -sizeMeters / 2 + ((col + 0.5) / gridSize) * sizeMeters;
        const zWorld = -sizeMeters / 2 + ((row + 0.5) / gridSize) * sizeMeters;
        const sampleLat = lat - zWorld / METERS_PER_DEGREE_LAT;
        const sampleLon = lon + x / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
        const px = clamp(Math.floor(((sampleLon - samplingBbox[0]) / Math.max(1e-9, lonSpan)) * width), 0, width - 1);
        const py = clamp(Math.floor((1 - (sampleLat - samplingBbox[1]) / Math.max(1e-9, latSpan)) * height), 0, height - 1);
        const idx = (py * width + px) * 4;
        outRow.push(estimateCanopyFromPixel(data[idx], data[idx + 1], data[idx + 2]));
        sampled++;
      }
      values.push(outRow);
    }

    return {
      stage: "preview-sampling-complete",
      previewAttempted: true,
      previewSucceeded: true,
      previewFailures,
      previewEndpoint: usedItemBbox ? "stac-rendered-preview" : (usedUrl?.includes("asset=image") ? "item/preview.png?asset=image" : "item/preview.png?assets=image"),
      previewUsedItemBbox: usedItemBbox,
      values,
      sampled,
      failedTiles: 0
    };
  }

  async signAssetHref(href) {
    const response = await fetch(`${SAS_SIGN_URL}?href=${encodeURIComponent(href)}`);
    if (!response.ok) throw new Error(`SAS sign failed: ${response.status}`);
    const body = await response.json();
    if (!body?.href) throw new Error("SAS sign response did not include href.");
    return body.href;
  }

  async testSignedAsset(href) {
    const result = {
      attempted: true,
      succeeded: false,
      status: null,
      contentType: null,
      hrefPreview: href?.slice?.(0, 90) ?? null,
      message: "Signed asset test not completed."
    };
    try {
      const signedHref = await this.signAssetHref(href);
      result.hrefPreview = signedHref.slice(0, 90);
      // We only request a tiny range to verify access. Browser-side canopy sampling
      // still uses rendered PNG previews because the signed asset is usually a COG/GeoTIFF.
      const response = await fetch(signedHref, { headers: { Range: "bytes=0-4095" } });
      result.status = response.status;
      result.contentType = response.headers.get("content-type");
      result.succeeded = response.ok || response.status === 206;
      result.message = result.succeeded
        ? `Signed asset access verified (${response.status}).`
        : `Signed asset request returned HTTP ${response.status}.`;
    } catch (error) {
      result.message = error.message;
    }
    return result;
  }

  async searchNaip(bbox) {
    const response = await fetch(STAC_SEARCH_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        collections: ["naip"],
        bbox,
        limit: 6,
        sortby: [{ field: "properties.datetime", direction: "desc" }]
      })
    });
    if (!response.ok) throw new Error(`Planetary Computer STAC error: ${response.status}`);
    return response.json();
  }
}
