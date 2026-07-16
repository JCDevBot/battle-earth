# Phase 10G.0 UI Cleanup Hotfix

## Purpose
Make the battlefield the default view and move testing controls into a single toggleable configuration panel.

## Changes
- Fixed invalid React hook call caused by a nested `useEffect` inside the map initialization effect.
- Replaced the two always visible side panels with one right side Config panel.
- Gear button opens and closes Config.
- `Tab` toggles Config.
- `Escape` closes Config.
- Destruction Sandbox is disabled by default at both React state and engine state level.
- Experimental destruction controls are hidden until the sandbox is enabled.
- Added a small favicon placeholder to stop the development server 404 noise.

## Known Notes
- Overpass `504 Gateway Timeout` is not caused by the UI. It is the public Overpass API timing out. Retry, lower map size, use cache, or later add endpoint fallback support.
