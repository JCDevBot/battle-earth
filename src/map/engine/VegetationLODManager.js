import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { resolveVegetationProfile, pickSpecies } from "./VegetationProfile";

/**
 * VegetationLODManager — Multi-level vegetation with geography-aware species.
 *
 * LOD 0 (near <250m):  Full instanced geometry — distinct trunk + canopy per species shape
 * LOD 1 (mid 250-600m): Simplified instanced shapes (cone/sphere only, fewer instances)
 * LOD 2 (far >600m):   Camera-facing billboard quads with species-tinted color
 *
 * Trees are grouped into spatial clusters. Each cluster resolves a VegetationProfile
 * based on lat/lon/elevation/zoneType and scatters species-appropriate trees.
 */

// Phase 10G.2: wider vegetation thresholds and persistent far representation.
// Forests should simplify into mass, not disappear while zooming.
const LOD_THRESHOLDS = { near: 420, mid: 1600 };
const LOD_HYSTERESIS = 90;
const CHUNK_SIZE = 180;

// Shared geometries for each shape archetype
const GEOM_CACHE = {};
function getGeometry(shape) {
  if (GEOM_CACHE[shape]) return GEOM_CACHE[shape];
  switch (shape) {
    case "cone":
      GEOM_CACHE[shape] = {
        crown: new THREE.ConeGeometry(1, 2.9, 7),
        trunk: new THREE.CylinderGeometry(0.16, 0.3, 1, 6)
      };
      break;
    case "sphere":
      // Low-poly rounded crown used by the visual-polish pass. The game reads better
      // from the tactical camera when trees have a bold, chunky silhouette instead
      // of tiny realistic leaf detail.
      GEOM_CACHE[shape] = { crown: new THREE.DodecahedronGeometry(1, 0), trunk: new THREE.CylinderGeometry(0.13, 0.24, 1, 5) };
      break;
    case "column":
      GEOM_CACHE[shape] = { crown: new THREE.CylinderGeometry(0.4, 0.5, 3, 6), trunk: new THREE.CylinderGeometry(0.12, 0.2, 1, 5) };
      break;
    case "weeping":
      GEOM_CACHE[shape] = { crown: new THREE.DodecahedronGeometry(1, 0).scale(1.2, 0.75, 1.2), trunk: new THREE.CylinderGeometry(0.12, 0.24, 1, 5) };
      break;
    case "palm":
      GEOM_CACHE[shape] = { crown: new THREE.SphereGeometry(1, 6, 4).scale(1.3, 0.5, 1.3), trunk: new THREE.CylinderGeometry(0.12, 0.18, 1, 6) };
      break;
    case "grass":
      GEOM_CACHE[shape] = { crown: new THREE.CylinderGeometry(0.15, 0.2, 1, 4), trunk: new THREE.CylinderGeometry(0.05, 0.08, 1, 4) };
      break;
    default:
      GEOM_CACHE[shape] = { crown: new THREE.DodecahedronGeometry(1, 0), trunk: new THREE.CylinderGeometry(0.15, 0.25, 1, 5) };
  }
  return GEOM_CACHE[shape];
}

// Billboard quad geometry (shared)
let BILLBOARD_GEO = null;
function getBillboardGeo() {
  if (!BILLBOARD_GEO) {
    BILLBOARD_GEO = new THREE.PlaneGeometry(6, 10);
    // Shift origin to bottom center so it stands on ground
    BILLBOARD_GEO.translate(0, 5, 0);
  }
  return BILLBOARD_GEO;
}

function darkenHex(hex, amount = 0.75) {
  const c = new THREE.Color(hex);
  c.r *= amount;
  c.g *= amount;
  c.b *= amount;
  return c;
}

