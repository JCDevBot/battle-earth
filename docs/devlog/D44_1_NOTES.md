# D44.1 – Non-Invasive Classification Overlay Fix

## Summary
D44 added inferred residential block coverage, but the new large debug polygons could visually interfere with buildings/trees from low camera angles.

## Changes
- Classification debug fills now render early instead of after world detail.
- Removed aggressive negative polygon offset that could make overlays win against buildings/vegetation.
- Lowered fill opacity, especially for inferred residential blocks.
- Kept outlines visible but less dominant for inferred residential blocks.

## Expected result
- Buildings, trees, roads, and props should remain visible while classification debug is enabled.
- Residential block inference should still be inspectable through color fill/outline and click inspector.
