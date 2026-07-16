# D25 Island Elevation + Canopy Containment

- Raises reconstructed pond island land planes clearly above the pond water surface.
- Gives island land materials stronger depth/polygon offset so water does not visually cover islands.
- Removes the generic `pond-island-canopy` zone so island trees are handled only by the island biome pass.
- Tightens island tree placement so large crowns and trunks stay farther from water.
- Reduces island interior tree density and dominant tree count to avoid oversized canopy spillover.
- Softens the visible wet-edge island mask so it does not appear as a bright green polygon.

Build verified with `npm run build`.