export class VegetationLODManager {
  safeMergeGeometries(geometries) {
    const normalized = geometries
      .filter(Boolean)
      .map((geometry) => geometry.index ? geometry.toNonIndexed() : geometry);
    if (!normalized.length) return null;
    return mergeGeometries(normalized, false);
  }

  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.visible = true;
    this.scene.add(this.group);
    this.chunks = new Map();
    this.centerLat = 0;
    this.centerLon = 0;
    this.mapSizeMeters = 1000;
    this.treeBudget = this.createTreeBudget(1000);
    this.treeStats = { requested: 0, accepted: 0, capped: 0, mapSizeMeters: 1000, maxTrees: this.treeBudget.maxTrees, areaHectares: this.treeBudget.areaHectares };
  }

  createTreeBudget(sizeMeters = 1000) {
    const mapSize = Number(sizeMeters) || 1000;
    const areaHectares = Math.max(0.01, (mapSize * mapSize) / 10000);
    // D35: vegetation is density-normalized by map area, then protected by a
    // performance cap. Small slices no longer receive the same total tree budget
    // as a 1000m map, but large maps still cannot overrun FPS.
    const areaBasedMax = Math.round(areaHectares * 34);
    const minimumPlayableBudget = mapSize <= 420 ? 145 : 260;
    const performanceCap = mapSize <= 420 ? 430 : mapSize <= 650 ? 620 : 900;
    return {
      areaHectares,
      maxTrees: Math.max(minimumPlayableBudget, Math.min(performanceCap, areaBasedMax))
    };
  }

  setMapSize(sizeMeters = 1000) {
    this.mapSizeMeters = Number(sizeMeters) || 1000;
    this.treeBudget = this.createTreeBudget(this.mapSizeMeters);
    this.treeStats = { requested: 0, accepted: 0, capped: 0, mapSizeMeters: this.mapSizeMeters, maxTrees: this.treeBudget.maxTrees, areaHectares: this.treeBudget.areaHectares };
  }

  getVegetationStats() {
    return { ...this.treeStats };
  }

  getRemainingTreeBudget() {
    return Math.max(0, (this.treeBudget?.maxTrees ?? 900) - (this.treeStats?.accepted ?? 0));
  }

  requestTreeSlots(count = 0) {
    const requested = Math.max(0, Math.floor(count));
    if (!this.treeStats) this.setMapSize(this.mapSizeMeters);
    this.treeStats.requested += requested;
    const allowed = Math.min(requested, this.getRemainingTreeBudget());
    this.treeStats.capped += Math.max(0, requested - allowed);
    return allowed;
  }

  getThresholds() {
    // Keep the small-slice maps crisp without forcing every tree chunk to stay
    // in full-detail mode from high camera angles. Larger maps retain the wide
    // persistent thresholds that make distant vegetation read as forest mass.
    const scale = THREE.MathUtils.clamp(this.mapSizeMeters / 1000, 0.58, 1.35);
    return {
      near: Math.max(230, LOD_THRESHOLDS.near * scale),
      mid: Math.max(720, LOD_THRESHOLDS.mid * scale)
    };
  }

  /**
   * Scatter vegetation for a zone polygon.
   * @param {Object} opts - { polygon, bounds, zoneType, lat, lon, rng, buildingBoxes, roadSegments }
   */
  scatter(opts) {
    const { polygon, bounds, zoneType, lat, lon, rng, isValidLocation, density = 1, reconstruction = false } = opts;
    const area = Math.abs(THREE.ShapeUtils.area(polygon));
    if (area < 50) return;

    // Sample elevation at zone center
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const elevation = this.terrain?.getWorldHeight?.(cx, cz) ?? 0;

    const profile = resolveVegetationProfile(lat, lon, elevation, zoneType);

    // D20: canopy reconstruction is no longer a solid paint bucket.  We keep
    // D19's higher neighborhood canopy coverage, but decompose it into tree
    // communities with edge erosion, internal gaps, and a strong height hierarchy.
    // This makes the test map read closer to Google Earth: mature tree crowns
    // overlap, but roads, roofs, and yards still punch visible holes through it.
    const baseDensity = zoneType === "forest"
      ? (reconstruction ? 0.021 : 0.018)
      : zoneType === "wetland" || zoneType === "riparian"
        ? (reconstruction ? 0.015 : 0.010)
        : zoneType === "park"
          ? (reconstruction ? 0.009 : 0.0075)
          : 0.0065;
    const rawTargetCount = Math.min(reconstruction ? 620 : 420, Math.max(4, Math.floor(area * baseDensity * profile.densityMod * density)));
    const targetCount = this.requestTreeSlots(rawTargetCount);
    if (targetCount <= 0) return;
    const trees = [];

    const gaps = reconstruction ? this.createCanopyGaps(polygon, bounds, area, rng, zoneType) : [];
    const minEdgeSoftness = zoneType === "park" ? 5 : zoneType === "wetland" || zoneType === "riparian" ? 8 : 9;

    const isAcceptedCanopyPoint = (pt) => {
      if (!this.isInPolygon(pt, polygon)) return false;
      if (gaps.some((gap) => pt.distanceTo(gap.center) < gap.radius)) return false;
      if (!reconstruction) return true;

      // Edge erosion: preserve irregular, feathered edges instead of hard canopy walls.
      const edgeDistance = this.distanceToPolygonEdges(pt, polygon);
      if (edgeDistance < minEdgeSoftness) {
        const edgeKeep = THREE.MathUtils.clamp(edgeDistance / minEdgeSoftness, 0.12, 0.92);
        if (rng.next() > edgeKeep) return false;
      }
      return true;
    };

    const sizeBandForTree = (indexInClump = 0) => {
      const roll = rng.next();
      if (indexInClump === 0 && roll < 0.28) return 1.58 + rng.next() * 0.42; // large neighborhood-defining crown
      if (roll < 0.15) return 1.48 + rng.next() * 0.36; // large
      if (roll < 0.50) return 1.15 + rng.next() * 0.30; // mature
      if (roll < 0.80) return 0.88 + rng.next() * 0.24; // medium
      return 0.58 + rng.next() * 0.24; // sapling/understory
    };

    const makeTree = (x, z, sizeBand = 1) => {
      const species = pickSpecies(profile, rng.next());
      const h = this.terrain?.getWorldHeight?.(x, z) ?? 0;
      const height = species.heightRange[0] + rng.next() * (species.heightRange[1] - species.heightRange[0]);
      const scale = species.crownScale[0] + rng.next() * (species.crownScale[1] - species.crownScale[0]);
      const crownJitter = (0.96 + rng.next() * 0.46) * sizeBand;
      trees.push({ x, z, h, species, height: height * 0.84 * sizeBand, scale: scale * crownJitter, rotation: rng.next() * Math.PI * 2 });
    };

    let attempts = 0;
    while (trees.length < targetCount && attempts < targetCount * 18) {
      attempts++;
      const anchorX = bounds.minX + rng.next() * (bounds.maxX - bounds.minX);
      const anchorZ = bounds.minZ + rng.next() * (bounds.maxZ - bounds.minZ);
      const anchor = new THREE.Vector2(anchorX, anchorZ);
      if (!isAcceptedCanopyPoint(anchor)) continue;
      if (isValidLocation && !isValidLocation(anchorX, anchorZ)) continue;

      const clumpRoll = rng.next();
      const clumpSize = zoneType === "forest"
        ? (clumpRoll < 0.20 ? 1 + Math.floor(rng.next() * 2) : 3 + Math.floor(rng.next() * 5))
        : (zoneType === "wetland" || zoneType === "riparian")
          ? (clumpRoll < 0.25 ? 1 + Math.floor(rng.next() * 2) : 2 + Math.floor(rng.next() * 5))
          : clumpRoll < 0.35 ? 1 : 2 + Math.floor(rng.next() * 3);
      const clumpRadius = zoneType === "forest"
        ? 4.0 + rng.next() * 10.5
        : (zoneType === "wetland" || zoneType === "riparian")
          ? 3.6 + rng.next() * 8.2
          : 2.2 + rng.next() * 6.0;

      for (let i = 0; i < clumpSize && trees.length < targetCount; i++) {
        const angle = rng.next() * Math.PI * 2;
        const distance = i === 0 ? 0 : Math.sqrt(rng.next()) * clumpRadius;
        const x = anchorX + Math.cos(angle) * distance;
        const z = anchorZ + Math.sin(angle) * distance;
        const pt = new THREE.Vector2(x, z);
        if (!isAcceptedCanopyPoint(pt)) continue;
        if (isValidLocation && !isValidLocation(x, z)) continue;
        makeTree(x, z, sizeBandForTree(i));
      }
    }

    if (!trees.length) return;

    for (const tree of trees) this.addTreeToChunk(tree);
  }

  createCanopyGaps(polygon, bounds, area, rng, zoneType) {
    const gapCount = Math.min(14, Math.max(1, Math.floor(area / (zoneType === "park" ? 1200 : 1650))));
    const gaps = [];
    let attempts = 0;
    while (gaps.length < gapCount && attempts < gapCount * 18) {
      attempts++;
      const x = bounds.minX + rng.next() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + rng.next() * (bounds.maxZ - bounds.minZ);
      const center = new THREE.Vector2(x, z);
      if (!this.isInPolygon(center, polygon)) continue;
      const edgeDistance = this.distanceToPolygonEdges(center, polygon);
      if (edgeDistance < 8) continue;
      const radius = (zoneType === "park" ? 4.5 : 5.5) + rng.next() * (zoneType === "forest" ? 7.5 : 5.5);
      gaps.push({ center, radius });
    }
    return gaps;
  }

  distanceToPolygonEdges(p, poly) {
    let nearest = Infinity;
    for (let i = 0; i < poly.length; i++) {
      nearest = Math.min(nearest, this.distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
    }
    return nearest;
  }

  distToSegment(p, a, b) {
    const ab = new THREE.Vector2().subVectors(b, a);
    const denom = Math.max(0.00001, ab.lengthSq());
    const t = THREE.MathUtils.clamp(new THREE.Vector2().subVectors(p, a).dot(ab) / denom, 0, 1);
    const projection = a.clone().add(ab.multiplyScalar(t));
    return p.distanceTo(projection);
  }

  /** Scatter individual trees along roads/rivers (non-zone) */
  scatterIndividual(opts) {
    const { positions, zoneType, lat, lon, rng, isValidLocation } = opts;
    if (!positions.length) return;
    const allowedPositions = this.requestTreeSlots(positions.length);
    if (allowedPositions <= 0) return;
    const sourcePositions = positions.slice(0, allowedPositions);

    const elevation = this.terrain?.getWorldHeight?.(positions[0].x, positions[0].z) ?? 0;
    const profile = resolveVegetationProfile(lat, lon, elevation, zoneType);

    const makeTree = (x, z, sizeBand = 1) => {
      const species = pickSpecies(profile, rng.next());
      const h = this.terrain?.getWorldHeight?.(x, z) ?? 0;
      const height = species.heightRange[0] + rng.next() * (species.heightRange[1] - species.heightRange[0]);
      const scale = species.crownScale[0] + rng.next() * (species.crownScale[1] - species.crownScale[0]);
      const crownJitter = (1.14 + rng.next() * 0.48) * sizeBand;
      this.addTreeToChunk({
        x, z, h, species, height: height * 0.82 * sizeBand, scale: scale * crownJitter, rotation: rng.next() * Math.PI * 2
      });
    };

    for (const pos of sourcePositions) {
      // Most street trees remain single specimens, but some become small paired
      // yard/street clusters so the spacing feels less synthetic. D21 callers can
      // bias the size/clump count for boulevard trees, canopy fringe, and shoreline ecology.
      const requestedClump = Number.isFinite(pos.clump) ? Math.max(1, Math.min(4, Math.round(pos.clump))) : null;
      const clumpSize = requestedClump ?? (rng.next() < 0.58 ? 1 : 2 + Math.floor(rng.next() * 3));
      const baseSize = Number.isFinite(pos.sizeBand) ? pos.sizeBand : (1.06 + rng.next() * 0.28);
      for (let i = 0; i < clumpSize; i++) {
        const angle = rng.next() * Math.PI * 2;
        const distance = i === 0 ? 0 : 2.2 + rng.next() * 5.2;
        const x = pos.x + Math.cos(angle) * distance;
        const z = pos.z + Math.sin(angle) * distance;
        if (isValidLocation && !isValidLocation(x, z)) continue;
        const sizeBand = i === 0 ? baseSize : baseSize * (0.56 + rng.next() * 0.38);
        makeTree(x, z, sizeBand);
      }
    }
  }


  addTreeToChunk(tree) {
    if (this.getRemainingTreeBudget() <= 0) {
      if (this.treeStats) this.treeStats.capped += 1;
      return false;
    }
    const key = `${Math.floor(tree.x / CHUNK_SIZE)}:${Math.floor(tree.z / CHUNK_SIZE)}`;
    if (!this.chunks.has(key)) {
      this.chunks.set(key, { trees: [], lod0: null, lod1: null, lod2: null, canopyMass: null, center: null, activeLod: null });
    }
    this.chunks.get(key).trees.push(tree);
    if (this.treeStats) this.treeStats.accepted += 1;
    return true;
  }

  /** Build all LOD meshes after scattering is complete */
  flush() {
    for (const [key, chunk] of this.chunks) {
      if (!chunk.trees.length) continue;

      // Compute center
      const avg = new THREE.Vector3();
      for (const t of chunk.trees) { avg.x += t.x; avg.y += t.h; avg.z += t.z; }
      avg.divideScalar(chunk.trees.length);
      chunk.center = avg;

      chunk.lod0 = this.buildLOD0(chunk);
      chunk.lod1 = this.buildLOD1(chunk);
      chunk.lod2 = this.buildLOD2(chunk);
      chunk.canopyMass = this.buildAerialCanopyMass(chunk);

      if (chunk.canopyMass) this.group.add(chunk.canopyMass);
      if (chunk.lod0) this.group.add(chunk.lod0);
      if (chunk.lod1) this.group.add(chunk.lod1);
      if (chunk.lod2) this.group.add(chunk.lod2);
    }
  }


  /**
   * D55: Aerial canopy mass.
   *
   * Google Earth reads tree cover as overlapping crown mass first and individual
   * trees second. The existing LODs already draw individual trees well, but a
   * high tactical camera could still see too much bare terrain between trunks.
   * This merged, low-opacity, horizontal canopy silhouette gives zoomed-out maps
   * the correct tree-cover footprint while keeping near-camera FPS stable.
   */
  buildAerialCanopyMass(chunk) {
    if (!chunk?.trees?.length) return null;
    const geos = [];
    const baseGeo = new THREE.CircleGeometry(1, 9);
    const mat4 = new THREE.Matrix4();
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const colors = [];

    for (let i = 0; i < chunk.trees.length; i++) {
      const t = chunk.trees[i];
      colors.push(t.species.crownColor);
      const crownRadius = Math.max(2.8, t.scale * (t.species.shape === "cone" ? 2.1 : 3.15));
      scale.set(crownRadius * (0.88 + ((i * 37) % 11) * 0.018), crownRadius * (0.72 + ((i * 19) % 9) * 0.026), 1);
      pos.set(t.x, t.h + 0.075, t.z);
      mat4.compose(pos, quat, scale);
      const geo = baseGeo.clone();
      geo.applyMatrix4(mat4);
      geos.push(geo);
    }

    if (!geos.length) return null;
    const merged = this.safeMergeGeometries(geos);
    baseGeo.dispose();
    for (const g of geos) g.dispose();
    if (!merged) return null;

    const material = new THREE.MeshBasicMaterial({
      color: this.averageColor(colors),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(merged, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    mesh.visible = false;
    mesh.userData = { feature: "d55-aerial-canopy-mass", lodLevel: "canopy-mass", persistentRepresentation: true };
    return mesh;
  }

  /** LOD 0: Full detail — instanced meshes grouped by species shape */
  buildLOD0(chunk) {
    const group = new THREE.Group();
    group.userData = { feature: "veg-lod0", lodLevel: 0 };
    group.frustumCulled = false;

    // Group trees by shape + species so light-leaf trees keep their own tint.
    const byShape = new Map();
    for (const t of chunk.trees) {
      const shape = `${t.species.shape}:${t.species.name ?? t.species.crownColor}`;
      if (!byShape.has(shape)) byShape.set(shape, []);
      byShape.get(shape).push(t);
    }

    const dummy = new THREE.Object3D();
    for (const [shapeKey, trees] of byShape) {
      const shape = trees[0].species.shape;
      const geo = getGeometry(shape);
      const crownMat = new THREE.MeshStandardMaterial({ color: trees[0].species.crownColor, roughness: 1, flatShading: true });
      const crownDarkMat = new THREE.MeshStandardMaterial({ color: darkenHex(trees[0].species.crownColor, 0.72), roughness: 1, flatShading: true });
      const trunkMat = new THREE.MeshStandardMaterial({ color: trees[0].species.trunkColor, roughness: 0.95, flatShading: true });

      const isConifer = shape === "cone";
      const isBroadleaf = !["cone", "column", "grass"].includes(shape);
      const lobeCount = isBroadleaf ? 6 : isConifer ? 5 : 3;
      const crownIM = new THREE.InstancedMesh(geo.crown, crownMat, trees.length * lobeCount);
      const crownDarkIM = new THREE.InstancedMesh(geo.crown, crownDarkMat, trees.length);
      const trunkIM = new THREE.InstancedMesh(geo.trunk, trunkMat, trees.length);
      // Phase 3: simple fake contact shadows. These keep the map readable even
      // when real-time shadows are subtle from the tactical camera angle.
      const shadowGeo = new THREE.CircleGeometry(1, 14);
      const shadowMat = new THREE.MeshBasicMaterial({ color: 0x071407, transparent: true, opacity: 0.20, depthWrite: false });
      const shadowIM = new THREE.InstancedMesh(shadowGeo, shadowMat, trees.length);

      let crownIndex = 0;
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        const broadScale = isBroadleaf ? 1.72 : isConifer ? 1.22 : 1.12;
        const crownY = t.h + t.height + t.scale * (isBroadleaf ? 0.78 : isConifer ? 0.88 : 1.18);

        const shadowScale = t.scale * (isBroadleaf ? 2.35 : isConifer ? 1.65 : 1.55);
        dummy.position.set(t.x + shadowScale * 0.22, t.h + 0.055, t.z + shadowScale * 0.28);
        dummy.scale.set(shadowScale * 1.25, shadowScale * 0.74, 1);
        dummy.rotation.set(-Math.PI / 2, 0, t.rotation + 0.35);
        dummy.updateMatrix();
        shadowIM.setMatrixAt(i, dummy.matrix);

        // Trunk: visible, slim, and a little shorter so the crown sits like the reference.
        dummy.position.set(t.x, t.h + t.height * 0.40, t.z);
        dummy.scale.set(0.9, t.height * 0.80, 0.9);
        dummy.rotation.set(0, t.rotation, 0);
        dummy.updateMatrix();
        trunkIM.setMatrixAt(i, dummy.matrix);

        // Dark lower crown gives the trees a shaded base and makes each one read
        // as a little object instead of a flat green marker.
        dummy.position.set(t.x, crownY - t.scale * 0.48, t.z);
        dummy.scale.set(t.scale * broadScale * 1.05, t.scale * 0.82, t.scale * broadScale * 1.05);
        dummy.rotation.set(0.05, t.rotation, -0.03);
        dummy.updateMatrix();
        crownDarkIM.setMatrixAt(i, dummy.matrix);

        if (isBroadleaf) {
          const offsets = [
            [0, 0.20, 0, 1.08],
            [Math.cos(t.rotation) * t.scale * 0.58, -0.02, Math.sin(t.rotation) * t.scale * 0.58, 0.92],
            [Math.cos(t.rotation + 1.7) * t.scale * 0.52, -0.06, Math.sin(t.rotation + 1.7) * t.scale * 0.52, 0.86],
            [Math.cos(t.rotation + 3.15) * t.scale * 0.55, -0.10, Math.sin(t.rotation + 3.15) * t.scale * 0.55, 0.84],
            [Math.cos(t.rotation + 4.45) * t.scale * 0.46, 0.04, Math.sin(t.rotation + 4.45) * t.scale * 0.46, 0.78],
            [0, -0.32, 0, 1.16]
          ];
          for (const [ox, oy, oz, os] of offsets) {
            dummy.position.set(t.x + ox, crownY + t.scale * oy, t.z + oz);
            dummy.scale.set(t.scale * broadScale * os, t.scale * 0.92 * os, t.scale * broadScale * os);
            dummy.rotation.set(0.06, t.rotation + crownIndex * 0.7, -0.04);
            dummy.updateMatrix();
            crownIM.setMatrixAt(crownIndex++, dummy.matrix);
          }
        } else if (isConifer) {
          // Layered low-poly pine/spruce silhouette: wide lower branches, stacked smaller crowns.
          const offsets = [
            [0, 0.46, 0, 0.78, 0.86],
            [0, 0.05, 0, 1.02, 1.02],
            [0, -0.36, 0, 1.28, 1.14],
            [0, -0.78, 0, 1.48, 1.08],
            [0, -1.12, 0, 1.18, 0.74]
          ];
          for (const [ox, oy, oz, os, ys] of offsets) {
            dummy.position.set(t.x + ox, crownY + t.scale * oy, t.z + oz);
            dummy.scale.set(t.scale * 1.22 * os, t.scale * 1.06 * ys, t.scale * 1.22 * os);
            dummy.rotation.set(0, t.rotation + crownIndex * 0.37, 0);
            dummy.updateMatrix();
            crownIM.setMatrixAt(crownIndex++, dummy.matrix);
          }
        } else {
          const offsets = [[0, 0.1, 0, 1.1], [0, -0.34, 0, 1.34], [0, -0.74, 0, 1.05]];
          for (const [ox, oy, oz, os] of offsets) {
            dummy.position.set(t.x + ox, crownY + t.scale * oy, t.z + oz);
            dummy.scale.set(t.scale * 1.14 * os, t.scale * (shape === "column" ? 1.65 : 1.18) * os, t.scale * 1.14 * os);
            dummy.rotation.set(0, t.rotation, 0);
            dummy.updateMatrix();
            crownIM.setMatrixAt(crownIndex++, dummy.matrix);
          }
        }
      }

      crownIM.count = crownIndex;
      crownIM.castShadow = true;
      crownIM.receiveShadow = true;
      crownDarkIM.castShadow = true;
      crownDarkIM.receiveShadow = true;
      trunkIM.castShadow = true;
      trunkIM.receiveShadow = true;
      crownIM.instanceMatrix.needsUpdate = true;
      crownDarkIM.instanceMatrix.needsUpdate = true;
      trunkIM.instanceMatrix.needsUpdate = true;
      shadowIM.instanceMatrix.needsUpdate = true;
      shadowIM.renderOrder = 1;
      shadowIM.userData = { feature: "tree-contact-shadows", layer: "vegetation" };
      group.add(shadowIM, crownDarkIM, crownIM, trunkIM);
    }

    return group;
  }

  /** LOD 1: Simplified — chunkier low-poly forms that match near trees. */
  buildLOD1(chunk) {
    const group = new THREE.Group();
    group.userData = { feature: "veg-lod1", lodLevel: 1 };
    group.frustumCulled = false;
    group.traverse?.((child) => { child.frustumCulled = false; });
    group.visible = false;

    // Just use cone for conifers, sphere for everything else
    const conifers = chunk.trees.filter((t) => t.species.shape === "cone" || t.species.shape === "column");
    const deciduous = chunk.trees.filter((t) => t.species.shape !== "cone" && t.species.shape !== "column");

    const dummy = new THREE.Object3D();

    if (conifers.length) {
      const geo = new THREE.ConeGeometry(1, 4, 6);
      const mat = new THREE.MeshStandardMaterial({ color: this.averageColor(conifers.map((t) => t.species.crownColor)), roughness: 1, flatShading: true });
      const im = new THREE.InstancedMesh(geo, mat, conifers.length);
      for (let i = 0; i < conifers.length; i++) {
        const t = conifers[i];
        dummy.position.set(t.x, t.h + t.height * 0.6, t.z);
        dummy.scale.set(t.scale * 1.08, t.height * 0.44, t.scale * 1.08);
        dummy.rotation.set(0, t.rotation, 0);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      group.add(im);
    }

    if (deciduous.length) {
      const geo = new THREE.DodecahedronGeometry(1, 0);
      const mat = new THREE.MeshStandardMaterial({ color: this.averageColor(deciduous.map((t) => t.species.crownColor)), roughness: 1, flatShading: true });
      const im = new THREE.InstancedMesh(geo, mat, deciduous.length);
      for (let i = 0; i < deciduous.length; i++) {
        const t = deciduous[i];
        dummy.position.set(t.x, t.h + t.height * 0.7, t.z);
        dummy.scale.set(t.scale * 1.55, t.scale * 1.05, t.scale * 1.55);
        dummy.rotation.set(0, t.rotation, 0);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      group.add(im);
    }

    return group;
  }

  /** LOD 2: Far simplified clumps — low-poly mass instead of billboards. */
  buildLOD2(chunk) {
    const group = new THREE.Group();
    group.userData = { feature: "veg-lod2", lodLevel: 2, persistentRepresentation: true };
    group.frustumCulled = false;
    group.visible = false;

    // One simplified canopy clump per small cluster of trees. This keeps the
    // forest/yard silhouette stable in the distance and avoids flat rotating
    // cards that clash with the low-poly style.
    const clumpSize = 5;
    const clumps = [];
    for (let i = 0; i < chunk.trees.length; i += clumpSize) {
      const slice = chunk.trees.slice(i, i + clumpSize);
      const avg = slice.reduce((acc, t) => {
        acc.x += t.x; acc.z += t.z; acc.h += t.h; acc.scale += t.scale;
        acc.colors.push(t.species.crownColor);
        return acc;
      }, { x: 0, z: 0, h: 0, scale: 0, colors: [] });
      const n = slice.length || 1;
      clumps.push({
        x: avg.x / n,
        z: avg.z / n,
        h: avg.h / n,
        scale: Math.max(1.8, (avg.scale / n) * (1.8 + n * 0.18)),
        color: this.averageColor(avg.colors),
        conifer: slice.filter((t) => t.species.shape === "cone" || t.species.shape === "column").length > n * 0.5
      });
    }

    const byType = { conifer: [], deciduous: [] };
    for (const c of clumps) byType[c.conifer ? "conifer" : "deciduous"].push(c);
    const dummy = new THREE.Object3D();

    for (const [type, items] of Object.entries(byType)) {
      if (!items.length) continue;
      const geo = type === "conifer" ? new THREE.ConeGeometry(1, 3.2, 6) : new THREE.DodecahedronGeometry(1, 0);
      const mat = new THREE.MeshStandardMaterial({ color: this.averageColor(items.map((c) => c.color)), roughness: 1, flatShading: true });
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      for (let i = 0; i < items.length; i++) {
        const c = items[i];
        const yScale = type === "conifer" ? c.scale * 1.55 : c.scale * 0.72;
        dummy.position.set(c.x, c.h + yScale * 0.82, c.z);
        dummy.scale.set(c.scale * (type === "conifer" ? 0.9 : 1.45), yScale, c.scale * (type === "conifer" ? 0.9 : 1.45));
        dummy.rotation.set(0, (i * 0.618) % (Math.PI * 2), 0);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      group.add(im);
    }

    return group;
  }

  averageColor(hexColors) {
    let r = 0, g = 0, b = 0;
    const c = new THREE.Color();
    for (const hex of hexColors) {
      c.set(hex);
      r += c.r; g += c.g; b += c.b;
    }
    const n = hexColors.length || 1;
    return new THREE.Color(r / n, g / n, b / n);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.group.visible = this.visible;
  }

  update(camera) {
    this.group.visible = this.visible !== false;
    if (!camera || this.visible === false) {
      this.forceChunksHidden();
      return;
    }
    const camPos = camera.position;
    const thresholds = this.getThresholds();
    const hysteresis = Math.max(45, LOD_HYSTERESIS * THREE.MathUtils.clamp(this.mapSizeMeters / 1000, 0.55, 1.2));

    for (const chunk of this.chunks.values()) {
      if (!chunk.center) continue;
      const dist = camPos.distanceTo(chunk.center);
      const previous = Number.isInteger(chunk.activeLod) ? chunk.activeLod : null;
      let nextLod;

      // Match the building LOD pattern: once a vegetation chunk chooses a LOD,
      // it waits until the camera moves meaningfully past the threshold before
      // switching. This removes the tree popping/flicker at cutoff distances.
      if (previous === 0) nextLod = dist > thresholds.near + hysteresis ? 1 : 0;
      else if (previous === 1) {
        if (dist < thresholds.near - hysteresis) nextLod = 0;
        else if (dist > thresholds.mid + hysteresis) nextLod = 2;
        else nextLod = 1;
      } else if (previous === 2) nextLod = dist < thresholds.mid - hysteresis ? 1 : 2;
      else if (dist < thresholds.near) nextLod = 0;
      else if (dist < thresholds.mid) nextLod = 1;
      else nextLod = 2;

      chunk.activeLod = nextLod;
      if (chunk.canopyMass) chunk.canopyMass.visible = nextLod !== 0;
      if (chunk.lod0) chunk.lod0.visible = nextLod === 0;
      if (chunk.lod1) chunk.lod1.visible = nextLod === 1;
      if (chunk.lod2) chunk.lod2.visible = nextLod === 2;
    }
  }

  forceChunksHidden() {
    for (const chunk of this.chunks.values()) {
      if (chunk.canopyMass) chunk.canopyMass.visible = false;
      if (chunk.lod0) chunk.lod0.visible = false;
      if (chunk.lod1) chunk.lod1.visible = false;
      if (chunk.lod2) chunk.lod2.visible = false;
    }
  }

  isInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  clear({ preserveVisibility = false } = {}) {
    this.group.clear();
    this.chunks.clear();
    this.treeBudget = this.createTreeBudget(this.mapSizeMeters);
    this.treeStats = {
      requested: 0,
      accepted: 0,
      capped: 0,
      mapSizeMeters: this.mapSizeMeters,
      maxTrees: this.treeBudget.maxTrees,
      areaHectares: this.treeBudget.areaHectares
    };
    if (!preserveVisibility) this.visible = true;
    this.group.visible = this.visible;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
