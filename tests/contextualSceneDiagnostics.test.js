import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  inspectContextualSceneObjects,
  inspectContextualWaterMeshes,
} from "../src/app/contextualSceneDiagnostics.js";

const plan = Object.freeze({
  visualFeatures: Object.freeze({
    mapWidthMeters: 500,
    mapDepthMeters: 400,
  }),
});

function horizontalPlane(width, depth, name) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial(),
  );
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe("contextual scene diagnostics", () => {
  it("accepts ordinary meshes inside the contextual render bounds", () => {
    const result = inspectContextualSceneObjects(plan, [
      horizontalPlane(120, 80, "river-section"),
    ]);

    expect(result).toMatchObject({
      objectsInspected: 1,
      invalidObjects: 0,
      outsideRenderBounds: 0,
      suspiciousFullMapCoverage: 0,
      valid: true,
    });
    expect(result.entries[0]).toMatchObject({
      label: "river-section",
      type: "Mesh",
      inspection: { reason: "within-render-bounds" },
    });
  });

  it("flags a single mesh that nearly covers the complete rendered map", () => {
    const result = inspectContextualSceneObjects(plan, [
      horizontalPlane(490, 390, "malformed-water-slab"),
    ]);

    expect(result).toMatchObject({
      objectsInspected: 1,
      invalidObjects: 1,
      suspiciousFullMapCoverage: 1,
      valid: false,
    });
    expect(result.entries[0].inspection.reason).toBe(
      "suspicious-full-map-coverage",
    );
  });

  it("flags meshes extending beyond contextual render bounds", () => {
    const mesh = horizontalPlane(120, 80, "misprojected-water");
    mesh.position.x = 260;
    mesh.updateMatrixWorld(true);

    expect(inspectContextualSceneObjects(plan, [mesh])).toMatchObject({
      invalidObjects: 1,
      outsideRenderBounds: 1,
      valid: false,
    });
  });

  it("reads water meshes from the map feature builder contract", () => {
    const builder = {
      waterMeshes: [horizontalPlane(100, 50, "water-1")],
    };

    expect(inspectContextualWaterMeshes(plan, builder)).toMatchObject({
      objectsInspected: 1,
      valid: true,
    });
  });

  it("returns a stable empty report when no objects are available", () => {
    const result = inspectContextualSceneObjects(plan, null);

    expect(result).toEqual({
      objectsInspected: 0,
      invalidObjects: 0,
      outsideRenderBounds: 0,
      suspiciousFullMapCoverage: 0,
      valid: true,
      entries: [],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.entries)).toBe(true);
  });
});
