# Changelog

This file summarizes stable project milestones. Detailed historical notes remain under `docs/devlog`.

## Unreleased

### Repository stabilization

- Established Battle Earth as the canonical project name.
- Consolidated project status, architecture, and roadmap documentation.
- Removed duplicate root-level development notes.
- Added repository hygiene files and contribution guidance.
- Added ESLint, Prettier, Vitest, and GitHub Actions validation.
- Added deterministic tests for geographic utilities, world-scale planning, seeded randomness, and campaign setup.
- Added lazy loading for campaign and tactical stages.

## D87

- Restored country boundaries and labels at globe scale.
- Reduced startup work by avoiding large global admin-1 and populated-place fetches.
- Added administrative-layer diagnostics.
- Retained bundled country and US state geometry for selection and offline fallback.

## Earlier development

D19 through D86 document the evolution of map generation, tactical systems, globe selection, campaign mechanics, geographic hierarchy, performance work, and world-scale rendering. See `docs/devlog` for those records.
