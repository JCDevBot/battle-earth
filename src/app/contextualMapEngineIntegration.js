import * as THREE from "three";
import { installCompatibleGeometryMerge } from "./compatibleGeometryMerge.js";
import { summarizeContextualFeatureBounds } from "./contextualFeatureDiagnostics.js";
import { quarantineSuspiciousWaterFeatures } from "./contextualFeatureQuarantine.js";
import { applyContextualCameraFrame } from "./contextualCameraFraming.js";
import { runContextualMapGeneration } from "./runContextualMapGeneration.js";

const INSTALL_MARKER = Symbol.for(
  "battle-earth.contextual-map-generation-installed",
);

function setDatasetNumber(dataset, key, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    delete dataset[key];
    return;
  }
  dataset[key] = String(value);
}

function exposePlayableCenterProbe(engine) {
  const canvas = engine.renderer?.domElement;
  if (!canvas?.dataset || !engine.camera) return;

  const groundY = Number(engine.terrain?.getWorldHeight?.(0, 0));
  const point = new THREE.Vector3(0, Number.isFinite(groundY) ? groundY : 0, 0);
  point.project(engine.camera);

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  setDatasetNumber(
    canvas.dataset,
    "playableCenterScreenX",
    ((point.x + 1) * 0.5) * width,
  );
  setDatasetNumber(
    canvas.dataset,
    "playableCenterScreenY",
    ((1 - point.y) * 0.5) * height,
  );
}

function exposeFeatureDiagnostics(engine, plan, canvas, config = {}) {
  if (!Array.isArray(engine.builder?.waterPolygons)) return;

  const diagnostics = summarizeContextualFeatureBounds(plan, {
    water: engine.builder.waterPolygons,
  });
  engine.lastContextualFeatureDiagnostics = diagnostics;

  let quarantine = Object.freeze({
    attempted: 0,
    removed: 0,
    sourceIds: Object.freeze([]),
  });
  if (
    diagnostics.hasSuspiciousGeometry &&
    config.quarantineSuspiciousContextWater !== false
  ) {
    quarantine = quarantineSuspiciousWaterFeatures(engine.builder, diagnostics);
    engine.lastContextualFeatureQuarantine = quarantine;
  }

  if (diagnostics.hasSuspiciousGeometry) {
    const quarantined =
      quarantine.removed > 0 ? ` Quarantined ${quarantine.removed}.` : "";
    engine.log?.(
      `Context geometry warning: ${diagnostics.invalid} suspicious water feature${diagnostics.invalid === 1 ? "" : "s"}.${quarantined}`,
      "warn",
    );
  }

  if (!canvas?.dataset) return;
  canvas.dataset.contextualSuspiciousGeometry = String(
    diagnostics.hasSuspiciousGeometry,
  );
  setDatasetNumber(
    canvas.dataset,
    "contextualWaterFeaturesInspected",
    diagnostics.inspected,
  );
  setDatasetNumber(
    canvas.dataset,
    "contextualWaterFeaturesInvalid",
    diagnostics.invalid,
  );
  setDatasetNumber(
    canvas.dataset,
    "contextualWaterFeaturesQuarantined",
    quarantine.removed,
  );
}

function exposeContextualPlan(engine, result, config = {}) {
  const plan = result?.plan;
  if (!plan) return;

  engine.lastContextualGenerationPlan = plan;
  engine.lastContextualGenerationDiagnostics =
    result.contextualDiagnostics ?? null;

  const canvas = engine.renderer?.domElement;
  exposeFeatureDiagnostics(engine, plan, canvas, config);
  if (!canvas?.dataset) return;

  canvas.dataset.contextualGeneration = "ready";
  canvas.dataset.playableWidthMeters = String(plan.gameplay.mapWidthMeters);
  canvas.dataset.playableDepthMeters = String(plan.gameplay.mapDepthMeters);
  canvas.dataset.renderWidthMeters = String(plan.visualFeatures.mapWidthMeters);
  canvas.dataset.renderDepthMeters = String(plan.visualFeatures.mapDepthMeters);
  canvas.dataset.outerSkirtVisible = String(
    plan.boundsManager.showOuterSkirt,
  );

  const diagnostics = result.contextualDiagnostics;
  if (!diagnostics) return;

  setDatasetNumber(
    canvas.dataset,
    "renderedAreaMultiplier",
    diagnostics.renderedAreaMultiplier,
  );
  setDatasetNumber(
    canvas.dataset,
    "renderedAreaIncreasePercent",
    diagnostics.renderedAreaIncreasePercent,
  );
  setDatasetNumber(
    canvas.dataset,
    "generationDurationMs",
    diagnostics.generationDurationMs,
  );
  setDatasetNumber(
    canvas.dataset,
    "memoryDeltaBytes",
    diagnostics.memoryDeltaBytes,
  );
  canvas.dataset.contextualMeasurementsAvailable = String(
    diagnostics.measurementsAvailable,
  );
}

function isPlayablePoint(engine, point) {
  return typeof engine.bounds?.containsPoint === "function"
    ? engine.bounds.containsPoint(point, 4)
    : true;
}

