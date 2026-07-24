# D66 - Living Campaign Engine First Pass

## Goal
Start moving from a static Risk-style campaign board to a living strategic command interface.

## Added
- Influence model per region.
- Owner control percent, contested state, and supply-linked state.
- Region cards now show influence bars.
- Real army objects with strength, morale, supply, order, and status.
- Player command tree listing deployed armies.
- Army selection syncs the left panel and board selection.
- Deploy Army action for owned regions.
- Issue Order action moves selected army into a target region.
- Movement updates influence and creates conflicts when entering enemy territory.
- Campaign pulse action updates resources/influence and logs the event.
- World Event Log with timestamped events.
- Conflict auto-resolve moved into campaign engine.
- Tactical launch hook retained from D65.

## Design Direction
Territory is no longer only static ownership. Armies project influence into their current region and nearby regions. Influence can eventually become the core visual and simulation layer for frontlines, control, supply, morale, and contested areas.

## Known Limitations
- AI actors do not yet make autonomous decisions.
- Influence is region-level, not continuous geographic painting yet.
- Movement is instant rather than animated/path-based.
- Adjacency is still first-pass/generated.
- Diplomacy and capitals are not yet modeled.
- Event log entries can center selected regions but not armies/conflicts yet.

## Next
D66.1 should add autonomous AI actor pulses, faction resources, smarter movement, and a clearer ownership/influence overlay.
