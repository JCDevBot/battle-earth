import { DataCache } from "./DataCache";
import { OSM_FEATURE_PROFILES } from "./osmFeatureProfile";

function reverseCopy(values) {
  return [...values].reverse();
}

function joinMemberWays(members, wayIndex) {
  const remaining = members
    .map((member) => {
      const nodes = wayIndex.get(member.ref)?.nodes;
      if (!Array.isArray(nodes) || nodes.length < 2) return null;
      return { ref: member.ref, nodes: [...nodes] };
    })
    .filter(Boolean);
  const rings = [];
  const consumedRefs = new Set();

  while (remaining.length) {
    const first = remaining.shift();
    const chain = [...first.nodes];
    const chainRefs = [first.ref];
    let advanced = true;

    while (chain[0] !== chain[chain.length - 1] && advanced) {
      advanced = false;
      const chainStart = chain[0];
      const chainEnd = chain[chain.length - 1];

      for (let index = 0; index < remaining.length; index++) {
        const candidate = remaining[index];
        const candidateStart = candidate.nodes[0];
        const candidateEnd = candidate.nodes[candidate.nodes.length - 1];

        if (candidateStart === chainEnd) {
          chain.push(...candidate.nodes.slice(1));
        } else if (candidateEnd === chainEnd) {
          chain.push(...reverseCopy(candidate.nodes).slice(1));
        } else if (candidateEnd === chainStart) {
          chain.unshift(...candidate.nodes.slice(0, -1));
        } else if (candidateStart === chainStart) {
          chain.unshift(...reverseCopy(candidate.nodes).slice(0, -1));
        } else {
          continue;
        }

        chainRefs.push(candidate.ref);
        remaining.splice(index, 1);
        advanced = true;
        break;
      }
    }

    if (chain.length >= 4 && chain[0] === chain[chain.length - 1]) {
      rings.push(chain);
      for (const ref of chainRefs) consumedRefs.add(ref);
    }
  }

  return { rings, consumedRefs };
}

function hasIndependentLinearSemantics(tags = {}) {
  return Boolean(
    tags.highway ||
      tags.railway ||
      tags.barrier ||
      tags.waterway ||
      tags.power ||
      tags.route,
  );
}

export class OSMService {
  constructor({
    apiUrl = "https://overpass-api.de/api/interpreter",
    apiUrls = null,
    cache = new DataCache(),
    logger = console,
  } = {}) {
    this.apiUrl = apiUrl;
    this.apiUrls = apiUrls ?? [
      apiUrl,
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.openstreetmap.ru/api/interpreter",
    ];
    this.cache = cache;
    this.logger = logger;
  }

  getCacheKey(south, west, north, east, profileName) {
    const centerLat = (south + north) / 2;
    const centerLon = (west + east) / 2;
    const heightMeters = Math.abs(north - south) * 111139;
    const roundedSize = Math.round(heightMeters / 100) * 100;

    return `map_${profileName}_v5_${centerLat.toFixed(3)}_${centerLon.toFixed(3)}_${roundedSize}`;
  }

  buildQuery(south, west, north, east, profileName = "expanded") {
    const selectors =
      OSM_FEATURE_PROFILES[profileName] ?? OSM_FEATURE_PROFILES.expanded;
    const bbox = `(${south},${west},${north},${east})`;
    const body = selectors.map((selector) => `${selector}${bbox};`).join("");

    return `[out:json][timeout:90];(${body});(._;>;);out body;`;
  }

  async fetchMapData(
    south,
    west,
    north,
    east,
    { profileName = "expanded", retryCount = 0 } = {},
  ) {
    const cacheKey = this.getCacheKey(south, west, north, east, profileName);
    const cachedData = await this.cache.get(cacheKey);

    if (cachedData) {
      this.logger.log?.("Loaded OSM data from local cache.");
      return { data: cachedData, fromCache: true };
    }

    this.logger.log?.(
      `Fetching ${profileName} OSM data. D32 uses broad base data for core/expanded/tactical presets.`,
    );
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
          body: `data=${encodeURIComponent(query)}`,
        });
        if (response.ok) return response;

        lastStatus = response.status;
        const retryAfter = Number(response.headers?.get?.("Retry-After") ?? 0);
        const isRetryable =
          response.status === 429 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;

        if (isRetryable) {
          const waitMs = Math.max(
            1200,
            Math.min(
              8000,
              retryAfter ? retryAfter * 1000 : (retryCount + 1) * 2200,
            ),
          );
          this.logger.warn?.(
            `Overpass ${response.status} from ${url}. Trying failover after ${Math.round(waitMs / 1000)}s.`,
          );
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
      this.logger.warn?.(
        "All Overpass endpoints failed. Retrying full request with backoff.",
      );
      await new Promise((resolve) =>
        setTimeout(resolve, (retryCount + 2) * 2500),
      );
      return this.fetchWithOverpassFailover(query, retryCount + 1);
    }

    throw new Error(`OSM API error: ${lastStatus}`);
  }

  /**
   * Convert relation multipolygons into synthetic closed ways so the builder can
   * process them without special-casing relations. OSM multipolygon boundaries
   * are commonly split across several open member ways; filling each member as
   * its own polygon creates large artificial slabs across the map.
   */
  resolveRelations(data) {
    const elements = data.elements ?? [];
    const wayIndex = new Map();
    const syntheticWays = [];
    const consumedMemberRefs = new Set();

    for (const element of elements) {
      if (element.type === "way") wayIndex.set(element.id, element);
    }

    for (const element of elements) {
      if (element.type !== "relation" || !element.tags) continue;

      const outerMembers = (element.members ?? []).filter(
        (member) =>
          member.type === "way" &&
          (member.role === "outer" || member.role === ""),
      );
      const innerMembers = (element.members ?? []).filter(
        (member) => member.type === "way" && member.role === "inner",
      );
      const outerAssembly = joinMemberWays(outerMembers, wayIndex);
      if (!outerAssembly.rings.length) continue;

      const innerAssembly = joinMemberWays(innerMembers, wayIndex);
      for (const ref of outerAssembly.consumedRefs) consumedMemberRefs.add(ref);
      for (const ref of innerAssembly.consumedRefs) consumedMemberRefs.add(ref);

      outerAssembly.rings.forEach((nodes, ringIndex) => {
        syntheticWays.push({
          type: "way",
          id: -(element.id * 1000 + ringIndex + 1),
          tags: { ...element.tags },
          nodes,
          innerRings: innerAssembly.rings,
        });
      });
    }

    const output = elements.filter((element) => {
      if (element.type === "relation") return false;
      if (element.type !== "way") return true;
      if (!consumedMemberRefs.has(element.id)) return true;
      return hasIndependentLinearSemantics(element.tags);
    });

    return { ...data, elements: [...output, ...syntheticWays] };
  }

  async clearCache() {
    await this.cache.clear();
  }
}
