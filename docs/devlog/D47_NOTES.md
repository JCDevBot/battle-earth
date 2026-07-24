# D47 Strategic POIs Phase 2: Clustering, Names, Influence Zones

## Goal
Turn raw strategic POI candidates into cleaner battlefield objectives.

## Changes
- Added POI clustering so nearby same-type candidates become one objective.
- Reduced visual noise by selecting top battlefield POIs instead of rendering every raw candidate.
- Added major vs secondary POI tiers.
- Major POIs get full labels; secondary POIs get smaller markers.
- Added generated directional names such as Central Road Hub, North Civic Center, and West High Ground.
- Added neutral influence rings around POIs to preview future capture/territory zones.
- Added debug stats for raw clustered candidate count, major count, secondary count, source candidate count, and influence radius.

## Notes
- This is still not full scoring or ownership gameplay.
- Capture state is represented visually as neutral influence space only.
- Next good step: click/capture POIs and tint rings friendly/enemy based on ownership.

## Build
- `npm run build` passes.
- Existing bundle-size warning remains.
