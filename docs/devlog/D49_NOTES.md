# D49 POI Ownership

## Added
- Initial POI ownership model after HQ generation.
- Ownership states: friendly, enemy, neutral, contested.
- Ownership strength and capture progress metadata on POIs.
- Frontline scoring for POIs near the balance line between HQs.
- Simple connected-to-HQ and defense level seed values.
- Ownership-colored POI labels, capture rings, and influence rings.
- Debug panel metrics for friendly/enemy/neutral/contested POI counts.
- Debug list now shows ownership strength and defense level.

## Ownership behavior
- Friendly and enemy HQ anchor POIs remain fully controlled.
- POIs close to each HQ become initially owned territory.
- POIs near the centerline/frontline become neutral or contested.
- Each side is guaranteed at least one non-HQ owned objective when enough POIs exist.

## Validation
- `npm run build` passes.
- Existing large bundle-size warning remains.

## Next suggested phase
- D50 territory visualization: blend ownership areas into a readable blue/red/gray territory layer and eventually connect POI control to the broader territory grid.
