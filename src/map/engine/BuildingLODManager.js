import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * BuildingLODManager — 3-level detail for buildings
 *
 * LOD 0 (near <300m):  Full detail group (walls + roof + rooftop details)
 * LOD 1 (mid 300-800m): Simple extruded box, single material
 * LOD 2 (far >800m):   Flat footprint rectangle on ground, colored by type
 *
 * Buildings are spatially chunked. Each chunk has merged geometry per LOD level.
 * On update, we swap visibility per chunk based on camera distance to chunk center.
 */

// Phase 10G.2: wider thresholds keep neighborhoods represented during camera movement.
// Buildings should simplify with distance, never vanish.
const LOD_THRESHOLDS = { near: 450, mid: 1800 };
const LOD_HYSTERESIS = 90;
const CHUNK_SIZE = 200;

export class BuildingLODManager {
  safeMergeGeometries(geometries) {
    const normalized = geometries
      .filter(Boolean)
      .map((geometry) => geometry.index ? geometry.toNonIndexed() : geometry);
    if (!normalized.length) return null;
    return mergeGeometries(normalized, false);
  }

  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.userData = { feature: "building-lod-root" };
    this.scene.add(this.group);
    this.chunks = new Map();
    this.buildings = [];
    this.visible = true;
  }

  /**
   * Register a building for LOD management.
   * Call this during build instead of adding to scene directly.
   */
  register(entry) {
    // entry: { fullDetail: Group, footprint: Vector2[], center: Vector2, terrainH, profile, area }
    this.buildings.push(entry);
    const key = this.chunkKey(entry.center);
    if (!this.chunks.has(key)) {
      this.chunks.set(key, { buildings: [], lod0: null, lod1: null, lod2: null, center3D: null, activeLod: null });
    }
    this.chunks.get(key).buildings.push(entry);
  }

  /** Flush all registered buildings into chunked LOD meshes */
  flush() {
    for (const [key, chunk] of this.chunks) {
      // Compute chunk 3D center
      const avg = new THREE.Vector3();
      for (const b of chunk.buildings) {
        avg.x += b.center.x;
        avg.z += b.center.y;
        avg.y += b.terrainH;
      }
      avg.divideScalar(chunk.buildings.length);
      chunk.center3D = avg;

      // D44-R.3: baseline performance pass. Instead of attaching every
      // residential building as a group of many meshes, merge visible building
      // geometry per chunk and material. This keeps the stable/no-blink behavior
      // from D44-R.2, but drops thousands of per-building draw calls.
      chunk.lod0 = this.buildBatchedLOD0(chunk, key);
      if (chunk.lod0) this.group.add(chunk.lod0);

      // LOD 1: simple extruded boxes (merged)
      chunk.lod1 = this.buildLOD1(chunk);
      if (chunk.lod1) this.group.add(chunk.lod1);

      // LOD 2: flat footprints (merged)
      chunk.lod2 = this.buildLOD2(chunk);
      if (chunk.lod2) this.group.add(chunk.lod2);
    }

    // Start in the same deterministic baseline state used by update().
    this.forceFullDetailOnly();
  }


  /**
   * Build the currently-used building representation.
   *
   * This is not distance LOD. It is a deterministic chunk batch: all child
   * meshes from all full-detail buildings in the chunk are flattened into one
   * merged mesh per material. The Buildings checkbox remains the only visibility
   * gate.
   */
  buildBatchedLOD0(chunk, key = "") {
    const byMaterial = new Map();

    for (const b of chunk.buildings) {
      if (!b.fullDetail) continue;
      b.fullDetail.updateMatrixWorld(true);

      b.fullDetail.traverse((child) => {
        if (!child?.isMesh || !child.geometry) return;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const material = materials[0];
        if (!material) return;

        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);

        const matKey = material.uuid || material.name || String(byMaterial.size);
        if (!byMaterial.has(matKey)) byMaterial.set(matKey, { material, geometries: [] });
        byMaterial.get(matKey).geometries.push(geo);
      });
    }

    const group = new THREE.Group();
    group.userData = {
      feature: "building-batched-lod0",
      lodLevel: 0,
      chunkKey: key,
      buildingCount: chunk.buildings.length
    };

    for (const { material, geometries } of byMaterial.values()) {
      if (!geometries.length) continue;
      const merged = this.safeMergeGeometries(geometries);
      geometries.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.userData = {
        feature: "building-batched-mesh",
        lodLevel: 0,
        chunkKey: key,
        buildingCount: chunk.buildings.length
      };
      group.add(mesh);
    }

    group.frustumCulled = false;
    group.visible = this.visible;
    return group.children.length ? group : null;
  }

  buildLOD1(chunk) {
    const geometries = [];
    for (const b of chunk.buildings) {
      if (b.footprint.length < 3) continue;
      const shape = new THREE.Shape(b.footprint);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: b.profile.height, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, b.terrainH + b.profile.height, 0);
      geometries.push(geo);
    }
    if (!geometries.length) return null;
    const merged = this.safeMergeGeometries(geometries);
    if (!merged) return null;
    geometries.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    const mat = this.materials.buildingConcrete || this.materials.building;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.userData = { feature: "building-lod1", lodLevel: 1 };
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  }

  buildLOD2(chunk) {
    const geometries = [];
    for (const b of chunk.buildings) {
      if (b.footprint.length < 3) continue;
      const shape = new THREE.Shape(b.footprint);
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, b.terrainH + 0.3, 0);
      geometries.push(geo);
    }
    if (!geometries.length) return null;
    const merged = this.safeMergeGeometries(geometries);
    if (!merged) return null;
    geometries.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({
      color: "#5a5550",
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }));
    mesh.userData = { feature: "building-lod2", lodLevel: 2, persistentRepresentation: true };
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.group.visible = this.visible;

    // D44-R.2 baseline/debug mode: building LOD swapping is disabled while
    // generation is being stabilized. The checkbox is the only visibility gate.
    // When enabled, always show full-detail building chunks and keep simplified
    // LOD 1/2 meshes hidden so chunks cannot blink near distance thresholds.
    this.forceFullDetailOnly();
  }

  forceChunksHidden() {
    for (const chunk of this.chunks.values()) {
      if (chunk.lod0) chunk.lod0.visible = false;
      if (chunk.lod1) chunk.lod1.visible = false;
      if (chunk.lod2) chunk.lod2.visible = false;
    }
  }

  forceFullDetailOnly() {
    for (const chunk of this.chunks.values()) {
      chunk.activeLod = 0;
      if (chunk.lod0) chunk.lod0.visible = this.visible;
      if (chunk.lod1) chunk.lod1.visible = false;
      if (chunk.lod2) chunk.lod2.visible = false;
    }
  }

  update(camera) {
    // D44-R.2: keep buildings deterministic and non-blinking while debugging.
    // Ignore camera distance entirely. Full-detail buildings are shown when the
    // Buildings layer is on; all simplified LOD meshes stay hidden.
    this.group.visible = this.visible;
    if (!this.visible) {
      this.forceChunksHidden();
      return;
    }
    this.forceFullDetailOnly();
  }

  chunkKey(center) {
    return `${Math.floor(center.x / CHUNK_SIZE)}:${Math.floor(center.y / CHUNK_SIZE)}`;
  }

  clear({ preserveVisibility = false } = {}) {
    this.group.clear();
    this.chunks.clear();
    this.buildings = [];
    if (!preserveVisibility) this.visible = true;
    this.group.visible = this.visible;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
