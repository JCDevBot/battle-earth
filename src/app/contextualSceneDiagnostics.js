import * as THREE from "three";
import { inspectContextualVisualBounds } from "./contextualVisualBounds.js";

function objectLabel(object, index) {
  return (
    object?.userData?.sourceId ??
    object?.name ??
    object?.uuid ??
    `scene-object-${index}`
  );
}

function boundsForObject(object) {
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  return Object.freeze({
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z,
  });
}

export function inspectContextualSceneObjects(
  plan,
  objects,
  options = {},
) {
  const entries = [];
  for (const [index, object] of Array.from(objects ?? []).entries()) {
    const bounds = boundsForObject(object);
    if (!bounds) continue;
    const inspection = inspectContextualVisualBounds(plan, bounds, options);
    entries.push(
      Object.freeze({
        label: objectLabel(object, index),
        type: object?.type ?? "Object3D",
        bounds,
        inspection,
      }),
    );
  }

  const invalidEntries = entries.filter((entry) => !entry.inspection.valid);
  const outsideRenderBounds = invalidEntries.filter(
    (entry) => entry.inspection.reason === "outside-render-bounds",
  );
  const suspiciousFullMapCoverage = invalidEntries.filter(
    (entry) => entry.inspection.reason === "suspicious-full-map-coverage",
  );

  return Object.freeze({
    objectsInspected: entries.length,
    invalidObjects: invalidEntries.length,
    outsideRenderBounds: outsideRenderBounds.length,
    suspiciousFullMapCoverage: suspiciousFullMapCoverage.length,
    valid: invalidEntries.length === 0,
    entries: Object.freeze(entries),
  });
}

export function inspectContextualWaterMeshes(plan, builder, options) {
  return inspectContextualSceneObjects(plan, builder?.waterMeshes, options);
}
