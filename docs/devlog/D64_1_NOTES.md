# D64.1 — Campaign Lobby UI + Globe Interaction Cleanup

## Goal
Clean up the default player-facing globe lobby so it feels like the actual game start screen rather than a developer/test screen.

## Changes

### Player-facing default view
- Known Test Locations are hidden by default.
- Known Test Location blue globe markers are hidden by default.
- Developer diagnostics are hidden by default.
- Test location tools now live behind a top-right Settings / Dev Mode toggle.

### Dev Mode
- Added a top-right Settings button.
- Toggling Dev Mode reveals:
  - Known Test Locations
  - geography visibility counts
  - boundary loading status
  - debug note explaining interaction behavior
- When Dev Mode is enabled, known location markers become visible on the globe.

### Globe interaction cleanup
- Removed the persistent red click marker from the globe.
- Short click selects/highlights the geography entity at the active zoom level.
- Long press or drag is treated as globe navigation and does not leave a marker.
- Mouse down pauses idle rotation.
- Mouse up updates centered geography after navigation.

### Responsive layout
- Desktop/laptop: globe is centered in the right 65% of the viewport, with the campaign lobby occupying the left 35%.
- Mobile: campaign lobby becomes a bottom sheet with the globe visible above it.
- Campaign lobby is scrollable on small screens.
- Real-Time Earth controls are centered under the globe on desktop.

## Validation
- `npm run build` completed successfully.

## Next Ideas
- Improve selected-region fill/glow, not just outlines.
- Add a polished settings modal rather than an inline dev drawer.
- Add a true click/hover tooltip for selected entities.
- Continue mobile bottom-sheet polish.
