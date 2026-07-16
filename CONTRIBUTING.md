# Contributing to Battle Earth

## Development setup

```bash
npm ci
npm run dev
```

Before opening a pull request:

```bash
npm run check
```

## Change discipline

- Keep behavior-preserving refactors separate from gameplay changes.
- Prefer small extractions over complete rewrites of core managers.
- Add unit tests whenever deterministic logic is moved or changed.
- Do not commit `node_modules`, `dist`, coverage output, local environment files, or service credentials.
- Keep historical D-number notes under `docs/devlog`; do not add iteration notes to the repository root.
- Update `README.md`, `ROADMAP.md`, or an architecture decision when current behavior or direction changes.

## Large-file refactors

For `MapFeatureBuilder.js`, `InfantryManager.js`, `GlobePicker.jsx`, `MapEngine.js`, and `CampaignStage.jsx`:

1. Identify a cohesive responsibility with a narrow interface.
2. Add tests for pure logic before moving it.
3. Extract without changing constants or gameplay values.
4. Run `npm run check`.
5. Perform a manual browser comparison using the same location and configuration before and after the change.

## Pull requests

A pull request should state:

- What changed
- Why it changed
- Expected user or developer impact
- Automated validation performed
- Manual scenarios checked
- Remaining risks or follow-up work
