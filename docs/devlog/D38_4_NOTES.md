# D38.4 Canopy Signed Asset / Rendered Preview Probe

## Purpose
D38.2 proved that Planetary Computer STAC search works and NAIP items are found, but the Data API XYZ tile endpoint returned HTTP 500 for every tile. D38.3 added preview fallback. D38.4 adds a more explicit asset-access audit.

## Changes
- Added Planetary Computer SAS signing test using `/api/sas/v1/sign?href=...` for the NAIP `image` asset.
- Added signed asset diagnostics:
  - asset keys
  - rendered preview availability
  - signed asset attempted/succeeded
  - signed asset HTTP status
  - signed asset content type
- Added STAC `rendered_preview` / `preview` asset fallback before constructed preview URLs.
- If a rendered preview is used, samples are mapped against the STAC item bbox instead of the smaller requested map bbox.

## Important limitation
The signed `image` asset is usually a Cloud Optimized GeoTIFF, which cannot be sampled directly as a browser image without a GeoTIFF reader. This update verifies signed access and tries rendered preview images first. A future pass can add GeoTIFF sampling if preview imagery is not enough.
