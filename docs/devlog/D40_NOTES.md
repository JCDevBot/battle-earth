# D40 Classification Coverage + Inspector

## Goal
Turn classification debug from text-heavy labels into a GIS-style color coverage tool so we can see what every area is being interpreted as before tuning vegetation rules.

## Added

- Color-coded classification polygon fills with outlines.
- Text labels suppressed by default to avoid hiding polygon coverage.
- Classification inspector panel.
- When the `classification-debug` layer is visible, a plain left click inspects the clicked map position.
- Inspector shows:
  - world position
  - ground class
  - primary OSM tag
  - polygon area
  - vegetation chunk
  - vegetation eligibility
  - water/road/building exclusion status
  - canopy score vs threshold
  - decision trace
  - overlapping classifications

## Why
The west/east bridge issue appears to be driven by OSM classification and/or exclusion logic, not vegetation chunking. D40 lets us click the west creek corridor and see whether it is PARK, SCRUB, FOREST, etc., and why vegetation is blocked or allowed.

## Notes
Classification Debug remains off by default. Enable it in the layer controls, then click the map to inspect classification decisions.
