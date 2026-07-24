# D79 Notes — Risk territory footprint renderer

Implemented the next campaign-map pass for the Risk-style theater renderer.

## What changed

- Campaign maps are labeled as D79 and now describe the renderer as an OSM Risk territory theater.
- Owned territories now render with a much stronger player-color overlay, so choosing Canada as the home country visibly paints all controlled Canada in the player's assigned color.
- Region borders now use the faction color more strongly when owned, while preserving the textured terrain underneath.
- Movement trails and hover previews now render as connected footprint corridors:
  - a wide translucent faction-color band connects the source territory to the destination,
  - a dark tactical route line sits inside the band,
  - a bright dashed route line shows the planned army movement.
- Movement influence claims now include source, target, and connected intermediate footprint regions when possible.
- Starting faction territories initialize as fully controlled and supply connected.
- The campaign header/help text now reflects selected land entity start, controlled territory paint, expansion footprint, and army progression.

## Verification

- Ran `npm install` to restore dependencies.
- Ran `npm run build` successfully.
- Vite emitted the existing large chunk warning only.
