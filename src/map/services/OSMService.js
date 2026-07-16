import { DataCache } from "./DataCache";
import { OSM_FEATURE_PROFILES } from "./osmFeatureProfile";

export class OSMService {
  constructor({
    apiUrl = "https://overpass-api.de/api/interpreter",
    apiUrls = null,
    cache = new DataCache(),
    logger = console
  } = {}) {
    this.apiUrl = apiUrl;
    this.apiUrls = apiUrls ?? [
      apiUrl,
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.openstreetmap.ru/api/interpreter"
    ];
    this.cache = cache;
    this.logger = logger;
  }

  getCacheKey(south, west, north, east, profileName) {
    const centerLat = (south + north) / 2;
    const centerLon = (west + east) / 2;
    const heightMeters = Math.abs(north - south) * 111139;
    const roundedSize = Math.round(heightMeters / 100) * 100;

    return `map_${profileName}_v2_${centerLat.toFixed(3)}_${centerLon.toFixed(3)}_${roundedSize}`;
  }

  buildQuery(south, west, north, east, profileName = "expanded") {
    const selectors = OSM_FEATURE_PROFILES[profileName] ?? OSM_FEATURE_PROFILES.expanded;
    const bbox = `(${south},${west},${north},${east})`;
    const body = selectors.map((selector) => `${selector}${bbox};`).join("");

    return `[out:json][timeout:90];(${body});(._;>;);out body;`;
  }

  async fetchMapData(south, west, north, east, { profileName = "expanded", retryCount = 0 } = {}) {
    const cacheKey = this.getCacheKey(south, west, north, east, profileName);
    const cachedData = await this.cache.get(cacheKey);

    if (cachedData) {
      this.logger.log?.("Loaded OSM data from local cache.");
      return { data: cachedData, fromCache: true };
    }

    this.logger.log?.(`Fetching ${profileName} OSM data. D32 uses broad base data for core/expanded/tactical presets.`);
    const query = this.buildQuery(south, west, north, east, profileName);

    const response = await this.fetchWithOverpassFailover(query, retryCount);
    const data = await response.json();
    const resolved = this.resolveRelations(data);
    await this.cache.put(cacheKey, resolved);
    return { data: resolved, fromCache: false };
  }

  async fetchWithOverpassFailover(query, retryCount = 0) {
    let lastStatus = null;

    for (const url of this.apiUrls) {
      try {
        const response = await fetch(url, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`
        });

        if (response.ok) return response;

        lastStatus = response.status;
        const retryAfter = Number(response.headers?.get?.("Retry-After") ?? 0);
        const isRetryable = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;

        if (isRetryable) {
          const waitMs = Math.max(1200, Math.min(8000, retryAfter ? retryAfter * 1000 : (retryCount + 1) * 2200));
          this.logger.warn?.(`Overpass ${response.status} from ${url}. Trying failover after ${Math.round(waitMs / 1000)}s.`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        throw new Error(`OSM API error: ${response.status}`);
      } catch (error) {
        lastStatus = lastStatus ?? "network";
        this.logger.warn?.(`Overpass request failed for ${url}.`, error);
      }
    }

    if (retryCount < 2) {
      this.logger.warn?.("All Overpass endpoints failed. Retrying full request with backoff.");
      await new Promise((resolve) => setTimeout(resolve, (retryCount + 2) * 2500));
      return this.fetchWithOverpassFailover(query, retryCount + 1);
    }

    throw new Error(`OSM API error: ${lastStatus}`);
  }

  /**
   * Convert relation multipolygons into synthetic ways so the builder can
   * process them without special-casing relations. Each outer member of a
   * relation becomes a way element with the relation's tags.
   */
  resolveRelations(data) {
    const elements = data.elements ?? [];
    const nodeIndex = new Map();
    const wayIndex = new Map();
    const output = [];

    for (const el of elements) {
      if (el.type === "node") nodeIndex.set(el.id, el);
      else if (el.type === "way") wayIndex.set(el.id, el);
    }

    for (const el of elements) {
      if (el.type === "node" || el.type === "way") {
        output.push(el);
        continue;
      }

      if (el.type !== "relation" || !el.tags) continue;

      const outers = (el.members ?? []).filter((m) => m.type === "way" && (m.role === "outer" || m.role === ""));
      const inners = (el.members ?? [])
        .filter((m) => m.type === "way" && m.role === "inner")
        .map((m) => wayIndex.get(m.ref)?.nodes)
        .filter((nodes) => Array.isArray(nodes) && nodes.length >= 3);
      for (const member of outers) {
        const way = wayIndex.get(member.ref);
        if (!way || !way.nodes?.length) continue;
        // Emit a synthetic way with the relation's tags. Preserve inner rings so
        // water multipolygons can reconstruct islands instead of painting water
        // over them.
        output.push({
          type: "way",
          id: -(el.id * 1000 + member.ref % 1000),
          tags: { ...el.tags },
          nodes: way.nodes,
          innerRings: inners
        });
      }
    }

    return { ...data, elements: output };
  }

  async clearCache() {
    await this.cache.clear();
  }
}
