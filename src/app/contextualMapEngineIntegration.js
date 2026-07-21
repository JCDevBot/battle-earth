import { runContextualMapGeneration } from "./runContextualMapGeneration.js";

const INSTALL_MARKER = Symbol.for(
  "battle-earth.contextual-map-generation-installed",
);

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

  prototype.generateMap = function generateContextualMap(config) {
    return runner(this, config);
  };

  return true;
}
