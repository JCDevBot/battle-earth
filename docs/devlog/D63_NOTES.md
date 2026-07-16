# D63 — Real-Time Earth Lighting & Living Globe

## Intent
Make the sandbox globe feel like a live Earth entry screen rather than a static selector.

## Added
- Real-time sun direction from UTC time.
- Day/night globe shader blending daylight Earth texture with night lights texture.
- Soft twilight terminator band.
- Atmosphere rim glow shader driven by sun direction.
- Transparent cloud layer with slow independent movement.
- Minnesota/Upper Midwest-oriented initial camera view.
- Slow idle globe navigation using OrbitControls autorotation.
- Real-Time Earth control panel:
  - Live/Debug time toggle.
  - Debug time offset slider.
  - Idle rotation toggle.
  - Live reset.
- Sun diagnostics:
  - current time label.
  - subsolar latitude/longitude.

## Notes
This keeps the existing D62.1 geographic hierarchy, global admin-1 reveal, city decluttering, and sandbox battle request flow intact.

## Follow-up
- Verify night lights texture loads reliably from CDN.
- Consider bundling day/night/cloud textures locally if remote texture loading becomes inconsistent.
- Add user geolocation permission flow later. For now default camera is centered over Minnesota.
- Tune shader twilight width and night light strength after screenshot review.
