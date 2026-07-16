# Battle Earth

Battle Earth is an experimental strategy and tactical warfare game built around a scale-aware digital Earth. Players begin on a globe, choose a real place, create a strategic campaign, and descend into a detailed tactical battlefield generated from geographic data.

The project is an active vertical-slice prototype. It contains working globe selection, campaign setup and movement, tactical terrain generation, OpenStreetMap ingestion, procedural fallbacks, infantry systems, fog of war, territory control, destruction, and performance diagnostics. It is not yet a complete game.

## Current status

The latest development milestone is **D87**. That milestone restored country outlines and labels on the globe while reducing initial administrative-data loading.

The current renderer architecture is intentionally transitional:

- The globe and tactical battlefield use Three.js.
- The strategic campaign currently uses a lightweight SVG renderer.
- A future migration may move strategic ownership and campaign visualization into the shared Three.js world renderer after feature parity is defined.

See [ADR 0001](docs/architecture/0001-renderer-boundaries.md) for the current decision and [ROADMAP.md](ROADMAP.md) for the stabilization sequence.

## Technology

- React 18
- Three.js
- Vite
- Tailwind CSS
- OpenStreetMap and Overpass data
- Bundled GeoJSON boundaries
- IndexedDB map caching
- Procedural terrain and feature fallbacks

## Run locally

Requirements:

- Node.js 20 or newer
- npm 10 or newer

```bash
npm ci
npm run dev
```

Open the local Vite URL shown in the terminal.

## Validation

```bash
npm run check
```

The check command runs linting, unit tests, formatting checks for maintained files, and a production build.

Individual commands:

```bash
npm run lint
npm test
npm run format:check
npm run build
```

## Project structure

```text
src/components          React application stages and panels
src/campaign            Strategic campaign rules and state transitions
src/map/builders         Geographic features converted into Three.js objects
src/map/engine           Rendering lifecycle and gameplay managers
src/map/materials        Generated materials and textures
src/map/services         OSM, cache, analysis, imagery, and fallback services
src/map/utils            Reusable geographic and deterministic utilities
src/world                Scale-aware world planning and configuration
public/data/admin        Bundled administrative boundaries
docs/devlog              Historical D-number development notes
docs/architecture        Current architecture decisions
tests                    Deterministic unit tests
```

## Known limitations

- Several core files remain too large, especially `MapFeatureBuilder.js`, `InfantryManager.js`, `GlobePicker.jsx`, `MapEngine.js`, and `CampaignStage.jsx`.
- The strategic SVG renderer and the Three.js world renderer duplicate some concepts.
- Live geographic services can be slow or unavailable; procedural fallbacks are therefore part of normal operation.
- Test coverage currently protects deterministic core logic but does not yet cover WebGL rendering or browser interaction.
- The production output still contains a large Three.js/tactical chunk. Stage-level lazy loading reduces initial work but does not eliminate the bundle-size warning.

## Development records

Historical iteration notes are retained under [`docs/devlog`](docs/devlog). They are reference material, not the authoritative statement of current architecture. Current decisions belong in the README, roadmap, architecture records, and source code.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before making structural changes. Refactors should preserve behavior, remain reviewable, and add tests around extracted deterministic logic.
