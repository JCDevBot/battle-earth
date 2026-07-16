import * as THREE from "three";

const ROLE_STYLE = {
  civilian: { color: 0x94a3b8, label: "C", name: "Civilian" },
  tactical: { color: 0xfacc15, label: "T", name: "Tactical" },
  military: { color: 0xfb7185, label: "M", name: "Military" },
  infrastructure: { color: 0xa78bfa, label: "I", name: "Infrastructure" }
};

const CIVILIAN_TAGS = new Set(["yes", "house", "residential", "detached", "semidetached_house", "apartments", "hut", "shed", "barn", "garage", "farm", "farm_auxiliary"]);
const TACTICAL_TAGS = new Set(["warehouse", "commercial", "retail", "school", "university", "college", "hospital", "public", "civic", "government", "townhall", "industrial"]);
const INFRA_TAGS = new Set(["bridge", "power", "substation", "service", "transportation", "train_station", "water_works", "wastewater_plant", "pumping_station", "storage_tank"]);
const MILITARY_TAGS = new Set(["military", "bunker", "barracks", "guardhouse", "checkpoint"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function polygonCenter(points) {
  return points.reduce((sum, point) => sum.add(point), new THREE.Vector2()).divideScalar(Math.max(1, points.length));
}

function areaOf(points) {
  return Math.abs(THREE.ShapeUtils.area(points));
}

function boundsFor(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...ys), maxZ: Math.max(...ys) };
}

function nearestPoi(center, pois) {
  let best = null;
  let bestDist = Infinity;
  for (const poi of pois) {
    const p = poi.position ?? poi.center;
    if (!p) continue;
    const px = p.x ?? 0;
    const pz = p.z ?? p.y ?? 0;
    const d = Math.hypot(center.x - px, center.y - pz);
    if (d < bestDist) {
      bestDist = d;
      best = poi;
    }
  }
  return best ? { poi: best, distance: bestDist } : null;
}

function classifyBuilding(building, nearest) {
  const tags = building.tags ?? {};
  const buildingTag = String(tags.building ?? tags.amenity ?? tags.man_made ?? tags.power ?? "yes").toLowerCase();
  const profileKind = String(building.profile?.kind ?? "").toLowerCase();
  const archetype = String(nearest?.poi?.archetype ?? "").toLowerCase();
  const closeToMajorPoi = nearest && nearest.distance < 90 && ["hq", "logistics", "strategic_crossing", "infrastructure"].includes(archetype);

  let role = "civilian";
  if (MILITARY_TAGS.has(buildingTag) || archetype === "hq") role = "military";
  else if (INFRA_TAGS.has(buildingTag) || tags.power || tags.man_made || archetype === "infrastructure" || archetype === "strategic_crossing") role = "infrastructure";
  else if (TACTICAL_TAGS.has(buildingTag) || profileKind === "industrial" || building.area > 900 || closeToMajorPoi) role = "tactical";
  else if (CIVILIAN_TAGS.has(buildingTag)) role = "civilian";

  const height = building.profile?.height ?? 6;
  const heightClass = height >= 15 ? "tall" : height >= 9 ? "medium" : "low";
  const baseCover = role === "military" ? 92 : role === "tactical" ? 76 : role === "infrastructure" ? 68 : 38;
  const coverValue = Math.round(clamp(baseCover + Math.sqrt(building.area) * 0.45 + (height >= 9 ? 8 : 0), 15, 100));
  const strategicValue = Math.round(clamp((nearest?.poi?.strategicValue ?? 0) * (nearest?.distance < 110 ? 0.35 : 0.08) + coverValue * 0.45, 5, 100));
  const garrisonCapacity = role === "civilian" ? Math.round(clamp(building.area / 130, 0, 6)) : Math.round(clamp(building.area / 95, 2, 14));
  return {
    buildingType: buildingTag,
    role,
    owner: nearest?.poi?.ownership ?? "neutral",
    coverValue,
    strategicValue,
    garrisonCapacity,
    heightClass,
    isHardened: role === "military" || (nearest?.distance ?? Infinity) < 55,
    isDestroyed: false,
    linkedPOIId: nearest?.distance < 125 ? nearest.poi.id : null,
    linkedPOILabel: nearest?.distance < 125 ? nearest.poi.label : null
  };
}

