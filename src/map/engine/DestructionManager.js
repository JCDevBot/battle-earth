import * as THREE from "three";

const DAMAGE_STATE_BY_RATIO = [
  { state: "destroyed", maxRatio: 0 },
  { state: "critical", maxRatio: 0.25 },
  { state: "heavy", maxRatio: 0.5 },
  { state: "damaged", maxRatio: 0.8 },
  { state: "intact", maxRatio: 1.01 }
];

const MATERIAL_HEALTH = {
  building: 120,
  road: 90,
  tree: 25,
  bridge: 140,
  prop: 40
};

const DAMAGE_MULTIPLIER = {
  rifle: 0.28,
  grenade: 1,
  shell: 1.8,
  airstrike: 2.8,
  bullet: 0.35,
  explosive: 1,
  debug: 2.5
};

const STATE_COLOR = {
  damaged: 0xffb02e,
  heavy: 0xff6a00,
  critical: 0xff2f00,
  destroyed: 0x2a1b12
};

function stateForHealth(health, maxHealth) {
  const ratio = maxHealth <= 0 ? 0 : Math.max(0, health) / maxHealth;
  return DAMAGE_STATE_BY_RATIO.find((entry) => ratio <= entry.maxRatio)?.state ?? "intact";
}

function forEachRenderable(object, callback) {
  if (!object) return;
  if (object.isMesh || object.isInstancedMesh) callback(object);
  for (const child of object.children ?? []) forEachRenderable(child, callback);
}

function cloneMaterialForDamage(material, state) {
  if (!material) return material;
  const next = material.clone();
  next.transparent = true;
  const opacityByState = {
    intact: 1,
    damaged: 0.9,
    heavy: 0.75,
    critical: 0.55,
    destroyed: 0.22
  };
  next.opacity = opacityByState[state] ?? 1;
  if (state !== "intact") next.color?.lerp?.(new THREE.Color(STATE_COLOR[state] ?? 0xff6a00), 0.35);
  return next;
}

