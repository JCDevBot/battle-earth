# Phase 10K - Compact Unit Command UI

## Goal
Reduce unit-management UI footprint and keep the battlefield as the primary control surface.

## Changes
- Replaced large D29 dashboard cards with a compact bottom roster strip.
- Friendly and enemy units now render as small unit icons with:
  - side color
  - status dot
  - squad strength text
  - tiny strength bar
- Clicking a roster icon selects the unit without moving or centering the camera.
- Added floating in-world command card anchored near the selected squad.
- Command card supports:
  - Move
  - Defend
  - Suppress
  - Retreat
  - Hold
- Move/Defend/Suppress enter map-targeting mode and close after the target order is completed.
- Hold and Retreat execute immediately and close the command card.

## Design Direction
The bottom UI now acts as a unit locator/roster only. Unit commands live near the selected unit on the battlefield so the user's attention stays on terrain, cover, LOS, and spatial context.
