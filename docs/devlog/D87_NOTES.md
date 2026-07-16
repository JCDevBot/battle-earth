# D87 Notes

## Focus
Restore country rendering on the globe and reduce startup load/crash risk.

## Changes
- Continent LOD now renders country boundaries and country labels instead of only continent labels.
- Added GlobePicker admin-layer diagnostics so console shows visible feature counts by level.
- Stopped fetching large global admin-1 and populated-place datasets during initial page load.
- Kept bundled country and US-state geometry available for fast selection and offline fallback.
- Added strategic-admin loading/ready logs.

## Expected behavior
- On initial globe load, country outlines should appear at continent/world zoom.
- Console should show an admin layer count with countries visible.
- Startup should be lighter and less likely to crash before selection.

## Build
- `npm run build` passed.
- Existing Vite bundle-size warning remains.
