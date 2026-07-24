# Phase 10G.3 — Battlefield Readability

Goal: keep the battlefield legible at tactical zoom levels. Important world features should simplify into readable masses instead of disappearing.

## Changes

- Added a terrain scale control in the config panel. Default is 1.35x to make real-world elevation read better in-game.
- Added persistent vegetation massing for forests, parks, scrub, and wetlands.
- Forest polygons now generate low-cost canopy mounds so forests read as wooded areas from altitude.
- Parks now get lighter canopy/green-space massing so they stand apart from generic ground.
- Wetland and scrub areas get their own massing material so they remain visible across zoom levels.

## Testing Notes

Load a familiar area with parks, ponds, or wooded patches. Zoom in and out while watching whether forests and parks remain recognizable. The goal is not final art quality yet. The goal is that the player always understands the battlefield geography.
