# D37 Notes — Planetary Computer NAIP Canopy Probe

## Goal
Prototype an external vegetation/canopy data path so tree placement can eventually be based on real-world canopy instead of OSM vegetation polygons alone.

## Added
- `PlanetaryCanopyService` for Microsoft Planetary Computer STAC + tile access.
- New config option: `Vegetation source`.
  - `OSM + procedural` keeps the existing behavior.
  - `Experimental: Planetary Computer NAIP canopy probe` queries the public NAIP collection.
- Canopy Probe diagnostics in the config panel:
  - source
  - availability
  - NAIP item ID/date
  - sampled cells
  - candidate cells
  - average green score
- Experimental NAIP-assisted vegetation scatter pass.
  - Samples rendered NAIP RGB tiles into a small canopy candidate grid.
  - Converts candidate cells into extra tree placements.
  - Still respects existing smart placement exclusions for roads, buildings, water, and map bounds.

## Important Limitation
This is a research spike, not yet a production canopy detector.

NAIP rendered RGB tiles can distinguish green/non-green areas, but cannot reliably separate grass/lawn from tree canopy. The current classifier is intentionally lightweight and should be treated as a prototype proving the data path.

## Why this matters
The map can now reach beyond OSM for vegetation. This is the first step toward placing trees where aerial imagery suggests vegetation actually exists, especially in residential neighborhoods where OSM rarely maps individual trees.

## Next Tuning Ideas
- Add a real canopy classifier instead of a simple green score.
- Use NIR bands if available through signed COG assets instead of rendered RGB.
- Combine NAIP candidates with building/road/residential context to distinguish lawn from canopy.
- Add an optional debug overlay for the sampled canopy grid.
- Cache canopy probe results by lat/lon/size to avoid repeated network calls.
