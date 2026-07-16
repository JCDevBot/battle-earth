# D69 – Living Influence & Command Layer

## Goal
Shift campaign play from panel-driven commands to direct map interaction. Armies are now selected on the strategic theater map and ordered by clicking target regions. Influence spreads behind the moving army like a first-pass paint/pressure mechanic.

## Added
- Direct army banner selection on the campaign map.
- Click-to-move / click-to-expand interaction from the map.
- Hover movement preview from selected army to target region.
- Dashed animated-style command paths and retained movement trails.
- First-pass influence paint using `influenceClaims` on source and target regions.
- Contested-region visual overlay when opposing influence overlaps.
- Movement events and influence events in the event log.
- Army progress/status data for advancing and engaging orders.
- Fallback order selector retained inside a collapsible details panel.
- North America theater curation: Canada, United States, and Mexico only. Central America and Caribbean should become separate campaign theaters.

## Interaction Model
1. Generate a campaign.
2. Select an army banner on the map or in the command tree.
3. Hover a destination region to preview the command path and projected influence.
4. Click the target region to issue the order.
5. Advance campaign pulse to progress army orders and influence.
6. Conflicts appear when moving into hostile or contested influence.

## Notes
This is still a first pass. Movement is region-to-region rather than continuous pathfinding over roads. D70 should make geography matter by adding roads, rivers, mountains, logistics, and supply-aware movement.
