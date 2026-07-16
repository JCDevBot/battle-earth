# D72 - Map-First Scale-Aware 3D Theater Layout

Focus: make the generated campaign map visible and dominant after campaign generation, while keeping the scale-aware strategic features from D71.

## Changes

- Campaign main area now scrolls instead of clipping content off-screen.
- Strategic theater map is now a fixed, map-first viewport instead of a flex item that can collapse behind lower panels.
- Theater viewport is larger by default, with a higher minimum height on desktop.
- Region cards and event panels remain below the map as secondary command surfaces.
- Updated D71 labeling to D72.
- Continued the scale-aware map language: borders, rivers, forests, mountains, command nodes, influence, armies, and conflicts.
- Adjusted ocean/water color treatment for richer terrain-map styling.

## Intent

The campaign map should feel closer to the neighborhood tactical map style: a generated world view first, with controls around it, not a card list with a hidden map.

## Next

D73 should continue moving the campaign map toward a true shared renderer with the tactical map:

- actual Three.js campaign scene instead of SVG/perspective war table
- orbit camera
- terrain chunks by selected entity scale
- scale-aware feature generation
- real strategic POIs
- army banners and influence rendered in 3D space
