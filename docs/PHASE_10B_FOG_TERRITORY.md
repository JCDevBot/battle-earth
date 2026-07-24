# Phase 10B — Fog of War and Territory Control

Adds a first playable battlefield information layer on top of infantry.

## Fog of War

- Toggleable fog overlay.
- Grid cells track `hidden`, `explored`, and `visible`.
- Friendly rifle squads reveal terrain within their vision radius.
- Enemy squads are hidden unless inside friendly vision.
- Optional debug vision rings show friendly detection radius.

## Territory Control

- Toggleable territory overlay.
- Sector cells become friendly, enemy, neutral, or contested.
- Squad presence controls nearby sectors.
- Contested sectors appear when both sides influence the same cell.

## Testing

1. Generate a map.
2. Spawn a friendly squad and an enemy squad.
3. Enable Fog of War.
4. Move the friendly squad with right-click secure-area orders.
5. Verify fog reveals around friendlies and enemy visibility changes.
6. Enable Territory Control.
7. Move squads through sectors and verify control colors update.

This is intentionally grid-based for performance and easy debugging. Later phases can replace the simple radius visibility with real LOS sampling against buildings/terrain.
