# D52 Territory Heatmap + Objective Hierarchy

Built from D51 tactical grid overlay.

## Added

### Territory Visualization
- Territory control now renders as a blended heatmap instead of only discrete capture cells.
- Friendly influence tints blue.
- Enemy influence tints red.
- Contested influence tints purple.
- Territory influence is seeded from owned POIs, HQs, and active squads.

### Frontline Visualization
- Automatic contested frontier detection from the friendly/enemy influence delta.
- Frontline cells render as orange/yellow rings over contested territory.
- Frontline has its own visual layer toggle.

### Objective Hierarchy
- Strategic POIs now expose `objectiveClass` as major/minor.
- HQs remain major objectives.
- High value objectives and strategic crossings are promoted to major.
- Major objectives keep larger pins and persistent labels.

### Strategic Crossings
- Added `strategic_crossing` archetype.
- Bridges now classify as strategic crossings instead of ordinary transport nodes.
- Strategic crossings receive higher strategic value, victory value, vision value, and artillery-priority benefit text.

### Tactical Grid Intelligence
- Sectors now compute owner, POIs, resource value, strategic value, and threat score.
- Selected sector panel now shows operational values and POI names.
- Top artillery target sectors are ranked in the Battlefield Grid panel.

### Debug Cleanup
- Influence rings are hidden by default.
- New layer controls added:
  - Territory Heatmap
  - Frontline
  - Objective Hierarchy
  - Influence Rings
  - Battlefield Grid

## Build

`npm run build` passes.

Same existing bundle-size warning only.
