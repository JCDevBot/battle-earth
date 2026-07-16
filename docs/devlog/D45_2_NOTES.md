# D45.2 — Riparian Gradient and Gap Fill

Starting point: D45.1 road canopy exclusion.

Changes:
- Reworked riparian vegetation from a binary corridor into a distance-weighted influence gradient.
- Added near-bank bias with patchy outer-bank placement.
- Added a minimum coverage pass so long river/creek stretches do not become visually barren.
- Added smaller gap-fill riparian trees/shrubs to improve continuity without creating a wall of forest.
- Kept D45.1 hard exclusions for roads, buildings, bridges, and open water.

Validation focus:
- River corridor should read as continuous ecology.
- Upper creek stretches should no longer have long empty sections.
- Trees should still stay clear of road surfaces.
