import { useEffect, useMemo, useState } from "react";
import { OSMService } from "../map/services/OSMService";
import {
  autoResolveConflict,
  createCampaignFromBattleRequest,
  deployArmyToRegion,
  initializeCampaignFactions,
  moveArmyToRegion,
  simulateCampaignPulse
} from "../campaign/CampaignEngine";

function colorClasses(color = "slate", active = false) {
  const map = {
    sky: active ? "border-sky-300 bg-sky-500/30 text-sky-50" : "border-sky-500/40 bg-sky-950/40 text-sky-100",
    rose: active ? "border-rose-300 bg-rose-500/30 text-rose-50" : "border-rose-500/40 bg-rose-950/40 text-rose-100",
    amber: active ? "border-amber-300 bg-amber-500/30 text-amber-50" : "border-amber-500/40 bg-amber-950/40 text-amber-100",
    emerald: active ? "border-emerald-300 bg-emerald-500/30 text-emerald-50" : "border-emerald-500/40 bg-emerald-950/40 text-emerald-100",
    violet: active ? "border-violet-300 bg-violet-500/30 text-violet-50" : "border-violet-500/40 bg-violet-950/40 text-violet-100",
    cyan: active ? "border-cyan-300 bg-cyan-500/30 text-cyan-50" : "border-cyan-500/40 bg-cyan-950/40 text-cyan-100",
    orange: active ? "border-orange-300 bg-orange-500/30 text-orange-50" : "border-orange-500/40 bg-orange-950/40 text-orange-100"
  };
  return map[color] ?? (active ? "border-slate-300 bg-slate-500/30 text-white" : "border-slate-700 bg-slate-900 text-slate-300");
}

function ownerFor(region, factions) {
  return factions.find((faction) => faction.id === region.ownerId) ?? null;
}

function factionFor(id, factions) {
  return factions.find((faction) => faction.id === id) ?? null;
}

function ownerLabel(owner) {
  return owner?.name ?? "Neutral";
}

function influenceSegments(region, factions) {
  const entries = Object.entries(region.influence ?? {}).filter(([, value]) => value > 0);
  if (!entries.length) return [{ key: "neutral", label: "Neutral", color: "bg-slate-500", value: 100 }];
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, value]) => {
      const faction = factionFor(key, factions);
      const color = {
        sky: "bg-sky-400",
        rose: "bg-rose-400",
        amber: "bg-amber-400",
        emerald: "bg-emerald-400",
        violet: "bg-violet-400",
        cyan: "bg-cyan-400",
        orange: "bg-orange-400"
      }[faction?.color] ?? "bg-slate-500";
      return { key, label: faction?.name ?? "Neutral", color, value };
    });
}

function eventTone(event) {
  if (event.importance === "high") return "border-amber-400/40 bg-amber-950/20 text-amber-100";
  if (event.type === "conflict") return "border-rose-400/40 bg-rose-950/20 text-rose-100";
  if (event.type === "deployment") return "border-sky-400/40 bg-sky-950/20 text-sky-100";
  return "border-slate-800 bg-slate-950/50 text-slate-300";
}

const FACTION_HEX = {
  sky: "#38bdf8",
  rose: "#fb7185",
  amber: "#fbbf24",
  emerald: "#34d399",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  orange: "#fb923c",
  slate: "#94a3b8"
};

function hexForFaction(faction) {
  return FACTION_HEX[faction?.color] ?? FACTION_HEX.slate;
}

function ringsFromGeometry(geometry, bbox = null) {
  if (geometry?.type === "Polygon") return geometry.coordinates ?? [];
  if (geometry?.type === "MultiPolygon") return (geometry.coordinates ?? []).flat();
  if (bbox) {
    return [[
      [bbox.w, bbox.s], [bbox.w, bbox.n], [bbox.e, bbox.n], [bbox.e, bbox.s], [bbox.w, bbox.s]
    ]];
  }
  return [];
}

function bboxFromRegions(regions = [], root = {}) {
  const boxes = [];
  if (root?.bbox) boxes.push(root.bbox);
  for (const region of regions) {
    if (region.entity?.bbox) boxes.push(region.entity.bbox);
  }
  if (!boxes.length) return { w: -180, e: 180, s: -60, n: 80 };
  let w = Math.min(...boxes.map((b) => b.w));
  let e = Math.max(...boxes.map((b) => b.e));
  let s = Math.min(...boxes.map((b) => b.s));
  let n = Math.max(...boxes.map((b) => b.n));
  const lonPad = Math.max(3, (e - w) * 0.08);
  const latPad = Math.max(2, (n - s) * 0.08);
  return { w: Math.max(-180, w - lonPad), e: Math.min(180, e + lonPad), s: Math.max(-85, s - latPad), n: Math.min(85, n + latPad) };
}

function makeProjector(bbox, width = 1000, height = 620) {
  const lonSpan = Math.max(1, bbox.e - bbox.w);
  const latSpan = Math.max(1, bbox.n - bbox.s);
  return ([lon, lat]) => {
    const x = ((lon - bbox.w) / lonSpan) * width;
    const y = ((bbox.n - lat) / latSpan) * height;
    return [x, y];
  };
}

function pathForRing(ring = [], project) {
  if (!ring.length) return "";
  const points = ring.map(project);
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";
}

function labelPointForEntity(entity = {}, project) {
  if (Number.isFinite(entity.lon) && Number.isFinite(entity.lat)) return project([entity.lon, entity.lat]);
  if (entity.bbox) return project([(entity.bbox.w + entity.bbox.e) / 2, (entity.bbox.s + entity.bbox.n) / 2]);
  return [500, 310];
}


function centroidLonLat(entity = {}) {
  if (Number.isFinite(entity.lon) && Number.isFinite(entity.lat)) return [entity.lon, entity.lat];
  if (entity.bbox) return [(entity.bbox.w + entity.bbox.e) / 2, (entity.bbox.s + entity.bbox.n) / 2];
  return [0, 0];
}

function terrainProfileForEntity(entity = {}) {
  const [lon, lat] = centroidLonLat(entity);
  const name = `${entity.name ?? ""}`.toLowerCase();
  if (name.includes("greenland") || lat > 62) return { id: "ice", label: "Ice / tundra", base: "#dbeafe", mid: "#93c5fd", accent: "#f8fafc" };
  if (name.includes("mexico") || name.includes("arizona") || name.includes("texas") || name.includes("baja") || (lat < 32 && lon < -90)) return { id: "desert", label: "Desert / scrub", base: "#d97706", mid: "#f59e0b", accent: "#fde68a" };
  if (name.includes("cuba") || name.includes("haiti") || name.includes("jamaica") || name.includes("guatemala") || name.includes("belize") || name.includes("honduras") || name.includes("nicaragua") || name.includes("panama") || (lat < 25 && lon > -100)) return { id: "tropical", label: "Tropical", base: "#047857", mid: "#22c55e", accent: "#86efac" };
  if (lon < -115 || name.includes("rocky") || name.includes("british columbia") || name.includes("alaska")) return { id: "mountain", label: "Mountains", base: "#57534e", mid: "#a8a29e", accent: "#f5f5f4" };
  if (lat > 48) return { id: "boreal", label: "Boreal forest", base: "#14532d", mid: "#16a34a", accent: "#86efac" };
  if (lon > -87 && lat > 30) return { id: "forest", label: "Forest / coast", base: "#166534", mid: "#22c55e", accent: "#bbf7d0" };
  return { id: "plains", label: "Plains", base: "#65a30d", mid: "#a3e635", accent: "#fef08a" };
}

