# Current Work

Last updated: 2026-07-18

## Active objective

Stabilize the functional vertical slice from globe selection through tactical play while preserving a clean install, passing checks, and passing CI.

## Active branch

`agent/initial-stabilization`

## Active pull request

#1 — Import and stabilize Battle Earth

## Current status

- GitHub Actions CI passes on the current branch.
- Dependency installation, lint, deterministic tests, maintained-file formatting, production build, and production-output smoke validation pass in CI.
- Stage routing validates and normalizes selected locations before entering campaign or tactical views.
- Campaign and tactical stages are lazy-loaded and protected by a recoverable stage error boundary.
- Browser-level coverage of the complete globe-to-tactical playable path is not yet present.

## Next safe step

Add a narrow deterministic browser smoke path that uses fixed location data and avoids live map-service dependencies. Verify:

1. the application loads without uncaught errors
2. a representative location can enter the tactical stage
3. the tactical environment reaches a ready state
4. units can be selected and given at least one order
5. the simulation advances without a blocking error

Keep the first browser suite narrow and upload failure artifacts in CI.

## Human decisions required

None currently.

## Do not begin

- strategic renderer migration
- infantry combat-rule redesign
- visual redesign
- new major gameplay subsystems
- direct changes to `main`
