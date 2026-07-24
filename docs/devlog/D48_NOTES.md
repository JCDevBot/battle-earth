# D48 Strategic POI Archetypes, HQs, and Resource Preview

## Added
- Strategic POI archetypes: logistics, transport, observation, civic, infrastructure, hq.
- Archetype-aware names so clustered objectives read more like battlefield locations.
- POI benefits:
  - Logistics: command income
  - Infrastructure: command income + systems
  - Transport: mobility corridor
  - Observation: recon vision
  - Civic: victory influence
- Capture metadata:
  - strategicValue
  - captureTime
  - resourceBonus
  - visionBonus
  - victoryValue
- Auto HQ generation from distant high-value major POIs.
- Friendly/enemy ownership applied to generated HQ anchor POIs.
- Ownership-colored capture rings and HQ markers.
- Debug panel now shows HQ count, archetype counts, and income preview.

## Validation
- `npm run build` passes.
- Existing large bundle-size warning remains.

## Next suggested phase
- D49/D50 territory preview: spread blue/red influence from HQs through adjacent POIs, keep neutral POIs gray, and prepare capture state transitions.
