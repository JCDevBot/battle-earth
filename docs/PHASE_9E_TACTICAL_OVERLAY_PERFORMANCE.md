# Phase 9E - Tactical Overlay Optimization

This pass converts the tactical overlay from thousands of independent CircleGeometry meshes into a single batched InstancedMesh.

## Goals

- Keep cover / LOS / movement overlays testable.
- Stop overlays from adding thousands of draw calls.
- Rebuild overlay matrices only when tactical state, visibility, or mode changes.
- Cap overlay instances to the strongest scored tactical items first.

## Expected result

Tactical overlays should now cost roughly one draw call instead of one draw call per tactical feature.