function gradientIdForRegion(region) {
  return `terrain-${String(region.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function terrainReliefOffset(region) {
  const profile = terrainProfileForEntity(region.entity);
  const offsets = { ice: 16, desert: 10, tropical: 11, mountain: 24, boreal: 16, forest: 13, plains: 9 };
  return offsets[profile.id] ?? 5;
}

function regionPoint(region, project) {
  return labelPointForEntity(region?.entity, project);
}

function curvedPathBetween(from, to) {
  if (!from || !to) return "";
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = x1 + dx * 0.48 - dy * 0.12;
  const cy = y1 + dy * 0.48 + dx * 0.08;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

function interpolatePoint(from, to, t = 1) {
  if (!from || !to) return from ?? to ?? [0, 0];
  const safeT = Math.max(0, Math.min(1, t));
  return [from[0] + (to[0] - from[0]) * safeT, from[1] + (to[1] - from[1]) * safeT];
}

function visibleStrategicLabel(region, campaign, selectedRegionId) {
  if (selectedRegionId === region.id) return true;
  if (region.ownerId) return true;
  if (campaign.regions.length <= 18) return true;
  return false;
}


function hashString(value = "") {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seededUnit(seed, index = 0) {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function regionFeatureBox(entity = {}) {
  if (entity.bbox) return entity.bbox;
  const [lon, lat] = centroidLonLat(entity);
  return { w: lon - 2, e: lon + 2, s: lat - 2, n: lat + 2 };
}

function pointInBox(box, u, v) {
  return [box.w + (box.e - box.w) * u, box.s + (box.n - box.s) * v];
}

function localTerrainLine(box, project, seed, row, rows = 6, wiggle = 0.035) {
  const points = Array.from({ length: 7 }).map((_, col) => {
    const u = 0.08 + col * 0.14;
    const v = 0.16 + row * (0.7 / Math.max(1, rows - 1));
    const wobble = Math.sin((u + seed * 0.001) * Math.PI * 5 + row) * wiggle;
    return project(pointInBox(box, u, Math.max(0.06, Math.min(0.94, v + wobble))));
  });
  return smoothFeaturePath(points);
}

function RegionTerrainDetails({ region, project }) {
  const profile = terrainProfileForEntity(region.entity);
  const box = regionFeatureBox(region.entity);
  const seed = hashString(region.id ?? region.name ?? "region");
  const clipId = `clip-${String(region.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const textureCount = profile.id === "mountain" ? 16 : profile.id === "ice" ? 11 : profile.id === "desert" ? 14 : 22;

  if (profile.id === "mountain") {
    return (
      <g clipPath={`url(#${clipId})`} className="pointer-events-none">
        {Array.from({ length: 5 }).map((_, i) => {
          const xBase = 0.22 + i * 0.11 + seededUnit(seed, i) * 0.08;
          const pts = Array.from({ length: 7 }).map((__, j) => {
            const v = 0.12 + j * 0.13;
            const u = xBase + Math.sin(v * 9 + i) * 0.035;
            return project(pointInBox(box, u, v));
          });
          const d = smoothFeaturePath(pts);
          return (
            <g key={`ridge-detail-${region.id}-${i}`} opacity={0.32 + seededUnit(seed, i + 20) * 0.22}>
              <path d={d} fill="none" stroke="#1c1917" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" transform="translate(5 8)" />
              <path d={d} fill="none" stroke="#78716c" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
              <path d={d} fill="none" stroke="#f8fafc" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.72" />
            </g>
          );
        })}
      </g>
    );
  }

  if (profile.id === "ice") {
    return (
      <g clipPath={`url(#${clipId})`} className="pointer-events-none">
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={`ice-${region.id}-${i}`} d={localTerrainLine(box, project, seed, i, 9, 0.025)} fill="none" stroke="#eff6ff" strokeWidth={1.4 + seededUnit(seed, i) * 1.4} strokeLinecap="round" opacity="0.44" />
        ))}
      </g>
    );
  }

  return (
    <g clipPath={`url(#${clipId})`} className="pointer-events-none">
      {Array.from({ length: profile.id === "desert" ? 8 : 6 }).map((_, i) => (
        <path key={`contour-${region.id}-${i}`} d={localTerrainLine(box, project, seed, i, 7, profile.id === "desert" ? 0.022 : 0.018)} fill="none" stroke={profile.id === "desert" ? "#fde68a" : "#ecfccb"} strokeWidth="1.1" strokeLinecap="round" opacity={profile.id === "desert" ? 0.25 : 0.14} />
      ))}
      {Array.from({ length: textureCount }).map((_, i) => {
        const u = 0.08 + seededUnit(seed, i) * 0.84;
        const v = 0.12 + seededUnit(seed + 17, i) * 0.76;
        const [x, y] = project(pointInBox(box, u, v));
        const size = 2.2 + seededUnit(seed + 31, i) * 3.8;
        if (profile.id === "desert") {
          return <path key={`dune-${region.id}-${i}`} d={`M${(x - size * 2).toFixed(1)},${y.toFixed(1)} C${(x - size).toFixed(1)},${(y - size).toFixed(1)} ${(x + size).toFixed(1)},${(y + size).toFixed(1)} ${(x + size * 2).toFixed(1)},${y.toFixed(1)}`} fill="none" stroke="#fed7aa" strokeWidth="1.2" opacity="0.2" />;
        }
        const treeColor = profile.id === "boreal" ? "#052e16" : profile.id === "tropical" ? "#064e3b" : "#14532d";
        return <ellipse key={`veg-${region.id}-${i}`} cx={x.toFixed(1)} cy={y.toFixed(1)} rx={(size * 1.2).toFixed(1)} ry={size.toFixed(1)} fill={treeColor} opacity={0.16 + seededUnit(seed + 50, i) * 0.16} />;
      })}
    </g>
  );
}

function StrategicRidgeLines({ bbox, project }) {
  const width = bbox.e - bbox.w;
  const height = bbox.n - bbox.s;
  const hasWesternRange = bbox.w < -80 && bbox.e > -170;
  if (!hasWesternRange) return null;
  const ridgeLon = Math.max(bbox.w + width * 0.18, -124);
  const top = bbox.n - height * 0.12;
  const bottom = bbox.s + height * 0.18;
  const ridges = [0, 1, 2].map((index) => {
    const lon = ridgeLon + index * width * 0.035;
    const points = Array.from({ length: 8 }).map((_, i) => {
      const t = i / 7;
      const lat = top + (bottom - top) * t;
      const wave = Math.sin(t * Math.PI * 5 + index) * width * 0.018;
      return project([lon + wave, lat]);
    });
    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  });
  return (
    <g opacity="0.38" className="pointer-events-none">
      {ridges.map((d, index) => <path key={index} d={d} fill="none" stroke="#f8fafc" strokeWidth="3.2" strokeLinecap="round" />)}
      {ridges.map((d, index) => <path key={`shadow-${index}`} d={d} fill="none" stroke="#292524" strokeWidth="8" strokeLinecap="round" opacity="0.28" transform="translate(4 8)" />)}
    </g>
  );
}

function featureScaleForCampaign(campaign) {
  const level = campaign?.root?.level ?? "continent";
  if (level === "world") return { label: "world scale", rivers: 4, forests: 5, roads: 3, nodes: "capitals / chokepoints" };
  if (level === "continent") return { label: "continent scale", rivers: 5, forests: 8, roads: 5, nodes: "capitals / ports / mountain passes" };
  if (level === "country") return { label: "country scale", rivers: 7, forests: 12, roads: 8, nodes: "states / cities / logistics hubs" };
  if (level === "region") return { label: "state scale", rivers: 9, forests: 16, roads: 12, nodes: "cities / roads / airfields" };
  return { label: "city scale", rivers: 4, forests: 10, roads: 14, nodes: "districts / tactical POIs" };
}

