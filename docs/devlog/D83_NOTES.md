# D83 Notes

## Goals
- Clean up the project root by moving historical D##_NOTES.md files into docs/devlog/.
- Fix the page-load crash path reported after D82.
- Remove the broken remote three-globe cloud texture request.
- Remove unreachable code after return in MapFeatureBuilder.js.
- Add clearer renderer startup, texture fallback, and WebGL context logging.

## Changes
- Moved dev notes from repo root into docs/devlog/.
- Replaced the remote fair_clouds_4k.png dependency with a local procedural CanvasTexture.
- Added local fallback day/night globe textures so the globe can initialize even if remote imagery fails.
- Capped renderer pixel ratio at 2 to reduce GPU pressure during development.
- Added console logging for GlobePicker initialization, texture loading/fallbacks, and WebGL context loss/restoration.
- Removed dead canopy-ground-darkening implementation that lived after an unconditional return.

## Validation
- npm run build passes.

## Next
- Verify the browser no longer logs the fair_clouds_4k.png 404/CORS failure.
- If the page still crashes, use the new WebGL context-loss and renderer initialization logs to identify the next heavy path.
