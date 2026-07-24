# D64 Strategic Campaign Lobby + Responsive UI

## Goal
Shift the globe start experience from a map generator setup screen into a strategy-game campaign lobby.

## Added

### Strategic campaign lobby
- Contextual left-side campaign panel.
- Panel follows the current strategic entity:
  - World
  - Continent
  - Country
  - State / Region
  - City
- If the user takes no action, the panel fades in as a World campaign menu.
- If the user spins the globe, the panel fades out, then fades back in after the globe settles.
- The panel displays selected entity hierarchy, facts, available game modes, player modes, and tactical starting scale.

### Strategic entity behavior
- Added a root World entity.
- Added helper logic for battle level labels, available game modes, facts, and launch location creation.
- Current entity is selected admin if clicked, otherwise centered geography after user interaction, otherwise World.
- BattleRequest now includes a `strategicEntity` payload with id, name, level, hierarchy, and source.

### UI presentation
- Globe remains the centerpiece.
- Large centered geography title remains for orientation.
- Real-time Earth controls moved to a compact lower HUD.
- Known test locations moved to a right rail that only appears on extra-large screens.
- Hover coordinates stay bottom-left.
- Existing central clutter was reduced.

### Responsive UI
- Continued using Tailwind CSS, which was already installed and configured.
- Added responsive panel widths, mobile-safe layouts, and breakpoint-controlled right rail visibility.
- No Bootstrap dependency was added. Bootstrap is still a good option, but Tailwind fits this project better because the UI is highly custom, HUD-like, and already using Tailwind.

## Build
- `npm install`
- `npm run build`
- Build verified successfully.

## Next ideas
- D64.1 visual polish pass for typography, spacing, and animation timing.
- D65 game-mode scaffolding by strategic level:
  - World Risk-style
  - Continent campaign
  - Country control
  - Region operation
  - City battle
- D66 strategic POI generation by scale.
