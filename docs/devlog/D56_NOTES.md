# D56 Notes - Exact OSM Building Footprints and Type Visuals

## North star
Generate a destructible tactical replica from real OSM lat/lon data. OSM remains the source of truth. Visual/gameplay enrichment must preserve real footprints and tags.

## What changed
- Added D56 building classification from OSM tags instead of relying mostly on generic size buckets.
- Preserved exact OSM footprint polygons as the single source for walls, roof caps, foundations, destruction registration, and metadata.
- Replaced the old rectangular foundation skirt with an exact-footprint foundation extrusion so buildings do not visually become bigger boxes.
- Added class and role metadata to building userData and destruction tags.
- Added building class counts to generation diagnostics.
- Added more distinct first-pass visual classes:
  - residential/house
  - garage/outbuilding
  - apartments
  - commercial/retail/shop
  - civic/school/church/hospital/etc.
  - industrial/warehouse/depot
  - utility/power/infrastructure
  - agricultural/barn/farm auxiliary
  - military/bunker/hardened
- Added class-specific facade markers:
  - residential/apartment windows
  - commercial/civic front glazing/entrance
  - industrial loading doors
  - utility rooftop pad marker
  - agricultural large door
  - military hardened roof cap
  - garage door
- Added new materials for civic, utility, garage, agricultural, civic roofs, and utility roofs.

## Why this matters
D54/D55 improved the map context through surfaces, parking, sports fields, and canopy. D56 starts fixing the next fidelity layer: buildings should look like the real OSM building type while staying destructible.

## Validation questions
When comparing to Google Earth:
1. Do buildings keep their real OSM outline instead of becoming generic rectangles?
2. Do houses, garages, shops, schools/civic buildings, warehouses, and utilities feel visually different?
3. Are residential buildings still too big, or is the problem mostly canopy/parcel context?
4. Are large commercial/industrial buildings readable at tactical zoom?
5. Does FPS remain acceptable with added visual markers?

## Known limitations
- Pitched roofs still use an oriented roof frame for readability, so complex residential roofs are simplified. The base footprint remains exact.
- No true OSM multipolygon building relation support beyond existing way handling.
- No real facade texture atlas yet.
- No interiors.
- No destruction state mesh swaps yet. Destruction registration is metadata-ready, but visual damage states remain future work.

## Recommended next milestone
D57 - Building Height, Roof, and Destructible State Framework
- Improve height fallback by OSM type and surrounding urban context.
- Add roof:shape and roof:material handling where present.
- Add intact/damaged/ruined/rubble state model per building.
- Add rubble footprint from exact OSM footprint.
- Add performance-safe LOD for facade details.
