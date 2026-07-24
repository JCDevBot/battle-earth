# Battle Earth Agent Instructions

## Project objective

Battle Earth is a scale-aware Earth strategy and tactical warfare prototype. The immediate goal is a functional vertical slice in which a user can install and launch the app, select a location, enter the generated tactical environment, deploy or control units, and complete a basic playable battle loop without a blocking error.

## Required reading

Before making changes, read:

1. `README.md`
2. `ROADMAP.md`
3. `CONTRIBUTING.md`
4. relevant files under `docs/architecture/`
5. the active GitHub issue and pull request

## Development sequence

Follow the phase order in `ROADMAP.md` unless a human explicitly reprioritizes the work.

Priorities are:

1. Keep dependency installation, tests, formatting, build, and CI passing.
2. Remove blocking errors from the globe-to-tactical user path.
3. Add deterministic or browser coverage around each stabilized path.
4. Refactor large systems only in small behavior-preserving steps.
5. Defer visual redesign and major new gameplay systems until the vertical slice is reliable.

## Change rules

- Work on the existing development branch and its draft pull request unless explicitly directed otherwise.
- Never push directly to `main`, merge pull requests, delete branches, or expose credentials.
- Keep behavior-preserving refactors separate from gameplay changes.
- Prefer small extractions over rewrites.
- Do not change gameplay constants during structural refactors.
- Add deterministic tests when moving deterministic logic.
- Preserve public interfaces unless the active issue explicitly authorizes a migration.
- Record follow-up work as issues instead of silently broadening the current change.
- Do not commit generated output, dependencies, local environment files, or secrets.

## Validation

Before considering a change complete, run:

```bash
npm run check
```

Rendering-sensitive work also requires a manual comparison using the same location, configuration, viewport, and deterministic seed before and after the change.

When browser automation exists, the minimum smoke path should verify:

1. the application loads without uncaught errors
2. the globe accepts a representative location selection
3. the campaign or tactical transition completes
4. a deterministic tactical environment appears
5. units can be selected, deployed or ordered
6. the basic battle loop advances without a blocking error

## Human-decision boundary

Stop and request direction only when:

- product behavior is materially ambiguous
- an architectural decision has multiple reasonable and difficult-to-reverse options
- a visual direction must be selected
- the task requires expanding scope beyond the active issue
- permissions or credentials are required

Do not make speculative product decisions merely to keep work moving.

## Completion report

Every pull request update should state:

- what changed
- why it changed
- automated validation performed
- manual scenarios checked
- remaining risks
- follow-up issues
