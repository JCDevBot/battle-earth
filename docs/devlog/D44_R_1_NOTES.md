# D44-R.1 Camera Anchor + Keyboard Elevation Fix

Built from D44-R recovery diagnostics.

## Changes

- Added screen-center ground anchor helper using terrain raycast.
- Camera elevation changes now preserve the terrain point under the center of the screen.
- Arrow keys were remapped:
  - W/A/S/D: pan across the map
  - Arrow Up/Down: raise/lower camera elevation
  - Arrow Left/Right: rotate around the anchored point
- R/F now use the same anchored elevation behavior.
- Camera target stays glued to terrain height while panning.
- OrbitControls now has tactical constraints:
  - screen-space pan disabled
  - min/max distance set
  - polar angle clamped to prevent under-terrain orbiting

## Intent

Moving from top-down/angled views toward lower elevations should keep the same map point centered instead of drifting away from the area being inspected.
