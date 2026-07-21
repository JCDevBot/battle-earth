import { applyContextualCameraFrame } from "./contextualCameraFraming.js";
import { runContextualMapGeneration } from "./runContextualMapGeneration.js";

const INSTALL_MARKER = Symbol.for(
  "battle-earth.contextual-map-generation-installed",
);

function exposeContextualPlan(engine, result) {
  const plan = result?.plan;
  if (!plan) return;

  engine.lastContextualGenerationPlan = plan;

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

  prototype.generateMap = async function generateContextualMap(config) {
    const result = await runner(this, config);
    applyContextualCameraFrame(this, result?.plan);
    exposeContextualPlan(this, result);
    return result;
  };

  return true;
}
