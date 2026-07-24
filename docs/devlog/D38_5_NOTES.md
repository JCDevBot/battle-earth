# D38.5 Canopy Classifier Calibration

Goal: D38.4 proved Planetary Computer NAIP access works, but the classifier was too strict. The map sampled imagery successfully while producing zero candidate cells.

Changes:
- Recalibrated RGB canopy score for rendered NAIP previews.
- Lowered canopy candidate threshold from 0.43 to 0.24.
- Lowered placement authority thresholds by context.
- Increased canopy-probe placement probability and max canopy budget slightly.
- Added min/max score, medium/high candidate counts, and candidate threshold diagnostics.

Expected result:
- Candidate cells should no longer be zero in leafy residential neighborhoods.
- Placement acceptance rate should rise from roughly 2% to a more useful range.
- Roads, buildings, water, and normal placement masks still prevent vegetation from landing in impossible places.

This is still not final tree-crown detection. It is the first calibrated canopy-mask pass for local tactical slices.
