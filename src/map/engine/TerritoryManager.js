import * as THREE from "three";

const CELL_SIZE = 55;
const CAPTURE_RADIUS = 95;
const FRONTLINE_THRESHOLD = 0.18;

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function influenceFalloff(distance, radius) {
  if (distance >= radius) return 0;
  const t = 1 - distance / Math.max(1, radius);
  return t * t;
}

const HEAT_COLORS = {
  neutral: new THREE.Color(0x64748b),
  friendly: new THREE.Color(0x38bdf8),
  enemy: new THREE.Color(0xfb7185),
  contested: new THREE.Color(0x8b5cf6)
};

export class TerritoryManager {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.enabled = true;
    this.frontlineVisible = true;
    this.cells = [];
    this.influenceSources = [];
    this.sizeMeters = 1000;
    this.group = new THREE.Group();
    this.group.name = "territory-heatmap";
    this.group.userData.feature = "territory";
    this.scene.add(this.group);
    this.frontlineGroup = new THREE.Group();
    this.frontlineGroup.name = "contested-frontline";
    this.frontlineGroup.userData.feature = "frontline";
    this.scene.add(this.frontlineGroup);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.mesh = null;
    this.frontlineMeshes = [];
    this.lastUpdateAt = 0;
  }

  build(sizeMeters = 1000, getGroundHeight = () => 0, influenceSources = []) {
    this.clearCells();
    this.clearFrontline();
    this.sizeMeters = sizeMeters;
    this.getGroundHeight = getGroundHeight;
    this.influenceSources = this.normalizeInfluenceSources(influenceSources);
    const half = sizeMeters * 0.5;
    const count = Math.max(8, Math.ceil(sizeMeters / CELL_SIZE));
    const actualCell = sizeMeters / count;
    const geometry = new THREE.PlaneGeometry(actualCell * 0.94, actualCell * 0.94);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, count * count);
    this.mesh.name = "territory-heatmap-grid";
    this.mesh.userData.feature = "territory-heatmap";
    this.mesh.renderOrder = 9;
    this.group.add(this.mesh);

    const dummy = new THREE.Object3D();
    let index = 0;
    for (let ix = 0; ix < count; ix += 1) {
      for (let iz = 0; iz < count; iz += 1) {
        const x = -half + actualCell * (ix + 0.5);
        const z = -half + actualCell * (iz + 0.5);
        dummy.position.set(x, getGroundHeight(x, z) + 1.55, z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(index, dummy.matrix);
        this.cells.push({ index, ix, iz, x, z, cellSize: actualCell, owner: "neutral", friendlyInfluence: 0, enemyInfluence: 0, delta: 0, strength: 0, frontline: false });
        index += 1;
      }
    }
    this.mesh.count = this.cells.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.ensureInstanceColors();
    this.recalculateHeatmap(null);
    this.group.visible = this.enabled;
    this.frontlineGroup.visible = this.frontlineVisible;
    this.emitStats();
  }

  normalizeInfluenceSources(sources) {
    return (sources ?? [])
      .filter((source) => source?.position && ["friendly", "enemy", "contested"].includes(source.ownership))
      .map((source) => ({
        id: source.id,
        x: source.position.x,
        z: source.position.y ?? source.position.z,
        owner: source.ownership,
        radius: Math.max(120, source.influenceRadius ?? 160),
        weight: source.tier === "hq" ? 2.2 : source.tier === "major" ? 1.35 : 0.9,
        value: source.strategicValue ?? source.priority ?? 50
      }));
  }

  setInfluenceSources(sources = []) {
    this.influenceSources = this.normalizeInfluenceSources(sources);
    this.recalculateHeatmap(null);
    this.emitStats();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.group.visible = this.enabled;
    this.emitStats();
  }

  setFrontlineVisible(visible) {
    this.frontlineVisible = Boolean(visible);
    this.frontlineGroup.visible = this.frontlineVisible;
    this.emitStats();
  }

  update(infantry, now = performance.now()) {
    if (!this.cells.length || now - this.lastUpdateAt < 350) return;
    this.lastUpdateAt = now;
    this.recalculateHeatmap(infantry);
    this.emitStats();
  }

  recalculateHeatmap(infantry) {
    const squads = [...(infantry?.squads?.values?.() ?? [])].filter((squad) => squad.soldiers?.some((soldier) => soldier.health > 0));
    for (const cell of this.cells) {
      let friendlyInfluence = 0;
      let enemyInfluence = 0;

      for (const source of this.influenceSources) {
        const d = distance2D(cell, source);
        const influence = influenceFalloff(d, source.radius) * source.weight * clamp(source.value / 70, 0.7, 1.8);
        if (source.owner === "friendly") friendlyInfluence += influence;
        else if (source.owner === "enemy") enemyInfluence += influence;
        else if (source.owner === "contested") {
          friendlyInfluence += influence * 0.5;
          enemyInfluence += influence * 0.5;
        }
      }

      for (const squad of squads) {
        const d = distance2D(cell, squad.center);
        if (d > CAPTURE_RADIUS) continue;
        const influence = 0.85 * (1 - d / CAPTURE_RADIUS);
        if (squad.side === "friendly") friendlyInfluence += influence;
        else enemyInfluence += influence;
      }

      const total = friendlyInfluence + enemyInfluence;
      const delta = total > 0 ? (friendlyInfluence - enemyInfluence) / total : 0;
      const owner = total < 0.03 ? "neutral" : Math.abs(delta) < FRONTLINE_THRESHOLD ? "contested" : delta > 0 ? "friendly" : "enemy";
      cell.friendlyInfluence = friendlyInfluence;
      cell.enemyInfluence = enemyInfluence;
      cell.delta = delta;
      cell.strength = clamp(total, 0, 2.2);
      cell.owner = owner;
      cell.frontline = owner === "contested" && total > 0.12;
    }
    this.updateColors();
    this.rebuildFrontline();
  }

  ensureInstanceColors() {
    if (!this.mesh) return;
    if (!this.mesh.instanceColor) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cells.length * 3), 3);
    }
    this.updateColors();
  }

  updateColors() {
    if (!this.mesh) return;
    for (const cell of this.cells) {
      const base = HEAT_COLORS[cell.owner] ?? HEAT_COLORS.neutral;
      const color = base.clone();
      if (cell.owner === "friendly" || cell.owner === "enemy") {
        color.lerp(new THREE.Color(0xffffff), clamp(0.36 - Math.abs(cell.delta) * 0.24, 0.08, 0.36));
      }
      this.mesh.setColorAt(cell.index, color);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  rebuildFrontline() {
    this.clearFrontline();
    const frontlineCells = this.cells.filter((cell) => cell.frontline);
    for (const cell of frontlineCells) {
      const geometry = new THREE.RingGeometry(Math.max(2, cell.cellSize * 0.22), Math.max(4, cell.cellSize * 0.42), 18);
      const material = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cell.x, (this.getGroundHeight?.(cell.x, cell.z) ?? 0) + 2.2, cell.z);
      mesh.renderOrder = 22;
      this.frontlineGroup.add(mesh);
      this.frontlineMeshes.push(mesh);
    }
  }

  clearFrontline() {
    for (const mesh of this.frontlineMeshes) {
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
      mesh.parent?.remove?.(mesh);
    }
    this.frontlineMeshes = [];
  }

  clearCells() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.parent?.remove(this.mesh);
      this.mesh = null;
    }
    this.cells = [];
  }

  getStats() {
    const counts = { neutral: 0, friendly: 0, enemy: 0, contested: 0 };
    for (const cell of this.cells) counts[cell.owner] = (counts[cell.owner] ?? 0) + 1;
    return {
      enabled: this.enabled,
      frontlineVisible: this.frontlineVisible,
      cells: this.cells.length,
      influenceSources: this.influenceSources.length,
      frontlineCells: this.cells.filter((cell) => cell.frontline).length,
      ...counts
    };
  }

  emitStats() {
    this.callbacks.onTerritoryStats?.(this.getStats());
  }

  dispose() {
    this.clearCells();
    this.clearFrontline();
    this.group.parent?.remove(this.group);
    this.frontlineGroup.parent?.remove(this.frontlineGroup);
    this.material.dispose();
  }
}
