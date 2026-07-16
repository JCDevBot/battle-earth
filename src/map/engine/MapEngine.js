import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createMapMaterials } from "../materials/MaterialFactory";
import { TerrainSystem } from "./TerrainSystem";
import { TerrainLODSystem } from "./TerrainLODSystem";
import { PostProcessingPipeline } from "./PostProcessingPipeline";
import { GlobeSystem } from "./GlobeSystem";
import { MapFeatureBuilder } from "../builders/MapFeatureBuilder";
import { OSMService } from "../services/OSMService";
import { analyzeOsmData } from "../services/analyzeOsmData";
import { generateProceduralOsmData } from "../services/ProceduralFallback";
import { boundsFromCenter } from "../utils/geo";
import { DestructionManager } from "./DestructionManager";
import { PerformanceManager } from "./PerformanceManager";
import { TacticalManager } from "./TacticalManager";
import { InfantryManager } from "./InfantryManager";
import { FogOfWarManager } from "./FogOfWarManager";
import { TerritoryManager } from "./TerritoryManager";
import { NavigationManager } from "./NavigationManager";
import { MapBoundsManager } from "./MapBoundsManager";
import { PlanetaryCanopyService } from "../services/PlanetaryCanopyService";
import { StrategicPOIManager } from "./StrategicPOIManager";
import { BattlefieldGridManager } from "./BattlefieldGridManager";
import { TacticalBuildingManager } from "./TacticalBuildingManager";

const SANDBOX_WEAPONS = {
  rifle: { label: "Rifle", amount: 18, radius: 3, type: "rifle" },
  grenade: { label: "Grenade", amount: 55, radius: 28, type: "grenade" },
  shell: { label: "Shell", amount: 90, radius: 55, type: "shell" },
  airstrike: { label: "Airstrike", amount: 125, radius: 95, type: "airstrike" }
};

