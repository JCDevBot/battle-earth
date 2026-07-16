# D27 Notes — Remove Visible Island Helper + Water Wedge Cleanup

## Changes

- Removed rendering of the hand-authored Bryant Park pond island helper ellipse.
  - The ellipse is still used internally as invisible support geometry for water exclusion and contained island vegetation.
  - This prevents the unwanted oval light-green patch from appearing on top of the pond/island area.

- Changed generated island land meshes to classify as terrain when they are rendered from real OSM inner rings.
  - This avoids island land being grouped into the water layer just because the feature name contained the word "water."

- Adjusted the water shader to stop using ShapeGeometry UVs for ripple/color variation.
  - Concave pond geometry can produce large triangulation-dependent UV wedges.
  - Water now uses local map coordinates for subtle ripple variation, reducing diagonal light-blue triangle artifacts.

## Build

- Verified with `npm run build`.
