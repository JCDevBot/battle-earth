# D64.2 Strategic Entity Navigation

## Goal
Allow the campaign lobby to navigate the geographic hierarchy directly from the menu, while keeping globe click/drag navigation available.

## Added
- Clickable breadcrumb trail for Earth -> continent -> country -> region -> city.
- Parent/up navigation inside the campaign lobby.
- Child entity lists for the selected entity:
  - World shows continents.
  - Continents show countries.
  - Countries show states/regions.
  - Regions show major cities.
- Menu selection updates the highlighted geography and campaign panel.
- Globe camera jumps to the selected entity at a zoom level appropriate to its scale.
- Existing globe short-click selection still works.

## Notes
This moves the interaction model toward a unified Strategic Entity hierarchy. The globe and the campaign panel are now two synchronized ways to navigate the same world model.

## Next
- Smooth camera transitions instead of instant jumps.
- Search box for direct entity lookup.
- More thoughtful child sorting/ranking for large countries and regions.
