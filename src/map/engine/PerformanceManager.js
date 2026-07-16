import * as THREE from "three";

const DEFAULT_LAYER_VISIBILITY = {
  terrain: true,
  roads: true,
  buildings: true,
  vegetation: true,
  water: true,
  props: true,
  tactical: false,
  "tactical-buildings": false,
  "classification-debug": false,
  units: true,
  fog: false,
  territory: false,
  "battlefield-grid": false,
  "strategic-pois": false,
  "influence-rings": false,
  frontline: false,
  "objective-hierarchy": false
};

const LOD_DISTANCE_BY_LAYER = {
  terrain: Infinity,
  roads: 1900,
  buildings: 1250,
  vegetation: 620,
  water: 2400,
  tactical: 1000,
  "tactical-buildings": Infinity,
  "classification-debug": Infinity,
  props: 520,
  units: 1400,
  fog: Infinity,
  territory: Infinity,
  "battlefield-grid": Infinity,
  "strategic-pois": Infinity,
  "influence-rings": Infinity,
  frontline: Infinity,
  "objective-hierarchy": Infinity
};

const HIGH_ALTITUDE_LAYER_CUTOFF = {
  props: 520,
  vegetation: 760,
  tactical: 900
};

const LAYER_PRIORITY = {
  terrain: 0,
  water: 1,
  roads: 2,
  buildings: 3,
  vegetation: 4,
  tactical: 5,
  "tactical-buildings": 5,
  "classification-debug": 6,
  props: 7,
  units: 7,
  territory: 8,
  "battlefield-grid": 8,
  "strategic-pois": 8,
  "influence-rings": 8,
  frontline: 8,
  "objective-hierarchy": 8,
  fog: 9
};

function classifyObject(object) {
  // D33: honor explicit layers from builders first. Broad OSM ingestion means
  // many physical ground-classification meshes have feature names that used
  // to fall through to props. Props should now mean true decorative/interactive
  // objects only, not parks/grass/landcover polygons.
  if (object.userData?.layer) return object.userData.layer;
  const feature = String(object.userData?.feature ?? "");
  if (feature.includes("territory")) return "territory";
  if (feature.includes("frontline")) return "frontline";
  if (feature.includes("battlefield-grid")) return "battlefield-grid";
  if (feature.includes("strategic-poi")) return "strategic-pois";
  if (feature.includes("influence-ring")) return "influence-rings";
  if (feature.includes("unit-")) return "units";
  if (feature.includes("prop-")) return "props";
  if (feature.includes("building")) return "buildings";
  if (feature.includes("tree") || feature.includes("forest") || feature.includes("park") || feature.includes("scrub") || feature.includes("wetland") || feature.includes("canopy")) return "vegetation";
  if (feature.includes("water") || feature.includes("shore") || feature.includes("wet-bank")) return "water";
  if (feature.includes("road") || feature.includes("sidewalk") || feature.includes("intersection") || feature.includes("rail")) return "roads";
  // D32: physical OSM infrastructure should not disappear when the Tactical Overlay is off.
  // Only tactical-overlay/debug meshes belong to the tactical layer.
  if (feature.includes("tactical-overlay") || feature.includes("unit-tactical")) return "tactical";
  if (feature.includes("barrier") || feature === "tactical") return "props";
  return "props";
}

function objectCenterAndRadius(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    const p = object.position?.clone?.() ?? new THREE.Vector3();
    return { center: p, radius: 0 };
  }
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(1, box.getSize(new THREE.Vector3()).length() * 0.5);
  return { center, radius };
}

function countRenderableStats(object) {
  const stats = { renderables: 0, geometries: 0, instanced: 0 };
  object.traverse?.((child) => {
    if (!child.isMesh && !child.isInstancedMesh) return;
    stats.renderables += 1;
    stats.geometries += child.geometry ? 1 : 0;
    if (child.isInstancedMesh) stats.instanced += child.count ?? 0;
  });
  if ((object.isMesh || object.isInstancedMesh) && !object.children?.length) {
    stats.renderables = Math.max(stats.renderables, 1);
    stats.geometries = Math.max(stats.geometries, object.geometry ? 1 : 0);
    if (object.isInstancedMesh) stats.instanced += object.count ?? 0;
  }
  return stats;
}

function ensureLayerBreakdown(layerBreakdown, layer) {
  if (!layerBreakdown[layer]) {
    layerBreakdown[layer] = {
      tracked: 0,
      visible: 0,
      hidden: 0,
      hiddenByLayer: 0,
      hiddenByLod: 0,
      hiddenByAltitude: 0,
      renderables: 0,
      geometries: 0,
      estimatedDrawCalls: 0,
      instancedItems: 0
    };
  }
  return layerBreakdown[layer];
}

