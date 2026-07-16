# D44-R.2 — Building LOD Blink Fix

Built from D44-R.1 camera-anchor build.

## Goal
Stop buildings blinking on/off when the Buildings layer is enabled.

## Changes
- Disabled building LOD distance swapping for now.
- Forced building chunks to render LOD0 / full-detail only.
- Kept LOD1 simplified meshes hidden.
- Kept LOD2 flat footprint meshes hidden.
- Buildings checkbox is now the only visibility gate for building chunks.

## Why
The old BuildingLODManager could swap between LOD0, LOD1, and LOD2 near camera distance thresholds, which made buildings appear to blink or flicker while moving/zooming. For recovery/debug builds, deterministic rendering is more useful than performance optimization.
