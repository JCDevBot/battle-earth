# Phase 10H - Dev Unit Control

This pass turns the infantry sandbox into a two-sided developer control tool.

## Added

- Friendly and enemy squads can both be selected from the map.
- A selected squad from either side can receive a move order by clicking the ground.
- Right-click orders now apply to the selected squad, not only friendlies.
- Selection cycling supports all squads, friendlies only, and enemies only.
- The selected squad can be ordered to hold position.
- Path and objective markers are shown for the currently selected squad, regardless of side.

## Current autonomy

- Squads still autonomously detect enemies, seek cover, and exchange fire once contact is made.
- Enemy squads still default to a defensive hold behavior after deployment.
- This is not yet a full behavior-state system. Patrol, guard, attack-move, retreat, and rules-of-engagement controls should be added as explicit squad orders in a later pass.
