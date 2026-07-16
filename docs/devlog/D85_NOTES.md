# D85 Notes

## Focus
Stabilize the GlobePicker lifecycle after D84 showed duplicate initialization logs on page load.

## Changes
- Added explicit GlobePicker lifecycle ids to logging.
- Suppressed stale async texture-loader callbacks after cleanup.
- Added missing cleanup logging for globe scene disposal.
- Guarded the animation loop so disposed lifecycle instances stop rendering immediately.
- Disposed OrbitControls, scene geometry, materials, textures, and renderer during cleanup.
- Safely removed the renderer canvas only if it is still attached to the active container.

## Why
React StrictMode can intentionally mount/unmount/remount effects in development. Before D85, stale texture callbacks could still log after the first dev-mode cleanup, making it look like there were two active globe instances. More importantly, incomplete cleanup could create GPU memory pressure during repeated reloads.

## Expected log shape in dev
You may still see two initialization attempts in development because of React StrictMode, but the first should now be followed by cleanup/disposal logs. Stale texture callbacks from disposed instances should not continue logging as active loads.

Expected pattern:

```text
[GlobePicker:1] initializing globe
[GlobePicker:1] using local procedural cloud texture
[GlobePicker:1] cleaning up globe scene
[GlobePicker:1] globe scene disposed
[GlobePicker:2] initializing globe
[GlobePicker:2] using local procedural cloud texture
[GlobePicker:2] day texture loaded
[GlobePicker:2] night texture loaded
```

## Build
- `npm run build` passed.
- Existing Vite large bundle warning remains.