function pickPlayableGroundPlanePoint(engine) {
  const ray = engine.raycaster?.ray;
  if (!ray?.intersectPlane) return null;

  const targetY = Number(engine.controls?.target?.y);
  const planeY = Number.isFinite(targetY) ? targetY : 0;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const point = new THREE.Vector3();
  if (!ray.intersectPlane(plane, point) || !isPlayablePoint(engine, point)) {
    return null;
  }

  const groundY = Number(engine.terrain?.getWorldHeight?.(point.x, point.z));
  if (Number.isFinite(groundY)) point.y = groundY;
  return { point, hit: null };
}

function pickPlayableCameraTarget(engine, event) {
  const canvas = engine.renderer?.domElement;
  const target = engine.controls?.target;
  if (!canvas || !target || !engine.camera || !isPlayablePoint(engine, target)) {
    return null;
  }

  const rect = canvas.getBoundingClientRect?.();
  if (!rect?.width || !rect?.height) return null;

  const groundY = Number(engine.terrain?.getWorldHeight?.(target.x, target.z));
  const point = new THREE.Vector3(
    target.x,
    Number.isFinite(groundY) ? groundY : Number(target.y) || 0,
    target.z,
  );
  const projected = point.clone().project(engine.camera);
  const screenX = rect.left + ((projected.x + 1) * 0.5) * rect.width;
  const screenY = rect.top + ((1 - projected.y) * 0.5) * rect.height;
  const tolerance = Math.max(28, Math.min(rect.width, rect.height) * 0.1);
  const distance = Math.hypot(event.clientX - screenX, event.clientY - screenY);

  return distance <= tolerance ? { point, hit: null } : null;
}

export function pickPlayableTerrainPoint(engine, event) {
  if (
    !engine?.deployMode ||
    !engine.terrain?.mesh ||
    !engine.raycaster ||
    typeof engine.updatePointerFromEvent !== "function"
  ) {
    return null;
  }

  engine.updatePointerFromEvent(event);
  const hits = engine.raycaster.intersectObject(engine.terrain.mesh, false);
  const playableHit = hits.find((hit) => isPlayablePoint(engine, hit.point));
  if (playableHit) return { point: playableHit.point, hit: playableHit };

  // A deformed or not-yet-updated terrain mesh can occasionally miss a valid
  // screen-space deployment click. Fall back to the camera ray's ground plane,
  // but retain the same playable-bounds validation before allowing a spawn.
  return (
    pickPlayableGroundPlanePoint(engine) ??
    pickPlayableCameraTarget(engine, event)
  );
}

function projectOriginalGroundPick(engine, pick) {
  const point = pick?.point;
  if (!point || !isPlayablePoint(engine, point)) return null;

  const hitObject = pick.hit?.object;
  const terrainMesh = engine.terrain?.mesh;
  const isGroundPick = !hitObject || hitObject === terrainMesh;
  if (!isGroundPick) return null;

  const groundY = Number(engine.terrain?.getWorldHeight?.(point.x, point.z));
  return {
    point: new THREE.Vector3(
      point.x,
      Number.isFinite(groundY) ? groundY : Number(point.y) || 0,
      point.z,
    ),
    hit: hitObject === terrainMesh ? pick.hit : null,
  };
}

function installTerrainFirstDeploymentPicking(prototype) {
  const originalPickWorldPoint = prototype.pickWorldPoint;
  if (typeof originalPickWorldPoint !== "function") return;

  prototype.pickWorldPoint = function pickContextualWorldPoint(event) {
    if (!this.deployMode) {
      return originalPickWorldPoint.call(this, event);
    }

    const contextualPick = pickPlayableTerrainPoint(this, event);
    if (contextualPick) return contextualPick;

    // Preserve the pickWorldPoint object contract for an explicit contextual
    // terrain hit outside the playable battlefield. The normal spawn path will
    // reject this point without falling through to visual-feature picking.
    const contextualTerrainHits = this.terrain?.mesh
      ? this.raycaster?.intersectObject?.(this.terrain.mesh, false) ?? []
      : [];
    if (contextualTerrainHits.length > 0) {
      const hit = contextualTerrainHits[0];
      return { point: hit.point, hit };
    }

    // Preserve the terrain-first contract while recovering from a transient
    // contextual ray miss. The legacy picker may still resolve the authoritative
    // terrain or its ground-plane fallback; visual feature hits remain rejected.
    return projectOriginalGroundPick(
      this,
      originalPickWorldPoint.call(this, event),
    );
  };
}

/**
 * Installs contextual map generation on the concrete MapEngine class.
 *
 * The tactical stage is lazy-loaded, so this bridge preserves the existing
 * route-level split while routing every normal MapEngine.generateMap call
 * through the tested contextual orchestration contract.
 */
export function installContextualMapEngineGeneration(
  MapEngineClass,
  runner = runContextualMapGeneration,
) {
  if (typeof MapEngineClass !== "function") {
    throw new TypeError("A MapEngine class is required.");
  }
  if (typeof runner !== "function") {
    throw new TypeError("A contextual generation runner is required.");
  }

  const prototype = MapEngineClass.prototype;
  if (prototype[INSTALL_MARKER]) return false;

  Object.defineProperty(prototype, INSTALL_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  installTerrainFirstDeploymentPicking(prototype);

  prototype.generateMap = async function generateContextualMap(config) {
    installCompatibleGeometryMerge(this.builder);
    const result = await runner(this, config);
    applyContextualCameraFrame(this, result?.plan);
    exposePlayableCenterProbe(this);
    exposeContextualPlan(this, result, config);
    return result;
  };

  return true;
}
