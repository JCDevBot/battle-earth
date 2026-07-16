import * as THREE from "three";
import { tacticalMetadataForFeature } from "./TacticalMetadata.js";

const OVERLAY_COLORS = {
  cover: 0x2dd4bf,
  los: 0xf97316,
  movement: 0xa78bfa
};

const OVERLAY_SEGMENTS = 16;
const OVERLAY_SCORE_THRESHOLD = 0.05;
const MAX_OVERLAY_INSTANCES = 1800;
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
const DUMMY = new THREE.Object3D();

function tacticalProfileFor(feature) {
  const metadata = tacticalMetadataForFeature(feature);
  return {
    ...metadata,
    // Backward-compatible aliases used by the current overlay/stat code.
    cover: metadata.cover,
    losBlock: metadata.losBlock,
    movementBlock: metadata.movementBlock,
    movementPenalty: metadata.movementPenalty,
    label: metadata.label
  };
}

export class TacticalManager {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.group = new THREE.Group();
    this.group.name = "tactical-overlays";
    this.group.userData.feature = "tactical-overlay";
    this.scene.add(this.group);

    this.features = new Map();
    this.overlayMode = "cover";
    this.visible = false;
    this.maxOverlayInstances = MAX_OVERLAY_INSTANCES;
    this.overlayMesh = null;
    this.overlayCapacity = 0;
    this.overlayDirty = true;
    this.stats = this.emptyStats();
  }

  emptyStats() {
    return {
      total: 0,
      hardCover: 0,
      softCover: 0,
      losBlockers: 0,
      movementBlockers: 0,
      movementPenalties: 0,
      concealment: 0,
      occupiable: 0,
      destructible: 0,
      byMaterial: {},
      byClass: {},
      overlayMode: this.overlayMode,
      visible: this.visible,
      overlayInstances: 0,
      overlayCulled: 0,
      overlayDrawCalls: this.visible ? 1 : 0
    };
  }

  clear() {
    this.features.clear();
    this.disposeOverlayMesh();
    this.stats = this.emptyStats();
    this.emitStats();
  }

  indexDestructibles(destructionManager) {
    this.clear();
    for (const feature of destructionManager?.features?.values?.() ?? []) {
      this.upsertFeature(feature, false);
    }
    this.overlayDirty = true;
    this.rebuildOverlayInstances();
    this.recomputeStats();
  }

  upsertFeature(feature, rebuild = true) {
    if (!feature?.id) return;
    const tactical = tacticalProfileFor(feature);
    feature.tactical = tactical;
    this.features.set(feature.id, {
      id: feature.id,
      category: feature.category,
      state: feature.state,
      position: feature.position?.clone?.() ?? new THREE.Vector3(),
      radius: Math.max(4, Math.min(80, feature.bounds?.radius ?? 8)),
      height: feature.bounds?.height ?? 0,
      tactical
    });

    if (rebuild) {
      this.overlayDirty = true;
      this.rebuildOverlayInstances();
      this.recomputeStats();
    }
  }

  handleDamageEvent(event, destructionManager) {
    const feature = destructionManager?.features?.get?.(event.id);
    if (!feature) return;
    this.upsertFeature(feature, true);
    this.callbacks.onTacticalEvent?.({
      id: feature.id,
      category: feature.category,
      state: feature.state,
      tactical: feature.tactical
    });
  }

  resetFromDestruction(destructionManager) {
    this.indexDestructibles(destructionManager);
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
    this.rebuildOverlayInstances();
    this.recomputeStats();
  }

  setOverlayMode(mode) {
    if (!["cover", "los", "movement"].includes(mode)) return;
    this.overlayMode = mode;
    this.overlayDirty = true;
    this.rebuildOverlayInstances();
    this.recomputeStats();
  }

  ensureOverlayMesh(capacity) {
    const neededCapacity = Math.max(1, Math.min(this.maxOverlayInstances, capacity));
    if (this.overlayMesh && this.overlayCapacity >= neededCapacity) return;

    this.disposeOverlayMesh();

    const geometry = new THREE.RingGeometry(0.72, 1, OVERLAY_SEGMENTS);
    const material = new THREE.MeshBasicMaterial({
      color: OVERLAY_COLORS[this.overlayMode],
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.InstancedMesh(geometry, material, neededCapacity);
    mesh.name = "tactical-overlay-batched";
    mesh.renderOrder = 30;
    mesh.frustumCulled = false;
    mesh.userData.feature = "tactical-overlay";
    mesh.count = 0;

    this.overlayMesh = mesh;
    this.overlayCapacity = neededCapacity;
    this.group.add(mesh);
  }

  rebuildOverlayInstances() {
    if (!this.visible) {
      if (this.overlayMesh) this.overlayMesh.count = 0;
      this.overlayDirty = false;
      return;
    }

    const entries = Array.from(this.features.values())
      .map((entry) => ({ entry, score: this.scoreForMode(entry) }))
      .filter(({ score }) => score > OVERLAY_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    const visibleEntries = entries.slice(0, this.maxOverlayInstances);
    this.ensureOverlayMesh(visibleEntries.length);
    this.overlayMesh.material.color.setHex(OVERLAY_COLORS[this.overlayMode]);

    let index = 0;
    for (const { entry, score } of visibleEntries) {
      const scale = Math.max(0.1, entry.radius * (0.65 + score * 0.5));
      DUMMY.position.set(entry.position.x, 2.2, entry.position.z);
      DUMMY.rotation.set(-Math.PI / 2, 0, 0);
      DUMMY.scale.set(scale, scale, scale);
      DUMMY.updateMatrix();
      this.overlayMesh.setMatrixAt(index, DUMMY.matrix);
      index += 1;
    }

    for (let i = index; i < this.overlayCapacity; i++) {
      this.overlayMesh.setMatrixAt(i, ZERO_MATRIX);
    }

    this.overlayMesh.count = index;
    this.overlayMesh.instanceMatrix.needsUpdate = true;
    this.overlayDirty = false;
    this.stats.overlayInstances = index;
    this.stats.overlayCulled = Math.max(0, entries.length - index);
    this.stats.overlayDrawCalls = index > 0 ? 1 : 0;
  }

  scoreForMode(entry) {
    if (this.overlayMode === "cover") return entry.tactical.cover;
    if (this.overlayMode === "los") return entry.tactical.losBlock;
    return Math.max(entry.tactical.movementBlock, entry.tactical.movementPenalty);
  }

  recomputeStats() {
    const stats = this.emptyStats();
    for (const entry of this.features.values()) {
      stats.total += 1;
      if (entry.tactical.cover >= 0.75) stats.hardCover += 1;
      else if (entry.tactical.cover >= 0.25) stats.softCover += 1;
      if (entry.tactical.losBlock >= 0.35) stats.losBlockers += 1;
      if (entry.tactical.movementBlock >= 0.5) stats.movementBlockers += 1;
      if (entry.tactical.movementPenalty >= 0.35) stats.movementPenalties += 1;
      if (entry.tactical.concealment >= 0.35) stats.concealment += 1;
      if (entry.tactical.occupiable) stats.occupiable += 1;
      if (entry.tactical.destructible) stats.destructible += 1;
      const material = entry.tactical.material ?? "unknown";
      const tacticalClass = entry.tactical.tacticalClass ?? "unknown";
      stats.byMaterial[material] = (stats.byMaterial[material] ?? 0) + 1;
      stats.byClass[tacticalClass] = (stats.byClass[tacticalClass] ?? 0) + 1;
    }
    stats.overlayMode = this.overlayMode;
    stats.visible = this.visible;
    stats.overlayInstances = this.overlayMesh?.count ?? 0;
    stats.overlayCulled = Math.max(0, this.countScoredEntries() - stats.overlayInstances);
    stats.overlayDrawCalls = this.visible && stats.overlayInstances > 0 ? 1 : 0;
    this.stats = stats;
    this.emitStats();
  }

  countScoredEntries() {
    let count = 0;
    for (const entry of this.features.values()) {
      if (this.scoreForMode(entry) > OVERLAY_SCORE_THRESHOLD) count += 1;
    }
    return count;
  }

  getStats() {
    return { ...this.stats };
  }

  emitStats() {
    this.callbacks.onTacticalStats?.(this.getStats());
  }

  disposeOverlayMesh() {
    if (!this.overlayMesh) return;
    this.overlayMesh.parent?.remove(this.overlayMesh);
    this.overlayMesh.geometry?.dispose?.();
    this.overlayMesh.material?.dispose?.();
    this.overlayMesh = null;
    this.overlayCapacity = 0;
  }

  dispose() {
    this.clear();
    this.group.parent?.remove(this.group);
  }
}
