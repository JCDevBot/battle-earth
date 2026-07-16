# D73 - Strategic GIS Data Pipeline

Goal: test the Natural Earth + OSM-style data approach for generated campaign theater maps.

## Added

- `D73` GIS-powered theater feature layer.
- Natural Earth-style political geography remains the source of country/region geometry.
- OSM-style strategic feature library added for campaign-scale rendering:
  - named rivers
  - named mountain systems
  - terrain / forest zones
  - movement corridors
  - capitals and port command nodes
- Feature layer adapts by campaign/theater:
  - North America
  - South America
  - Africa
  - Europe
  - generic fallback
- Map now displays a small GIS source diagnostic overlay.
- Preserved D69/D70/D71/D72 campaign command systems:
  - army banners
  - click-to-move
  - influence paint
  - contested regions
  - event log
  - tactical hook

## Notes

This is still not a full GIS streaming backend. It is the first playable prototype of the intended pipeline:

Natural Earth political boundaries + OSM/Geofabrik-style strategic features + custom Three/SVG war-table renderer.

The next phase should replace the curated feature library with actual bundled extracts or vector tiles.

## Next

D74 should focus on one of two paths:

1. Real bundled strategic GIS datasets
   - Natural Earth rivers, lakes, physical labels, populated places
   - simplified roads / rail / ports / airports from OSM extracts

2. True 3D map renderer migration
   - move campaign theater from SVG pseudo-3D to Three.js terrain scene
   - share visual language with the neighborhood tactical renderer
