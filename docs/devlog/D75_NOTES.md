# D75 - Scale Rules & World Country Campaigns

## Purpose
Separate geographic navigation scale from playable campaign territory scale.

## Key changes
- World Risk-style campaigns now generate countries as the playable regions instead of continents.
- Continent Risk-style campaigns continue to generate countries as the playable regions.
- Country campaigns generate state/province/admin-1 regions.
- Region campaigns generate cities where available.
- Added campaign metadata showing the playable scale rule, for example `world/risk → country`.
- Campaign panel now labels the region count as `Playable countries`, `Playable regions`, etc.
- Kept continents as navigation/context layers rather than default Risk territories.
- Preserved D74 scale-aware world generator rendering, influence paint, army command, conflicts, and tactical hook.

## Design note
The globe remains the selector. The generated campaign map now uses the selected entity and game mode to determine the next playable child layer.