export class DestructionManager {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.features = new Map();
    this.damageOverlays = new Map();
    this.rubbleMeshes = new Map();
    this.decals = [];
    this.maxDecals = 80;
  }

  clear() {
    for (const overlay of this.damageOverlays.values()) this.disposeObject(overlay);
    for (const rubble of this.rubbleMeshes.values()) this.disposeObject(rubble);
    for (const decal of this.decals) this.disposeObject(decal);
    this.features.clear();
    this.damageOverlays.clear();
    this.rubbleMeshes.clear();
    this.decals = [];
    this.emitStats();
  }

  register({ id, category, meshes = [], position, bounds, maxHealth, tags = {} }) {
    const resolvedId = id ?? crypto.randomUUID();
    const health = maxHealth ?? MATERIAL_HEALTH[category] ?? 60;
    const feature = {
      id: resolvedId,
      category,
      meshes,
      position: position?.clone?.() ?? new THREE.Vector3(),
      bounds,
      maxHealth: health,
      health,
      state: "intact",
      tags
    };

    for (const mesh of meshes) {
      mesh.userData.destructibleId = resolvedId;
      mesh.userData.feature = mesh.userData.feature ?? category;
      mesh.userData.originalScale = mesh.scale.clone();
      mesh.userData.originalVisible = mesh.visible;

      forEachRenderable(mesh, (renderable) => {
        renderable.userData.destructibleId = resolvedId;
        renderable.userData.feature = renderable.userData.feature ?? category;
        renderable.userData.originalScale = renderable.scale.clone();
        renderable.userData.originalVisible = renderable.visible;
        if (!renderable.userData.originalMaterial && renderable.material) renderable.userData.originalMaterial = renderable.material;
      });
    }

    this.features.set(resolvedId, feature);
    this.emitStats();
    return feature;
  }

  applyDamage({ targetId, amount = 10, type = "debug", position = null, radius = 0 }) {
    if (radius > 0 && position) return this.applyRadiusDamage({ position, radius, amount, type });

    const feature = this.features.get(targetId);
    if (!feature || feature.state === "destroyed") return null;

    const scaledAmount = amount * (DAMAGE_MULTIPLIER[type] ?? 1);
    feature.health = Math.max(0, feature.health - scaledAmount);
    const nextState = stateForHealth(feature.health, feature.maxHealth);

    if (nextState !== feature.state) {
      feature.state = nextState;
      this.applyVisualState(feature);
      this.callbacks.onDamageEvent?.({
        id: feature.id,
        category: feature.category,
        state: feature.state,
        health: feature.health,
        maxHealth: feature.maxHealth
      });
    }

    this.emitStats();
    return feature;
  }

  applyRadiusDamage({ position, radius, amount = 25, type = "explosive" }) {
    const affected = [];
    for (const feature of this.features.values()) {
      if (feature.state === "destroyed") continue;
      const distance = feature.position.distanceTo(position);
      if (distance > radius) continue;
      const falloff = 1 - distance / radius;
      const result = this.applyDamage({
        targetId: feature.id,
        amount: amount * Math.max(0.15, falloff),
        type
      });
      if (result) affected.push(result);
    }

    this.addImpactDecal(position, radius, type);
    return affected;
  }

  reset() {
    for (const feature of this.features.values()) {
      feature.health = feature.maxHealth;
      feature.state = "intact";
      this.applyVisualState(feature);
    }
    for (const decal of this.decals) this.disposeObject(decal);
    this.decals = [];
    this.emitStats();
  }

  applyVisualState(feature) {
    const opacityByState = {
      intact: 1,
      damaged: 0.9,
      heavy: 0.75,
      critical: 0.55,
      destroyed: 0.22
    };

    const yScaleByState = {
      intact: 1,
      damaged: 0.96,
      heavy: 0.86,
      critical: 0.68,
      destroyed: 0.16
    };

    for (const mesh of feature.meshes) {
      mesh.visible = true;
      const originalScale = mesh.userData.originalScale ?? new THREE.Vector3(1, 1, 1);
      const buildingScale = feature.category === "building" ? { damaged: 1, heavy: 0.97, critical: 0.9, destroyed: 0.28 } : yScaleByState;
      mesh.scale.set(originalScale.x, originalScale.y * (buildingScale[feature.state] ?? 1), originalScale.z);

      forEachRenderable(mesh, (renderable) => {
        renderable.visible = true;
        if (feature.state === "intact" && renderable.userData.originalMaterial) {
          renderable.material = renderable.userData.originalMaterial;
        } else if (renderable.material) {
          renderable.material = cloneMaterialForDamage(renderable.userData.originalMaterial ?? renderable.material, feature.state);
        }
      });
    }

    if (feature.state === "intact") {
      this.removeOverlay(feature.id);
      this.removeRubble(feature.id);
    } else {
      this.ensureOverlay(feature);
      if (feature.state === "destroyed") this.ensureRubble(feature);
    }
  }

  ensureOverlay(feature) {
    let ring = this.damageOverlays.get(feature.id);
    if (!ring) {
      const radius = Math.max(3, feature.bounds?.radius ?? 5);
      const geometry = new THREE.RingGeometry(radius * 0.5, radius * 0.65, 24);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff7a18,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      });
      ring = new THREE.Mesh(geometry, material);
      ring.rotateX(-Math.PI / 2);
      this.scene.add(ring);
      this.damageOverlays.set(feature.id, ring);
    }

    ring.position.copy(feature.position);
    ring.position.y = 0.38;
    ring.material.color.setHex(STATE_COLOR[feature.state] ?? 0xff7a18);
  }

  ensureRubble(feature) {
    if (this.rubbleMeshes.has(feature.id)) return;

    const radius = Math.max(3, Math.min(feature.category === "road" ? 18 : 24, feature.bounds?.radius ?? 6));

    if (feature.category === "road") {
      const craterGroup = new THREE.Group();

      const craterGeometry = new THREE.CircleGeometry(radius, 28);
      const craterMaterial = new THREE.MeshStandardMaterial({
        color: 0x15110f,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
        depthWrite: false
      });
      const crater = new THREE.Mesh(craterGeometry, craterMaterial);
      crater.rotateX(-Math.PI / 2);
      crater.position.y = 0.08;
      craterGroup.add(crater);

      const bermGeometry = new THREE.TorusGeometry(radius * 0.82, Math.max(0.18, radius * 0.08), 6, 20);
      const bermMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3d34, roughness: 1, metalness: 0 });
      const berm = new THREE.Mesh(bermGeometry, bermMaterial);
      berm.rotateX(Math.PI / 2);
      berm.position.y = 0.24;
      craterGroup.add(berm);

      craterGroup.position.set(feature.position.x, 0.64, feature.position.z);
      craterGroup.rotation.y = Math.random() * Math.PI;
      craterGroup.userData.feature = "road-crater";
      this.scene.add(craterGroup);
      this.rubbleMeshes.set(feature.id, craterGroup);
      return;
    }

    if (feature.category === "building") {
      const rubbleGroup = new THREE.Group();
      const rubbleMaterial = new THREE.MeshStandardMaterial({ color: 0x6d6258, roughness: 0.98, metalness: 0 });
      const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x302820, roughness: 1, metalness: 0 });
      const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x5f6669, roughness: 0.75, metalness: 0.15 });
      const chunkCount = Math.max(8, Math.min(42, Math.round(radius * 1.6)));
      const buildingHeight = Math.max(4, feature.bounds?.height ?? 8);

      for (let i = 0; i < chunkCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const offset = Math.sqrt(Math.random()) * radius * 0.85;
        const size = 0.8 + Math.random() * Math.min(4, radius * 0.18);
        const height = 0.35 + Math.random() * Math.min(2.2, buildingHeight * 0.12);
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(size * (0.8 + Math.random()), height, size * (0.7 + Math.random())), rubbleMaterial);
        chunk.position.set(Math.cos(angle) * offset, height / 2, Math.sin(angle) * offset);
        chunk.rotation.set(Math.random() * 0.45, Math.random() * Math.PI, Math.random() * 0.45);
        rubbleGroup.add(chunk);
      }

      const dust = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.9, radius * 0.72, 0.45, 9),
        darkMaterial
      );
      dust.position.y = 0.2;
      dust.rotation.y = Math.random() * Math.PI;
      rubbleGroup.add(dust);

      const beamCount = Math.max(1, Math.min(6, Math.round(radius / 5)));
      for (let i = 0; i < beamCount; i++) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(Math.max(5, radius * 0.8), 0.25, 0.25), metalMaterial);
        beam.position.set((Math.random() - 0.5) * radius, 0.65 + Math.random() * 0.8, (Math.random() - 0.5) * radius);
        beam.rotation.set(Math.random() * 0.35, Math.random() * Math.PI, Math.random() * 0.35);
        rubbleGroup.add(beam);
      }

      rubbleGroup.position.set(feature.position.x, 0.22, feature.position.z);
      rubbleGroup.userData.feature = "building-rubble";
      this.scene.add(rubbleGroup);
      this.rubbleMeshes.set(feature.id, rubbleGroup);
      return;
    }

    if (feature.category === "tree") {
      const stumpGroup = new THREE.Group();
      const stumpMaterial = new THREE.MeshStandardMaterial({ color: 0x3f2418, roughness: 1 });
      const logMaterial = new THREE.MeshStandardMaterial({ color: 0x4d2c1e, roughness: 1 });
      const stumpCount = Math.max(1, Math.min(8, Math.round(radius / 3)));

      for (let i = 0; i < stumpCount; i++) {
        const angle = (i / stumpCount) * Math.PI * 2 + Math.random() * 0.5;
        const offset = Math.random() * radius * 0.55;
        const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.8 + Math.random() * 0.5, 6), stumpMaterial);
        stump.position.set(Math.cos(angle) * offset, 0.4, Math.sin(angle) * offset);
        stump.rotation.y = Math.random() * Math.PI;
        stumpGroup.add(stump);
      }

      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, Math.max(4, radius * 1.1), 7), logMaterial);
      log.rotateZ(Math.PI / 2);
      log.rotation.y = Math.random() * Math.PI;
      log.position.y = 0.35;
      stumpGroup.add(log);

      stumpGroup.position.set(feature.position.x, 0.18, feature.position.z);
      stumpGroup.userData.feature = "tree-destruction";
      this.scene.add(stumpGroup);
      this.rubbleMeshes.set(feature.id, stumpGroup);
      return;
    }

    const geometry = new THREE.CylinderGeometry(radius, radius * 0.8, 0.8, 7);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6d6258,
      roughness: 0.95,
      metalness: 0
    });
    const rubble = new THREE.Mesh(geometry, material);
    rubble.position.set(feature.position.x, 0.42, feature.position.z);
    rubble.rotation.y = Math.random() * Math.PI;
    rubble.userData.feature = "rubble";
    this.scene.add(rubble);
    this.rubbleMeshes.set(feature.id, rubble);
  }

  removeRubble(id) {
    const rubble = this.rubbleMeshes.get(id);
    if (!rubble) return;
    this.disposeObject(rubble);
    this.rubbleMeshes.delete(id);
  }

  removeOverlay(id) {
    const overlay = this.damageOverlays.get(id);
    if (!overlay) return;
    this.disposeObject(overlay);
    this.damageOverlays.delete(id);
  }

  addImpactDecal(position, radius, type) {
    const decalRadius = Math.max(2, Math.min(radius * 0.32, 35));
    const geometry = new THREE.CircleGeometry(decalRadius, 24);
    const material = new THREE.MeshBasicMaterial({
      color: type === "rifle" ? 0x1f1f1f : 0x17100c,
      transparent: true,
      opacity: type === "rifle" ? 0.45 : 0.65,
      depthWrite: false
    });
    const decal = new THREE.Mesh(geometry, material);
    decal.rotateX(-Math.PI / 2);
    decal.position.set(position.x, 0.62, position.z);
    decal.userData.feature = "damage-decal";
    this.scene.add(decal);
    this.decals.push(decal);

    while (this.decals.length > this.maxDecals) this.disposeObject(this.decals.shift());
  }

  getStats() {
    const stats = {
      total: this.features.size,
      intact: 0,
      damaged: 0,
      heavy: 0,
      critical: 0,
      destroyed: 0,
      decals: this.decals.length,
      byCategory: {}
    };

    for (const feature of this.features.values()) {
      stats[feature.state] += 1;
      stats.byCategory[feature.category] = (stats.byCategory[feature.category] ?? 0) + 1;
    }

    return stats;
  }

  emitStats() {
    this.callbacks.onDestructionStats?.(this.getStats());
  }

  disposeObject(object) {
    object.parent?.remove(object);
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
      else child.material?.dispose?.();
    });
    if (!object.traverse) {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    }
  }
}
