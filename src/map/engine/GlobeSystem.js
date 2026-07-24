import * as THREE from "three";

/**
 * GlobeSystem — Earth globe with fly-to-location and stage transitions.
 *
 * Stages:
 *   "globe"    — Full earth sphere visible, camera orbiting in space
 *   "descend"  — Camera animating down toward selected lat/lon
 *   "regional" — Transitional flat terrain (globe fading out)
 *   "tactical" — Full game map active (globe removed from scene)
 *
 * The globe uses a procedural earth texture (continents/oceans) since we
 * can't bundle large satellite images. We load Natural Earth tiles at runtime.
 */

const EARTH_RADIUS = 6371; // km scale units — we'll scale appropriately
const GLOBE_SCALE = 200;   // visual radius in scene units
const ATMOSPHERE_COLOR = "#4a90c2";

export class GlobeSystem {
  constructor(scene, camera, controls, callbacks = {}) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.callbacks = callbacks;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.stage = "globe";
    this.targetLatLon = null;
    this.flyAnimation = null;
    this.globe = null;
    this.atmosphere = null;
    this.clouds = null;

    this.build();
  }

  build() {
    // Earth sphere
    const geo = new THREE.SphereGeometry(GLOBE_SCALE, 64, 48);
    const mat = new THREE.MeshPhongMaterial({
      color: "#2a6a3a",
      specular: "#222222",
      shininess: 15
    });
    this.globe = new THREE.Mesh(geo, mat);
    this.group.add(this.globe);

    // Load satellite texture async
    this.loadEarthTexture();

    // Atmosphere glow (slightly larger translucent sphere)
    const atmosGeo = new THREE.SphereGeometry(GLOBE_SCALE * 1.015, 48, 32);
    const atmosMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(ATMOSPHERE_COLOR) },
        uCameraPos: { value: this.camera.position }
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uCameraPos;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 viewDir = normalize(uCameraPos - vWorldPos);
          float rim = 1.0 - max(dot(viewDir, vWorldNormal), 0.0);
          float intensity = pow(rim, 3.0) * 0.7;
          gl_FragColor = vec4(uColor, intensity);
        }
      `
    });
    this.atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    this.group.add(this.atmosphere);

    // Graticule lines (lat/lon grid for visual reference)
    this.addGraticule();

    // Position camera for globe view
    this.setCameraForGlobe();
  }

  loadEarthTexture() {
    // Use a free Natural Earth / Blue Marble tile
    const loader = new THREE.TextureLoader();
    const url = "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg";
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.globe.material.map = texture;
      this.globe.material.color.set("#ffffff");
      this.globe.material.needsUpdate = true;
    }, undefined, () => {
      // Fallback: use procedural coloring (already set as green)
      this.applyProceduralEarth();
    });
  }

  applyProceduralEarth() {
    // Simple procedural: ocean blue base with noise-based land masses
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Ocean
    ctx.fillStyle = "#1a4a7a";
    ctx.fillRect(0, 0, 1024, 512);

    // Crude continent shapes using noise approximation
    const imageData = ctx.getImageData(0, 0, 1024, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 1024; x++) {
        const lon = (x / 1024) * 360 - 180;
        const lat = 90 - (y / 512) * 180;
        if (this.isLandApprox(lat, lon)) {
          const idx = (y * 1024 + x) * 4;
          // Vary green by latitude
          const temp = 1 - Math.abs(lat) / 90;
          imageData.data[idx] = Math.floor(40 + temp * 60);
          imageData.data[idx + 1] = Math.floor(80 + temp * 80);
          imageData.data[idx + 2] = Math.floor(30 + temp * 30);
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.globe.material.map = texture;
    this.globe.material.color.set("#ffffff");
    this.globe.material.needsUpdate = true;
  }

  isLandApprox(lat, lon) {
    // Very rough continental outlines for fallback
    // North America
    if (lat > 15 && lat < 72 && lon > -170 && lon < -50) return Math.random() > 0.3;
    // South America
    if (lat > -56 && lat < 12 && lon > -82 && lon < -34) return Math.random() > 0.35;
    // Europe
    if (lat > 35 && lat < 72 && lon > -12 && lon < 45) return Math.random() > 0.3;
    // Africa
    if (lat > -35 && lat < 37 && lon > -18 && lon < 52) return Math.random() > 0.3;
    // Asia
    if (lat > 5 && lat < 75 && lon > 45 && lon < 180) return Math.random() > 0.35;
    // Australia
    if (lat > -45 && lat < -10 && lon > 112 && lon < 155) return Math.random() > 0.35;
    return false;
  }

  addGraticule() {
    const material = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.12 });

    // Latitude lines every 30°
    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let lon = 0; lon <= 360; lon += 5) {
        points.push(this.latLonToVec3(lat, lon - 180, GLOBE_SCALE * 1.001));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this.group.add(new THREE.Line(geo, material));
    }

    // Longitude lines every 30°
    for (let lon = -180; lon < 180; lon += 30) {
      const points = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        points.push(this.latLonToVec3(lat, lon, GLOBE_SCALE * 1.001));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this.group.add(new THREE.Line(geo, material));
    }
  }

  latLonToVec3(lat, lon, radius = GLOBE_SCALE) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  setCameraForGlobe() {
    this.camera.near = 1;
    this.camera.far = 100000;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, GLOBE_SCALE * 3.2);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = GLOBE_SCALE * 1.3;
    this.controls.maxDistance = GLOBE_SCALE * 6;
    this.controls.enableDamping = true;
    this.controls.update();
  }

  /**
   * Fly the camera to a lat/lon on the globe, then trigger descent.
   */
  flyTo(lat, lon) {
    this.targetLatLon = { lat, lon };
    const surfacePoint = this.latLonToVec3(lat, lon, GLOBE_SCALE * 1.05);
    const cameraTarget = this.latLonToVec3(lat, lon, GLOBE_SCALE * 1.8);

    this.flyAnimation = {
      startPos: this.camera.position.clone(),
      endPos: cameraTarget.clone(),
      startTarget: this.controls.target.clone(),
      endTarget: surfacePoint.clone(),
      startTime: performance.now(),
      duration: 2200,
      phase: "approach" // approach → descend
    };

    this.stage = "descend";
    this.callbacks.onStageChange?.("descend");
  }

  /**
   * Transition from globe to tactical map generation.
   * Called after flyTo completes or manually.
   */
  transitionToTactical() {
    if (!this.targetLatLon) return;

    // Fade out globe
    this.stage = "tactical";
    this.group.visible = false;

    // Reset camera for tactical view
    this.camera.near = 1;
    this.camera.far = 10000;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 400, 600);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    this.controls.update();

    this.callbacks.onStageChange?.("tactical");
    this.callbacks.onLocationSelected?.(this.targetLatLon.lat, this.targetLatLon.lon);
  }

  /**
   * Return to globe view (e.g. after game ends or player wants new location).
   */
  returnToGlobe() {
    this.stage = "globe";
    this.group.visible = true;
    this.targetLatLon = null;
    this.flyAnimation = null;
    this.setCameraForGlobe();
    this.callbacks.onStageChange?.("globe");
  }

  /**
   * Add a marker pin at a lat/lon on the globe surface.
   */
  addMarker(lat, lon, color = "#ff4444") {
    const pos = this.latLonToVec3(lat, lon, GLOBE_SCALE * 1.01);
    const geo = new THREE.SphereGeometry(GLOBE_SCALE * 0.012, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    const marker = new THREE.Mesh(geo, mat);
    marker.position.copy(pos);
    this.group.add(marker);
    return marker;
  }

  update(deltaSeconds) {
    if (!this.flyAnimation) return;

    const elapsed = performance.now() - this.flyAnimation.startTime;
    const t = Math.min(1, elapsed / this.flyAnimation.duration);
    // Smooth ease-in-out
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    this.camera.position.lerpVectors(this.flyAnimation.startPos, this.flyAnimation.endPos, ease);
    this.controls.target.lerpVectors(this.flyAnimation.startTarget, this.flyAnimation.endTarget, ease);
    this.controls.update();

    // Update atmosphere shader
    if (this.atmosphere?.material?.uniforms?.uCameraPos) {
      this.atmosphere.material.uniforms.uCameraPos.value.copy(this.camera.position);
    }

    if (t >= 1) {
      if (this.flyAnimation.phase === "approach") {
        // Start descent phase — zoom in closer
        const surfacePoint = this.latLonToVec3(this.targetLatLon.lat, this.targetLatLon.lon, GLOBE_SCALE * 1.02);
        const closeUp = this.latLonToVec3(this.targetLatLon.lat, this.targetLatLon.lon, GLOBE_SCALE * 1.15);

        this.flyAnimation = {
          startPos: this.camera.position.clone(),
          endPos: closeUp,
          startTarget: this.controls.target.clone(),
          endTarget: surfacePoint,
          startTime: performance.now(),
          duration: 1500,
          phase: "descend"
        };
      } else {
        // Descent complete — trigger tactical transition
        this.flyAnimation = null;
        this.transitionToTactical();
      }
    }
  }

  getStage() {
    return this.stage;
  }

  isGlobeActive() {
    return this.stage === "globe" || this.stage === "descend";
  }

  dispose() {
    this.group.clear();
    this.scene.remove(this.group);
  }
}
