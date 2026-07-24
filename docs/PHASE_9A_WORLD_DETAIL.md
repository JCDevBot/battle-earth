# Phase 9A — World Detail Pass

This phase adds a lightweight “lived-in world” layer on top of the tactical map.

## Added

- Residential fence generation around building footprints
- Driveways from houses to nearby eligible roads
- Commercial / industrial parking pads
- Static parked-car instances on parking pads
- Instanced roadside utility poles and streetlights
- Prop-specific destruction registration
- Prop-specific tactical metadata
- Dedicated `props` performance layer toggle

## Testing

1. Run the project.
2. Generate a map with residential/commercial roads.
3. Toggle the new `props` layer in the debug panel.
4. Damage fences, parking pads, streetlights, and poles with the sandbox weapons.
5. Enable tactical overlays and verify props contribute light cover / movement penalties.

## Notes

This pass favors cheap, readable geometry over high-detail assets. Props are designed to be destructible and tactical without creating a large draw-call burden.
