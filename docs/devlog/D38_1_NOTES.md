# D38.1 Canopy Validation Diagnostics

Purpose: verify whether the Planetary Computer / NAIP canopy pipeline is actually returning usable canopy data before adding more procedural vegetation.

Changes:
- Expanded the Canopy panel into Canopy Diagnostics.
- Shows STAC item count, selected NAIP item, date, tile zoom, grid size, sampled cells, failed tiles, candidate canopy cells, and average green score.
- After map build, reports canopy authority placement behavior: placement checks, high-score accepted, fallback allowed, rejected, and acceptance rate.
- Exposes builder canopy authority diagnostics back to the React UI after generation.

Interpretation:
- If STAC items = 0, the external source is not finding imagery for the bbox.
- If sampled cells = 0 or failed tiles is high, tile fetch/CORS/rendering is failing.
- If candidate cells is very low, the green/canopy classifier is too strict or imagery is not useful.
- If placement checks are high but accepted is low, the authority mask is suppressing vegetation.
- If acceptance rate is healthy but the map still looks treeless, tree caps or placement exclusions are likely too aggressive.
