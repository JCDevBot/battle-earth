import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  installCompatibleGeometryMerge,
  mergeCompatibleGeometries,
} from "../src/app/compatibleGeometryMerge.js";

describe("compatible geometry merge", () => {
  it("merges indexed and non-indexed geometries with mismatched optional attributes", () => {
    const box = new THREE.BoxGeometry(2, 2, 2);
    const triangle = new THREE.BufferGeometry();
    triangle.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 0, 0, 1],
        3,
      ),
    );

    const merged = mergeCompatibleGeometries([box, triangle]);

    expect(merged).not.toBeNull();
    expect(merged.index).toBeNull();
    expect(merged.getAttribute("position").count).toBe(39);
    expect(merged.getAttribute("uv")).toBeUndefined();
    expect(box.getAttribute("uv")).toBeDefined();

    merged.dispose();
    box.dispose();
    triangle.dispose();
  });

  it("ignores invalid entries and returns null without a position geometry", () => {
    expect(mergeCompatibleGeometries([null, undefined])).toBeNull();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute([0, 1, 0], 3),
    );
    expect(mergeCompatibleGeometries([geometry])).toBeNull();
    geometry.dispose();
  });

  it("installs once on a builder instance", () => {
    const builder = { safeMergeGeometries: () => "legacy" };

    expect(installCompatibleGeometryMerge(builder)).toBe(true);
    expect(builder.safeMergeGeometries).toBe(mergeCompatibleGeometries);
    expect(installCompatibleGeometryMerge(builder)).toBe(false);
  });
});
