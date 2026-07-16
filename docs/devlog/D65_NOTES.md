# D65 — Campaign Engine Foundation

## Goal
Begin separating the globe lobby from actual gameplay by introducing a generated strategic campaign board.

The globe now selects a strategic root entity and configuration. Non-city selections with campaign-style modes launch a campaign board instead of immediately creating a tactical OSM map.

## Added

### Campaign Engine Foundation
- Added `src/campaign/CampaignEngine.js`.
- Introduced campaign generation from a `BattleRequest`.
- Root entity becomes the campaign theater.
- Direct child entities become playable strategic regions.
- Unit scale adapts by selected level:
  - World: army group
  - Continent: field army
  - Country: corps
  - Region: brigade
  - City: battalion

### Campaign Stage
- Added `src/components/CampaignStage.jsx`.
- New strategic campaign board screen.
- Setup flow supports:
  - home region selection
  - AI opponent count
  - generated campaign start
- Campaign regions display:
  - owner
  - army strength
  - income
  - POI count
- First-pass movement/conflict loop:
  - select owned region
  - select target region
  - move army / create conflict
  - auto-resolve conflict
  - zoom to tactical placeholder path

### BattleRequest Upgrade
- `BattleRequest` now carries:
  - launch type: `campaign` or `tactical`
  - selected strategic entity
  - direct child entities
  - child level
- City and freeplay selections still launch tactical maps directly.
- World, continent, country, and region campaign modes launch strategic campaigns.

### D64.3 Carryover
- Campaign generation uses direct children only.
- No stale child entities should be reused between selections.
- Child data is copied into the `BattleRequest` at launch time.

## Known Limitations
- Region adjacency is placeholder/order-based, not true polygon adjacency yet.
- AI does not take turns yet.
- Strategic map is a card board, not a geographic projected board yet.
- POIs are generated as lightweight counts, not named strategic objectives yet.
- Tactical launch from a conflict uses the contested region centroid as a first-pass location.

## Success Test
1. Select North America.
2. Select Risk-style and PvAI or Sandbox.
3. Generate campaign.
4. Pick a home country.
5. Pick AI opponent count.
6. Start campaign.
7. Move from an owned region into another region.
8. See a confrontation when attacking an occupied region.
9. Auto-resolve or launch tactical placeholder.

