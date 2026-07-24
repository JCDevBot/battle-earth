# D67 - Entity Campaign Map Renderer

## Purpose
When a player selects a geography and generates a campaign, the selected entity now becomes a playable strategic campaign map instead of only a card grid.

## Added
- Strategic SVG campaign map renderer for generated campaign boards.
- Real child entity geometry is passed from the globe battle request into the campaign engine.
- Country/region polygons render as the main board where geometry or bbox data exists.
- Region ownership tinting appears directly on the map.
- Influence opacity reflects control strength.
- Selected region gets a stronger outline/glow.
- Army icons render on the map at region centroids.
- Conflict markers render on contested regions.
- Clicking map regions selects that region.
- Clicking army icons selects the unit and syncs the command tree.
- Region cards remain as a secondary command list below the map.

## First target
North America Risk-style / PvAI / Fluid campaign.

## Design note
The globe remains the lobby. Once Generate Campaign is selected, the generated strategic board becomes a separate playable map for the selected entity.

## Next recommended step
D68 should improve campaign map interactions:
- map panning/zooming
- adjacency-aware movement
- capital/command-node rendering
- ownership/influence overlay controls
- clearer army order modal/context menu
- event log click-to-camera behavior
