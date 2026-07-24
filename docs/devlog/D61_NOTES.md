# D61 Notes — Progressive Geographic Detail & Selection

## Goal
Make the globe move from a working geography prototype toward an intuitive battle-selection interface:

Earth → continent → country → state/region → city → generated battle.

## Built

### Progressive zoom thresholds
Retuned globe distance thresholds so state/region geography appears sooner when zooming into a country.

- Continent: very high altitude
- Country: medium globe view
- State/region: closer country view
- City: close view

### Continent presentation cleanup
Continents are now treated as strategic labels rather than hard geographic outlines.

- Removed visible continent boundary outlines from the main globe layer
- Kept continent labels for high-level orientation
- Real country/state polygons now carry the actual geography

### State/region visibility
The state/region layer now participates more clearly in progressive disclosure.

- US state boundaries become visible at the region zoom tier
- US state labels render as the active layer at that tier
- Country boundaries remain as faint context one tier above

### Selection persistence
Selected geography now stores a selected admin ref and rebuilds the active layer after selection.

- Selected country/state/city remains highlighted more strongly
- BattleRequest still receives selected geometry and bbox

### Geography diagnostics
Added a compact globe diagnostics badge showing:

- active zoom tier
- visible continents
- visible countries
- visible states/regions
- visible cities

This should help quickly determine whether a layer is loaded, hidden, or culled.

## Notes
D61 intentionally does not add draw tools yet. The next phase should focus on selecting/drawing tactical battle areas after state/city navigation feels right.

## Validation checklist
- At globe level, continent labels should appear without large continent polygons.
- At country level, country boundaries and labels should be visible.
- When zooming toward the US, state boundaries and state names should appear sooner than before.
- Clicking a state should highlight it and update the selected-location hierarchy.
- BattleRequest should carry the selected state's geometry and bbox.
