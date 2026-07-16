# Phase 8 — Tactical Destruction Hooks

This phase makes destruction affect tactical metadata, not just visuals.

## Added

- Tactical feature profiles for destructibles
- Cover values
- Line-of-sight blocker values
- Movement blocker and movement penalty values
- Tactical debug overlays:
  - cover
  - LOS
  - movement
- Tactical stats in the debug panel
- Destruction-driven tactical updates

## How to test

1. Run the app.
2. Enable **Tactical Overlays** in the right debug panel.
3. Switch between:
   - `cover`
   - `los`
   - `movement`
4. Damage buildings, roads, bridges, and trees with sandbox weapons.
5. Watch overlay size/opacity and tactical stats update.

Expected behavior:

- Intact buildings provide strong cover, LOS blocking, and movement blocking.
- Destroyed buildings become rubble: lower LOS blocking, partial cover, movement penalty.
- Destroyed roads create movement penalties.
- Destroyed bridges become movement blockers.
- Trees provide soft cover and partial LOS blocking until destroyed.