function edgeData(points) {
  const edges = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    edges.push({ a, b, length: a.distanceTo(b), midpoint: new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2) });
  }
  return edges.sort((a, b) => b.length - a.length);
}

function makeRectangle(center, width, depth, rotation = 0) {
  const hw = width / 2;
  const hd = depth / 2;
  const raw = [new THREE.Vector2(-hw, -hd), new THREE.Vector2(hw, -hd), new THREE.Vector2(hw, hd), new THREE.Vector2(-hw, hd)];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return raw.map((p) => new THREE.Vector2(center.x + p.x * cos - p.y * sin, center.y + p.x * sin + p.y * cos));
}

export class TacticalBuildingManager {
  constructor(scene, { onStats } = {}) {
    this.scene = scene;
    this.callbacks = { onStats };
    this.group = new THREE.Group();
    this.group.name = "tactical-buildings";
    this.scene.add(this.group);
    this.visible = true;
    this.buildings = [];
    this.materials = [];
    this.geometries = [];
    this.labelTextures = [];
  }

  clear() {
    this.group.clear();
    for (const material of this.materials) material.dispose?.();
    for (const geometry of this.geometries) geometry.dispose?.();
    for (const texture of this.labelTextures) texture.dispose?.();
    this.materials = [];
    this.geometries = [];
    this.labelTextures = [];
    this.buildings = [];
    this.emitStats();
  }

  dispose() {
    this.clear();
    this.scene?.remove?.(this.group);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.group.visible = this.visible;
    this.emitStats();
  }

  build({ builder, pois = [], terrain }) {
    this.clear();
    const allPois = pois.filter(Boolean);
    const sourceBuildings = [...(builder?.buildingBoxes ?? [])];
    const existing = sourceBuildings.map((building, index) => this.makeTacticalBuilding(building, index, allPois, terrain, false));
    const compound = this.generatePoiCompoundBuildings(existing, allPois, terrain);
    this.buildings = [...existing, ...compound];
    for (const building of this.buildings) this.drawBuildingOverlay(building, terrain);
    this.group.visible = this.visible;
    this.emitStats();
  }

  makeTacticalBuilding(building, index, pois, terrain, procedural = false) {
    const points = building.points;
    const center = building.center ?? polygonCenter(points);
    const area = building.area ?? areaOf(points);
    const nearest = nearestPoi(center, pois);
    const tactical = building.tacticalMetadata ?? classifyBuilding({ ...building, area }, nearest);
    const edges = edgeData(points);
    const coverEdges = edges.slice(0, Math.min(4, edges.length)).map((edge) => ({ x1: edge.a.x, z1: edge.a.y, x2: edge.b.x, z2: edge.b.y, value: tactical.coverValue }));
    const entrances = edges.slice(-Math.min(2, edges.length)).map((edge) => ({ x: edge.midpoint.x, z: edge.midpoint.y }));
    const garrisonPoints = this.makeGarrisonPoints(center, tactical.garrisonCapacity, terrain);
    return {
      id: procedural ? building.id : `tactical-building:${index}`,
      source: procedural ? "poi-compound" : "osm-building",
      points,
      center,
      area,
      terrainH: terrain?.getWorldHeight?.(center.x, center.y) ?? 0,
      tags: building.tags ?? {},
      profile: building.profile ?? { height: 4, kind: "compound", roofShape: "flat" },
      tactical,
      entrances,
      coverEdges,
      losBlockers: coverEdges,
      garrisonPoints
    };
  }

