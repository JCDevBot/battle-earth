import { runContextualMapGeneration } from "./runContextualMapGeneration.js";

const INSTALL_FLAG = Symbol.for("battle-earth.contextual-map-generation-installed");

/**
 * Installs the contextual map-generation orchestrator on a MapEngine-compatible
 * class. Keeping the adapter here lets the orchestration remain independently
 * testable while the large MapEngine class is decomposed incrementally.
 */
export function installContextualMapGeneration(MapEngineClass) {
  if (typeof MapEngineClass !== "function") {
    throw new TypeError("A MapEngine class is required.");
  }

  const prototype = MapEngineClass.prototype;
  if (!prototype || prototype[INSTALL_FLAG]) return false;

  Object.defineProperty(prototype, INSTALL_FLAG, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  prototype.generateMap = function generateContextualMap(config) {
    return runContextualMapGeneration(this, config);
  };

  return true;
}