function smoothFeaturePath(points = []) {
  if (!points.length) return "";
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function organicBlobPath(cx, cy, rx, ry, phase = 0, segments = 28) {
  const points = Array.from({ length: segments }).map((_, i) => {
    const t = (i / segments) * Math.PI * 2;
    const wobble = 1 + Math.sin(t * 3 + phase) * 0.08 + Math.cos(t * 5 + phase * 0.7) * 0.05;
    return [cx + Math.cos(t) * rx * wobble, cy + Math.sin(t) * ry * wobble];
  });
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";
}

function offsetFeaturePoints(points = [], dx = 0, dy = 0) {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

function terrainContourPaths(bbox, project, count = 8) {
  const width = bbox.e - bbox.w;
  const height = bbox.n - bbox.s;
  return Array.from({ length: count }).map((_, row) => {
    const lat = bbox.n - height * (0.16 + row * 0.095);
    const points = Array.from({ length: 13 }).map((__, col) => {
      const t = col / 12;
      const lon = bbox.w + width * (0.05 + t * 0.9);
      const wave = Math.sin(t * Math.PI * 4 + row * 0.7) * height * 0.012;
      return project([lon, lat + wave]);
    });
    return smoothFeaturePath(points);
  });
}

function theaterKindForCampaign(campaign = {}, bbox = {}) {
  const rootName = `${campaign.root?.name ?? ""}`.toLowerCase();
  if (rootName.includes("north america")) return "northAmerica";
  if (rootName.includes("south america")) return "southAmerica";
  if (rootName.includes("africa")) return "africa";
  if (rootName.includes("europe")) return "europe";
  if (rootName.includes("asia")) return "asia";
  if (rootName.includes("oceania") || rootName.includes("australia")) return "oceania";
  if (bbox.w < -50 && bbox.e < -20 && bbox.n > 35 && bbox.s < 15) return "northAmerica";
  if (bbox.w < -35 && bbox.e < -30 && bbox.s < 15 && bbox.n > -55) return "southAmerica";
  if (bbox.w < 55 && bbox.e > -25 && bbox.s < 5 && bbox.n > 20) return "africa";
  if (bbox.w < 45 && bbox.e > -15 && bbox.n > 35) return "europe";
  return "generic";
}

function featurePathFromLonLat(points = [], project) {
  return smoothFeaturePath(points.map(project));
}

function theaterFeatureLibrary(campaign = {}, bbox = {}) {
  const kind = theaterKindForCampaign(campaign, bbox);
  const width = bbox.e - bbox.w;
  const height = bbox.n - bbox.s;
  const regionNames = new Set((campaign.regions ?? []).map((region) => `${region.name}`.toLowerCase()));

  const libraries = {
    northAmerica: {
      rivers: [
        { name: "Mississippi", points: [[-95, 47], [-93, 44], [-91, 40], [-90, 36], [-91, 32], [-89, 29]] },
        { name: "Missouri", points: [[-112, 47], [-107, 45], [-103, 43], [-99, 41], [-94, 39], [-90, 38]] },
        { name: "Rio Grande", points: [[-107, 32], [-104, 31], [-101, 29], [-99, 27], [-97, 26]] },
        { name: "St. Lawrence", points: [[-82, 45], [-78, 45], [-73, 46], [-68, 48], [-63, 49]] },
        { name: "Colorado", points: [[-110, 41], [-113, 38], [-114, 35], [-113, 32], [-115, 31]] }
      ],
      mountains: [
        { name: "Rockies", points: [[-122, 56], [-118, 50], [-113, 44], [-110, 39], [-106, 35], [-104, 31]] },
        { name: "Appalachians", points: [[-80, 45], [-79, 40], [-82, 36], [-84, 33]] },
        { name: "Sierra", points: [[-122, 42], [-120, 38], [-118, 35]] }
      ],
      forests: [
        { name: "Canadian Boreal", center: [-102, 56], rx: 250, ry: 70, color: "#14532d" },
        { name: "Pacific Northwest", center: [-123, 48], rx: 90, ry: 70, color: "#166534" },
        { name: "Eastern Forest", center: [-80, 40], rx: 150, ry: 90, color: "#166534" }
      ],
      corridors: [
        { name: "Transcontinental corridor", points: [[-123, 49], [-112, 49], [-100, 46], [-88, 43], [-74, 45]] },
        { name: "I-35 / central corridor", points: [[-97, 29], [-97, 36], [-94, 42], [-93, 45]] },
        { name: "Eastern seaboard", points: [[-80, 26], [-78, 34], [-75, 40], [-71, 43]] }
      ],
      points: [
        { name: "Ottawa", type: "capital", lon: -75.6972, lat: 45.4215 },
        { name: "Washington", type: "capital", lon: -77.0369, lat: 38.9072 },
        { name: "Mexico City", type: "capital", lon: -99.1332, lat: 19.4326 },
        { name: "Vancouver", type: "port", lon: -123.1207, lat: 49.2827 },
        { name: "New York", type: "port", lon: -74.006, lat: 40.7128 },
        { name: "Veracruz", type: "port", lon: -96.1342, lat: 19.1738 }
      ]
    },
    southAmerica: {
      rivers: [
        { name: "Amazon", points: [[-74, -4], [-68, -4], [-61, -3], [-54, -2], [-49, -1]] },
        { name: "Paraná", points: [[-55, -16], [-54, -22], [-58, -28], [-60, -33], [-58, -35]] },
        { name: "Orinoco", points: [[-67, 6], [-63, 7], [-60, 8], [-62, 9]] }
      ],
      mountains: [
        { name: "Andes", points: [[-77, 8], [-78, 0], [-76, -10], [-72, -20], [-70, -30], [-70, -44], [-73, -52]] }
      ],
      forests: [
        { name: "Amazon Basin", center: [-61, -5], rx: 270, ry: 135, color: "#064e3b" },
        { name: "Atlantic Forest", center: [-46, -22], rx: 95, ry: 120, color: "#166534" },
        { name: "Pampas", center: [-61, -36], rx: 140, ry: 70, color: "#65a30d" }
      ],
      corridors: [
        { name: "Andean corridor", points: [[-77, 5], [-76, -10], [-72, -23], [-70, -38]] },
        { name: "Atlantic trade route", points: [[-43, -23], [-48, -25], [-57, -34]] }
      ],
      points: [
        { name: "Brasília", type: "capital", lon: -47.8825, lat: -15.7942 },
        { name: "Buenos Aires", type: "capital", lon: -58.3816, lat: -34.6037 },
        { name: "Lima", type: "capital", lon: -77.0428, lat: -12.0464 },
        { name: "Santos", type: "port", lon: -46.3336, lat: -23.9608 },
        { name: "Callao", type: "port", lon: -77.1181, lat: -12.0464 }
      ]
    },
    africa: {
      rivers: [
        { name: "Nile", points: [[31, 31], [31, 24], [30, 17], [31, 9], [32, 2], [30, -4]] },
        { name: "Congo", points: [[25, 0], [20, -2], [15, -4], [13, -5], [18, -6], [24, -5]] },
        { name: "Niger", points: [[-10, 11], [-5, 13], [1, 14], [6, 12], [8, 9], [6, 5]] },
        { name: "Zambezi", points: [[25, -11], [22, -15], [19, -18], [15, -20], [12, -22]] }
      ],
      mountains: [
        { name: "Atlas", points: [[-10, 31], [-3, 34], [5, 35], [10, 34]] },
        { name: "East African Rift", points: [[35, 12], [36, 4], [35, -4], [34, -12], [32, -18]] },
        { name: "Drakensberg", points: [[28, -25], [29, -29], [30, -31]] }
      ],
      forests: [
        { name: "Congo Basin", center: [20, 0], rx: 210, ry: 120, color: "#064e3b" },
        { name: "Sahel", center: [5, 14], rx: 280, ry: 50, color: "#a16207" },
        { name: "Sahara", center: [13, 24], rx: 360, ry: 130, color: "#d97706" }
      ],
      corridors: [
        { name: "Nile corridor", points: [[31, 30], [31, 20], [31, 10], [32, 0]] },
        { name: "West African coast", points: [[-17, 14], [-5, 5], [5, 4], [8, 6]] },
        { name: "Cape corridor", points: [[18, -34], [25, -30], [31, -26]] }
      ],
      points: [
        { name: "Cairo", type: "capital", lon: 31.2357, lat: 30.0444 },
        { name: "Lagos", type: "port", lon: 3.3792, lat: 6.5244 },
        { name: "Cape Town", type: "port", lon: 18.4241, lat: -33.9249 },
        { name: "Nairobi", type: "capital", lon: 36.8219, lat: -1.2921 }
      ]
    },
    europe: {
      rivers: [
        { name: "Rhine", points: [[8, 47], [7, 49], [6, 51], [5, 52]] },
        { name: "Danube", points: [[9, 48], [14, 48], [19, 47], [24, 45], [29, 45]] },
        { name: "Volga", points: [[37, 57], [42, 55], [46, 51], [48, 47]] }
      ],
      mountains: [
        { name: "Alps", points: [[6, 45], [9, 46], [13, 47], [16, 46]] },
        { name: "Pyrenees", points: [[-2, 43], [1, 43], [3, 42]] },
        { name: "Carpathians", points: [[18, 49], [22, 48], [25, 46], [26, 45]] }
      ],
      forests: [
        { name: "Scandinavian Forest", center: [16, 62], rx: 190, ry: 85, color: "#14532d" },
        { name: "Central European Forest", center: [15, 50], rx: 190, ry: 70, color: "#166534" }
      ],
      corridors: [
        { name: "North European Plain", points: [[2, 51], [9, 52], [18, 52], [27, 51]] },
        { name: "Mediterranean route", points: [[-3, 40], [5, 43], [13, 42], [20, 40], [29, 41]] }
      ],
      points: [
        { name: "Paris", type: "capital", lon: 2.3522, lat: 48.8566 },
        { name: "Berlin", type: "capital", lon: 13.405, lat: 52.52 },
        { name: "Rome", type: "capital", lon: 12.4964, lat: 41.9028 },
        { name: "Rotterdam", type: "port", lon: 4.4777, lat: 51.9244 }
      ]
    }
  };

  const generic = {
    rivers: [{ name: "Main river", points: [[bbox.w + width * 0.2, bbox.n - height * 0.2], [bbox.w + width * 0.35, bbox.n - height * 0.36], [bbox.w + width * 0.52, bbox.n - height * 0.45], [bbox.w + width * 0.72, bbox.n - height * 0.66]] }],
    mountains: [{ name: "Highlands", points: [[bbox.w + width * 0.18, bbox.n - height * 0.18], [bbox.w + width * 0.25, bbox.n - height * 0.42], [bbox.w + width * 0.28, bbox.n - height * 0.68]] }],
    forests: [{ name: "Forest belt", center: [bbox.w + width * 0.45, bbox.n - height * 0.42], rx: 180, ry: 80, color: "#166534" }],
    corridors: [{ name: "Strategic corridor", points: [[bbox.w + width * 0.25, bbox.n - height * 0.25], [bbox.w + width * 0.5, bbox.n - height * 0.48], [bbox.w + width * 0.78, bbox.n - height * 0.7]] }],
    points: []
  };

  const library = libraries[kind] ?? generic;
  return {
    kind,
    source: "Natural Earth political geometry + OSM-style strategic feature layer",
    rivers: library.rivers.filter((feature) => feature.points.some(([lon, lat]) => lon >= bbox.w - width * 0.1 && lon <= bbox.e + width * 0.1 && lat >= bbox.s - height * 0.1 && lat <= bbox.n + height * 0.1)),
    mountains: library.mountains.filter((feature) => feature.points.some(([lon, lat]) => lon >= bbox.w - width * 0.1 && lon <= bbox.e + width * 0.1 && lat >= bbox.s - height * 0.1 && lat <= bbox.n + height * 0.1)),
    forests: library.forests,
    corridors: library.corridors,
    points: library.points.filter((point) => point.lon >= bbox.w - width * 0.05 && point.lon <= bbox.e + width * 0.05 && point.lat >= bbox.s - height * 0.05 && point.lat <= bbox.n + height * 0.05)
  };
}

function TheaterFeatureLayer({ campaign, bbox, project }) {
  const scale = featureScaleForCampaign(campaign);
  const library = theaterFeatureLibrary(campaign, bbox);
  const visibleRivers = library.rivers.slice(0, scale.rivers);
  const visibleCorridors = library.corridors.slice(0, scale.roads);
  const visibleForests = library.forests.slice(0, scale.forests);
  const visibleMountains = library.mountains;
  const visiblePoints = library.points.slice(0, 12);

  const renderMountainSymbols = (feature, featureIndex) => {
    const points = feature.points.map(project);
    const main = smoothFeaturePath(points);
    const shadow = smoothFeaturePath(offsetFeaturePoints(points, 10, 14));
    const crest = smoothFeaturePath(offsetFeaturePoints(points, -2, -4));
    const labelAnchor = points[Math.floor(points.length / 2)] ?? points[0];
    return (
      <g key={`mountain-${feature.name}`} opacity="0.82">
        <path d={shadow} fill="none" stroke="#020617" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.28" />
        <path d={main} fill="none" stroke="#57534e" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.48" />
        <path d={main} fill="none" stroke="#a8a29e" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.52" />
        <path d={crest} fill="none" stroke="#f8fafc" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.72" strokeDasharray="16 12" />
        <path d={main} fill="none" stroke="#292524" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.38" strokeDasharray="4 9" />
        {labelAnchor && <text x={labelAnchor[0]} y={labelAnchor[1] - 24} textAnchor="middle" className="fill-stone-100 text-[10px] font-black" opacity="0.24">{feature.name}</text>}
      </g>
    );
  };

  return (
    <g className="pointer-events-none">
      <g opacity="0.14">
        {terrainContourPaths(bbox, project, 9).map((d, index) => (
          <path key={`terrain-contour-${index}`} d={d} fill="none" stroke="#f8fafc" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="8 18" />
        ))}
      </g>
      <g opacity="0.24">
        {visibleCorridors.map((corridor, index) => {
          const d = featurePathFromLonLat(corridor.points, project);
          return (
            <g key={`corridor-${corridor.name}-${index}`}>
              <path d={d} fill="none" stroke="#020617" strokeWidth="8" strokeLinecap="round" strokeOpacity="0.45" />
              <path d={d} fill="none" stroke="#facc15" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.66" strokeDasharray="10 9" />
            </g>
          );
        })}
      </g>

      <g opacity="0.78">
        {visibleForests.map((forest, index) => {
          const [cx, cy] = project(forest.center);
          const blob = organicBlobPath(cx, cy, forest.rx, forest.ry, index * 1.7);
          const inner = organicBlobPath(cx + forest.rx * 0.04, cy - forest.ry * 0.06, forest.rx * 0.72, forest.ry * 0.56, index * 2.1 + 0.5);
          return (
            <g key={`forest-${forest.name}-${index}`} opacity="0.72">
              <path d={blob} fill={forest.color} opacity="0.16" filter="url(#soft-terrain)" />
              <path d={inner} fill={forest.color} opacity="0.16" />
              <path d={blob} fill="none" stroke="#bbf7d0" strokeWidth="1.2" strokeOpacity="0.08" />
              <text x={cx} y={cy - forest.ry * 0.62} textAnchor="middle" className="fill-emerald-100 text-[10px] font-black" opacity="0.18">{forest.name}</text>
            </g>
          );
        })}
      </g>

      <g opacity="0.96">
        {visibleRivers.map((river, index) => {
          const d = featurePathFromLonLat(river.points, project);
          const label = project(river.points[Math.floor(river.points.length / 2)]);
          return (
            <g key={`river-${river.name}-${index}`}>
              <path d={d} fill="none" stroke="#082f49" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity="0.58" />
              <path d={d} fill="none" stroke="#0284c7" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              <path d={d} fill="none" stroke="#e0f2fe" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" />
              {label && <text x={label[0] + 10} y={label[1] - 8} className="fill-sky-100 text-[10px] font-black" opacity="0.38">{river.name}</text>}
            </g>
          );
        })}
      </g>

      <g opacity="0.92">
        {visibleMountains.map(renderMountainSymbols)}
      </g>

      <g>
        {visiblePoints.map((point, index) => {
          const [x, y] = project([point.lon, point.lat]);
          const isCapital = point.type === "capital";
          return (
            <g key={`gis-point-${point.name}-${index}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity="0.9">
              <circle r={isCapital ? 11 : 8} fill="#020617" stroke={isCapital ? "#fde68a" : "#7dd3fc"} strokeWidth="2" />
              <text y="4" textAnchor="middle" className="fill-white text-[10px] font-black">{isCapital ? "◆" : "●"}</text>
              <rect x="12" y="-14" width={Math.max(48, point.name.length * 7.5)} height="20" rx="8" fill="#020617" opacity="0.54" />
              <text x="19" y="0" className="fill-slate-100 text-[10px] font-black">{point.name}</text>
            </g>
          );
        })}
      </g>

      <g opacity="0.76">
        <rect x="18" y="570" width="510" height="30" rx="12" fill="#020617" opacity="0.5" />
        <text x="34" y="589" className="fill-slate-200 text-[11px] font-bold">
          D77 terrain layer: {library.source} · {library.rivers.length} rivers · {library.mountains.length} mountain systems · {library.forests.length} terrain zones · {library.points.length} command nodes
        </text>
      </g>
    </g>
  );
}


function osmWayPoints(way, nodeIndex, project) {
  return (way.nodes ?? [])
    .map((nodeId) => nodeIndex.get(nodeId))
    .filter(Boolean)
    .map((node) => project([node.lon, node.lat]));
}

function osmWayPath(way, nodeIndex, project) {
  const points = osmWayPoints(way, nodeIndex, project);
  if (points.length < 2) return "";
  const closed = way.nodes?.length > 2 && way.nodes[0] === way.nodes[way.nodes.length - 1];
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + (closed ? " Z" : "");
}

function osmTerrainClass(tags = {}) {
  if (tags.waterway || tags.water || tags.natural === "water" || tags.natural === "wetland") return "water";
  if (["forest", "wood", "meadow", "grass", "orchard", "vineyard", "recreation_ground", "park"].includes(tags.landuse) || ["wood", "scrub", "grassland", "heath"].includes(tags.natural) || tags.leisure === "park" || tags.leisure === "nature_reserve") return "vegetation";
  if (["bare_rock", "scree", "cliff", "ridge", "valley"].includes(tags.natural)) return "relief";
  if (tags.highway || tags.railway) return "corridor";
  return "other";
}

function OSMLiveTerrainLayer({ bbox, project, campaign }) {
  const [state, setState] = useState({ status: "idle", elements: [], message: "" });

  useEffect(() => {
    let cancelled = false;
    const lonSpan = Math.abs((bbox?.e ?? 0) - (bbox?.w ?? 0));
    const latSpan = Math.abs((bbox?.n ?? 0) - (bbox?.s ?? 0));
    const rootLevel = campaign?.root?.level ?? "region";
    const tooLarge = lonSpan * latSpan > 90 || lonSpan > 14 || latSpan > 10 || ["world", "continent"].includes(rootLevel);

    if (!bbox || tooLarge) {
      setState({ status: "skipped", elements: [], message: "OSM terrain fetch skipped at this strategic scale. Zoom to country, region, city, or freeplay for live OSM terrain." });
      return () => { cancelled = true; };
    }

    setState({ status: "loading", elements: [], message: "Loading live OSM terrain…" });
    const osm = new OSMService({ logger: console });
    osm.fetchMapData(bbox.s, bbox.w, bbox.n, bbox.e, { profileName: "terrainOnly" })
      .then(({ data }) => {
        if (cancelled) return;
        setState({ status: "ready", elements: data.elements ?? [], message: "Live OSM terrain" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: "error", elements: [], message: `OSM terrain unavailable: ${error.message}` });
      });

    return () => { cancelled = true; };
  }, [bbox?.w, bbox?.e, bbox?.s, bbox?.n, campaign?.root?.level]);

  const { nodeIndex, ways, peaks } = useMemo(() => {
    const nodes = new Map();
    const osmWays = [];
    const peakNodes = [];
    for (const el of state.elements ?? []) {
      if (el.type === "node") {
        nodes.set(el.id, el);
        if (el.tags?.natural === "peak") peakNodes.push(el);
      } else if (el.type === "way") {
        osmWays.push(el);
      }
    }
    return { nodeIndex: nodes, ways: osmWays, peaks: peakNodes };
  }, [state.elements]);

  const terrainWays = useMemo(() => {
    const grouped = { water: [], vegetation: [], relief: [], corridor: [] };
    for (const way of ways) {
      const type = osmTerrainClass(way.tags ?? {});
      if (grouped[type]) grouped[type].push(way);
    }
    return grouped;
  }, [ways]);

  return (
    <g className="pointer-events-none">
      <rect x="0" y="0" width="1000" height="620" fill="#1f3b24" opacity="0.86" />
      <rect x="0" y="0" width="1000" height="620" fill="url(#terrain-shade)" opacity="0.58" />
      <g opacity="0.75">
        {terrainWays.vegetation.slice(0, 650).map((way) => {
          const d = osmWayPath(way, nodeIndex, project);
          return d ? <path key={`osm-veg-${way.id}`} d={d} fill="#166534" fillOpacity="0.42" stroke="#14532d" strokeWidth="0.8" strokeOpacity="0.38" /> : null;
        })}
      </g>
      <g opacity="0.9">
        {terrainWays.water.slice(0, 500).map((way) => {
          const d = osmWayPath(way, nodeIndex, project);
          return d ? <path key={`osm-water-${way.id}`} d={d} fill="#0ea5e9" fillOpacity="0.58" stroke="#7dd3fc" strokeWidth="1.5" strokeOpacity="0.75" /> : null;
        })}
      </g>
      <g opacity="0.55">
        {terrainWays.relief.slice(0, 500).map((way) => {
          const d = osmWayPath(way, nodeIndex, project);
          return d ? <path key={`osm-relief-${way.id}`} d={d} fill="none" stroke="#fef3c7" strokeWidth="1.35" strokeOpacity="0.62" strokeDasharray="6 7" /> : null;
        })}
      </g>
      <g opacity="0.72">
        {terrainWays.corridor.slice(0, 700).map((way) => {
          const d = osmWayPath(way, nodeIndex, project);
          return d ? <path key={`osm-road-${way.id}`} d={d} fill="none" stroke="#f8fafc" strokeWidth={way.tags?.highway === "motorway" || way.tags?.highway === "trunk" ? 2.2 : 1.05} strokeOpacity="0.46" /> : null;
        })}
      </g>
      <g opacity="0.85">
        {peaks.slice(0, 60).map((peak) => {
          const [x, y] = project([peak.lon, peak.lat]);
          return <path key={`osm-peak-${peak.id}`} d={`M${x.toFixed(1)},${(y - 5).toFixed(1)} L${(x + 5).toFixed(1)},${(y + 5).toFixed(1)} L${(x - 5).toFixed(1)},${(y + 5).toFixed(1)} Z`} fill="#f8fafc" opacity="0.75" />;
        })}
      </g>
      <rect x="18" y="570" width="620" height="30" rx="12" fill="#020617" opacity="0.56" />
      <text x="34" y="590" fill="#bae6fd" fontSize="11" fontWeight="800" letterSpacing="1.4">
        {state.status === "ready" ? `OSM terrain layer · ${ways.length} ways · ${peaks.length} peaks` : state.message}
      </text>
    </g>
  );
}

function StrategicCampaignMap({ campaign, selectedRegionId, selectedArmyId, hoverTargetId, onHoverTarget, onSelectRegion, onSelectArmy, onSelectConflict }) {
  const bbox = bboxFromRegions(campaign.regions, campaign.root);
  const project = makeProjector(bbox);
  const pendingConflicts = campaign.conflicts.filter((conflict) => conflict.status === "pending");
  const rootLabel = campaign.root.level === "continent" ? "Living strategic theater" : `${campaign.root.level ?? "Strategic"} theater`;
  const selectedArmy = campaign.armies.find((army) => army.id === selectedArmyId) ?? null;
  const selectedArmyFaction = selectedArmy ? factionFor(selectedArmy.factionId, campaign.factions) : null;
  const selectedArmyRegion = selectedArmy ? campaign.regions.find((region) => region.id === selectedArmy.regionId) : null;
  const hoverTarget = hoverTargetId ? campaign.regions.find((region) => region.id === hoverTargetId) : null;
  const previewPath = selectedArmy && hoverTarget && selectedArmy.regionId !== hoverTarget.id
    ? curvedPathBetween(regionPoint(selectedArmyRegion, project), regionPoint(hoverTarget, project))
    : "";

  return (
    <section className="mb-4 shrink-0 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/80 shadow-2xl shadow-black/45">
      <div className="flex flex-col gap-2 border-b border-cyan-300/10 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-200">D77 · terrain LOD generated world {rootLabel}</div>
          <div className="text-sm text-slate-300">Generated terrain model for {campaign.root.name}: terrain, water, forest masses, ridges, borders, command nodes, influence, armies, and conflicts.</div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
          <span className="rounded-full border border-emerald-300/20 bg-emerald-950/30 px-3 py-1">rich terrain</span>
          <span className="rounded-full border border-sky-300/20 bg-sky-950/30 px-3 py-1">raised borders</span>
          <span className="rounded-full border border-amber-300/20 bg-amber-950/30 px-3 py-1">scale-aware features</span>
          <span className="rounded-full border border-violet-300/20 bg-violet-950/30 px-3 py-1">influence paint</span>
        </div>
      </div>
      <div className="relative flex min-h-[560px] items-center justify-center overflow-hidden bg-[#020617] p-3 md:min-h-[620px] md:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_18%,rgba(125,211,252,0.14),transparent_44%),linear-gradient(180deg,rgba(8,47,73,0.22),rgba(2,6,23,0.88))]" />
        <div className="relative w-full max-w-[1420px] origin-center rounded-[1.4rem] shadow-[0_34px_90px_rgba(0,0,0,0.55)] [transform:perspective(1400px)_rotateX(18deg)]">
        <svg className="block h-[70vh] min-h-[540px] w-full rounded-[1.4rem]" viewBox="0 0 1000 620" role="img" aria-label={`${campaign.root.name} living strategic theater map`}>
          <defs>
            <linearGradient id="ocean-depth" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="32%" stopColor="#075985" />
              <stop offset="72%" stopColor="#0f3b6d" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <radialGradient id="theater-light" cx="42%" cy="24%" r="74%">
              <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.34" />
              <stop offset="48%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="terrain-shade" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.22" />
              <stop offset="46%" stopColor="#365314" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.44" />
            </linearGradient>
            <filter id="region-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="map-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="9" dy="13" stdDeviation="6" floodColor="#000000" floodOpacity="0.55" />
            </filter>
            <filter id="army-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="soft-terrain" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
            <filter id="surface-grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="11" result="noise" />
              <feColorMatrix in="noise" type="saturate" values="0" result="grain" />
              <feBlend in="SourceGraphic" in2="grain" mode="soft-light" />
            </filter>

            {campaign.regions.map((region) => {
              const clipId = `clip-${String(region.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
              const rings = ringsFromGeometry(region.entity?.geometry, region.entity?.bbox);
              return (
                <clipPath key={clipId} id={clipId}>
                  {rings.map((ring, index) => {
                    const d = pathForRing(ring, project);
                    return d ? <path key={`${clipId}-${index}`} d={d} /> : null;
                  })}
                </clipPath>
              );
            })}
            <pattern id="water-lines" width="64" height="36" patternUnits="userSpaceOnUse">
              <path d="M0 16 C16 6 32 26 48 16 S80 16 96 16" fill="none" stroke="#7dd3fc" strokeOpacity="0.15" strokeWidth="1.4" />
            </pattern>
            {campaign.regions.map((region) => {
              const profile = terrainProfileForEntity(region.entity);
              return (
                <linearGradient key={gradientIdForRegion(region)} id={gradientIdForRegion(region)} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={profile.accent} />
                  <stop offset="42%" stopColor={profile.mid} />
                  <stop offset="100%" stopColor={profile.base} />
                </linearGradient>
              );
            })}
          </defs>
          <rect x="0" y="0" width="1000" height="620" fill="url(#ocean-depth)" />
          <rect x="0" y="0" width="1000" height="620" fill="url(#water-lines)" opacity="0.85" />
          <rect x="0" y="0" width="1000" height="620" fill="url(#theater-light)" />
          <g opacity="0.18">
            <ellipse cx="220" cy="120" rx="180" ry="52" fill="#bae6fd" />
            <ellipse cx="760" cy="485" rx="220" ry="64" fill="#0369a1" />
          </g>
          <ellipse cx="500" cy="602" rx="440" ry="42" fill="#020617" opacity="0.6" />
          <OSMLiveTerrainLayer bbox={bbox} project={project} campaign={campaign} />

          <g filter="url(#map-shadow)">
            {campaign.regions.map((region) => {
              const rings = ringsFromGeometry(region.entity?.geometry, region.entity?.bbox);
              const depth = terrainReliefOffset(region);
              return (
                <g key={`depth-${region.id}`} className="pointer-events-none" opacity="0.72">
                  {rings.map((ring, index) => {
                    const path = pathForRing(ring, project);
                    if (!path) return null;
                    return <path key={`${region.id}-depth-${index}`} d={path} fill="#0f172a" stroke="#020617" strokeWidth="1" transform={`translate(${depth * 0.55} ${depth})`} />;
                  })}
                </g>
              );
            })}

            {campaign.regions.map((region) => {
              const owner = ownerFor(region, campaign.factions);
              const active = selectedRegionId === region.id;
              const rings = ringsFromGeometry(region.entity?.geometry, region.entity?.bbox);
              const terrainId = gradientIdForRegion(region);
              const ownerColor = hexForFaction(owner);
              const influenceOpacity = owner ? 0.025 + Math.min(0.105, (region.controlPercent ?? 0) / 720) : 0;
              return (
                <g
                  key={region.id}
                  className="cursor-pointer"
                  onMouseEnter={() => onHoverTarget?.(region.id)}
                  onMouseLeave={() => onHoverTarget?.(null)}
                  onClick={() => onSelectRegion(region.id)}
                >
                  {rings.map((ring, index) => {
                    const path = pathForRing(ring, project);
                    if (!path) return null;
                    return (
                      <g key={`${region.id}-${index}`}>
                        <path d={path} fill="#111827" fillOpacity={active ? "0.12" : "0.04"} stroke="#dbeafe" strokeWidth={active ? 3.2 : 1.05} strokeOpacity={active ? 0.98 : 0.36} filter={active ? "url(#region-glow)" : undefined} />
                        {owner && <path d={path} fill={ownerColor} fillOpacity={influenceOpacity} stroke={ownerColor} strokeWidth={active ? 2.2 : 0.8} strokeOpacity={active ? 0.72 : 0.2} />}
                        {selectedArmy && hoverTargetId === region.id && selectedArmy.regionId !== region.id && (
                          <path d={path} fill={hexForFaction(selectedArmyFaction)} fillOpacity="0.26" stroke={hexForFaction(selectedArmyFaction)} strokeWidth="3" strokeOpacity="0.9" strokeDasharray="8 7" />
                        )}
                        {region.contested && <path d={path} fill="#f97316" fillOpacity="0.18" stroke="#fed7aa" strokeWidth="2.6" strokeOpacity="0.85" strokeDasharray="10 5" />}
                        <path d={path} fill="none" stroke="#020617" strokeWidth="0.55" strokeOpacity="0.42" transform="translate(2 3)" />
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>

          <g className="pointer-events-none" opacity="0.1">
            {terrainContourPaths(bbox, project, 7).map((d, index) => (
              <path key={`surface-flow-${index}`} d={d} fill="none" stroke="#020617" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.35" />
            ))}
          </g>

          {/* Real terrain is rendered from OSM above. Keep gameplay overlays below. */}

          <g className="pointer-events-none">
            {(campaign.movementTrails ?? []).slice(0, 12).map((trail, index) => {
              const fromRegion = campaign.regions.find((region) => region.id === trail.fromRegionId);
              const toRegion = campaign.regions.find((region) => region.id === trail.toRegionId);
              const faction = factionFor(trail.factionId, campaign.factions);
              const d = curvedPathBetween(regionPoint(fromRegion, project), regionPoint(toRegion, project));
              if (!d) return null;
              return (
                <g key={trail.id} opacity={Math.max(0.22, 0.88 - index * 0.07)}>
                  <path d={d} fill="none" stroke="#020617" strokeWidth="9" strokeLinecap="round" strokeOpacity="0.45" />
                  <path d={d} fill="none" stroke={hexForFaction(faction)} strokeWidth="4" strokeLinecap="round" strokeOpacity="0.86" strokeDasharray="10 10" />
                  <path d={d} fill="none" stroke="#f8fafc" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.72" strokeDasharray="3 14" />
                </g>
              );
            })}
            {previewPath && (
              <g>
                <path d={previewPath} fill="none" stroke="#020617" strokeWidth="11" strokeLinecap="round" strokeOpacity="0.55" />
                <path d={previewPath} fill="none" stroke={hexForFaction(selectedArmyFaction)} strokeWidth="5" strokeLinecap="round" strokeOpacity="0.95" strokeDasharray="14 9" />
                <text x="500" y="36" textAnchor="middle" className="fill-cyan-100 text-[13px] font-black">Click target region to expand influence</text>
              </g>
            )}
          </g>

          {campaign.regions.map((region) => {
            const owner = ownerFor(region, campaign.factions);
            const [x, y] = labelPointForEntity(region.entity, project);
            const active = selectedRegionId === region.id;
            const armiesHere = campaign.armies.filter((army) => army.regionId === region.id);
            if (!visibleStrategicLabel(region, campaign, selectedRegionId)) return null;
            return (
              <g key={`label-${region.id}`} className="pointer-events-none">
                <rect x={x - 58} y={y - 24} width="116" height={owner ? 35 : 24} rx="12" fill="#020617" opacity={active ? 0.68 : 0.38} />
                <text x={x} y={y - 8} textAnchor="middle" className="fill-white text-[13px] font-black drop-shadow" opacity={active ? 1 : 0.86}>{region.name.length > 18 ? `${region.name.slice(0, 16)}…` : region.name}</text>
                {owner && <text x={x} y={y + 9} textAnchor="middle" className="fill-slate-100 text-[9px] font-bold" opacity="0.78">{owner.name} · {region.controlPercent ?? 0}%</text>}
                {active && <circle cx={x} cy={y + 25} r="4" fill="#fef3c7" opacity="0.9" />}
                {armiesHere.length > 0 && <text x={x} y={y + 29} textAnchor="middle" className="fill-amber-100 text-[10px] font-black">{armiesHere.length} army</text>}
              </g>
            );
          })}

          {campaign.regions.map((region) => {
            const owner = ownerFor(region, campaign.factions);
            if (!owner) return null;
            const [x, y] = labelPointForEntity(region.entity, project);
            return (
              <g key={`capital-${region.id}`} className="pointer-events-none">
                <circle cx={x} cy={y - 43} r="12" fill="#020617" stroke={hexForFaction(owner)} strokeWidth="2" opacity="0.94" />
                <text x={x} y={y - 38} textAnchor="middle" className="fill-amber-100 text-[12px] font-black">◆</text>
              </g>
            );
          })}

          {campaign.armies.map((army) => {
            const region = campaign.regions.find((item) => item.id === army.regionId);
            if (!region) return null;
            const faction = factionFor(army.factionId, campaign.factions);
            const lastRegion = campaign.regions.find((item) => item.id === army.lastRegionId);
            const [baseX, baseY] = interpolatePoint(
              lastRegion ? labelPointForEntity(lastRegion.entity, project) : labelPointForEntity(region.entity, project),
              labelPointForEntity(region.entity, project),
              army.progress ?? 1
            );
            const armyIndex = campaign.armies.filter((item) => item.regionId === army.regionId).findIndex((item) => item.id === army.id);
            const x = baseX + (armyIndex % 3) * 30 - 30;
            const y = baseY + 46 + Math.floor(armyIndex / 3) * 28;
            const active = selectedArmyId === army.id;
            const factionColor = hexForFaction(faction);
            return (
              <g key={army.id} className="cursor-pointer" onClick={(event) => { event.stopPropagation(); onSelectArmy(army.id, army.regionId); }} filter={active ? "url(#army-glow)" : undefined}>
                <line x1={x - 9} y1={y + 18} x2={x - 9} y2={y - 24} stroke="#f8fafc" strokeWidth="2.2" />
                <path d={`M${x - 8},${y - 23} L${x + 27},${y - 16} L${x - 8},${y - 8} Z`} fill={factionColor} stroke="#e0f2fe" strokeWidth={active ? 2.5 : 1.4} />
                <circle cx={x - 9} cy={y + 20} r={active ? 15 : 12} fill="#020617" stroke={factionColor} strokeWidth={active ? 4 : 2.3} />
                <text x={x - 9} y={y + 24} textAnchor="middle" className="fill-white text-[10px] font-black">{army.strength}</text>
                <path d={`M${x - 22},${y + 35} C${x - 6},${y + 28} ${x + 12},${y + 30} ${x + 26},${y + 22}`} fill="none" stroke={factionColor} strokeWidth="2" strokeOpacity="0.45" strokeDasharray="5 5" />
              </g>
            );
          })}

          {pendingConflicts.map((conflict) => {
            const region = campaign.regions.find((item) => item.id === conflict.toRegionId);
            if (!region) return null;
            const [x, y] = labelPointForEntity(region.entity, project);
            return (
              <g key={conflict.id} className="cursor-pointer" onClick={() => onSelectConflict(conflict)}>
                <circle cx={x} cy={y - 64} r="28" fill="#f97316" fillOpacity="0.16" stroke="#fed7aa" strokeWidth="1.5" />
                <circle cx={x} cy={y - 64} r="17" fill="#f59e0b" fillOpacity="0.9" stroke="#fef3c7" strokeWidth="2" />
                <text x={x} y={y - 58} textAnchor="middle" className="fill-slate-950 text-[18px] font-black">⚔</text>
              </g>
            );
          })}
        </svg>
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-300 shadow-xl backdrop-blur md:block">
          <div className="font-black uppercase tracking-[0.2em] text-cyan-200">3D theater renderer</div>
          <div className="mt-1 max-w-xs">A first-pass terrain LOD view: generated landforms, carved water, organic forests, borders, armies, and command objects share one playable world.</div>
        </div>
      </div>
    </section>
  );
}

export function CampaignStage({ battleRequest, onBack, onLaunchTactical }) {
  const baseCampaign = useMemo(() => createCampaignFromBattleRequest(battleRequest), [battleRequest]);
  const [campaign, setCampaign] = useState(baseCampaign);
  const [homeRegionId, setHomeRegionId] = useState(baseCampaign.selectedHomeRegionId);
  const [aiCount, setAiCount] = useState(baseCampaign.aiOpponentCount);
  const [selectedRegionId, setSelectedRegionId] = useState(baseCampaign.selectedHomeRegionId);
  const [selectedArmyId, setSelectedArmyId] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [hoverTargetId, setHoverTargetId] = useState(null);

  const selectedRegion = campaign.regions.find((region) => region.id === selectedRegionId) ?? campaign.regions[0];
  const selectedArmy = campaign.armies.find((army) => army.id === selectedArmyId) ?? null;
  const selectedTarget = campaign.regions.find((region) => region.id === selectedTargetId) ?? null;
  const selectedOwner = selectedRegion ? ownerFor(selectedRegion, campaign.factions) : null;
  const playerFaction = campaign.factions.find((faction) => faction.id === "player") ?? null;
  const maxAi = Math.max(0, campaign.regions.length - 1);
  const selectedRegionArmies = campaign.armies.filter((army) => army.regionId === selectedRegion?.id);
  const playerArmies = campaign.armies.filter((army) => army.factionId === "player");
  const pendingConflicts = campaign.conflicts.filter((c) => c.status === "pending");

  const startCampaign = () => {
    const next = initializeCampaignFactions(campaign, { homeRegionId, aiOpponentCount: aiCount });
    setCampaign(next);
    setSelectedRegionId(homeRegionId);
    const firstArmy = next.armies.find((army) => army.factionId === "player" && army.regionId === homeRegionId) ?? next.armies.find((army) => army.factionId === "player");
    setSelectedArmyId(firstArmy?.id ?? null);
    setSelectedTargetId(null);
  };

  const deployPlayerArmy = () => {
    if (!selectedRegion || selectedRegion.ownerId !== "player") return;
    const next = deployArmyToRegion(campaign, selectedRegion.id, "player");
    setCampaign(next);
    const newest = next.armies.filter((army) => army.factionId === "player" && army.regionId === selectedRegion.id).at(-1);
    setSelectedArmyId(newest?.id ?? selectedArmyId);
  };

  const issueMove = () => {
    const armyId = selectedArmy?.id;
    if (!armyId || !selectedTarget) return;
    const next = moveArmyToRegion(campaign, armyId, selectedTarget.id);
    setCampaign(next);
    setSelectedRegionId(selectedTarget.id);
    setSelectedTargetId(null);
  };

  const issueMapMove = (targetRegionId) => {
    if (!selectedArmy || selectedArmy.regionId === targetRegionId) {
      setSelectedRegionId(targetRegionId);
      const first = campaign.armies.find((army) => army.regionId === targetRegionId && army.factionId === "player");
      if (first) setSelectedArmyId(first.id);
      return;
    }
    const next = moveArmyToRegion(campaign, selectedArmy.id, targetRegionId);
    setCampaign(next);
    setSelectedRegionId(targetRegionId);
    setSelectedTargetId(null);
    setHoverTargetId(null);
  };

  const pulse = () => setCampaign((current) => simulateCampaignPulse(current));

  const autoResolve = (conflictId) => {
    setCampaign((current) => autoResolveConflict(current, conflictId));
  };

  const launchTactical = (conflict) => {
    const target = campaign.regions.find((region) => region.id === conflict.toRegionId);
    const entity = target?.entity ?? campaign.root;
    onLaunchTactical?.({
      lat: entity.lat ?? battleRequest.lat,
      lon: entity.lon ?? battleRequest.lon,
      sizeMeters: 1200,
      battleRequest: {
        ...battleRequest,
        initialView: "tactical-replica",
        launchType: "tactical",
        selectionType: entity.level,
        selectedName: entity.name,
        strategicConflict: conflict,
        strategicEntity: entity,
        scale: "neighborhood",
        mapWidthMeters: 800,
        mapDepthMeters: 1200,
        mapAspect: "operational"
      }
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        <aside className="max-h-[42vh] overflow-y-auto border-b border-slate-800 bg-slate-950/95 p-4 lg:h-full lg:max-h-none lg:w-[32%] lg:border-b-0 lg:border-r lg:p-6">
          <button className="mb-4 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:border-sky-400 hover:text-white" onClick={onBack}>← Globe Lobby</button>
          <div className="rounded-3xl border border-sky-500/25 bg-slate-900/80 p-5 shadow-2xl shadow-black/35">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-300">Living Campaign Prototype</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{campaign.root.name}</h1>
            <div className="mt-1 text-sm text-slate-400">{campaign.modeLabel} · {(battleRequest.playerMode ?? "sandbox").toUpperCase()} · {campaign.timeModel}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-slate-500">Playable {campaign.childLayer}</div><b>{campaign.regions.length}</b></div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-slate-500">Unit Scale</div><b>{campaign.unitScale}</b></div>
              <div className="col-span-2 rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-3"><div className="text-slate-500">Scale Rule</div><b>{campaign.playableScaleRule}</b></div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-slate-500">Victory</div><b>{campaign.victoryCondition}</b></div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-slate-500">Status</div><b>{campaign.status}</b></div>
            </div>
          </div>

          {campaign.worldEnginePlan && (
            <div className="mt-4 rounded-3xl border border-cyan-500/25 bg-cyan-950/15 p-5 shadow-xl shadow-black/20">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">{campaign.worldEnginePlan.version}</div>
              <div className="mt-2 text-sm leading-relaxed text-slate-300">{campaign.worldEnginePlan.tagline}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-slate-500">Current LOD</div><b>{campaign.worldEnginePlan.currentLod?.label}</b></div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-slate-500">Next Detail</div><b>{campaign.worldEnginePlan.detailLod?.label}</b></div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-slate-500">Region Density</div><b>{campaign.worldEnginePlan.regionDensity?.label}</b></div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-slate-500">Target Regions</div><b>{campaign.worldEnginePlan.regionDensity?.target}</b></div>
              </div>
              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Scale-aware assets</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(campaign.worldEnginePlan.scaleAssets ?? []).slice(0, 8).map((asset) => <span key={asset} className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-slate-300">{asset}</span>)}
                </div>
              </div>
            </div>
          )}

          {campaign.status === "setup" ? (
            <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/75 p-5">
              <div className="text-sm font-black text-white">Setup</div>
              <label className="mt-4 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Home {campaign.childLayer.replace(/s$/, "")}</label>
              <select className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" value={homeRegionId ?? ""} onChange={(event) => { setHomeRegionId(event.target.value); setSelectedRegionId(event.target.value); }}>
                {campaign.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>

              <label className="mt-4 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">AI Opponents</label>
              <input className="mt-2 w-full" type="range" min="0" max={maxAi} value={aiCount} onChange={(event) => setAiCount(Number(event.target.value))} />
              <div className="mt-1 text-sm font-bold text-slate-200">{aiCount} AI opponent{aiCount === 1 ? "" : "s"}</div>
              <button className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500" onClick={startCampaign}>Generate Campaign</button>
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/75 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-white">Selected Region</div>
                    <div className="mt-2 text-2xl font-black">{selectedRegion?.name ?? "None"}</div>
                    <div className="mt-1 text-sm text-slate-400">Owner: {ownerLabel(selectedOwner)} · Control: {selectedRegion?.controlPercent ?? 0}%</div>
                  </div>
                  {selectedRegion?.contested && <div className="rounded-full border border-amber-400/50 bg-amber-950/50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-100">contested</div>}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-slate-500"><span>Influence</span><span>{selectedRegion?.supplyConnected ? "Supply linked" : "No supply"}</span></div>
                  <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-800">
                    {influenceSegments(selectedRegion ?? {}, campaign.factions).map((segment) => <div key={segment.key} className={`${segment.color}`} style={{ width: `${segment.value}%` }} title={`${segment.label}: ${segment.value}%`} />)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {influenceSegments(selectedRegion ?? {}, campaign.factions).map((segment) => <span key={segment.key}>{segment.label} {segment.value}%</span>)}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="flex-1 rounded-xl border border-sky-400/40 px-3 py-2 text-xs font-black text-sky-100 hover:bg-sky-500/20 disabled:opacity-40" disabled={selectedRegion?.ownerId !== "player"} onClick={deployPlayerArmy}>Deploy Army</button>
                  <button className="flex-1 rounded-xl border border-emerald-400/40 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/20" onClick={pulse}>Advance Pulse</button>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/75 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-white">Command Tree</div>
                  <div className="text-xs text-slate-500">{playerArmies.length} units</div>
                </div>
                <div className="mt-3 space-y-2">
                  {playerArmies.length === 0 && <div className="rounded-xl border border-dashed border-slate-800 p-3 text-sm text-slate-500">No player armies deployed.</div>}
                  {playerArmies.map((army) => {
                    const region = campaign.regions.find((item) => item.id === army.regionId);
                    const active = selectedArmy?.id === army.id;
                    return (
                      <button key={army.id} className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-sky-300 bg-sky-500/20" : "border-slate-800 bg-slate-950/60 hover:border-sky-500/50"}`} onClick={() => { setSelectedArmyId(army.id); setSelectedRegionId(army.regionId); }}>
                        <div className="flex items-center justify-between gap-3">
                          <b className="text-sm text-white">{army.name}</b>
                          <span className="rounded-full bg-black/30 px-2 py-1 text-[10px] font-black">{army.strength}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{region?.name ?? "Unknown"} · {army.order} · morale {army.morale}%</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/75 p-5">
                <div className="text-sm font-black text-white">Selected Unit Orders</div>
                <div className="mt-2 text-lg font-black text-white">{selectedArmy?.name ?? "No army selected"}</div>
                {selectedArmy && <div className="mt-1 text-sm text-slate-400">Strength {selectedArmy.strength} · Supply {selectedArmy.supply}% · Status {selectedArmy.status} · Order {selectedArmy.order}</div>}
                <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-3 text-xs text-cyan-100">
                  <b>Map command:</b> select an army banner, hover a region to preview influence, then click the destination region to move, expand, or attack.
                </div>
                <details className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.18em] text-slate-400">Fallback order selector</summary>
                  <select className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" value={selectedTargetId ?? ""} onChange={(event) => setSelectedTargetId(event.target.value)}>
                    <option value="">Select region</option>
                    {campaign.regions.filter((region) => region.id !== selectedArmy?.regionId).slice(0, 40).map((region) => <option key={region.id} value={region.id}>{region.name} · {ownerLabel(ownerFor(region, campaign.factions))}</option>)}
                  </select>
                  <button className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white hover:bg-sky-500 disabled:opacity-40" disabled={!selectedTargetId || !selectedArmy} onClick={issueMove}>Issue Order</button>
                </details>
              </div>
            </>
          )}
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),transparent_42%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-3 lg:p-6">
          <div className="mb-3 shrink-0 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Generated Strategic Board</div>
              <h2 className="text-2xl font-black text-white">{campaign.root.name} Theater</h2>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">D75: scale rules separate navigation from playable entities. World Risk uses countries; continent campaigns use countries; country campaigns use regions. Theater renderer stays scale-aware.</div>
          </div>

          <StrategicCampaignMap
            campaign={campaign}
            selectedRegionId={selectedRegion?.id}
            selectedArmyId={selectedArmy?.id}
            hoverTargetId={hoverTargetId}
            onHoverTarget={setHoverTargetId}
            onSelectRegion={issueMapMove}
            onSelectArmy={(armyId, regionId) => {
              setSelectedArmyId(armyId);
              setSelectedRegionId(regionId);
            }}
            onSelectConflict={(conflict) => {
              setSelectedRegionId(conflict.toRegionId);
              setSelectedArmyId(conflict.armyId);
            }}
          />

          <div className="shrink-0 overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/35 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-white">Region Command Cards</div>
              <div className="text-xs text-slate-500">Secondary command list for quick region selection.</div>
            </div>
          </div>
          <div className="grid max-h-[24rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {campaign.regions.map((region) => {
              const owner = ownerFor(region, campaign.factions);
              const active = selectedRegion?.id === region.id;
              const armiesHere = campaign.armies.filter((army) => army.regionId === region.id);
              return (
                <button key={region.id} className={`min-h-[10rem] rounded-2xl border p-3 text-left shadow-lg shadow-black/20 transition hover:scale-[1.01] ${colorClasses(owner?.color, active)}`} onClick={() => { setSelectedRegionId(region.id); const first = campaign.armies.find((army) => army.regionId === region.id && army.factionId === "player"); if (first) setSelectedArmyId(first.id); }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-black">{region.name}</div>
                    <div className="rounded-full bg-black/30 px-2 py-1 text-[10px] font-black">{armiesHere.reduce((sum, army) => sum + army.strength, 0) || region.armyStrength}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] opacity-80"><span>{ownerLabel(owner)}</span>{region.contested && <span className="text-amber-200">contested</span>}</div>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-black/30">
                    {influenceSegments(region, campaign.factions).map((segment) => <div key={segment.key} className={`${segment.color}`} style={{ width: `${segment.value}%` }} />)}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="rounded-lg bg-black/25 p-2"><span className="opacity-60">Income</span><br /><b>{region.income}</b></div>
                    <div className="rounded-lg bg-black/25 p-2"><span className="opacity-60">POIs</span><br /><b>{region.poiCount}</b></div>
                    <div className="rounded-lg bg-black/25 p-2"><span className="opacity-60">Units</span><br /><b>{armiesHere.length}</b></div>
                  </div>
                </button>
              );
            })}
          </div>
          </div>

          <div className="mt-3 grid shrink-0 gap-4 pr-1 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">Active Confrontations</div>
                  <div className="text-xs text-slate-500">Auto-resolve or launch a tactical battle from a contested region.</div>
                </div>
                <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-400">{pendingConflicts.length} pending</div>
              </div>
              <div className="mt-4 space-y-3">
                {campaign.conflicts.length === 0 && <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">No confrontations yet. Deploy or select an army, then move into neutral or enemy influence.</div>}
                {campaign.conflicts.map((conflict) => (
                  <div key={conflict.id} className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <div className="font-black text-amber-100">⚔ {conflict.name}</div>
                        <div className="text-xs text-amber-200/70">Attacker win estimate: {conflict.estimatedAttackerWin}% · Intensity {conflict.intensity} · Status: {conflict.status}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-xl border border-amber-400/50 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-500/20" onClick={() => autoResolve(conflict.id)}>Auto-resolve</button>
                        <button className="rounded-xl border border-sky-400/50 px-3 py-2 text-xs font-black text-sky-100 hover:bg-sky-500/20" onClick={() => launchTactical(conflict)}>Zoom to tactical</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">World Event Log</div>
                  <div className="text-xs text-slate-500">Clickable command history will eventually center entities and conflicts.</div>
                </div>
                <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-400">{campaign.events.length}</div>
              </div>
              <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {campaign.events.map((event) => (
                  <button key={event.id} className={`w-full rounded-xl border p-3 text-left text-xs ${eventTone(event)}`} onClick={() => { if (event.entityId && campaign.regions.some((r) => r.id === event.entityId)) setSelectedRegionId(event.entityId); }}>
                    <div className="flex items-center justify-between gap-3"><b className="uppercase tracking-wider">{event.type}</b><span className="text-[10px] opacity-60">{event.time}</span></div>
                    <div className="mt-1 opacity-90">{event.message}</div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
