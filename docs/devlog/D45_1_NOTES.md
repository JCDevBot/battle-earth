# D45.1 Road Canopy Exclusion

Focused fix after D45 riparian corridor vegetation.

## Problem
Riparian trees improved river corridors, but large crowns/clumps could visually cover roads even when trunks were technically outside the existing road exclusion buffer.

## Changes
- Added context-aware vegetation road clearance helper.
- Riparian vegetation now uses a wider road/bridge no-canopy band.
- Major roads get a larger clearance than local streets.
- Street-tree context keeps a smaller clearance so future boulevard trees can still exist.
- No changes to building batching, camera, water, or generation recovery pipeline.

## Expected Result
- Riverbanks stay wooded.
- Large riparian canopies no longer cover roads/bridges as aggressively.
- Roads remain visually readable through riparian corridors.
