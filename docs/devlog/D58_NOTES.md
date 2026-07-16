# D58 Sandbox Mode Shell

## North Star
Let a developer/player browse the globe, choose a real location, and generate a sandbox battle where they can control both sides.

## Implemented
- Added a Sandbox Battle Setup panel on the globe screen.
- Added player mode choices:
  - Sandbox
  - PvAI stub
  - PvP stub
- Added game mode choices:
  - Freeplay
  - Control
  - Rush
  - Risk-style
- Added battle scale choices:
  - Small test slice: 350m x 350m
  - Neighborhood: 800m x 1200m
  - District: 900m x 1400m
- Added `BattleRequest` object that carries selection, game mode, player mode, scale, and map dimensions into the tactical generator.
- Tactical stage now receives `battleRequest` and initializes map dimensions from it.
- Added in-game Sandbox Mode HUD:
  - Deploy Friendly
  - Deploy Enemy
  - Select Next
  - Clear Units
- Sandbox mode keeps Replica Mode as default and lets the player manually test both teams.

## Current Scope
This is not yet a full Earth strategy layer. It is the first sandbox shell for choosing a location and launching a manually controlled tactical battle.

## Next
- Add admin/country/state/city boundary awareness.
- Add selectable named regions on the globe.
- Add draw rectangle/polygon/corridor battle area tools.
- Add scenario presets that create initial units and objectives.
- Add a visual world buffer around the tactical tile.
- Continue roof render verification.
