# D81 Notes - Continuous scale-aware OSM terrain map reset

Goal: stop treating the Risk/campaign view as a separate SVG/mockup renderer and return to the OSM/Three.js terrain map style at every selected land-entity scale.

What changed:
- Risk/campaign launches now open in the continuous Three.js terrain renderer instead of the SVG campaign renderer.
- Starting view extent is now scale-aware and can be Auto from the selected land entity.
- Added real starting view extents for continent, country, state/region, city, neighborhood, and small test slice.
- Selecting a continent/country/state/city now creates a map request sized to that entity's level.
- The generated map keeps the existing Three.js camera/orbit behavior for zoom and navigation. No fake in-map zoom control panel is injected.
- Large geographic extents skip live Overpass requests and use the existing stylized terrain/procedural fallback path so the app does not try to download impossible country/continent-sized OSM bboxes.
- Neighborhood and city scales still use live OSM where practical, preserving the older stylized OSM neighborhood-map look.

Important direction:
- OSM terrain map first.
- Game ownership/influence overlays second.
- UI third.

Known limitation:
- State/country/continent views now use the same Three.js scene path, but the strategic ownership overlay still needs a true Three.js implementation. D81 removes the wrong SVG direction and resets the map-generation architecture so D82 can add ownership/influence as scene meshes/shaders on top of the terrain.
