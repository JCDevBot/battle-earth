import * as THREE from "three";

export class MapBoundsManager {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.group = new THREE.Group();
    this.group.name = "map-bounds";
    this.group.userData.feature = "bounds";
    this.scene.add(this.group);
    this.sizeMeters = 0;
    this.half = 0;
    this.enabled = true;
    this.cameraClampEnabled = true;
    this.visualsVisible = true;
  }

  build(sizeMeters, getGroundHeight = () => 0) {
    this.clearVisuals();
    this.sizeMeters = Number(sizeMeters) || 1000;
    this.half = this.sizeMeters * 0.5;
    this.getGroundHeight = getGroundHeight;

    const y = Math.max(0.25, getGroundHeight(0, 0) + 0.35);
    const borderPoints = [
      new THREE.Vector3(-this.half, y, -this.half),
      new THREE.Vector3(this.half, y, -this.half),
      new THREE.Vector3(this.half, y, this.half),
      new THREE.Vector3(-this.half, y, this.half),
      new THREE.Vector3(-this.half, y, -this.half)
    ];
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 });
    const border = new THREE.Line(borderGeometry, borderMaterial);
    border.name = "playable-boundary-line";
    this.group.add(border);

    const outer = this.sizeMeters * 3.0;
    const stripMaterial = new THREE.MeshBasicMaterial({
      color: 0x334155,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide
    });

    const strips = [
      { x: 0, z: -this.half - (outer - this.sizeMeters) * 0.25, w: outer, h: (outer - this.sizeMeters) * 0.5 },
      { x: 0, z: this.half + (outer - this.sizeMeters) * 0.25, w: outer, h: (outer - this.sizeMeters) * 0.5 },
      { x: -this.half - (outer - this.sizeMeters) * 0.25, z: 0, w: (outer - this.sizeMeters) * 0.5, h: this.sizeMeters },
      { x: this.half + (outer - this.sizeMeters) * 0.25, z: 0, w: (outer - this.sizeMeters) * 0.5, h: this.sizeMeters }
    ];

    for (const strip of strips) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(strip.w, strip.h), stripMaterial.clone());
      mesh.rotateX(-Math.PI / 2);
      mesh.position.set(strip.x, y - 0.08, strip.z);
      mesh.renderOrder = -5;
      mesh.name = "out-of-bounds-ground-skirt";
      this.group.add(mesh);
    }

    this.group.visible = this.visualsVisible;
    this.emitStats();
  }

  containsPoint(point, margin = 0) {
    if (!this.enabled || !point || !this.half) return true;
    const limit = this.half - margin;
    return point.x >= -limit && point.x <= limit && point.z >= -limit && point.z <= limit;
  }

  clampPoint(point, margin = 0) {
    if (!point || !this.half) return point;
    const limit = Math.max(1, this.half - margin);
    point.x = THREE.MathUtils.clamp(point.x, -limit, limit);
    point.z = THREE.MathUtils.clamp(point.z, -limit, limit);
    return point;
  }

  setVisualsVisible(visible) {
    this.visualsVisible = Boolean(visible);
    this.group.visible = this.visualsVisible;
    this.emitStats();
  }

  setCameraClampEnabled(enabled) {
    this.cameraClampEnabled = Boolean(enabled);
    this.emitStats();
  }

  clearVisuals() {
    while (this.group.children.length) {
      const child = this.group.children.pop();
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose?.());
      else child.material?.dispose?.();
    }
  }

  dispose() {
    this.clearVisuals();
    this.group.parent?.remove(this.group);
  }

  getStats() {
    return {
      sizeMeters: this.sizeMeters,
      half: this.half,
      visible: this.visualsVisible,
      cameraClampEnabled: this.cameraClampEnabled
    };
  }

  emitStats() {
    this.callbacks.onBoundsStats?.(this.getStats());
  }
}
