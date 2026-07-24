import * as THREE from "three";

const CELL_SIZE = 35;
const VISION_RADIUS = 185;

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export class FogOfWarManager {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.enabled = false;
    this.showDebugVision = true;
    this.cells = [];
    this.sizeMeters = 1000;
    this.group = new THREE.Group();
    this.group.name = "fog-of-war";
    this.group.userData.feature = "fog";
    this.scene.add(this.group);

    this.hiddenMaterial = new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.72, depthWrite: false });
    this.exploredMaterial = new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.28, depthWrite: false });
    this.visionMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });

    this.hiddenMesh = null;
    this.exploredMesh = null;
    this.cellGeometry = null;
    this.visionMeshes = [];
    this.lastUpdateAt = 0;
    this.visibleEnemyIds = new Set();
    this.dummy = new THREE.Object3D();
  }

  build(sizeMeters = 1000, getGroundHeight = () => 0) {
    this.clearCells();
    this.sizeMeters = sizeMeters;
    this.getGroundHeight = getGroundHeight;
    const half = sizeMeters * 0.5;
    const count = Math.max(8, Math.ceil(sizeMeters / CELL_SIZE));
    const actualCell = sizeMeters / count;
    this.cellGeometry = new THREE.PlaneGeometry(actualCell * 0.98, actualCell * 0.98);
    this.hiddenMesh = new THREE.InstancedMesh(this.cellGeometry, this.hiddenMaterial, count * count);
    this.exploredMesh = new THREE.InstancedMesh(this.cellGeometry, this.exploredMaterial, count * count);
    for (const mesh of [this.hiddenMesh, this.exploredMesh]) {
      mesh.userData.feature = "fog-overlay";
      mesh.renderOrder = 90;
      this.group.add(mesh);
    }

    let index = 0;
    for (let ix = 0; ix < count; ix++) {
      for (let iz = 0; iz < count; iz++) {
        const x = -half + actualCell * (ix + 0.5);
        const z = -half + actualCell * (iz + 0.5);
        this.cells.push({ index, x, z, y: getGroundHeight(x, z) + 2.4, state: "hidden" });
        index++;
      }
    }
    this.rebuildOverlayInstances();
    this.group.visible = this.enabled;
    this.emitStats();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.group.visible = this.enabled;
    this.emitStats();
  }

  setDebugVision(enabled) {
    this.showDebugVision = Boolean(enabled);
    this.updateVisionMeshes([]);
    this.emitStats();
  }

  update(infantry, now = performance.now()) {
    if (!this.enabled) {
      // Fog disabled should not hide enemies. This keeps dev-spawned enemies stable
      // instead of blinking from stale visibility sets.
      infantry?.setEnemyVisibility?.(null);
      this.updateVisionMeshes([]);
      return;
    }
    if (!this.cells.length || now - this.lastUpdateAt < 220) return;
    this.lastUpdateAt = now;

    const friendlySquads = [...(infantry?.squads?.values?.() ?? [])].filter((squad) => squad.side === "friendly");
    const enemies = [...(infantry?.squads?.values?.() ?? [])].filter((squad) => squad.side === "enemy");
    const visibleEnemyIds = new Set();

    let changed = false;
    for (const cell of this.cells) {
      let visible = false;
      for (const squad of friendlySquads) {
        if (distance2D(cell, squad.center) <= VISION_RADIUS) {
          visible = true;
          break;
        }
      }
      const previous = cell.state;
      if (visible) cell.state = "visible";
      else if (cell.state === "visible") cell.state = "explored";
      if (previous !== cell.state) changed = true;
    }

    for (const enemy of enemies) {
      if (friendlySquads.some((squad) => distance2D(squad.center, enemy.center) <= VISION_RADIUS)) visibleEnemyIds.add(enemy.id);
    }
    this.visibleEnemyIds = visibleEnemyIds;
    infantry?.setEnemyVisibility?.(visibleEnemyIds);

    if (changed) this.rebuildOverlayInstances();
    this.updateVisionMeshes(friendlySquads);
    this.emitStats();
  }

  setMatrixForCell(mesh, slot, cell) {
    this.dummy.position.set(cell.x, cell.y, cell.z);
    this.dummy.rotation.set(-Math.PI / 2, 0, 0);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(slot, this.dummy.matrix);
  }

  rebuildOverlayInstances() {
    if (!this.hiddenMesh || !this.exploredMesh) return;
    let hiddenCount = 0;
    let exploredCount = 0;
    for (const cell of this.cells) {
      if (cell.state === "hidden") this.setMatrixForCell(this.hiddenMesh, hiddenCount++, cell);
      else if (cell.state === "explored") this.setMatrixForCell(this.exploredMesh, exploredCount++, cell);
    }
    this.hiddenMesh.count = hiddenCount;
    this.exploredMesh.count = exploredCount;
    this.hiddenMesh.instanceMatrix.needsUpdate = true;
    this.exploredMesh.instanceMatrix.needsUpdate = true;
  }

  updateVisionMeshes(friendlySquads) {
    for (const mesh of this.visionMeshes) {
      mesh.geometry.dispose();
      mesh.parent?.remove(mesh);
    }
    this.visionMeshes = [];
    if (!this.enabled || !this.showDebugVision) return;
    for (const squad of friendlySquads) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(VISION_RADIUS * 0.96, VISION_RADIUS, 96), this.visionMaterial);
      mesh.rotateX(-Math.PI / 2);
      mesh.position.set(squad.center.x, (this.getGroundHeight?.(squad.center.x, squad.center.z) ?? 0) + 3, squad.center.z);
      mesh.userData.feature = "fog-vision";
      mesh.renderOrder = 91;
      this.group.add(mesh);
      this.visionMeshes.push(mesh);
    }
  }

  clearCells() {
    for (const mesh of [this.hiddenMesh, this.exploredMesh]) {
      if (mesh) mesh.parent?.remove(mesh);
    }
    this.cellGeometry?.dispose?.();
    this.hiddenMesh = null;
    this.exploredMesh = null;
    this.cellGeometry = null;
    for (const mesh of this.visionMeshes) {
      mesh.geometry.dispose();
      mesh.parent?.remove(mesh);
    }
    this.visionMeshes = [];
    this.cells = [];
    this.visibleEnemyIds.clear();
  }

  getStats() {
    const hidden = this.cells.filter((cell) => cell.state === "hidden").length;
    const explored = this.cells.filter((cell) => cell.state === "explored").length;
    const visible = this.cells.filter((cell) => cell.state === "visible").length;
    return { enabled: this.enabled, debugVision: this.showDebugVision, cells: this.cells.length, hidden, explored, visible, visibleEnemies: this.visibleEnemyIds.size, visionRadius: VISION_RADIUS };
  }

  emitStats() {
    this.callbacks.onFogStats?.(this.getStats());
  }

  dispose() {
    this.clearCells();
    this.group.parent?.remove(this.group);
    this.hiddenMaterial.dispose();
    this.exploredMaterial.dispose();
    this.visionMaterial.dispose();
  }
}
