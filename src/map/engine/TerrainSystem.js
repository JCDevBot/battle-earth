import * as THREE from "three";
import { SimpleNoise } from "../utils/SimpleNoise";

export class TerrainSystem {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.noise = new SimpleNoise();
    this.mesh = null;
    this.useRealData = true;
    this.terrainCtx = null;
    this.tileW = 0;
    this.tileH = 0;
    this.bounds = null;
    this.centerHeight = 0;
    this.params = { scale: 25, octaves: 4, persistence: 0.5 };
    this.heightExaggeration = 1.35;
    this.currentLat = 0;
    this.currentLon = 0;
    this.currentScaleFactor = 1;
    this.waterBasinModifiers = [];
  }

  async fetchTerrainTile(lat, lon) {
    const zoom = 14;
    const x = Math.floor(((lon + 180) / 360) * 2 ** zoom);
    const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** zoom);
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        this.terrainCtx = canvas.getContext("2d");
        this.terrainCtx.drawImage(img, 0, 0);
        this.tileW = img.width;
        this.tileH = img.height;

        const n = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** zoom))) * 180) / Math.PI;
        const s = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / 2 ** zoom))) * 180) / Math.PI;
        const w = (x / 2 ** zoom) * 360 - 180;
        const e = ((x + 1) / 2 ** zoom) * 360 - 180;
        this.bounds = { n, s, w, e, latRange: n - s, lonRange: e - w };
        resolve(true);
      };
      img.onerror = () => {
        this.useRealData = false;
        resolve(false);
      };
      img.src = url;
    });
  }

  setHeightExaggeration(value = 1.35) {
    const next = Number(value);
    this.heightExaggeration = Number.isFinite(next) ? Math.min(3, Math.max(0.25, next)) : 1.35;
  }

  getRawHeight(x, z, centerLat, centerLon, scaleFactor) {
    if (this.useRealData && this.terrainCtx && this.bounds) {
      const lat = centerLat - z / scaleFactor;
      const lon = centerLon + x / (scaleFactor * Math.cos((centerLat * Math.PI) / 180));
      const u = Math.min(Math.max((lon - this.bounds.w) / this.bounds.lonRange, 0), 1);
      const v = Math.min(Math.max((this.bounds.n - lat) / this.bounds.latRange, 0), 1);
      const px = Math.floor(u * (this.tileW - 1));
      const py = Math.floor(v * (this.tileH - 1));
      const data = this.terrainCtx.getImageData(px, py, 1, 1).data;
      return data[0] * 256 + data[1] + data[2] / 256 - 32768 - this.centerHeight;
    }

    let total = 0;
    let freq = 0.002;
    let amp = this.params.scale;
    for (let i = 0; i < this.params.octaves; i++) {
      total += this.noise.noise(x * freq, z * freq) * amp;
      amp *= this.params.persistence;
      freq *= 2;
    }
    return total;
  }

  getHeight(x, z, centerLat, centerLon, scaleFactor) {
    const base = this.getRawHeight(x, z, centerLat, centerLon, scaleFactor) * this.heightExaggeration;
    return base + this.getTerrainModifierDelta(x, z);
  }

  setWaterBasinModifiers(modifiers = []) {
    this.waterBasinModifiers = Array.isArray(modifiers) ? modifiers : [];
    this.applyHeightModifiersToMesh();
  }

  getTerrainModifierDelta(x, z) {
    let delta = 0;
    for (const modifier of this.waterBasinModifiers ?? []) {
      if (!modifier?.polygon?.length || !modifier.bounds) continue;
      const b = modifier.bounds;
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      if (!this.isPointInPolygon2(x, z, modifier.polygon)) continue;
      if ((modifier.holes ?? []).some((hole) => this.isPointInPolygon2(x, z, hole))) continue;
      const edgeDistance = this.distanceToPolygonEdges2(x, z, modifier.polygon);
      const rimWidth = Math.max(3, modifier.rimWidth ?? 12);
      const basinFactor = Math.min(1, Math.max(0.12, edgeDistance / rimWidth));
      delta -= (modifier.depth ?? 0.8) * basinFactor;
    }
    return delta;
  }

  applyHeightModifiersToMesh() {
    if (!this.mesh?.geometry?.attributes?.position) return;
    const pos = this.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.getHeight(x, z, this.currentLat, this.currentLon, this.currentScaleFactor));
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.attributes.normal.needsUpdate = true;
  }

  isPointInPolygon2(x, z, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, zi = polygon[i].y;
      const xj = polygon[j].x, zj = polygon[j].y;
      const intersect = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  distanceToPolygonEdges2(x, z, polygon) {
    let best = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const dx = b.x - a.x;
      const dz = b.y - a.y;
      const lenSq = dx * dx + dz * dz;
      const t = lenSq > 0 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.y) * dz) / lenSq)) : 0;
      const px = a.x + dx * t;
      const pz = a.y + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) best = d;
    }
    return Number.isFinite(best) ? best : 0;
  }


  getWorldHeight(x, z) {
    const height = this.getHeight(
      x,
      z,
      this.currentLat,
      this.currentLon,
      this.currentScaleFactor
    );
    return Number.isFinite(height) ? height : 0;
  }

  generateGround(width, depth, lat, lon, scaleFactor) {
    this.currentLat = lat;
    this.currentLon = lon;
    this.currentScaleFactor = scaleFactor;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }

    if (this.useRealData) {
      this.centerHeight = 0;
      this.centerHeight = this.getRawHeight(0, 0, lat, lon, scaleFactor);
    }

    const segments = Math.min(256, Math.max(128, Math.floor(Math.max(width, depth) / 6)));
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.getHeight(pos.getX(i), pos.getZ(i), lat, lon, scaleFactor));
    }

    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, this.materials.ground);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }
}
