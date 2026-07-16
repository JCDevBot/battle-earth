# D40.1 — Classification Overlay Depth Fix

Fixes a regression from D40 where the color-coded classification coverage overlay could make buildings appear to blink or pop on/off.

## Cause
The D40 debug fill planes were raised about 1.35m above the terrain and rendered late with transparent depth writes disabled. At tactical camera angles, those planes could intersect building walls/foundations and visually fight with building LOD geometry.

## Fix
- Lowered classification fill planes to terrain + 0.08m.
- Added explicit depth testing to classification fills, outlines, and grid lines.
- Kept depth writes disabled so the overlay does not pollute the main scene depth buffer.
- Added strong polygon offset so the overlay still reads above terrain without covering raised building geometry.
- Reduced debug overlay render order so buildings remain visually authoritative.

## Expected Result
Classification debug can stay on without causing buildings to flicker/blink. Buildings should occlude the classification overlay, while the overlay remains readable on open ground.
