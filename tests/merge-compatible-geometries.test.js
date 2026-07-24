import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { mergeCompatibleGeometries } from "../src/map/utils/mergeCompatibleGeometries.js";

function triangleGeometry({ withUv = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  geometry.computeVertexNormals();
  if (withUv) {
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2),
    );
  }
  return geometry;
}

describe("mergeCompatibleGeometries", () => {
  it("drops optional attributes that are not present on every geometry", () => {
    const withUv = triangleGeometry({ withUv: true });
    const withoutUv = triangleGeometry();

    const merged = mergeCompatibleGeometries([withUv, withoutUv]);

    expect(merged).not.toBeNull();
    expect(merged.getAttribute("position").count).toBe(6);
    expect(merged.getAttribute("normal").count).toBe(6);
    expect(merged.getAttribute("uv")).toBeUndefined();
    expect(withUv.getAttribute("uv")).toBeDefined();
  });

  it("preserves compatible optional attributes shared by every geometry", () => {
    const first = triangleGeometry({ withUv: true });
    const second = triangleGeometry({ withUv: true });

    const merged = mergeCompatibleGeometries([first, second]);

    expect(merged).not.toBeNull();
    expect(merged.getAttribute("uv").count).toBe(6);
  });

  it("returns null when no usable geometry is supplied", () => {
    expect(mergeCompatibleGeometries([null, undefined])).toBeNull();
  });
});
