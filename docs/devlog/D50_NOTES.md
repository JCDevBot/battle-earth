# D50 Notes — Fixed North/South Battlefield Orientation

## Goal
Lock the generated battlefield into a consistent readable campaign axis:

- Friendly HQ always generated from the south side of the map.
- Enemy HQ always generated from the north side of the map.

## Implementation
- Replaced pair-distance HQ selection with oriented HQ selection in `StrategicPOIManager.generateHQs()`.
- Friendly HQ is selected from the southern band of the map when possible.
- Enemy HQ is selected from the northern band of the map when possible.
- If one band has no suitable POI, the generator falls back to the strongest south-leaning/north-leaning POI so sparse maps still work.
- Added minimum HQ separation safeguard.
- Preserved previous POI ownership, influence, income, capture, and defense seed data.
- Added debug panel orientation metric: `Friendly South / Enemy North`.

## Design Rule
This build treats map generation as game generation:

```text
Enemy HQ
Enemy Territory
Neutral / Contested Front
Friendly Territory
Friendly HQ
```

This gives future deployment, AI, territory propagation, and resource systems a stable spatial assumption.

## Next Recommended Step
D51 should begin territory propagation/frontline visualization from this stable north/south seed.
