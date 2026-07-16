# D38.2 Canopy Connection Audit

Goal: make the external canopy pipeline visibly auditable.

Changes:
- Default vegetation source is now `planetaryNaip` for tactical-stage launches, so the canopy probe is actually attempted by default.
- Canopy diagnostics now show mode, query execution, query success, stage, BBOX, total cells, and probe time.
- STAC failures now return structured diagnostics instead of only falling back silently.
- OSM-only mode now reports `stage=disabled` and a clear message.

Expected diagnostic states:
- `queued`: generate map requested and canopy probe queued.
- `stac-search`: STAC request failed.
- `stac-no-items`: STAC succeeded but returned zero NAIP items.
- `tile-sampling-complete`: imagery tiles sampled successfully.
- `tile-sampling-empty`: item found but tile sampling failed.
- `disabled`: user selected OSM + procedural.
