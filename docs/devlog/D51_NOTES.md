# D51 Tactical Grid Overlay

Adds an optional battlefield grid layer for future targetable fire missions and map balancing.

## Added
- New `BattlefieldGridManager`.
- 5 north/south battlefield bands:
  - Enemy Rear
  - Enemy Operations
  - Contested Zone
  - Friendly Operations
  - Friendly Rear
- 3 east/west columns:
  - West
  - Center
  - East
- 15 sectors total with sector IDs such as `N-W`, `C-C`, `S-E`.
- Grid overlay layer toggle: `Battlefield Grid`.
- POIs and HQs are assigned to sectors.
- Ctrl-click sector selection for future fire mission targeting.
- Selected sector debug stats in the config panel.

## Design intent
POIs remain the strategic control layer. Grid sectors become the tactical targeting layer for future mortar fire, artillery, smoke, drone scans, suppression, supply drops, and area-denial cards.

## Build
`npm run build` passes. Existing bundle-size warning remains.