export class MapEngine {
  constructor(mountEl, callbacks = {}) {
    this.mountEl = mountEl;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#050510");
    this.camera = new THREE.PerspectiveCamera(45, mountEl.clientWidth / mountEl.clientHeight, 2, 8000);
    this.camera.position.set(0, 0, 640);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    this.renderer.setPixelRatio(1);
    mountEl.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    // D44-R.1: keep tactical navigation anchored to the ground point under screen center.
    // OrbitControls can otherwise drift the view when changing height/pitch.
    this.controls.enablePan = false;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 40;
    this.controls.maxDistance = 2400;
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.48;

    this.scene.add(new THREE.HemisphereLight(0xdff3ff, 0x46652f, 1.25));
    const directional = new THREE.DirectionalLight(0xfff3d6, 1.65);
    directional.position.set(-360, 900, 420);
    directional.castShadow = false;
    directional.shadow.mapSize.set(1024, 1024);
    directional.shadow.camera.left = -900;
    directional.shadow.camera.right = 900;
    directional.shadow.camera.top = 900;
    directional.shadow.camera.bottom = -900;
    directional.shadow.camera.near = 50;
    directional.shadow.camera.far = 1800;
    this.scene.add(directional);

    this.materials = createMapMaterials();
    this.terrain = new TerrainSystem(this.scene, this.materials);
    this.terrainLOD = new TerrainLODSystem(this.scene);
    // Phase 10G.2: disable the experimental terrain LOD renderer by default.
    // The main terrain mesh remains the authoritative battlefield surface.
    // The old multi-ring terrain LOD caused broad color shifts and feature disappearance while zooming.
    this.useTerrainLodRenderer = false;
    this.postProcessing = new PostProcessingPipeline(this.renderer, this.scene, this.camera);
    this.postProcessing.setPreset("bc2");
    // D28 FPS rescue: post-processing is beautiful but expensive on older integrated GPUs.
    // Keep the pipeline available, but start with the direct renderer for playability.
    this.postProcessing.setEnabled(false);

    // Globe system — pre-game Earth view (skip if launched directly into tactical)
    if (!callbacks.skipGlobe) {
      this.globe = new GlobeSystem(this.scene, this.camera, this.controls, {
        onStageChange: (stage) => {
          this.callbacks.onStageChange?.(stage);
          if (stage === "tactical") {
            this.scene.background = new THREE.Color("#a8daf0");
            this.scene.fog = new THREE.Fog("#c0e4f4", 1000, 2800);
          }
        },
        onLocationSelected: (lat, lon) => {
          this.callbacks.onLocationSelected?.(lat, lon);
        }
      });
      this.gameStage = "globe";
    } else {
      this.globe = null;
      this.gameStage = "tactical";
      this.scene.background = new THREE.Color("#a8daf0");
      this.scene.fog = new THREE.Fog("#c0e4f4", 1000, 2800);
      this.camera.position.set(0, 400, 600);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
    this.destruction = new DestructionManager(this.scene, {
      onDestructionStats: (stats) => this.callbacks.onDestructionStats?.(stats),
      onDamageEvent: (event) => {
        this.log(`${event.category} ${event.id} is ${event.state} (${Math.ceil(event.health)}/${Math.ceil(event.maxHealth)} HP).`, event.state === "destroyed" ? "warn" : "info");
        this.tactical?.handleDamageEvent?.(event, this.destruction);
        this.navigation?.updateFromDestruction?.(this.destruction);
        this.infantry?.repathActiveSquads?.();
      }
    });
    this.builder = new MapFeatureBuilder(this.scene, this.terrain, this.materials, this.destruction);
    this.performance = new PerformanceManager({
      onPerformanceStats: (stats) => this.callbacks.onPerformanceStats?.(stats)
    });
    this.tactical = new TacticalManager(this.scene, {
      onTacticalStats: (stats) => this.callbacks.onTacticalStats?.(stats),
      onTacticalEvent: (event) => this.callbacks.onTacticalEvent?.(event)
    });
    this.infantry = new InfantryManager(this.scene, {
      onInfantryStats: (stats) => this.callbacks.onInfantryStats?.(stats),
      getGroundHeight: (x, z) => this.terrain?.getWorldHeight?.(x, z) ?? 0,
      getPath: (start, end) => this.navigation?.findPath?.(start, end),
      onInfantryEvent: (event) => {
        if (event.type === "spawn") this.log(`${event.squad.label} spawned (${event.squad.side}).`, event.squad.side === "friendly" ? "success" : "warn");
        if (event.type === "select") this.log(`${event.squad.label} selected.`, "info");
        if (event.type === "order") this.log(`${event.squad.label} ordered to move.`, "success");
        if (event.type === "mission") this.log(`${event.squad.label}: ${event.missionType} mission assigned.`, "success");
        if (event.type === "buildingOrder") this.log(`${event.squad.label}: ${event.order.type === "occupy_building" ? "occupy building" : "use building as cover"} (${event.order.fireMode}${event.order.rallyPoint ? ", rally" : ""}).`, "success");
        if (event.type === "hold") this.log(`${event.squad.label} ordered to hold position.`, "success");
        if (event.type === "state") this.log(`${event.squad.label}: ${event.squad.state} / ${event.squad.mission}.`, event.squad.state === "engaged" || event.squad.state === "suppressed" ? "warn" : "info");
        if (event.type === "contact") this.log(`${event.squad.label}: CONTACT ${event.bearing}, ${event.range}m, confidence ${event.confidence}%.`, "warn");
        if (event.type === "fallback") this.log(`${event.squad.label}: falling back along known route.`, "warn");
        if (event.type === "casualty") this.log(`${event.squad.label}: casualty reported (${event.casualties}).`, "error");
        if (event.type === "wounded") this.log(`${event.squad.label}: soldier wounded.`, "warn");
        if (event.type === "neutralized") this.log(`${event.squad.label}: combat ineffective.`, "error");
      }
    });
    this.fog = new FogOfWarManager(this.scene, {
      onFogStats: (stats) => this.callbacks.onFogStats?.(stats)
    });
    this.territory = new TerritoryManager(this.scene, {
      onTerritoryStats: (stats) => this.callbacks.onTerritoryStats?.(stats)
    });
    this.navigation = new NavigationManager({
      onNavigationStats: (stats) => this.callbacks.onNavigationStats?.(stats)
    });
    this.bounds = new MapBoundsManager(this.scene, {
      onBoundsStats: (stats) => this.callbacks.onBoundsStats?.(stats)
    });
    this.strategicPois = new StrategicPOIManager(this.scene, {
      onStrategicPoiStats: (stats) => this.callbacks.onStrategicPoiStats?.(stats)
    });
    this.battlefieldGrid = new BattlefieldGridManager(this.scene, {
      onBattlefieldGridStats: (stats) => this.callbacks.onBattlefieldGridStats?.(stats)
    });
    this.tacticalBuildings = new TacticalBuildingManager(this.scene, {
      onStats: (stats) => this.callbacks.onTacticalBuildingStats?.(stats)
    });
    this.cameraSettings = {
      panSpeed: 240,
      elevationSpeed: 360,
      keyboardRotateSpeed: 1.35,
      minHeightAboveGround: 18,
      maxHeightAboveGround: 1800,
      edgePan: false,
      cameraClamp: true,
      followSelected: false,
      terrainDepth: 1
    };
    this.keysDown = new Set();
    this.osm = new OSMService({ logger: this.createLogger() });
    this.canopy = new PlanetaryCanopyService({ logger: this.createLogger() });
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.debugDamageEnabled = false;
    this.pointerInsideMap = false;
    this.sandboxWeapon = "grenade";
    this.deployMode = null;
    this.squadCommandMode = null;
    this.pendingBuildingHold = null;
    this.pendingTerrainHold = null;
    this.terrainMissionPoint = null;
    this.buildingCommandMarker = this.createBuildingCommandMarker();
    this.buildingOccupancyMarkers = new Map();
    this.buildingOccupancyMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this.enemyBuildingOccupancyMaterial = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this.radiusPreview = this.createRadiusPreview();
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onPointerLeave = this.handlePointerLeave.bind(this);

    this.onResize = this.resize.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.onContextMenu = (event) => event.preventDefault();
    this.renderer.domElement.addEventListener("contextmenu", this.onContextMenu);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointerleave", this.onPointerLeave);
    this.animate();
  }

  createLogger() {
    return {
      log: (message) => this.log(message, "info"),
      warn: (message) => this.log(message, "warn"),
      error: (message) => this.log(message, "error")
    };
  }

  log(message, type = "info") {
    this.callbacks.onLog?.(message, type);
  }

  async generateMap(config) {
    this.callbacks.onLoadingChange?.(true);
    try {
      const mapWidthMeters = Number(config.mapWidthMeters) || Number(config.sizeMeters) || 1000;
      const mapDepthMeters = Number(config.mapDepthMeters) || Number(config.sizeMeters) || mapWidthMeters;
      const operationalSizeMeters = Math.max(mapWidthMeters, mapDepthMeters);
      const bounds = boundsFromCenter(config.lat, config.lon, operationalSizeMeters, mapWidthMeters, mapDepthMeters);
      this.terrain.useRealData = config.useRealTerrain;
      this.terrain.setHeightExaggeration?.(config.terrainScale ?? 1.35);

      if (config.useRealTerrain) {
        this.log("Fetching terrain tiles.");
        await this.terrain.fetchTerrainTile(config.lat, config.lon);
        if (this.useTerrainLodRenderer) {
          await this.terrainLOD.generate(config.lat, config.lon, operationalSizeMeters);
        } else {
          this.terrainLOD?.dispose?.();
        }
      }

      const result = await this.osm.fetchMapData(bounds.south, bounds.west, bounds.north, bounds.east, {
        profileName: config.osmProfile
      });

      const osmCount = result.data.elements?.length ?? 0;
      this.log(`OSM elements: ${osmCount}${result.fromCache ? " from cache" : ""}.`, "success");

      let mapData = result.data;
      if (osmCount < 20) {
        this.log("Sparse OSM data — generating procedural fill.", "warn");
        const procedural = generateProceduralOsmData({ lat: config.lat, lon: config.lon, sizeMeters: operationalSizeMeters, seed: config.seed });
        mapData = { elements: [...(result.data.elements ?? []), ...procedural.elements] };
      }

      const analysis = analyzeOsmData(mapData);
      this.callbacks.onAnalysis?.(analysis);
      console.table(analysis);

      let externalCanopy = null;
      if (config.vegetationSource === "planetaryNaip") {
        this.callbacks.onCanopyStats?.({
          enabled: true,
          available: false,
          source: "planetary-computer-naip",
          mode: "planetaryNaip",
          queryExecuted: false,
          stage: "queued",
          message: "Queued Planetary Computer NAIP canopy probe."
        });
        try {
          this.log("Fetching Microsoft Planetary Computer NAIP canopy probe.", "info");
          externalCanopy = await this.canopy.fetchCanopyGrid({ lat: config.lat, lon: config.lon, sizeMeters: operationalSizeMeters });
          this.callbacks.onCanopyStats?.(externalCanopy);
          this.log(externalCanopy.message ?? "Canopy probe complete.", externalCanopy.available ? "success" : "warn");
        } catch (error) {
          externalCanopy = { enabled: true, available: false, source: "planetary-computer-naip", mode: "planetaryNaip", queryExecuted: true, querySucceeded: false, stage: "engine-fetch", message: error.message };
          this.callbacks.onCanopyStats?.(externalCanopy);
          this.log(`Canopy probe failed: ${error.message}`, "warn");
        }
      } else {
        this.callbacks.onCanopyStats?.({ enabled: false, available: false, source: "osm-only", mode: "osmOnly", queryExecuted: false, stage: "disabled", message: "Vegetation source is set to OSM + procedural." });
      }

      this.performance?.removeLayerEntries?.("units");
      this.infantry?.clear?.();
      this.builder.build(mapData, { ...config, sizeMeters: operationalSizeMeters, mapWidthMeters, mapDepthMeters, externalCanopy });
      this.strategicPois?.build?.({ mapData, builder: this.builder, terrain: this.terrain, sizeMeters: operationalSizeMeters });
      const initialObjectiveSources = [...(this.strategicPois?.pois ?? []), ...(this.strategicPois?.hqs ?? [])];
      this.tacticalBuildings?.build?.({ builder: this.builder, terrain: this.terrain, pois: initialObjectiveSources });
      this.battlefieldGrid?.build?.({ sizeMeters: operationalSizeMeters, terrain: this.terrain, pois: initialObjectiveSources });
      this.callbacks.onGenerationStats?.(this.builder.getGenerationDiagnostics?.() ?? {});
      if (config.vegetationSource === "planetaryNaip") {
        this.callbacks.onCanopyStats?.({
          ...(externalCanopy ?? {}),
          ...(this.builder.getCanopyAuthorityDiagnostics?.() ?? {})
        });
      }
      this.performance.indexBuilder(this.builder, this.terrain);
      const layerVisibility = this.performance?.getStats?.().layerVisibility ?? {};
      this.builder?.buildingLOD?.setVisible?.(layerVisibility.buildings !== false);
      this.builder?.vegetationLOD?.setVisible?.(layerVisibility.vegetation !== false);
      this.builder?.setGroundClassificationDebugVisible?.(layerVisibility["classification-debug"] !== false);
      this.tactical.indexDestructibles(this.destruction);
      this.navigation?.build?.(operationalSizeMeters, this.destruction, (x, z) => this.terrain?.getWorldHeight?.(x, z) ?? 0);
      this.fog?.build?.(operationalSizeMeters, (x, z) => this.terrain?.getWorldHeight?.(x, z) ?? 0);
      const objectiveSources = [...(this.strategicPois?.pois ?? []), ...(this.strategicPois?.hqs ?? [])];
      this.territory?.build?.(operationalSizeMeters, (x, z) => this.terrain?.getWorldHeight?.(x, z) ?? 0, objectiveSources);
      this.battlefieldGrid?.build?.({ sizeMeters: operationalSizeMeters, terrain: this.terrain, pois: objectiveSources, territoryCells: this.territory?.cells ?? [] });
      this.bounds?.build?.(operationalSizeMeters, (x, z) => this.terrain?.getWorldHeight?.(x, z) ?? 0);
      this.callbacks.onDestructionStats?.(this.destruction.getStats());
      this.callbacks.onTacticalStats?.(this.tactical.getStats());
      this.applyReplicaModeDefaults();
      this.frameMap(operationalSizeMeters, mapWidthMeters, mapDepthMeters);
      this.log("Map generated.", "success");
    } catch (error) {
      console.error(error);
      this.log(error.message ?? "Map generation failed.", "error");
    } finally {
      this.callbacks.onLoadingChange?.(false);
    }
  }

  frameMap(sizeMeters, widthMeters = sizeMeters, depthMeters = sizeMeters) {
    const maxDim = Math.max(sizeMeters, widthMeters, depthMeters);
    this.camera.position.set(0, Math.max(360, maxDim * 0.58), Math.max(560, depthMeters * 0.72));
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  applyReplicaModeDefaults() {
    const replicaVisible = { terrain: true, roads: true, buildings: true, vegetation: true, water: true, props: true, units: true };
    const replicaHidden = ["tactical-buildings", "territory", "frontline", "strategic-pois", "objective-hierarchy", "influence-rings", "battlefield-grid", "tactical", "classification-debug", "fog"];
    for (const [layer, visible] of Object.entries(replicaVisible)) this.setLayerVisible(layer, visible);
    for (const layer of replicaHidden) this.setLayerVisible(layer, false);
  }

  handleKeyDown(event) {
    if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    this.keysDown.add(key);
    if (key === "q") this.rotateCamera(-0.12);
    if (key === "e") this.rotateCamera(0.12);
    if (key === "r") this.tiltCamera(-24);
    if (key === "f") this.tiltCamera(24);
    if (key === "home") this.resetCamera();
  }

  handleKeyUp(event) {
    this.keysDown.delete(event.key.toLowerCase());
  }

  getCenterGroundAnchor() {
    if (!this.camera) return this.controls?.target?.clone?.() ?? new THREE.Vector3();

    // First choice: the exact terrain point under the center of the screen.
    if (this.terrain?.mesh) {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      const hits = this.raycaster.intersectObject(this.terrain.mesh, false);
      if (hits.length > 0) {
        const p = hits[0].point.clone();
        p.y = this.terrain?.getWorldHeight?.(p.x, p.z) ?? p.y;
        return p;
      }
    }

    // Fallback: intersect the current target-height plane.
    const targetY = this.controls?.target?.y ?? 0;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -targetY);
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, p)) {
      p.y = this.terrain?.getWorldHeight?.(p.x, p.z) ?? targetY;
      return p;
    }

