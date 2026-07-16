# D82 Notes — Non-blocking Planetary NAIP probe

## Why
Local testing showed 404s from the Planetary Computer NAIP item tile endpoint, for example:

`/api/data/v1/item/tiles/WebMercatorQuad/16/6763/15055@1x?...`

This can happen when STAC finds a NAIP item that intersects the requested bbox, but an individual WebMercator tile requested from that item is outside the item's available tile coverage. The browser reports the failed image load and the map generation appears stuck or noisy.

## Changes
- `src/map/services/PlanetaryCanopyService.js`
  - The canopy probe now prefers bbox preview sampling first.
  - The old per-tile Data API path is retained only as a last-chance fallback.
  - If both preview and tile sampling fail, the service returns an unavailable result and the map continues with the OSM/procedural vegetation fallback.
  - Status messaging now distinguishes `Preview` from `Tile fallback`.

## Expected result
- Missing NAIP tiles should no longer block terrain map generation.
- The neighborhood/city/state/country map should still render even when Planetary Computer imagery is unavailable or partially missing.
- The NAIP probe remains experimental and auxiliary, not required for the core OSM terrain renderer.
