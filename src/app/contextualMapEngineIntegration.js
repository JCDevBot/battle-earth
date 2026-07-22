import * as THREE from "three";
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
  setDatasetNumber(canvas.dataset, "playableCenterScreenX", ((point.x + 1) * 0.5) * width);
  setDatasetNumber(canvas.dataset, "playableCenterScreenY", ((1 - point.y) * 0.5) * height);
}

function exposeContextualPlan(engine, result) {
  const plan = result?.plan;
  if (!plan) return;

  engine.lastContextualGenerationPlan = plan;
  engine.lastContextualGenerationDiagnostics = result.contextualDiagnostics ?? null;

  const canvas = engine.renderer?.domElement;
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
  const playableHit = hits.find((hit) =>
    typeof engine.bounds?.containsPoint === "function"
      ? engine.bounds.containsPoint(hit.point, 4)
      : true,
  );
  if (!playableHit) return null;

  return { point: playableHit.point, hit: playableHit };
}

function installTerrainFirstDeploymentPicking(prototype) {
  const originalPickWorldPoint = prototype.pickWorldPoint;
  if (typeof originalPickWorldPoint !== "function") return;

  prototype.pickWorldPoint = function pickContextualWorldPoint(event) {
    const terrainResult = pickPlayableTerrainPoint(this, event);
    return terrainResult ?? originalPickWorldPoint.call(this, event);
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
    const result = await runner(this, config);
    applyContextualCameraFrame(this, result?.plan);
    exposePlayableCenterProbe(this);
    exposeContextualPlan(this, result);
    return result;
  };

  return true;
}
