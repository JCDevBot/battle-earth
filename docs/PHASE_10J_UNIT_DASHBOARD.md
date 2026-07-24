# Phase 10J: Unit Dashboard / Roster Commands

Adds a bottom-of-screen unit dashboard for deployed resources.

## Added

- Friendly and enemy roster lanes at the bottom of the tactical view.
- Every deployed squad appears as a compact unit card.
- Unit cards show label, side, state, mission summary, alive count, and strength percent.
- Clicking a unit card selects that squad and recenters the battlefield camera near it.
- Selected unit is highlighted in the dashboard and on the battlefield.
- Dashboard command buttons:
  - Move
  - Defend
  - Suppress
  - Hold

## Command flow

Move, Defend, and Suppress enter a map-targeting mode.

1. Select a unit card.
2. Click a command.
3. Click the map to assign the target.

Suppress is implemented as an attack mission with fire-at-will behavior for this pass.

## Notes

This is intentionally a dev/control backbone before adding a minimap. It gives us a low-cost way to manage deployed units without adding extra 3D rendering load.