export class PerformanceManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.layerVisibility = { ...DEFAULT_LAYER_VISIBILITY };
    this.entries = [];
    this.chunkSize = 250;
    this.chunks = new Map();
    this.lastUpdateAt = 0;
    this.updateIntervalMs = 180;
    this.stats = {
      chunks: 0,
      trackedObjects: 0,
      visibleObjects: 0,
      hiddenByLod: 0,
      hiddenByLayer: 0,
      hiddenByAltitude: 0,
      layerVisibility: { ...this.layerVisibility },
      layerBreakdown: {}
    };
  }

  clear() {
    this.entries = [];
    this.chunks.clear();
    this.emitStats();
  }

  indexBuilder(builder, terrain) {
    this.clear();

    if (terrain?.mesh) {
      this.addEntry(terrain.mesh, "terrain");
    }

    for (const child of builder?.group?.children ?? []) {
      this.addEntry(child, classifyObject(child));
    }

    if (builder?.buildingLOD?.group) {
      this.addEntry(builder.buildingLOD.group, "buildings");
    }

    for (const child of builder?.vegGroup?.children ?? []) {
      this.addEntry(child, "vegetation");
    }

    this.stats.chunks = this.chunks.size;
    this.stats.trackedObjects = this.entries.length;
    this.sortEntriesForCulling();
    this.applyLayerVisibility();
    this.emitStats();
  }


  removeLayerEntries(layer) {
    this.entries = this.entries.filter((entry) => entry.layer !== layer);
    this.chunks.clear();
    for (const entry of this.entries) {
      if (!this.chunks.has(entry.chunkKey)) this.chunks.set(entry.chunkKey, []);
      this.chunks.get(entry.chunkKey).push(entry);
    }
    this.stats.chunks = this.chunks.size;
    this.stats.trackedObjects = this.entries.length;
    this.applyLayerVisibility();
    this.emitStats();
  }

  addEntry(object, layer) {
    const { center, radius } = objectCenterAndRadius(object);
    const chunkKey = `${Math.floor(center.x / this.chunkSize)}:${Math.floor(center.z / this.chunkSize)}`;
    const entry = {
      object,
      layer,
      center,
      radius,
      chunkKey,
      baseVisible: object.visible !== false,
      renderStats: countRenderableStats(object)
    };

    object.userData.perfLayer = layer;
    object.userData.chunkKey = chunkKey;
    object.userData.lodRadius = radius;

    this.entries.push(entry);
    if (!this.chunks.has(chunkKey)) this.chunks.set(chunkKey, []);
    this.chunks.get(chunkKey).push(entry);
  }

  sortEntriesForCulling() {
    this.entries.sort((a, b) => (LAYER_PRIORITY[a.layer] ?? 99) - (LAYER_PRIORITY[b.layer] ?? 99));
  }

  setLayerVisible(layer, visible) {
    if (!(layer in this.layerVisibility)) return;
    this.layerVisibility[layer] = visible;
    this.applyLayerVisibility();
    this.emitStats();
  }

  toggleLayer(layer) {
    this.setLayerVisible(layer, !this.layerVisibility[layer]);
  }

  applyLayerVisibility() {
    let visibleObjects = 0;
    let hiddenByLayer = 0;
    const layerBreakdown = {};

    for (const entry of this.entries) {
      const layerStats = ensureLayerBreakdown(layerBreakdown, entry.layer);
      layerStats.tracked++;
      layerStats.renderables += entry.renderStats.renderables;
      layerStats.geometries += entry.renderStats.geometries;
      layerStats.estimatedDrawCalls += entry.renderStats.renderables;
      layerStats.instancedItems += entry.renderStats.instanced;

      const visible = entry.baseVisible && this.layerVisibility[entry.layer] !== false;
      entry.object.visible = visible;
      if (visible) {
        visibleObjects++;
        layerStats.visible++;
      } else {
        hiddenByLayer++;
        layerStats.hidden++;
      }
    }

    this.stats.visibleObjects = visibleObjects;
    this.stats.hiddenByLayer = hiddenByLayer;
    this.stats.layerVisibility = { ...this.layerVisibility };
    this.stats.layerBreakdown = layerBreakdown;
  }

  update(camera, now = performance.now()) {
    if (!camera || now - this.lastUpdateAt < this.updateIntervalMs) return;
    this.lastUpdateAt = now;

    let visibleObjects = 0;
    let hiddenByLayer = 0;
    const layerBreakdown = {};

    for (const entry of this.entries) {
      const layerStats = ensureLayerBreakdown(layerBreakdown, entry.layer);
      layerStats.tracked++;
      layerStats.renderables += entry.renderStats.renderables;
      layerStats.geometries += entry.renderStats.geometries;
      layerStats.estimatedDrawCalls += entry.renderStats.renderables;
      layerStats.instancedItems += entry.renderStats.instanced;

      if (!entry.baseVisible || this.layerVisibility[entry.layer] === false) {
        entry.object.visible = false;
        hiddenByLayer++;
        layerStats.hiddenByLayer++;
        continue;
      }

      const cameraX = camera.position?.x ?? 0;
      const cameraZ = camera.position?.z ?? 0;
      const dx = entry.center.x - cameraX;
      const dz = entry.center.z - cameraZ;
      const distance = Math.max(0, Math.sqrt(dx * dx + dz * dz) - entry.radius);
      const maxDistance = LOD_DISTANCE_BY_LAYER[entry.layer] ?? Infinity;
      const altitudeCutoff = HIGH_ALTITUDE_LAYER_CUTOFF[entry.layer];
      const tooFar = distance > maxDistance;
      const tooHigh = Number.isFinite(altitudeCutoff) && (camera.position?.y ?? 0) > altitudeCutoff;

      if (tooFar || tooHigh) {
        entry.object.visible = false;
        if (tooFar) {
          layerStats.hiddenByLod++;
        } else {
          layerStats.hiddenByAltitude++;
        }
        continue;
      }

      entry.object.visible = true;
      visibleObjects++;
      layerStats.visible++;
    }

    this.stats = {
      chunks: this.chunks.size,
      trackedObjects: this.entries.length,
      visibleObjects,
      hiddenByLod: Object.values(layerBreakdown).reduce((sum, layer) => sum + layer.hiddenByLod, 0),
      hiddenByLayer,
      hiddenByAltitude: Object.values(layerBreakdown).reduce((sum, layer) => sum + layer.hiddenByAltitude, 0),
      layerVisibility: { ...this.layerVisibility },
      layerBreakdown
    };
    this.emitStats();
  }

  getStats() {
    return this.stats;
  }

  emitStats() {
    this.callbacks.onPerformanceStats?.(this.getStats());
  }
}
