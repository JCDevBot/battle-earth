# Phase 10G.1 Shorelines and Water Fidelity

Goal: improve recognizable neighborhood water features so ponds, rivers, islands, and shorelines read as real terrain features instead of flat blue shapes.

## Added

- Broader mud flat layer around polygon water bodies.
- Stronger wet bank and shoreline layers around ponds and lakes.
- Reeds and shoreline rocks along polygon water edges.
- Reeds and shoreline rocks along rivers, streams, canals, ditches, and drains.
- Water edge detail uses instanced meshes so it should be relatively cheap to render.

## Testing Notes

Use a neighborhood with a known pond, creek, island, or river edge.

Check:

- The pond or lake still appears in the correct location.
- Shoreline no longer reads as a hard flat edge.
- Reeds and rocks appear around water without overwhelming the map.
- Camera movement remains stable after the extra shoreline detail.
- Performance remains acceptable in water heavy areas.

## Known Limits

- This does not yet create real cut banks or terrain deformation around water.
- This does not yet classify docks, beaches, boardwalks, marshes, or boat launches.
- Island fidelity depends on the OSM polygon data available for the selected location.