  makeGarrisonPoints(center, capacity, terrain) {
    const count = clamp(Math.min(capacity, 6), 0, 6);
    const points = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const r = 2.5 + (i % 2) * 1.5;
      const x = center.x + Math.cos(angle) * r;
      const z = center.y + Math.sin(angle) * r;
      points.push({ x, z, y: (terrain?.getWorldHeight?.(x, z) ?? 0) + 0.65 });
    }
    return points;
  }

  generatePoiCompoundBuildings(existing, pois, terrain) {
    const generated = [];
    const tacticalPois = pois.filter((poi) => ["hq", "logistics", "strategic_crossing", "infrastructure", "transport", "observation"].includes(poi.archetype));
    for (const poi of tacticalPois.slice(0, 12)) {
      const p = poi.position ?? poi.center;
      if (!p) continue;
      const center = new THREE.Vector2(p.x ?? 0, p.z ?? p.y ?? 0);
      const nearby = existing.filter((b) => b.center.distanceTo(center) < 95).length;
      if (nearby >= 2 && poi.archetype !== "hq") continue;
      const specs = this.compoundSpecsForPoi(poi);
      specs.forEach((spec, i) => {
        const offset = new THREE.Vector2(spec.dx, spec.dz);
        const c = center.clone().add(offset);
        const points = makeRectangle(c, spec.w, spec.d, spec.rot ?? 0);
        const h = terrain?.getWorldHeight?.(c.x, c.y) ?? 0;
        const building = {
          id: `compound:${poi.id}:${i}`,
          points,
          center: c,
          area: areaOf(points),
          terrainH: h,
          tags: { building: spec.type, generated: "poi-compound" },
          profile: { height: spec.height, kind: spec.type, roofShape: "flat" },
          tacticalMetadata: {
            buildingType: spec.type,
            role: spec.role,
            owner: poi.ownership ?? "neutral",
            coverValue: spec.coverValue,
            strategicValue: Math.round(clamp((poi.strategicValue ?? 55) * spec.valueScale, 25, 100)),
            garrisonCapacity: spec.capacity,
            heightClass: spec.height >= 10 ? "medium" : "low",
            isHardened: spec.role === "military" || poi.archetype === "hq",
            isDestroyed: false,
            linkedPOIId: poi.id,
            linkedPOILabel: poi.label
          }
        };
        generated.push(this.makeTacticalBuilding(building, generated.length, [poi], terrain, true));
      });
    }
    return generated;
  }

  compoundSpecsForPoi(poi) {
    if (poi.archetype === "hq") return [
      { type: "command_post", role: "military", dx: 0, dz: 0, w: 28, d: 18, height: 8, coverValue: 92, valueScale: 0.95, capacity: 10 },
      { type: "checkpoint", role: "military", dx: -34, dz: 20, w: 14, d: 10, height: 5, coverValue: 88, valueScale: 0.55, capacity: 4 },
      { type: "depot", role: "tactical", dx: 32, dz: -18, w: 24, d: 14, height: 6, coverValue: 78, valueScale: 0.6, capacity: 6 }
    ];
    if (poi.archetype === "logistics") return [
      { type: "warehouse", role: "tactical", dx: 0, dz: 0, w: 34, d: 22, height: 8, coverValue: 82, valueScale: 0.85, capacity: 8 },
      { type: "storage_yard", role: "infrastructure", dx: 34, dz: 18, w: 22, d: 14, height: 4, coverValue: 58, valueScale: 0.45, capacity: 2 }
    ];
    if (poi.archetype === "strategic_crossing") return [
      { type: "bridge_control", role: "infrastructure", dx: 0, dz: 0, w: 18, d: 12, height: 6, coverValue: 74, valueScale: 0.8, capacity: 5 },
      { type: "checkpoint", role: "military", dx: 26, dz: -16, w: 16, d: 10, height: 5, coverValue: 86, valueScale: 0.55, capacity: 4 }
    ];
    if (poi.archetype === "infrastructure") return [
      { type: "substation", role: "infrastructure", dx: 0, dz: 0, w: 24, d: 18, height: 5, coverValue: 64, valueScale: 0.8, capacity: 3 },
      { type: "utility_house", role: "infrastructure", dx: -28, dz: 12, w: 14, d: 10, height: 4, coverValue: 56, valueScale: 0.4, capacity: 2 }
    ];
    if (poi.archetype === "observation") return [
      { type: "observation_post", role: "military", dx: 0, dz: 0, w: 14, d: 10, height: 9, coverValue: 82, valueScale: 0.75, capacity: 3 }
    ];
    return [
      { type: "road_facility", role: "infrastructure", dx: 0, dz: 0, w: 18, d: 12, height: 5, coverValue: 58, valueScale: 0.45, capacity: 2 }
    ];
  }

  drawBuildingOverlay(building, terrain) {
    const style = ROLE_STYLE[building.tactical.role] ?? ROLE_STYLE.civilian;
    const y = (building.terrainH ?? 0) + 0.28;
    const outlineMat = new THREE.LineBasicMaterial({ color: style.color, transparent: true, opacity: building.tactical.role === "civilian" ? 0.55 : 0.95, depthWrite: false });
    const outlineGeo = new THREE.BufferGeometry().setFromPoints([...building.points, building.points[0]].map((p) => new THREE.Vector3(p.x, y, p.y)));
    this.materials.push(outlineMat);
    this.geometries.push(outlineGeo);
    const outline = new THREE.Line(outlineGeo, outlineMat);
    outline.userData = { feature: "tactical-building-outline", buildingId: building.id, role: building.tactical.role };
    this.group.add(outline);

    if (building.source === "poi-compound") this.drawCompoundBlock(building, style, terrain);
    if (building.tactical.role !== "civilian" || building.tactical.strategicValue >= 42) this.drawRoleLabel(building, style);
    this.drawEntrances(building, style);
    this.drawGarrisonPoints(building, style);
  }

  drawCompoundBlock(building, style, terrain) {
    const shape = new THREE.Shape(building.points);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: building.profile.height, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.9, transparent: true, opacity: 0.62 });
    this.geometries.push(geo);
    this.materials.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = (building.terrainH ?? 0) + building.profile.height;
    mesh.userData = { feature: "poi-compound-building", tactical: building.tactical };
    this.group.add(mesh);
  }

  drawRoleLabel(building, style) {
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(2,6,23,0.82)";
    ctx.strokeStyle = `#${style.color.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, 164, 76, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 28px system-ui, sans-serif";
    ctx.fillText(`${style.label}${building.tactical.coverValue}`, 20, 42);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillText(`G:${building.tactical.garrisonCapacity} V:${building.tactical.strategicValue}`, 20, 66);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.labelTextures.push(texture);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
    this.materials.push(material);
    const sprite = new THREE.Sprite(material);
    sprite.position.set(building.center.x, (building.terrainH ?? 0) + (building.profile?.height ?? 6) + 8, building.center.y);
    sprite.scale.set(18, 9.6, 1);
    sprite.userData = { feature: "tactical-building-label", buildingId: building.id };
    this.group.add(sprite);
  }

  drawEntrances(building, style) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    this.materials.push(mat);
    const geo = new THREE.RingGeometry(0.9, 1.5, 12);
    this.geometries.push(geo);
    for (const entrance of building.entrances) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(entrance.x, (building.terrainH ?? 0) + 0.45, entrance.z);
      mesh.rotateX(-Math.PI / 2);
      mesh.userData = { feature: "building-entrance", buildingId: building.id, role: style.name };
      this.group.add(mesh);
    }
  }

  drawGarrisonPoints(building, style) {
    if (!building.garrisonPoints.length) return;
    const mat = new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.9, depthWrite: false });
    const geo = new THREE.CircleGeometry(0.9, 10);
    this.materials.push(mat);
    this.geometries.push(geo);
    for (const point of building.garrisonPoints) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(point.x, point.y, point.z);
      mesh.rotateX(-Math.PI / 2);
      mesh.userData = { feature: "garrison-point", buildingId: building.id };
      this.group.add(mesh);
    }
  }

  getStats() {
    const byRole = { civilian: 0, tactical: 0, military: 0, infrastructure: 0 };
    let garrisonCapacity = 0;
    let coverTotal = 0;
    let linked = 0;
    let generated = 0;
    for (const building of this.buildings) {
      byRole[building.tactical.role] = (byRole[building.tactical.role] ?? 0) + 1;
      garrisonCapacity += building.tactical.garrisonCapacity ?? 0;
      coverTotal += building.tactical.coverValue ?? 0;
      if (building.tactical.linkedPOIId) linked += 1;
      if (building.source === "poi-compound") generated += 1;
    }
    const top = [...this.buildings]
      .sort((a, b) => (b.tactical.strategicValue ?? 0) - (a.tactical.strategicValue ?? 0))
      .slice(0, 8)
      .map((b) => ({
        id: b.id,
        role: b.tactical.role,
        type: b.tactical.buildingType,
        coverValue: b.tactical.coverValue,
        strategicValue: b.tactical.strategicValue,
        garrisonCapacity: b.tactical.garrisonCapacity,
        linkedPOI: b.tactical.linkedPOILabel ?? "none"
      }));
    return {
      enabled: this.visible,
      total: this.buildings.length,
      byRole,
      generatedCompounds: generated,
      poiLinked: linked,
      garrisonCapacity,
      averageCover: this.buildings.length ? Math.round(coverTotal / this.buildings.length) : 0,
      top
    };
  }

  emitStats() {
    this.callbacks.onStats?.(this.getStats());
  }
}
