# D38.3 Canopy Preview Fallback

Goal: test a second Planetary Computer imagery access route after the item tile endpoint returned HTTP 500 for NAIP tiles.

Changes:
- Kept STAC search as-is.
- Kept tile sampling as the first attempt.
- Added fallback sampling through the Data API item preview endpoint when all tile samples fail.
- Added diagnostics for preview fallback status, preview endpoint, tile samples, and tile failures.
- The fallback samples a 512×512 bbox preview image into the existing 32×32 canopy grid.

Expected diagnostics:
- If tile access still fails but preview works, `Preview fallback=used`, `Preview success=yes`, and `Sampled cells=1024`.
- If both fail, diagnostics should still show the failing stage and endpoint attempted.
