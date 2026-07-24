# D63.1 — Globe Presentation + Center Context

## Goal
Make the globe startup view feel cleaner and more intentional:

- initial camera starts at continent zoom
- North America is centered for the default Minnesota user location
- continent labels are the primary initial labels
- labels fade down while the user spins/drags the globe
- labels fade back in after interaction
- mouse/pointer down disables idle rotation
- pointer up captures the current camera-centered lat/lon and resolves the active geography for the current zoom tier
- a large centered geography title shows the current view context

## Added

- `centerContext` state
- `centeredFeatureForLevel()` helper
- `viewLabelForLevel()` helper
- smooth label opacity target/current refs
- interaction state refs
- pointer down/up interaction handling
- center context refresh during idle animation
- cleaner top-center view title panel

## Validation

- `npm run build` completed successfully.

## Next suggested iteration

D64 — Globe visual polish pass:

- move/collapse debug controls further away from the globe
- improve city/country label font scale and contrast
- add hover highlight for centered geography
- add optional “minimal cinematic globe” mode for launch screen
