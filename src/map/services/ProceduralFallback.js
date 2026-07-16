import { SeededRandom } from "../utils/SeededRandom";

/**
 * Generates fake OSM-format data (nodes + ways) for areas with sparse/no real data.
 * Output is compatible with MapFeatureBuilder.build() — same structure as Overpass JSON.
 */
export function generateProceduralOsmData({ lat, lon, sizeMeters, seed = 1 }) {
  const rng = new SeededRandom(seed);
  const elements = [];
  let nextId = -1;

  const halfDeg = (sizeMeters / 2) / 111139;

  function addNode(nodeLat, nodeLon) {
    const id = nextId--;
    elements.push({ type: "node", id, lat: nodeLat, lon: nodeLon });
    return id;
  }

  function addWay(nodeIds, tags) {
    elements.push({ type: "way", id: nextId--, tags, nodes: nodeIds });
  }

  // Grid-based road network
  const roadSpacing = Math.max(80, sizeMeters / (6 + Math.floor(rng.next() * 5)));
  const roadCount = Math.floor(sizeMeters / roadSpacing);

  // Horizontal roads
  for (let i = 0; i <= roadCount; i++) {
    const offsetLat = halfDeg * ((i / roadCount) * 2 - 1);
    const n1 = addNode(lat + offsetLat, lon - halfDeg);
    const n2 = addNode(lat + offsetLat, lon + halfDeg);
    const type = i === Math.floor(roadCount / 2) ? "secondary" : "residential";
    addWay([n1, n2], { highway: type });
  }

  // Vertical roads
  for (let i = 0; i <= roadCount; i++) {
    const offsetLon = halfDeg * ((i / roadCount) * 2 - 1);
    const n1 = addNode(lat - halfDeg, lon + offsetLon);
    const n2 = addNode(lat + halfDeg, lon + offsetLon);
    const type = i === Math.floor(roadCount / 2) ? "secondary" : "residential";
    addWay([n1, n2], { highway: type });
  }

  // Scatter buildings in blocks between roads
  const buildingCount = 20 + Math.floor(rng.next() * 41);
  for (let b = 0; b < buildingCount; b++) {
    const bLat = lat + (rng.next() - 0.5) * halfDeg * 1.8;
    const bLon = lon + (rng.next() - 0.5) * halfDeg * 1.8;
    const w = (8 + rng.next() * 20) / 111139;
    const h = (8 + rng.next() * 20) / 111139;

    const n1 = addNode(bLat, bLon);
    const n2 = addNode(bLat + h, bLon);
    const n3 = addNode(bLat + h, bLon + w);
    const n4 = addNode(bLat, bLon + w);

    const levels = 1 + Math.floor(rng.next() * 4);
    addWay([n1, n2, n3, n4, n1], { building: "yes", "building:levels": String(levels) });
  }

  // A few forest/park zones
  const zoneCount = 1 + Math.floor(rng.next() * 4);
  for (let z = 0; z < zoneCount; z++) {
    const zLat = lat + (rng.next() - 0.5) * halfDeg * 1.4;
    const zLon = lon + (rng.next() - 0.5) * halfDeg * 1.4;
    const r = (30 + rng.next() * 60) / 111139;
    const pts = [];
    const sides = 5 + Math.floor(rng.next() * 4);
    for (let s = 0; s < sides; s++) {
      const angle = (s / sides) * Math.PI * 2;
      pts.push(addNode(zLat + Math.sin(angle) * r, zLon + Math.cos(angle) * r * 1.2));
    }
    pts.push(pts[0]);
    const tag = rng.next() > 0.5 ? { landuse: "forest" } : { leisure: "park", landuse: "grass" };
    addWay(pts, tag);
  }

  return { elements };
}
