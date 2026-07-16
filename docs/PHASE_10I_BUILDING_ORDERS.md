# Phase 10I: Building Orders and Infantry Intent

This pass adds the first version of intent-based building interaction for infantry squads.

## Interaction

- Select a friendly or enemy squad.
- Single-click a building to issue the default order: use the building as cover with return-fire rules.
- Long-hold a building to open a building command card.
- Choose one of the building orders from the card.

## Building orders

Implemented order packages:

- `use_building_cover`
  - Squad moves toward the selected building.
  - The squad forms a defensive line outside the building, using the building as cover behind them.
  - Fire policy can be `free`, `return`, or `hold`.

- `occupy_building`
  - Squad moves into/onto the building footprint.
  - The squad clusters in a protected posture.
  - Fire policy can be `free`, `return`, or `hold`.

## Current autonomy

The squad still uses the existing infantry contact loop:

- If contact is detected while moving, the squad stops to seek cover and defend.
- If it reaches the building order destination, it transitions into setup and then defending.
- If morale breaks from casualties/suppression, it transitions into retreating.

This is intentionally a first playable layer, not a full behavior tree yet.
