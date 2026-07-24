# D62.1 — Zoom-Aware City Relevance

## Purpose
Reduce city-label overload when zooming into a country. D62 loaded global cities, but at city zoom it displayed too many available city labels regardless of what country/region the user was focused on.

## Changes
- Added country/region-aware filtering for the visible admin layer.
- Region labels now filter to the country under the camera instead of showing global admin-1 everywhere.
- City labels now filter to the country under the camera.
- At closer zoom, cities further narrow to the active region/province/state when available.
- Added city population/importance tiers.
- Added progressive city thresholds by camera distance:
  - wide city zoom: only very large cities
  - closer country zoom: major regional cities
  - close state/region zoom: local cities
- Added screen-space label decluttering for cities.
- Updated bottom guidance text to describe the new filtering behavior.

## Success Criteria
When zooming into the United States, the globe should not show every available global city. It should first show the most important US cities, then reveal more cities as the user zooms closer to a specific state/region.

## Notes
This is a first-pass label relevance system. Future work should improve city datasets, add neighborhood labels, and expose label density as a debug setting.
