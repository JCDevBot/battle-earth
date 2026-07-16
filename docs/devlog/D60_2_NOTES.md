# D60.2 Globe Boundary Occlusion + State Zoom Pass

## Goal
Fix the globe geography layer so boundaries and labels on the far side of Earth do not render through the planet, while making state and region outlines appear sooner as the user zooms in.

## Changes
- Turned depth testing back on for administrative boundary line materials.
- Set boundary line depthWrite to false so overlays do not corrupt the depth buffer.
- Turned depth testing on for admin label sprites so labels behind the globe are occluded by Earth.
- Set label depthWrite to false for cleaner layered text.
- Adjusted zoom thresholds:
  - Continent view remains high altitude.
  - Country view appears at mid altitude.
  - State/region view appears sooner when zooming into a country.
  - City view appears only when zoomed closer.
- Updated boundary status text to indicate depth occlusion is enabled.

## Validation Checklist
- From North America view, Africa/Europe/Asia boundaries should no longer be visible through the globe.
- Country boundaries should remain visible on the near side.
- Zooming into the United States should reveal US state outlines and state names.
- Zooming closer should transition to city labels.

## Notes
If labels still feel crowded at country zoom, the next pass should add label priority and decluttering instead of hiding real geography.
