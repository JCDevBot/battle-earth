# D28 Notes — FPS Rescue Pass

Changes:
- Disabled antialiasing by default for the WebGL renderer.
- Forced renderer pixel ratio to 1 for older/integrated GPUs.
- Disabled shadow map rendering by default.
- Disabled post-processing by default while keeping the pipeline available in code.
- Restored distance/altitude culling logic in PerformanceManager so far-away props/vegetation/tactical helpers can be hidden instead of all 1600+ tracked objects staying visible.

Goal:
- Stabilize FPS on lower-end hardware while preserving the D27 visual/map fixes.
