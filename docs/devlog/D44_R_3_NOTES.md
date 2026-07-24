# D44-R.3 — Building Chunk Batching Performance Pass

Goal: keep the stable D44-R recovery pipeline and no-blink building behavior, while reducing the draw-call cost of buildings.

Changes:
- Replaced full-detail per-building group rendering with deterministic chunk batching.
- For each building chunk, all full-detail child meshes are flattened and merged by material.
- The Buildings checkbox remains the only visibility gate.
- Distance-based LOD swapping remains disabled.
- LOD1/LOD2 are still generated but hidden, preserving a future path for performance modes.

Expected result:
- Buildings should no longer blink.
- Building draw calls should drop sharply compared with D44-R.2.
- Destruction visuals may need a later dedicated pass, because merged building meshes are now the visible representation in baseline mode.
