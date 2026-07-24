import * as THREE from "three";
import { SimpleNoise } from "../utils/SimpleNoise";

/**
 * TerrainLOD — Multi-resolution terrain that behaves like a map zoom.
 *
 * Strategy:
 * - 3 LOD rings: near (high-res), mid, far (low-res)
 * - Each ring is a PlaneGeometry with vertex displacement from Terrarium tiles
 * - Camera altitude drives which rings are visible and at what resolution
 * - Terrain material blends between stylized painted look (BC2 vibe) and detail texture
 */

const LOD_LEVELS = [
  { label: "high", zoom: 15, segments: 192, radius: 500, minAlt: 0, maxAlt: 400 },
  { label: "mid", zoom: 14, segments: 128, radius: 1000, minAlt: 0, maxAlt: 800 },
  { label: "low", zoom: 12, segments: 64, radius: 2000, minAlt: 200, maxAlt: Infinity }
];

function terrariumHeight(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

export class TerrainLODSystem {
  constructor(scene) {
    this.scene = scene;
    this.noise = new SimpleNoise();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.levels = [];
    this.tileCache = new Map();
    this.centerLat = 0;
    this.centerLon = 0;
    this.centerHeight = 0;
    this.scaleFactor = 111139;
    this.currentSize = 1000;
    this.material = this.createTerrainMaterial();
  }

  createTerrainMaterial() {
    return new THREE.ShaderMaterial({
      lights: true,
      uniforms: {
        ...THREE.UniformsLib.lights,
        uColorLow: { value: new THREE.Color("#5a6e32") },
        uColorMid: { value: new THREE.Color("#84934A") },
        uColorHigh: { value: new THREE.Color("#a59d6b") },
        uColorRock: { value: new THREE.Color("#6b6355") },
        uFogColor: { value: new THREE.Color("#8ba4b0") },
        uFogNear: { value: 600 },
        uFogFar: { value: 2200 }
      },
      vertexShader: `
        #include <common>
        #include <lights_pars_begin>
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vHeight;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vNormal = normalize(normalMatrix * normal);
          vHeight = position.y;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        #include <common>
        #include <lights_pars_begin>
        uniform vec3 uColorLow;
        uniform vec3 uColorMid;
        uniform vec3 uColorHigh;
        uniform vec3 uColorRock;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vHeight;

        void main() {
          // Height-based color blend
          float h = clamp(vHeight / 40.0, -1.0, 1.0);
          vec3 baseColor = mix(uColorLow, uColorMid, smoothstep(-0.5, 0.2, h));
          baseColor = mix(baseColor, uColorHigh, smoothstep(0.3, 0.8, h));

          // Steep slope = rock
          float slope = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));
          baseColor = mix(baseColor, uColorRock, smoothstep(0.35, 0.65, slope));

          // Simple directional light
          float NdotL = max(dot(vNormal, normalize(vec3(0.3, 1.0, 0.2))), 0.0);
          vec3 lit = baseColor * (0.45 + 0.55 * NdotL);

          // Distance fog
          float dist = length(vWorldPos - cameraPosition);
          float fog = smoothstep(uFogNear, uFogFar, dist);
          lit = mix(lit, uFogColor, fog);

          gl_FragColor = vec4(lit, 1.0);
        }
      `
    });
  }

  async generate(lat, lon, sizeMeters) {
    this.centerLat = lat;
    this.centerLon = lon;
    this.currentSize = sizeMeters;
    this.group.clear();
    this.levels = [];

    // Fetch center height for normalization
    const centerTile = await this.fetchTile(lat, lon, 14);
    if (centerTile) {
      this.centerHeight = this.sampleTile(centerTile, lat, lon);
    }

    for (const lod of LOD_LEVELS) {
      const tile = await this.fetchTile(lat, lon, lod.zoom);
      const mesh = this.buildLevelMesh(lod, tile);
      mesh.visible = true;
      mesh.userData = { lodLabel: lod.label, minAlt: lod.minAlt, maxAlt: lod.maxAlt };
      this.group.add(mesh);
      this.levels.push({ mesh, config: lod });
    }
  }

  buildLevelMesh(lod, tile) {
    const size = lod.radius * 2;
    const geo = new THREE.PlaneGeometry(size, size, lod.segments, lod.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.getHeight(x, z, tile));
    }

    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.receiveShadow = true;
    return mesh;
  }

  getHeight(x, z, tile) {
    const lat = this.centerLat - z / this.scaleFactor;
    const lon = this.centerLon + x / (this.scaleFactor * Math.cos((this.centerLat * Math.PI) / 180));

    if (tile) {
      const h = this.sampleTile(tile, lat, lon);
      if (Number.isFinite(h)) return h - this.centerHeight;
    }

    // Procedural fallback
    let total = 0, freq = 0.002, amp = 25;
    for (let i = 0; i < 4; i++) {
      total += this.noise.noise(x * freq, z * freq) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return total;
  }

  getWorldHeight(x, z) {
    // Use the highest-res available tile for gameplay queries
    const tile = this.tileCache.get(14) || this.tileCache.get(15);
    return this.getHeight(x, z, tile);
  }

  sampleTile(tile, lat, lon) {
    const u = Math.min(Math.max((lon - tile.bounds.w) / tile.bounds.lonRange, 0), 1);
    const v = Math.min(Math.max((tile.bounds.n - lat) / tile.bounds.latRange, 0), 1);
    const px = Math.floor(u * (tile.width - 1));
    const py = Math.floor(v * (tile.height - 1));
    const idx = (py * tile.width + px) * 4;
    return terrariumHeight(tile.data[idx], tile.data[idx + 1], tile.data[idx + 2]);
  }

  async fetchTile(lat, lon, zoom) {
    if (this.tileCache.has(zoom)) return this.tileCache.get(zoom);

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
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        const n = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** zoom))) * 180) / Math.PI;
        const s = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / 2 ** zoom))) * 180) / Math.PI;
        const w = (x / 2 ** zoom) * 360 - 180;
        const e = ((x + 1) / 2 ** zoom) * 360 - 180;

        const tile = {
          data: imageData.data,
          width: img.width,
          height: img.height,
          bounds: { n, s, w, e, latRange: n - s, lonRange: e - w }
        };
        this.tileCache.set(zoom, tile);
        resolve(tile);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  update(camera) {
    if (!camera || this.levels.length === 0) return;
    const alt = camera.position.y;

    for (const { mesh, config } of this.levels) {
      mesh.visible = alt >= config.minAlt && alt < config.maxAlt;
    }
  }

  dispose() {
    this.group.clear();
    this.levels = [];
    this.tileCache.clear();
  }
}
