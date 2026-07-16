# D76 - World Engine v1 Foundation

## Build focus

Introduces the architectural foundation for: one continuous, scale-aware digital Earth for strategy gameplay from planetary level down to individual streets.

## Added

- `src/world/WorldEngine.js`
  - shared World Engine tagline
  - LOD hierarchy from Planet to Tactical
  - scale-aware asset profiles
  - natural region count estimator
  - sparse / recommended / dense / custom region density options
  - World Engine plan generator
- `docs/WORLD_ENGINE_V1.md`
  - formalizes continuous Earth architecture
  - separates selection scale from playable scale
  - defines renderer/data rules by zoom level
- Campaign lobby now exposes:
  - World Engine concept panel
  - playable layer for selected mode
  - region density controls
- Campaign stage now shows:
  - World Engine version
  - current LOD
  - next detail LOD
  - target region count
  - scale-aware asset tags

## Design intent

The campaign map, operational map, and tactical battlefield should become levels of detail of the same world model rather than separate map types.

## Verified

- `npm run build` succeeds.