    return this.controls.target.clone();
  }

  setCameraAnchor(anchor) {
    if (!anchor || !this.controls) return;
    const before = this.controls.target.clone();
    const next = anchor.clone();
    this.bounds?.clampPoint?.(next, 20);
    next.y = this.terrain?.getWorldHeight?.(next.x, next.z) ?? next.y;
    const correction = next.clone().sub(before);
    this.controls.target.copy(next);
    this.camera.position.add(correction);
  }

  rotateCamera(angle) {
    const anchor = this.getCenterGroundAnchor();
    this.setCameraAnchor(anchor);
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  changeCameraElevation(deltaY) {
    const anchor = this.getCenterGroundAnchor();
    this.setCameraAnchor(anchor);
    const terrainY = this.controls.target.y;
    const currentAboveGround = this.camera.position.y - terrainY;
    const maxHeight = Math.max(this.cameraSettings.maxHeightAboveGround, (this.bounds?.sizeMeters ?? 1000) * 1.1);
    const nextAboveGround = THREE.MathUtils.clamp(
      currentAboveGround + deltaY,
      this.cameraSettings.minHeightAboveGround,
      maxHeight
    );
    this.camera.position.y = terrainY + nextAboveGround;
    this.controls.update();
  }

  tiltCamera(deltaY) {
    // Legacy R/F support now behaves as an anchored elevation change.
    this.changeCameraElevation(deltaY);
  }

  resetCamera() {
    this.frameMap(this.bounds?.sizeMeters || 1000);
    this.log("Camera reset.", "info");
  }

  setCameraPreset(preset) {
    const size = this.bounds?.sizeMeters || 1000;
    const target = this.getCenterGroundAnchor();
    this.setCameraAnchor(target);
    if (preset === "topDown") {
      this.camera.position.set(target.x, Math.max(650, size * 0.95), target.z + 0.1);
    } else {
      this.camera.position.set(target.x, Math.max(280, size * 0.45), target.z + Math.max(450, size * 0.7));
    }
    this.camera.lookAt(target);
    this.controls.update();
    this.log(`Camera preset: ${preset === "topDown" ? "top-down" : "angled"}.`, "info");
  }

  setFollowSelectedSquad(enabled) {
    this.cameraSettings.followSelected = Boolean(enabled);
    this.log(`Follow selected squad ${enabled ? "enabled" : "disabled"}.`, "info");
  }

  setEdgePanEnabled(enabled) {
    this.cameraSettings.edgePan = Boolean(enabled);
    this.log(`Edge pan ${enabled ? "enabled" : "disabled"}.`, "info");
  }

  setCameraClampEnabled(enabled) {
    this.cameraSettings.cameraClamp = Boolean(enabled);
    this.bounds?.setCameraClampEnabled?.(enabled);
    this.log(`Camera bounds ${enabled ? "enabled" : "disabled"}.`, "info");
  }

  setBoundsVisible(visible) {
    this.bounds?.setVisualsVisible?.(visible);
    this.log(`Playable bounds ${visible ? "shown" : "hidden"}.`, "info");
  }

  updateCameraControls(deltaSeconds) {
    if (!this.camera || !this.controls) return;
    const move = new THREE.Vector3();
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // D44-R.1 keyboard camera split:
    // WASD = ground-plane pan
    // Arrow Up/Down = elevation
    // Arrow Left/Right = rotate around the anchored screen-center ground point
    if (this.keysDown.has("w")) move.add(forward);
    if (this.keysDown.has("s")) move.sub(forward);
    if (this.keysDown.has("d")) move.add(right);
    if (this.keysDown.has("a")) move.sub(right);

    if (this.keysDown.has("arrowup")) this.changeCameraElevation(this.cameraSettings.elevationSpeed * deltaSeconds);
    if (this.keysDown.has("arrowdown")) this.changeCameraElevation(-this.cameraSettings.elevationSpeed * deltaSeconds);
    if (this.keysDown.has("arrowleft")) this.rotateCamera(-this.cameraSettings.keyboardRotateSpeed * deltaSeconds);
    if (this.keysDown.has("arrowright")) this.rotateCamera(this.cameraSettings.keyboardRotateSpeed * deltaSeconds);

    if (this.cameraSettings.edgePan && this.pointerInsideMap && this.lastPointerClient) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const pointerInsideMap = this.lastPointerClient.x >= rect.left
        && this.lastPointerClient.x <= rect.right
        && this.lastPointerClient.y >= rect.top
        && this.lastPointerClient.y <= rect.bottom;
      if (pointerInsideMap) {
        const edge = 26;
        if (this.lastPointerClient.x - rect.left < edge) move.sub(right);
        if (rect.right - this.lastPointerClient.x < edge) move.add(right);
        if (this.lastPointerClient.y - rect.top < edge) move.add(forward);
        if (rect.bottom - this.lastPointerClient.y < edge) move.sub(forward);
      }
    }

    const selected = this.cameraSettings.followSelected ? this.infantry?.getSelectedSquad?.() : null;
    if (selected) {
      const desired = selected.center.clone();
      this.bounds?.clampPoint?.(desired, 10);
      const delta = desired.sub(this.controls.target).multiplyScalar(Math.min(1, deltaSeconds * 2.5));
      this.camera.position.add(delta);
      this.controls.target.add(delta);
    } else if (move.lengthSq() > 0.0001) {
      move.normalize().multiplyScalar(this.cameraSettings.panSpeed * deltaSeconds);
      this.camera.position.add(move);
      this.controls.target.add(move);
    }

    // Keep the target glued to the actual terrain surface as the camera pans across hills/gorges.
    const targetGroundY = this.terrain?.getWorldHeight?.(this.controls.target.x, this.controls.target.z);
    if (Number.isFinite(targetGroundY)) {
      const dy = targetGroundY - this.controls.target.y;
      this.controls.target.y += dy;
      this.camera.position.y += dy;
    }

    if (this.cameraSettings.cameraClamp && this.bounds?.cameraClampEnabled) {
      const before = this.controls.target.clone();
      this.bounds.clampPoint(this.controls.target, 20);
      this.controls.target.y = this.terrain?.getWorldHeight?.(this.controls.target.x, this.controls.target.z) ?? this.controls.target.y;
      const correction = this.controls.target.clone().sub(before);
      this.camera.position.add(correction);
    }
  }


  setLayerVisible(layer, visible) {
    if (layer === "fog") {
      this.setFogOfWarEnabled(visible);
      return;
    }

    if (layer === "territory") {
      this.setTerritoryOverlayEnabled(visible);
      return;
    }

    if (layer === "strategic-pois") {
      this.strategicPois?.setVisible?.(visible);
      this.performance?.setLayerVisible?.(layer, visible);
      this.log(`Strategic POIs ${visible ? "shown" : "hidden"}.`, "info");
      return;
    }


    if (layer === "influence-rings") {
      this.strategicPois?.setInfluenceRingsVisible?.(visible);
      this.performance?.setLayerVisible?.(layer, visible);
      this.log(`Influence rings ${visible ? "shown" : "hidden"}.`, "info");
      return;
    }

    if (layer === "frontline") {
      this.territory?.setFrontlineVisible?.(visible);
      this.performance?.setLayerVisible?.(layer, visible);
      this.log(`Frontline ${visible ? "shown" : "hidden"}.`, "info");
      return;
    }

    if (layer === "objective-hierarchy") {
      this.strategicPois?.setVisible?.(visible);
      this.performance?.setLayerVisible?.("strategic-pois", visible);
      this.performance?.setLayerVisible?.(layer, visible);
      this.log(`Objective hierarchy ${visible ? "shown" : "hidden"}.`, "info");
      return;
    }

    if (layer === "battlefield-grid") {
      this.battlefieldGrid?.setVisible?.(visible);
      this.performance?.setLayerVisible?.(layer, visible);
      this.log(`Battlefield grid ${visible ? "shown" : "hidden"}.`, "info");
      return;
    }

    if (layer === "tactical-buildings") {
      this.tacticalBuildings?.setVisible?.(visible);
      this.performance?.setLayerVisible?.(layer, visible);
      this.log(`Tactical buildings ${visible ? "shown" : "hidden"}.`, "info");
      return;
    }

    if (layer === "tactical") {
      this.performance?.setLayerVisible(layer, visible);
      this.tactical?.setVisible?.(visible);
      this.log(`tactical layer ${visible ? "shown" : "hidden"}.`, "info");
      return;
    }

    if (layer === "buildings") {
      this.builder?.buildingLOD?.setVisible?.(visible);
    }

    if (layer === "vegetation") {
      this.builder?.vegetationLOD?.setVisible?.(visible);
    }

    if (layer === "classification-debug") {
      this.builder?.setGroundClassificationDebugVisible?.(visible);
    }

    if (layer === "units") {
      this.infantry?.setVisible?.(visible);
    }

    this.performance?.setLayerVisible(layer, visible);
    this.log(`${layer} layer ${visible ? "shown" : "hidden"}.`, "info");
  }

  toggleLayer(layer) {
    const current = this.performance?.getStats?.().layerVisibility?.[layer] !== false;
    this.setLayerVisible(layer, !current);
  }

  setDebugDamageEnabled(enabled) {
    this.debugDamageEnabled = enabled;
    if (!enabled && this.radiusPreview) this.radiusPreview.visible = false;
  }

  setDeployMode(mode) {
    const nextMode = mode === "friendly" || mode === "enemy" ? mode : null;
    this.deployMode = this.deployMode === nextMode ? null : nextMode;
    this.renderer.domElement.style.cursor = this.deployMode ? "crosshair" : "";
    this.log(this.deployMode ? `Deploy mode armed: click the map to spawn a ${this.deployMode} squad.` : "Deploy mode canceled.", "info");
    this.callbacks.onDeployModeChange?.(this.deployMode);
    return this.deployMode;
  }

  spawnSquadAt(point, side = "friendly") {
    if (!this.bounds?.containsPoint?.(point, 4)) {
      this.log(`Spawn blocked: ${side} squad target is outside playable bounds.`, "warn");
      return null;
    }
    const squad = this.infantry?.spawnRifleSquad?.(point.clone ? point.clone() : new THREE.Vector3(point.x, point.y ?? 0, point.z), side);
    if (squad?.group) {
      this.performance?.addEntry?.(squad.group, "units");
      this.log(`${side === "friendly" ? "Friendly" : "Enemy"} rifle squad deployed at ${squad.center.x.toFixed(1)}, ${squad.center.z.toFixed(1)}.`, side === "friendly" ? "success" : "warn");
    } else {
      this.log(`Unable to deploy ${side} squad.`, "warn");
    }
    this.callbacks.onInfantryStats?.(this.infantry?.getStats?.());
    return squad;
  }

  resetDestruction() {
    this.destruction.reset();
    this.tactical?.resetFromDestruction?.(this.destruction);
    this.navigation?.updateFromDestruction?.(this.destruction);
    this.infantry?.repathActiveSquads?.();
    this.log("Destruction state reset.", "success");
  }

  setTacticalOverlayVisible(visible) {
    this.tactical?.setVisible?.(visible);
    this.performance?.setLayerVisible?.("tactical", visible);
    this.log(`Tactical overlays ${visible ? "shown" : "hidden"}.`, "info");
  }

  setTacticalOverlayMode(mode) {
    this.tactical?.setOverlayMode?.(mode);
    this.log(`Tactical overlay mode: ${mode}.`, "info");
  }

  setFogOfWarEnabled(enabled) {
    this.fog?.setEnabled?.(enabled);
    this.performance?.setLayerVisible?.("fog", enabled);
    this.log(`Fog of war ${enabled ? "enabled" : "disabled"}.`, "info");
  }

  setFogVisionDebug(enabled) {
    this.fog?.setDebugVision?.(enabled);
    this.log(`Fog vision debug ${enabled ? "shown" : "hidden"}.`, "info");
  }

  setTerritoryOverlayEnabled(enabled) {
    this.territory?.setEnabled?.(enabled);
    this.performance?.setLayerVisible?.("territory", enabled);
    this.log(`Territory control overlay ${enabled ? "shown" : "hidden"}.`, "info");
  }


  spawnFriendlySquad() {
    return this.spawnSquadAt(this.controls.target.clone().add(new THREE.Vector3(-45, 0, 45)), "friendly");
  }

  spawnEnemySquad() {
    return this.spawnSquadAt(this.controls.target.clone().add(new THREE.Vector3(90, 0, -70)), "enemy");
  }


  selectSquadById(id, options = {}) {
    const squad = this.infantry?.selectSquad?.(id);
    if (!squad) {
      this.log("Unit selection ignored: squad not found.", "warn");
      return null;
    }
    if (options.centerCamera && squad.center) {
      const target = squad.center.clone();
      target.y = this.controls.target.y;
      this.controls.target.lerp(target, 0.85);
      this.camera.position.lerp(new THREE.Vector3(target.x + 80, this.camera.position.y, target.z + 95), 0.35);
      this.controls.update();
    }
    return squad;
  }

  getSquadScreenPosition(id, offsetY = -42) {
    const squad = this.infantry?.squads?.get?.(id);
    if (!squad?.center || !this.camera || !this.renderer?.domElement) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const world = squad.center.clone();
    world.y = (this.terrain?.getWorldHeight?.(world.x, world.z) ?? world.y ?? 0) + 4;
    const projected = world.project(this.camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return {
      x: rect.left + ((projected.x + 1) / 2) * rect.width,
      y: rect.top + ((-projected.y + 1) / 2) * rect.height + offsetY
    };
  }

  retreatSelectedSquad() {
    const squad = this.infantry?.forceSelectedSquadRetreat?.();
    if (!squad) this.log("Retreat ignored: no squad selected.", "warn");
    return squad;
  }

  startSelectedSquadMapCommand(command = "move") {
    const selected = this.infantry?.getSelectedSquad?.();
    if (!selected) {
      this.log("Command ignored: select a unit first.", "warn");
      return null;
    }
    const normalized = command === "suppress" ? "suppress" : command === "defend" ? "defend" : "move";
    const label = normalized === "suppress" ? "Suppress" : normalized === "defend" ? "Defend" : "Move";
    this.squadCommandMode = { command: normalized, label, squadId: selected.id };
    this.renderer.domElement.style.cursor = "crosshair";
    this.callbacks.onSquadCommandModeChange?.(this.squadCommandMode);
    this.log(`${selected.label}: ${label} command armed. Click the map to set target.`, "info");
    return this.squadCommandMode;
  }

  cancelSelectedSquadMapCommand() {
    this.squadCommandMode = null;
    this.renderer.domElement.style.cursor = this.deployMode ? "crosshair" : "";
    this.callbacks.onSquadCommandModeChange?.(null);
  }

  issueSquadCommandModeAtPoint(point) {
    const mode = this.squadCommandMode;
    if (!mode) return null;
    if (!this.bounds?.containsPoint?.(point, 4)) {
      this.log("Command blocked: target is outside playable bounds.", "warn");
      this.cancelSelectedSquadMapCommand();
      return null;
    }
    const selected = this.infantry?.squads?.get?.(mode.squadId);
    if (!selected) {
      this.log("Command ignored: selected squad is gone.", "warn");
      this.cancelSelectedSquadMapCommand();
      return null;
    }
    this.infantry?.selectSquad?.(mode.squadId);
    const missionType = mode.command === "suppress" ? "attack" : mode.command === "defend" ? "defend" : "move";
    const fireMode = mode.command === "suppress" ? "free" : missionType === "defend" ? "return" : "return";
    const squad = this.infantry?.issueMissionAtPoint?.(point, { missionType, fireMode }, mode.squadId);
    if (squad) this.log(`${squad.label}: ${mode.label} target set.`, "success");
    this.cancelSelectedSquadMapCommand();
    return squad;
  }

  selectNextSquad(side = null) {
    return this.infantry?.selectNext?.(side);
  }

  selectNextFriendlySquad() {
    return this.infantry?.selectNextFriendly?.();
  }

  selectNextEnemySquad() {
    return this.infantry?.selectNextEnemy?.();
  }

  holdSelectedSquad() {
    const squad = this.infantry?.holdSelectedPosition?.();
    if (!squad) this.log("Hold ignored: no squad selected.", "warn");
    else this.infantry?.clearSelection?.();
    return squad;
  }

  orderSelectedSquadToTarget() {
    return this.issueSelectedSquadMissionAtCamera("move");
  }

  issueSelectedSquadMissionAtCamera(missionType = "move") {
    const target = this.controls.target.clone();
    if (!this.bounds?.containsPoint?.(target, 4)) {
      this.log("Mission blocked: target is outside playable bounds.", "warn");
      return null;
    }
    const squad = this.infantry?.issueMissionAtPoint?.(target, { missionType });
    if (!squad) this.log("Mission ignored: no squad selected.", "warn");
    else this.infantry?.clearSelection?.();
    return squad;
  }

  resetInfantry() {
    this.performance?.removeLayerEntries?.("units");
    this.infantry?.clear?.();
    this.log("Infantry reset.", "warn");
  }

  setSandboxWeapon(weapon) {
    if (!SANDBOX_WEAPONS[weapon]) return;
    this.sandboxWeapon = weapon;
    this.updateRadiusPreview(this.controls.target);
    this.log(`Sandbox weapon set to ${SANDBOX_WEAPONS[weapon].label}.`, "info");
  }

  applyDebugBlast() {
    this.applySandboxStrike(this.controls.target.clone(), "airstrike");
  }

  applySandboxStrike(position = this.controls.target.clone(), overrideWeapon = null) {
    const weaponKey = overrideWeapon ?? this.sandboxWeapon;
    const weapon = SANDBOX_WEAPONS[weaponKey] ?? SANDBOX_WEAPONS.grenade;
    const affected = this.destruction.applyRadiusDamage({
      position,
      radius: weapon.radius,
      amount: weapon.amount,
      type: weapon.type
    });
    this.flashRadius(position, weapon.radius);
    this.log(`${weapon.label} affected ${affected.length} features.`, affected.length ? "warn" : "info");
    return affected;
  }

  createBuildingOccupancyMarker(side = "friendly") {
    // Building occupation used to create a large floating triangle/flag over occupied structures.
    // That visual is now intentionally disabled; defensive footprints, soldier positions,
    // and reinforcement visuals carry the occupancy/readiness information instead.
    return null;
  }

  updateBuildingOccupancyVisuals() {
    // Keep the method as a safe no-op so existing building occupation logic remains intact
    // without drawing the old oversized building marker. Hide any markers created by older state.
    for (const marker of this.buildingOccupancyMarkers?.values?.() ?? []) {
      if (marker) marker.visible = false;
    }
  }

  createBuildingCommandMarker() {
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 72),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide })
    );
    marker.rotateX(-Math.PI / 2);
    marker.visible = false;
    marker.renderOrder = 98;
    marker.userData.feature = "building-command-marker";
    this.scene.add(marker);
    return marker;
  }

  createRadiusPreview() {
    const geometry = new THREE.RingGeometry(1, 1.04, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const preview = new THREE.Mesh(geometry, material);
    preview.rotateX(-Math.PI / 2);
    preview.visible = false;
    this.scene.add(preview);
    return preview;
  }

  updateRadiusPreview(position) {
    const weapon = SANDBOX_WEAPONS[this.sandboxWeapon] ?? SANDBOX_WEAPONS.grenade;
    this.radiusPreview.visible = this.debugDamageEnabled;
    this.radiusPreview.position.set(position.x, (this.terrain?.getWorldHeight?.(position.x, position.z) ?? 0) + 0.72, position.z);
    this.radiusPreview.scale.setScalar(weapon.radius);
  }

  flashRadius(position, radius) {
    const geometry = new THREE.RingGeometry(radius * 0.92, radius, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4d00,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotateX(-Math.PI / 2);
    ring.position.set(position.x, (this.terrain?.getWorldHeight?.(position.x, position.z) ?? 0) + 0.76, position.z);
    this.scene.add(ring);
    setTimeout(() => {
      ring.parent?.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    }, 350);
  }

  updatePointerFromEvent(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  pickUnit(event) {
    this.updatePointerFromEvent(event);
    const unitRoot = this.infantry?.group;
    if (!unitRoot?.children?.length || unitRoot.visible === false) return null;
    const hits = this.raycaster.intersectObjects(unitRoot.children, true);
    const hit = hits.find((entry) => entry.object.userData?.squadId);
    if (!hit) return null;
    const squadId = hit.object.userData.squadId;
    const squad = this.infantry?.squads?.get?.(squadId) ?? null;
    return squad ? { squad, hit } : null;
  }

  getFeatureFromHit(hit) {
    const id = hit?.object?.userData?.destructibleId;
    if (!id) return null;
    return this.destruction?.features?.get?.(id) ?? null;
  }

  isBuildingRenderable(object) {
    let current = object;
    while (current) {
      const feature = current.userData?.feature;
      if (typeof feature === "string" && feature.startsWith("building")) return true;
      current = current.parent;
    }
    return false;
  }

  getBuildingFeatureNearPoint(point, padding = 6) {
    if (!point || !this.destruction?.features) return null;
    let best = null;
    let bestDistSq = Infinity;

    for (const feature of this.destruction.features.values()) {
      if (!this.isBuildingFeature(feature)) continue;
      const radius = Math.max(8, feature.bounds?.radius ?? 12) + padding;
      const dx = feature.position.x - point.x;
      const dz = feature.position.z - point.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= radius * radius && distSq < bestDistSq) {
        best = feature;
        bestDistSq = distSq;
      }
    }

    return best;
  }

  showTerrainMissionMenu(point, event) {
    if (!this.infantry?.getSelectedSquad?.()) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.terrainMissionPoint = (point.clone?.() ?? new THREE.Vector3(point.x, point.y ?? 0, point.z));
    this.terrainMissionPoint.y = this.terrain?.getWorldHeight?.(this.terrainMissionPoint.x, this.terrainMissionPoint.z) ?? this.terrainMissionPoint.y ?? 0;
    this.callbacks.onMissionCommandMenuChange?.({
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }

  hideTerrainMissionMenu() {
    this.callbacks.onMissionCommandMenuChange?.({ visible: false });
  }

  issueSelectedSquadTerrainMission(missionType = "defend") {
    const target = this.terrainMissionPoint;
    if (!target) {
      this.log("Mission ignored: no terrain target selected.", "warn");
      this.hideTerrainMissionMenu();
      return null;
    }
    if (!this.bounds?.containsPoint?.(target, 4)) {
      this.log("Mission blocked: target is outside playable bounds.", "warn");
      this.hideTerrainMissionMenu();
      return null;
    }
    const squad = this.infantry?.issueMissionAtPoint?.(target, { missionType });
    if (!squad) this.log("Mission ignored: select a squad first.", "warn");
    else this.infantry?.clearSelection?.();
    this.hideTerrainMissionMenu();
    this.terrainMissionPoint = null;
    return squad;
  }

  startTerrainHold(event, point) {
    this.cancelTerrainHold(false);
    this.pendingTerrainHold = {
      point: point.clone(),
      startX: event.clientX,
      startY: event.clientY,
      triggered: false,
      timer: window.setTimeout(() => {
        if (!this.infantry?.getSelectedSquad?.()) return;
        if (!this.bounds?.containsPoint?.(point, 4)) return;
        if (!this.pendingTerrainHold) return;
        this.pendingTerrainHold.triggered = true;
        this.showTerrainMissionMenu(point, event);
      }, 520)
    };
  }

  cancelTerrainHold(hideMenu = false) {
    if (this.pendingTerrainHold?.timer) window.clearTimeout(this.pendingTerrainHold.timer);
    this.pendingTerrainHold = null;
    if (hideMenu) this.hideTerrainMissionMenu();
  }

  getBuildingFeatureFromHitOrPoint(hit, point) {
    const direct = this.getFeatureFromHit(hit);
    if (this.isBuildingFeature(direct)) return direct;

    // Building LOD 1/2 meshes are merged for performance, so those renderables
    // do not carry one destructible id per house. If the click hits any building
    // LOD mesh, resolve the nearest registered building from the hit point.
    if (hit?.object && this.isBuildingRenderable(hit.object)) {
      const resolved = this.getBuildingFeatureNearPoint(hit.point ?? point, 8);
      if (resolved) return resolved;
    }

    return null;
  }

  isBuildingFeature(feature) {
    return feature?.category === "building" && feature.state !== "destroyed";
  }

  showBuildingCommandMenu(feature, event) {
    if (!this.isBuildingFeature(feature)) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const buildingRadius = Math.max(10, feature.bounds?.radius ?? 14);
    this.buildingCommandMarker.visible = true;
    this.buildingCommandMarker.position.set(
      feature.position.x,
      (this.terrain?.getWorldHeight?.(feature.position.x, feature.position.z) ?? 0) + 0.9,
      feature.position.z
    );
    this.buildingCommandMarker.scale.setScalar(buildingRadius + 5);
    this.callbacks.onBuildingCommandMenuChange?.({
      visible: true,
      featureId: feature.id,
      category: feature.category,
      health: Math.round(feature.health ?? 0),
      maxHealth: Math.round(feature.maxHealth ?? 0),
      state: feature.state,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }

  hideBuildingCommandMenu() {
    if (this.buildingCommandMarker) this.buildingCommandMarker.visible = false;
    this.callbacks.onBuildingCommandMenuChange?.({ visible: false });
  }

  issueSelectedSquadBuildingOrder(featureId, order = {}) {
    const feature = this.destruction?.features?.get?.(featureId);
    if (!this.isBuildingFeature(feature)) {
      this.log("Building order ignored: selected building is unavailable.", "warn");
      this.hideBuildingCommandMenu();
      return null;
    }
    const squad = this.infantry?.issueBuildingOrder?.(feature, order);
    if (!squad) this.log("Building order ignored: select a squad first.", "warn");
    else this.infantry?.clearSelection?.();
    this.hideBuildingCommandMenu();
    return squad;
  }

  startBuildingHold(event, feature) {
    this.cancelBuildingHold(false);
    this.pendingBuildingHold = {
      featureId: feature.id,
      startX: event.clientX,
      startY: event.clientY,
      triggered: false,
      timer: window.setTimeout(() => {
        const current = this.destruction?.features?.get?.(feature.id);
        if (!current || !this.infantry?.getSelectedSquad?.()) return;
        this.pendingBuildingHold.triggered = true;
        this.showBuildingCommandMenu(current, event);
      }, 520)
    };
  }

  cancelBuildingHold(hideMenu = false) {
    if (this.pendingBuildingHold?.timer) window.clearTimeout(this.pendingBuildingHold.timer);
    this.pendingBuildingHold = null;
    if (hideMenu) this.hideBuildingCommandMenu();
  }

  pickWorldPoint(event) {
    this.updatePointerFromEvent(event);

    const roots = [];
    if (this.builder?.group) roots.push(...this.builder.group.children);
    if (this.builder?.buildingLOD?.group) roots.push(this.builder.buildingLOD.group);

    const hits = roots.length ? this.raycaster.intersectObjects(roots, true) : [];
    const destructibleHit = hits.find((entry) => entry.object.userData?.destructibleId);
    if (destructibleHit) return { point: destructibleHit.point, hit: destructibleHit };

    const buildingHit = hits.find((entry) => this.isBuildingRenderable(entry.object));
    if (buildingHit) return { point: buildingHit.point, hit: buildingHit };

    if (this.terrain?.mesh) {
      const terrainHits = this.raycaster.intersectObject(this.terrain.mesh, false);
      if (terrainHits.length) return { point: terrainHits[0].point, hit: terrainHits[0] };
    }

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(groundPlane, point)) return { point, hit: null };

    return { point: this.controls.target.clone(), hit: null };
  }

  handlePointerLeave(event) {
    this.pointerInsideMap = false;
    this.lastPointerClient = null;
    if (this.radiusPreview) this.radiusPreview.visible = false;
    this.handlePointerUp(event);
  }

  handlePointerMove(event) {
    this.pointerInsideMap = true;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };
    // Keep normal navigation visually clean. The sandbox blast radius only appears
    // when the damage tool is armed and Shift is held for an intentional preview.
    if (!this.debugDamageEnabled || !event.shiftKey || this.deployMode) {
      this.radiusPreview.visible = false;
      return;
    }
    const { point } = this.pickWorldPoint(event);
    this.updateRadiusPreview(point);
  }

  handlePointerDown(event) {
    const { point, hit } = this.pickWorldPoint(event);

    if (event.button === 2) {
      if (!this.bounds?.containsPoint?.(point, 4)) {
        this.log("Right-click order blocked: outside playable bounds.", "warn");
        return;
      }
      const squad = this.infantry?.issueSecureArea?.(point);
      if (!squad) this.log("Right-click order ignored: no squad selected.", "warn");
      else this.infantry?.clearSelection?.();
      return;
    }

    if (event.button !== 0) return;

    if (event.ctrlKey && this.battlefieldGrid) {
      const sector = this.battlefieldGrid.selectSectorAtPoint(point);
      if (sector) this.log(`Grid sector ${sector.id} selected: ${sector.bandLabel} / ${sector.columnLabel} (${sector.poiIds.length} POIs).`, "info");
      return;
    }

    if (this.squadCommandMode) {
      this.issueSquadCommandModeAtPoint(point);
      return;
    }

    if (this.deployMode) {
      const side = this.deployMode;
      const squad = this.spawnSquadAt(point, side);
      this.deployMode = null;
      this.renderer.domElement.style.cursor = "";
      this.callbacks.onDeployModeChange?.(null);
      if (squad) return;
    }

    const plainLeftClick = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (plainLeftClick && !this.debugDamageEnabled) {
      const classificationDebugVisible = this.performance?.getStats?.().layerVisibility?.["classification-debug"] !== false;
      if (classificationDebugVisible && this.builder?.getClassificationDebugAtPoint) {
        const inspection = this.builder.getClassificationDebugAtPoint(point);
        this.callbacks.onClassificationInspect?.(inspection);
        if (inspection) this.log(`Classification: ${String(inspection.groundClass).toUpperCase()} — ${inspection.reason}.`, inspection.vegetationEligible ? "success" : "warn");
        return;
      }

      const pickedUnit = this.pickUnit(event);
      if (pickedUnit?.squad) {
        this.infantry?.selectSquad?.(pickedUnit.squad.id);
        this.hideBuildingCommandMenu();
        this.hideTerrainMissionMenu();
        return;
      }

      const feature = this.getBuildingFeatureFromHitOrPoint(hit, point);
      if (this.isBuildingFeature(feature) && this.infantry?.getSelectedSquad?.()) {
        this.startBuildingHold(event, feature);
        return;
      }

      this.hideBuildingCommandMenu();
      this.hideTerrainMissionMenu();

      if (this.infantry?.getSelectedSquad?.()) {
        this.startTerrainHold(event, point);
        return;
      }

      const selected = this.infantry?.selectAtPoint?.(point);
      if (selected) return;
      return;
    }

    if (event.altKey) {
      const pickedUnit = this.pickUnit(event);
      if (pickedUnit?.squad) {
        this.infantry?.selectSquad?.(pickedUnit.squad.id);
        return;
      }
      const selected = this.infantry?.selectAtPoint?.(point);
      if (selected) return;
    }

    if (!this.debugDamageEnabled || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

    const weapon = SANDBOX_WEAPONS[this.sandboxWeapon] ?? SANDBOX_WEAPONS.grenade;

    if (weapon.radius <= 4 && hit?.object.userData?.destructibleId) {
      const feature = this.destruction.applyDamage({
        targetId: hit.object.userData.destructibleId,
        amount: weapon.amount,
        type: weapon.type
      });
      this.destruction.addImpactDecal(point, weapon.radius, weapon.type);
      this.flashRadius(point, weapon.radius);
      if (feature) this.log(`Hit ${feature.category} ${feature.id}: ${Math.ceil(feature.health)}/${Math.ceil(feature.maxHealth)} HP`, "info");
      return;
    }

    this.applySandboxStrike(point);
  }

  handlePointerUp(event) {
    if (this.pendingTerrainHold) {
      const pendingTerrain = this.pendingTerrainHold;
      const movedTerrain = Math.hypot(event.clientX - pendingTerrain.startX, event.clientY - pendingTerrain.startY) > 9;
      if (pendingTerrain.timer) window.clearTimeout(pendingTerrain.timer);
      this.pendingTerrainHold = null;

      if (!pendingTerrain.triggered && !movedTerrain && event.button === 0) {
        if (!this.bounds?.containsPoint?.(pendingTerrain.point, 4)) {
          this.log("Move order blocked: outside playable bounds.", "warn");
          return;
        }
        const squad = this.infantry?.issueSecureArea?.(pendingTerrain.point);
        if (squad) this.infantry?.clearSelection?.();
        else this.log("Move ignored: select a squad first.", "warn");
      }
      return;
    }

    if (!this.pendingBuildingHold) return;
    const pending = this.pendingBuildingHold;
    const moved = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) > 9;
    if (pending.timer) window.clearTimeout(pending.timer);
    this.pendingBuildingHold = null;

    if (pending.triggered || moved || event.button !== 0) return;

    const feature = this.destruction?.features?.get?.(pending.featureId);
    if (this.isBuildingFeature(feature) && this.infantry?.getSelectedSquad?.()) {
      this.issueSelectedSquadBuildingOrder(feature.id, { type: "use_building_cover", fireMode: "return" });
    }
  }

  getCameraStats() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() < 0.0001) direction.set(0, 0, -1);
    direction.normalize();
    const headingDegrees = (THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z)) + 360) % 360;
    return { headingDegrees };
  }

  getRenderStats() {
    const info = this.renderer.info;
    return {
      fps: this.lastFps ?? 0,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      visibleObjects: this.performance?.getStats?.().visibleObjects ?? 0,
      hiddenByLod: this.performance?.getStats?.().hiddenByLod ?? 0,
      chunks: this.performance?.getStats?.().chunks ?? 0
    };
  }

  async clearCache() {
    await this.osm.clearCache();
    this.log("Local map cache cleared.", "warn");
  }

  animate(now = performance.now()) {
    this.animationId = requestAnimationFrame((nextNow) => this.animate(nextNow));
    this.frameCount = (this.frameCount ?? 0) + 1;
    if (!this.lastFpsAt) this.lastFpsAt = now;
    if (now - this.lastFpsAt >= 500) {
      this.lastFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsAt));
      this.frameCount = 0;
      this.lastFpsAt = now;
      this.callbacks.onRenderStats?.(this.getRenderStats());
      this.callbacks.onCameraStats?.(this.getCameraStats());
    }
    const deltaSeconds = Math.min(0.08, Math.max(0.001, ((now - (this.lastFrameAt ?? now)) / 1000) || 0.016));
    this.lastFrameAt = now;

    // Globe stage — only update globe + controls
    if (this.globe?.isGlobeActive()) {
      this.globe.update(deltaSeconds);
      this.controls.update();
      this.postProcessing.render();
      return;
    }

    // Tactical stage — full game loop
    this.updateCameraControls(deltaSeconds);
    this.controls.update();
    this.builder?.update?.(now / 1000);
    this.builder?.buildingLOD?.update?.(this.camera);
    this.builder?.vegetationLOD?.update?.(this.camera);
    this.infantry?.update?.(deltaSeconds, now, this.tactical, this.destruction);
    this.updateBuildingOccupancyVisuals();
    this.fog?.update?.(this.infantry, now);
    this.territory?.update?.(this.infantry, now);
    this.performance?.update?.(this.camera, now);
    if (this.useTerrainLodRenderer) this.terrainLOD?.update?.(this.camera);
    this.postProcessing.render();
  }

  resize() {
    if (!this.mountEl) return;
    this.camera.aspect = this.mountEl.clientWidth / this.mountEl.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.mountEl.clientWidth, this.mountEl.clientHeight);
    this.postProcessing?.resize(this.mountEl.clientWidth, this.mountEl.clientHeight);
  }

  setPostProcessingPreset(preset) {
    this.postProcessing?.setPreset(preset);
    this.log(`Visual preset: ${preset}.`, "info");
  }

  setPostProcessingEnabled(enabled) {
    this.postProcessing?.setEnabled(enabled);
    this.log(`Post-processing ${enabled ? "enabled" : "disabled"}.`, "info");
  }

  // --- Globe methods ---

  flyToLocation(lat, lon) {
    if (!this.globe) return;
    this.globe.addMarker(lat, lon, "#ff4444");
    this.globe.flyTo(lat, lon);
  }

  returnToGlobe() {
    this.globe?.returnToGlobe();
    this.scene.background = new THREE.Color("#050510");
    this.scene.fog = null;
    this.gameStage = "globe";
  }

  getGameStage() {
    return this.globe?.getStage() ?? "tactical";
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointerleave", this.onPointerLeave);
    this.renderer.domElement.removeEventListener("contextmenu", this.onContextMenu);
    this.cancelTerrainHold?.(true);
    this.cancelBuildingHold?.(true);
    if (this.radiusPreview) {
      this.radiusPreview.parent?.remove(this.radiusPreview);
      this.radiusPreview.geometry?.dispose?.();
      this.radiusPreview.material?.dispose?.();
    }
    for (const marker of this.buildingOccupancyMarkers?.values?.() ?? []) {
      marker.parent?.remove(marker);
      marker.traverse?.((child) => { child.geometry?.dispose?.(); });
    }
    this.buildingOccupancyMarkers?.clear?.();
    this.buildingOccupancyMaterial?.dispose?.();
    this.enemyBuildingOccupancyMaterial?.dispose?.();
    this.destruction?.clear();
    this.tactical?.dispose?.();
    this.fog?.dispose?.();
    this.territory?.dispose?.();
    this.bounds?.dispose?.();
    this.strategicPois?.dispose?.();
    this.tacticalBuildings?.dispose?.();
    this.battlefieldGrid?.dispose?.();
    this.infantry?.dispose?.();
    this.terrainLOD?.dispose?.();
    this.postProcessing?.dispose?.();
    this.globe?.dispose?.();
    this.performance?.clear();
    this.renderer.dispose();
    this.mountEl?.removeChild(this.renderer.domElement);
  }
}
