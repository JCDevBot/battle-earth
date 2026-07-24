const PRESETS = [
  { name: "Small Slice Test Map", lat: 44.849758, lon: -93.289793, sizeMeters: 350 },
  { name: "Default Test Site", lat: 44.8500907, lon: -93.2885465, sizeMeters: 1200, mapAspect: "operational", mapWidthMeters: 800, mapDepthMeters: 1200 },
  { name: "NYC", lat: 40.7061, lon: -74.0092 },
  { name: "London", lat: 51.5033, lon: -0.1195 },
  { name: "Creek Falls", lat: 44.9081934, lon: -93.2880537 },
  { name: "Da Lat, VN", lat: 11.9404, lon: 108.4583 },
  { name: "Mpls Gorge", lat: 44.905, lon: -93.205 },
  { name: "Duluth Harbor", lat: 46.778, lon: -92.092 },
  { name: "Bloomington", lat: 44.8326, lon: -93.3293 }
];

const LAYERS = ["terrain", "roads", "buildings", "tactical-buildings", "vegetation", "water", "props", "territory", "frontline", "strategic-pois", "objective-hierarchy", "influence-rings", "battlefield-grid", "tactical", "classification-debug", "units", "fog"];
const LAYER_LABELS = { tactical: "Tactical Overlay", "tactical-buildings": "Tactical Buildings", "classification-debug": "Classification Debug", "strategic-pois": "Strategic POIs", "battlefield-grid": "Battlefield Grid", territory: "Territory Heatmap", frontline: "Frontline", "influence-rings": "Influence Rings", "objective-hierarchy": "Objective Hierarchy" };

function updateNumber(setConfig, key, value) {
  setConfig((current) => ({ ...current, [key]: Number(value) }));
}

function Metric({ label, value }) {
  return <div className="flex justify-between gap-3"><span className="text-slate-400">{label}</span><b>{value}</b></div>;
}

function Section({ title, children, muted = false }) {
  return (
    <section className={`rounded border border-slate-800 bg-slate-950/70 p-3 ${muted ? "opacity-80" : ""}`}>
      <h2 className="mb-2 border-b border-slate-800 pb-1 text-xs font-bold uppercase tracking-widest text-sky-400">{title}</h2>
      {children}
    </section>
  );
}

export function UnifiedConfigPanel({
  config,
  setConfig,
  onGenerate,
  onClearCache,
  analysis,
  renderStats,
  destructionStats,
  performanceStats,
  generationStats,
  tacticalStats,
  infantryStats,
  fogStats,
  territoryStats,
  navigationStats,
  boundsStats,
  canopyStats,
  strategicPoiStats,
  battlefieldGridStats,
  tacticalBuildingStats,
  deployMode,
  debugDamageEnabled,
  sandboxWeapon,
  onSetSandboxWeapon,
  onToggleDebugDamage,
  onResetDestruction,
  onDebugBlast,
  onSetLayerVisible,
  onSetTacticalOverlayVisible,
  onSetTacticalOverlayMode,
  onSpawnFriendlySquad,
  onSpawnEnemySquad,
  onSelectNextSquad,
  onSelectNextFriendlySquad,
  onSelectNextEnemySquad,
  onOrderSelectedSquad,
  onIssueSquadMission,
  onHoldSelectedSquad,
  onResetInfantry,
  onSetFogOfWarEnabled,
  onSetFogVisionDebug,
  onSetTerritoryOverlayEnabled,
  onSetBoundsVisible,
  onSetCameraClampEnabled,
  onSetEdgePanEnabled,
  onSetFollowSelectedSquad,
  onSetCameraPreset,
  onResetCamera,
  onClose
}) {
  return (
    <div className="absolute right-5 top-20 z-40 max-h-[calc(100vh-6rem)] w-[28rem] overflow-y-auto rounded border border-slate-700 bg-slate-950/95 p-4 text-sm text-slate-100 shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-lg font-bold text-sky-400">Config</h1>
          <p className="text-xs text-slate-400">TAB toggles, ESC closes. Destruction is off by default.</p>
        </div>
        <button className="rounded bg-slate-800 px-3 py-1 text-xs font-bold hover:bg-slate-700" onClick={onClose}>Close</button>
      </div>

      <div className="space-y-3">
        <Section title="Map">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <button key={preset.name} className="rounded bg-slate-800 px-2 py-2 text-xs font-semibold hover:bg-sky-700" onClick={() => setConfig((current) => ({ ...current, lat: preset.lat, lon: preset.lon, sizeMeters: preset.sizeMeters ?? current.sizeMeters, mapAspect: preset.mapAspect ?? current.mapAspect ?? "square", mapWidthMeters: preset.mapWidthMeters ?? current.mapWidthMeters ?? preset.sizeMeters ?? current.sizeMeters, mapDepthMeters: preset.mapDepthMeters ?? current.mapDepthMeters ?? preset.sizeMeters ?? current.sizeMeters }))}>{preset.name}</button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">Latitude<input className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-slate-100" type="number" step="0.000001" value={config.lat} onChange={(e) => updateNumber(setConfig, "lat", e.target.value)} /></label>
            <label className="text-xs text-slate-400">Longitude<input className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-slate-100" type="number" step="0.000001" value={config.lon} onChange={(e) => updateNumber(setConfig, "lon", e.target.value)} /></label>
          </div>
          <label className="mt-2 block text-xs text-slate-400">Size in meters<input className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-slate-100" type="number" min="100" max="5000" value={config.sizeMeters} onChange={(e) => updateNumber(setConfig, "sizeMeters", e.target.value)} /></label>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {[
              ["square", "Square", 1000, 1000],
              ["operational", "Operational", 800, 1200],
              ["deep", "Deep", 900, 1400]
            ].map(([id, label, w, d]) => (
              <button key={id} className={`rounded p-2 font-bold ${config.mapAspect === id ? "bg-sky-700" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setConfig((current) => ({ ...current, mapAspect: id, mapWidthMeters: w, mapDepthMeters: d, sizeMeters: Math.max(w, d) }))}>{label}<br/><span className="font-mono text-[10px] text-slate-300">{w}×{d}</span></button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">East-west meters<input className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-slate-100" type="number" min="100" max="5000" value={config.mapWidthMeters ?? config.sizeMeters} onChange={(e) => updateNumber(setConfig, "mapWidthMeters", e.target.value)} /></label>
            <label className="text-xs text-slate-400">North-south meters<input className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-slate-100" type="number" min="100" max="5000" value={config.mapDepthMeters ?? config.sizeMeters} onChange={(e) => updateNumber(setConfig, "mapDepthMeters", e.target.value)} /></label>
          </div>
          <label className="mt-2 block text-xs text-slate-400">Terrain scale: {Number(config.terrainScale ?? 1.35).toFixed(2)}x<input className="mt-1 w-full" type="range" min="0.75" max="2.5" step="0.05" value={config.terrainScale ?? 1.35} onChange={(e) => updateNumber(setConfig, "terrainScale", e.target.value)} /></label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between rounded bg-slate-800 p-2 text-xs"><span>Real elevation</span><input type="checkbox" checked={config.useRealTerrain} onChange={(e) => setConfig((current) => ({ ...current, useRealTerrain: e.target.checked }))} /></label>
            <select className="rounded border border-slate-700 bg-slate-900 p-2 text-xs" value={config.osmProfile} onChange={(e) => setConfig((current) => ({ ...current, osmProfile: e.target.value }))}>
              <option value="broadBase">broad base</option><option value="expanded">expanded/broad</option><option value="core">core/broad</option><option value="tactical">tactical/broad</option><option value="terrainOnly">terrain only</option>
            </select>
          </div>
          <label className="mt-2 block text-xs text-slate-400">Vegetation source
            <select className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-slate-100" value={config.vegetationSource ?? "osmOnly"} onChange={(e) => setConfig((current) => ({ ...current, vegetationSource: e.target.value }))}>
              <option value="osmOnly">OSM + procedural</option>
              <option value="planetaryNaip">Experimental: Planetary Computer NAIP canopy probe</option>
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded bg-sky-700 p-2 font-bold hover:bg-sky-600" onClick={onGenerate}>Generate Map</button>
            <button className="rounded bg-red-900 p-2 font-bold hover:bg-red-800" onClick={onClearCache}>Clear Cache</button>
          </div>
        </Section>

        <Section title="Visuals and Layers">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {LAYERS.map((layer) => (
              <label key={layer} className="flex items-center gap-2 rounded bg-slate-800 p-2 capitalize">
                <input type="checkbox" checked={performanceStats.layerVisibility?.[layer] !== false} onChange={(event) => onSetLayerVisible?.(layer, event.target.checked)} />
                <span>{LAYER_LABELS[layer] ?? layer}</span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Camera">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={() => onSetCameraPreset?.("top")}>Top Down</button>
            <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={() => onSetCameraPreset?.("angled")}>Angled</button>
            <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={onResetCamera}>Reset Camera</button>
            <label className="flex items-center justify-between rounded bg-slate-800 p-2"><span>Clamp</span><input type="checkbox" checked={Boolean(boundsStats?.cameraClampEnabled)} onChange={(e) => onSetCameraClampEnabled?.(e.target.checked)} /></label>
            <label className="flex items-center justify-between rounded bg-slate-800 p-2"><span>Bounds</span><input type="checkbox" checked={Boolean(boundsStats?.visible)} onChange={(e) => onSetBoundsVisible?.(e.target.checked)} /></label>
            <label className="flex items-center justify-between rounded bg-slate-800 p-2"><span>Edge pan</span><input type="checkbox" onChange={(e) => onSetEdgePanEnabled?.(e.target.checked)} /></label>
            <label className="col-span-2 flex items-center justify-between rounded bg-slate-800 p-2"><span>Follow selected squad</span><input type="checkbox" onChange={(e) => onSetFollowSelectedSquad?.(e.target.checked)} /></label>
          </div>
        </Section>

        <Section title="Gameplay">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button className={`rounded p-2 font-bold ${deployMode === "friendly" ? "bg-sky-500 text-slate-950 ring-2 ring-sky-200" : "bg-sky-800 hover:bg-sky-700"}`} onClick={onSpawnFriendlySquad}>Spawn Friendly</button>
            <button className={`rounded p-2 font-bold ${deployMode === "enemy" ? "bg-rose-500 text-slate-950 ring-2 ring-rose-200" : "bg-rose-900 hover:bg-rose-800"}`} onClick={onSpawnEnemySquad}>Spawn Enemy</button>
            <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={onSelectNextSquad}>Next Any</button>
            <button className="rounded bg-emerald-800 p-2 font-bold hover:bg-emerald-700" onClick={onOrderSelectedSquad}>Move to Camera</button>
            <button className="rounded bg-sky-900 p-2 font-bold hover:bg-sky-800" onClick={onSelectNextFriendlySquad}>Next Friendly</button>
            <button className="rounded bg-rose-950 p-2 font-bold hover:bg-rose-900" onClick={onSelectNextEnemySquad}>Next Enemy</button>
            <button className="col-span-2 rounded bg-amber-800 p-2 font-bold hover:bg-amber-700" onClick={onHoldSelectedSquad}>Hold Selected</button>
            <div className="col-span-2 mt-1 rounded border border-slate-700 bg-slate-900/70 p-2">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Mission at camera target</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={() => onIssueSquadMission?.("hold")}>Hold</button>
                <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={() => onIssueSquadMission?.("observe")}>Observe</button>
                <button className="rounded bg-sky-900 p-2 font-bold hover:bg-sky-800" onClick={() => onIssueSquadMission?.("overwatch")}>Overwatch</button>
                <button className="rounded bg-violet-900 p-2 font-bold hover:bg-violet-800" onClick={() => onIssueSquadMission?.("screen")}>Screen</button>
              </div>
            </div>
            {deployMode ? <div className="col-span-2 rounded border border-amber-500/60 bg-amber-950/70 p-2 text-center text-amber-100">Click the map to deploy {deployMode === "friendly" ? "a friendly" : "an enemy"} squad.</div> : <div className="col-span-2 rounded bg-black/20 p-2 text-center text-slate-400">Click any unit to select. Click ground to move. Right-click also orders. Works for friendly and enemy squads.</div>}
            <button className="col-span-2 rounded bg-red-900 p-2 font-bold hover:bg-red-800" onClick={onResetInfantry}>Clear Units</button>
            <label className="flex items-center justify-between rounded bg-slate-800 p-2"><span>Fog of war</span><input type="checkbox" checked={Boolean(fogStats?.enabled)} onChange={(e) => onSetFogOfWarEnabled?.(e.target.checked)} /></label>
            <label className="flex items-center justify-between rounded bg-slate-800 p-2"><span>Vision debug</span><input type="checkbox" checked={Boolean(fogStats?.debugVision)} onChange={(e) => onSetFogVisionDebug?.(e.target.checked)} /></label>
            <label className="col-span-2 flex items-center justify-between rounded bg-slate-800 p-2"><span>Territory overlay</span><input type="checkbox" checked={Boolean(territoryStats?.enabled)} onChange={(e) => onSetTerritoryOverlayEnabled?.(e.target.checked)} /></label>
          </div>
        </Section>





        <Section title="D53 Tactical Buildings">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
            <Metric label="Buildings" value={tacticalBuildingStats?.total ?? 0} />
            <Metric label="POI compounds" value={tacticalBuildingStats?.generatedCompounds ?? 0} />
            <Metric label="Linked to POI" value={tacticalBuildingStats?.poiLinked ?? 0} />
            <Metric label="Garrison slots" value={tacticalBuildingStats?.garrisonCapacity ?? 0} />
            <Metric label="Avg cover" value={tacticalBuildingStats?.averageCover ?? 0} />
            <Metric label="Visible" value={tacticalBuildingStats?.enabled ? "yes" : "no"} />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px] font-bold uppercase text-slate-300">
            <div className="rounded bg-slate-800 p-1">C {tacticalBuildingStats?.byRole?.civilian ?? 0}</div>
            <div className="rounded bg-slate-800 p-1">T {tacticalBuildingStats?.byRole?.tactical ?? 0}</div>
            <div className="rounded bg-slate-800 p-1">M {tacticalBuildingStats?.byRole?.military ?? 0}</div>
            <div className="rounded bg-slate-800 p-1">I {tacticalBuildingStats?.byRole?.infrastructure ?? 0}</div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Labels show role + cover score, plus garrison and strategic value. White rings are entrance candidates, colored dots are first-pass garrison points.</p>
        </Section>

        <Section title="Battlefield Grid">
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Metric label="Grid" value={`${battlefieldGridStats?.rows ?? 0}×${battlefieldGridStats?.columns ?? 0}`} />
              <Metric label="Sectors" value={battlefieldGridStats?.total ?? 0} />
              <Metric label="Occupied" value={battlefieldGridStats?.occupiedSectors ?? 0} />
              <Metric label="Selected" value={battlefieldGridStats?.selected?.id ?? "None"} />
            </div>
            {battlefieldGridStats?.selected ? (
              <div className="rounded border border-amber-500/40 bg-amber-950/30 p-2">
                <div className="font-bold text-amber-200">Selected sector {battlefieldGridStats.selected.id}</div>
                <div className="text-slate-300">{battlefieldGridStats.selected.band} · {battlefieldGridStats.selected.column}</div>
                <div className="text-slate-400">Owner: {battlefieldGridStats.selected.owner ?? battlefieldGridStats.selected.ownerHint} · Role: {battlefieldGridStats.selected.role}</div>
                <div className="text-slate-400">POIs: {battlefieldGridStats.selected.poiCount} · Resource {battlefieldGridStats.selected.resourceValue ?? 0} · Strategic {battlefieldGridStats.selected.strategicValue ?? 0} · Threat {battlefieldGridStats.selected.threatScore ?? 0}</div>
                {battlefieldGridStats.selected.pois?.length ? <div className="mt-1 text-[11px] text-slate-500">{battlefieldGridStats.selected.pois.map((poi) => `${poi.label} (${poi.archetype})`).join(", ")}</div> : null}
              </div>
            ) : (
              <div className="rounded bg-black/30 p-2 text-slate-400">Ctrl-click the map to select a targetable sector for future fire missions.</div>
            )}
            {battlefieldGridStats?.rankedTargets?.length ? (
              <div className="rounded bg-black/30 p-2">
                <div className="mb-1 font-bold text-orange-200">Top artillery sectors</div>
                {battlefieldGridStats.rankedTargets.map((sector, index) => <div key={sector.id} className="flex justify-between text-[11px]"><span>{index + 1}. {sector.id} · {sector.owner}</span><b>{sector.threatScore}</b></div>)}
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Strategic POIs">
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Metric label="Battlefield POIs" value={(strategicPoiStats?.total ?? 0).toLocaleString()} />
              <Metric label="Raw candidates" value={(strategicPoiStats?.clusteredSources ?? 0).toLocaleString()} />
              <Metric label="Major" value={strategicPoiStats?.byTier?.major ?? 0} />
              <Metric label="Secondary" value={strategicPoiStats?.byTier?.secondary ?? 0} />
              <Metric label="HQs" value={strategicPoiStats?.hqs ?? strategicPoiStats?.byTier?.hq ?? 0} />
              <Metric label="Orientation" value={strategicPoiStats?.battlefieldOrientation ?? "South/North"} />
              <Metric label="Friendly income" value={`${strategicPoiStats?.economy?.friendlyIncome ?? 1}/s`} />
              <Metric label="Enemy income" value={`${strategicPoiStats?.economy?.enemyIncome ?? 1}/s`} />
              <Metric label="Friendly POIs" value={strategicPoiStats?.ownership?.friendly ?? 0} />
              <Metric label="Enemy POIs" value={strategicPoiStats?.ownership?.enemy ?? 0} />
              <Metric label="Neutral POIs" value={strategicPoiStats?.ownership?.neutral ?? 0} />
              <Metric label="Contested" value={strategicPoiStats?.ownership?.contested ?? 0} />
              <Metric label="Strategic crossings" value={strategicPoiStats?.byArchetype?.strategic_crossing ?? 0} />
              <Metric label="Transport" value={strategicPoiStats?.byArchetype?.transport ?? 0} />
              <Metric label="Logistics" value={strategicPoiStats?.byArchetype?.logistics ?? 0} />
              <Metric label="Observation" value={strategicPoiStats?.byArchetype?.observation ?? 0} />
              <Metric label="Civic" value={strategicPoiStats?.byArchetype?.civic ?? 0} />
              <Metric label="Infrastructure" value={strategicPoiStats?.byArchetype?.infrastructure ?? 0} />
            </div>
            <div className="max-h-36 overflow-y-auto rounded bg-black/30 p-2">
              {strategicPoiStats?.top?.length ? strategicPoiStats.top.map((poi) => (
                <div key={poi.id} className="border-b border-slate-900 py-1">
                  <div className="flex justify-between gap-3"><b className="text-slate-200">{poi.label}</b><span className="text-sky-300">{poi.strategicValue ?? poi.priority}</span></div>
                  <div className="text-[11px] text-slate-500">{poi.tier} · {poi.ownership ?? "neutral"} · {poi.ownershipStrength ?? 0}% · {poi.archetype ?? poi.type} · influence {poi.influenceRadius ?? 0}m</div>
                  <div className="text-[10px] text-emerald-400">{poi.benefit ?? `+${poi.resourceBonus ?? 0}/s`} · capture {poi.captureTime ?? 0}s · defense L{poi.defenseLevel ?? 0}</div>
                  <div className="text-[10px] text-slate-600">{(poi.reasons ?? []).join(", ")}</div>
                </div>
              )) : <p className="text-slate-500">Generate a map to see candidate strategic POIs.</p>}
            </div>
          </div>
        </Section>

        <Section title="Generation Diagnostics">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Metric label="OSM elements" value={(generationStats?.osmElements ?? 0).toLocaleString()} />
            <Metric label="OSM ways" value={(generationStats?.osmWays ?? 0).toLocaleString()} />
            <Metric label="OSM roads" value={(generationStats?.osmRoadWays ?? 0).toLocaleString()} />
            <Metric label="Road segments" value={(generationStats?.roadSegments ?? 0).toLocaleString()} />
            <Metric label="OSM buildings" value={(generationStats?.osmBuildingWays ?? 0).toLocaleString()} />
            <Metric label="Buildings" value={(generationStats?.buildings ?? 0).toLocaleString()} />
            <Metric label="Exact OSM footprints" value={(generationStats?.buildings ?? 0).toLocaleString()} />
            <Metric label="Building chunks" value={(generationStats?.buildingChunks ?? 0).toLocaleString()} />
            <Metric label="Water features" value={(generationStats?.waterFeatures ?? 0).toLocaleString()} />
            <Metric label="Vegetation zones" value={(generationStats?.vegetationZones ?? 0).toLocaleString()} />
            <Metric label="Trees generated" value={(generationStats?.treesGenerated ?? 0).toLocaleString()} />
            <Metric label="Tree cap hits" value={(generationStats?.treesCapped ?? 0).toLocaleString()} />
            <Metric label="Residential blocks" value={(generationStats?.residentialBlocks ?? 0).toLocaleString()} />
            <Metric label="Residential green" value={(generationStats?.residentialGreenspaces ?? 0).toLocaleString()} />
            <Metric label="Riparian candidates" value={(generationStats?.riparianCandidates ?? 0).toLocaleString()} />
            <Metric label="Riparian trees" value={(generationStats?.riparianTrees ?? 0).toLocaleString()} />
            <Metric label="Props" value={(generationStats?.props ?? 0).toLocaleString()} />
          </div>
          {generationStats?.buildingClassCounts && (
            <div className="mt-2 rounded bg-black/30 p-2 text-xs">
              <div className="mb-1 font-bold uppercase tracking-widest text-slate-400">D57 Building Classes</div>
              {Object.entries(generationStats.buildingClassCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([kind, count]) => (
                <div key={kind} className="flex justify-between gap-3 border-b border-slate-900 py-0.5"><span className="capitalize text-slate-300">{kind}</span><span className="text-sky-300">{Number(count).toLocaleString()}</span></div>
              ))}
            </div>
          )}
          {generationStats?.buildingAttributionStats && (
            <div className="mt-2 rounded bg-black/30 p-2 text-xs">
              <div className="mb-1 font-bold uppercase tracking-widest text-slate-400">D57 Attribution</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <Metric label="Explicit tags" value={Number(generationStats.buildingAttributionStats.explicit ?? 0).toLocaleString()} />
                <Metric label="Inferred" value={Number(generationStats.buildingAttributionStats.inferred ?? 0).toLocaleString()} />
                <Metric label="Weak bldg=yes" value={Number(generationStats.buildingAttributionStats.weakBuildingYes ?? 0).toLocaleString()} />
                <Metric label="Roofs generated" value={Number(generationStats.buildingAttributionStats.roofsGenerated ?? 0).toLocaleString()} />
                <Metric label="Residential roofs" value={Number(generationStats.buildingAttributionStats.roofedResidential ?? 0).toLocaleString()} />
              </div>
              {generationStats.buildingAttributionStats.roofShapes && (
                <div className="mt-1 border-t border-slate-900 pt-1">
                  {Object.entries(generationStats.buildingAttributionStats.roofShapes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([shape, count]) => (
                    <div key={shape} className="flex justify-between gap-3 py-0.5"><span className="capitalize text-slate-400">roof {shape}</span><span className="text-emerald-300">{Number(count).toLocaleString()}</span></div>
                  ))}
                </div>
              )}
              {generationStats.buildingAttributionStats.byContext && (
                <div className="mt-1 border-t border-slate-900 pt-1">
                  {Object.entries(generationStats.buildingAttributionStats.byContext).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, count]) => (
                    <div key={reason} className="flex justify-between gap-3 py-0.5"><span className="text-slate-500">{reason}</span><span className="text-amber-300">{Number(count).toLocaleString()}</span></div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Developer">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Metric label="FPS" value={renderStats.fps} />
            <Metric label="Draw calls" value={renderStats.drawCalls} />
            <Metric label="Triangles" value={renderStats.triangles?.toLocaleString?.() ?? 0} />
            <Metric label="Chunks" value={performanceStats.chunks ?? renderStats.chunks ?? 0} />
            <Metric label="Visible objs" value={performanceStats.visibleObjects ?? renderStats.visibleObjects ?? 0} />
            <Metric label="LOD hidden" value={performanceStats.hiddenByLod ?? 0} />
            <Metric label="Squads" value={infantryStats?.totalSquads ?? 0} />
            <Metric label="Alive" value={`${infantryStats?.alive ?? 0}/${infantryStats?.soldiers ?? 0}`} />
            <Metric label="Nav cells" value={navigationStats?.cells ?? 0} />
            <Metric label="Blocked" value={navigationStats?.blocked ?? 0} />
          </div>
        </Section>

        <Section title="Experimental Destruction" muted={!debugDamageEnabled}>
          <label className="mb-2 flex items-center justify-between rounded bg-slate-800 p-2 text-xs"><span>Enable destruction sandbox</span><input type="checkbox" checked={debugDamageEnabled} onChange={(e) => onToggleDebugDamage?.(e.target.checked)} /></label>
          {debugDamageEnabled ? (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                {["rifle", "grenade", "shell", "airstrike"].map((weapon) => <button key={weapon} className={`rounded p-2 font-bold capitalize hover:bg-sky-700 ${sandboxWeapon === weapon ? "bg-sky-700" : "bg-slate-800"}`} onClick={() => onSetSandboxWeapon?.(weapon)}>{weapon}</button>)}
              </div>
              <div className="grid grid-cols-2 gap-2"><button className="rounded bg-orange-800 p-2 font-bold hover:bg-orange-700" onClick={onDebugBlast}>Airstrike Target</button><button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={onResetDestruction}>Reset</button></div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400"><Metric label="Destructibles" value={destructionStats.total ?? 0} /><Metric label="Destroyed" value={destructionStats.destroyed ?? 0} /></div>
            </div>
          ) : <p className="text-xs text-slate-500">Sandbox controls and mouse blast preview are disabled.</p>}
        </Section>

        <Section title="OSM Analysis">
          <div className="max-h-40 overflow-y-auto rounded bg-black/30 p-2 text-xs">
            {analysis?.length ? analysis.slice(0, 30).map(([tag, count]) => <div key={tag} className="flex justify-between gap-4 border-b border-slate-900 py-1"><span className="truncate text-slate-300">{tag}</span><span className="text-sky-300">{count}</span></div>) : <p className="text-slate-500">Generate a map to see tag counts.</p>}
          </div>
        </Section>

        <Section title="Canopy Diagnostics">
          <div className="space-y-1 rounded bg-black/30 p-2 text-xs">
            <Metric label="Mode" value={canopyStats?.mode ?? "osmOnly"} />
            <Metric label="Source" value={canopyStats?.source ?? "osm-only"} />
            <Metric label="Available" value={canopyStats?.available ? "yes" : canopyStats?.enabled ? "no" : "off"} />
            {typeof canopyStats?.queryExecuted === "boolean" && <Metric label="Query executed" value={canopyStats.queryExecuted ? "yes" : "no"} />}
            {typeof canopyStats?.querySucceeded === "boolean" && <Metric label="Query success" value={canopyStats.querySucceeded ? "yes" : "no"} />}
            {canopyStats?.stage && <Metric label="Stage" value={canopyStats.stage} />}
            {canopyStats?.bbox && <Metric label="BBOX" value={canopyStats.bbox} />}
            {Number.isFinite(canopyStats?.itemCount) && <Metric label="STAC items" value={canopyStats.itemCount} />}
            {canopyStats?.itemId && <Metric label="NAIP item" value={canopyStats.itemId} />}
            {canopyStats?.itemDatetime && <Metric label="Date" value={String(canopyStats.itemDatetime).slice(0, 10)} />}
            {Array.isArray(canopyStats?.assetKeys) && <Metric label="Asset keys" value={canopyStats.assetKeys.slice(0, 5).join(", ")} />}
            {typeof canopyStats?.hasRenderedPreview === "boolean" && <Metric label="Rendered preview" value={canopyStats.hasRenderedPreview ? "yes" : "no"} />}
            {typeof canopyStats?.signedAssetAttempted === "boolean" && <Metric label="Sign asset" value={canopyStats.signedAssetAttempted ? (canopyStats.signedAssetSucceeded ? "ok" : "failed") : "not tried"} />}
            {Number.isFinite(canopyStats?.signedAssetStatus) && <Metric label="Signed status" value={canopyStats.signedAssetStatus} />}
            {canopyStats?.signedAssetContentType && <Metric label="Signed type" value={canopyStats.signedAssetContentType} />}
            {canopyStats?.previewEndpoint && <Metric label="Preview source" value={canopyStats.previewEndpoint} />}
            {typeof canopyStats?.fallbackUsed === "boolean" && <Metric label="Fallback used" value={canopyStats.fallbackUsed ? "yes" : "no"} />}
            {Number.isFinite(canopyStats?.zoom) && <Metric label="Tile zoom" value={canopyStats.zoom} />}
            {Number.isFinite(canopyStats?.gridSize) && <Metric label="Grid" value={`${canopyStats.gridSize}×${canopyStats.gridSize}`} />}
            {Number.isFinite(canopyStats?.sampled) && <Metric label="Sampled cells" value={canopyStats.sampled} />}
            {Number.isFinite(canopyStats?.failedTiles) && <Metric label="Failed tiles" value={canopyStats.failedTiles} />}
            {Number.isFinite(canopyStats?.totalCells) && <Metric label="Total cells" value={canopyStats.totalCells} />}
            {Number.isFinite(canopyStats?.canopyCells) && <Metric label="Candidate cells" value={canopyStats.canopyCells} />}
            {Number.isFinite(canopyStats?.mediumCanopyCells) && <Metric label="Medium cells" value={canopyStats.mediumCanopyCells} />}
            {Number.isFinite(canopyStats?.highCanopyCells) && <Metric label="High cells" value={canopyStats.highCanopyCells} />}
            {Number.isFinite(canopyStats?.canopyCandidateThreshold) && <Metric label="Candidate threshold" value={canopyStats.canopyCandidateThreshold.toFixed(2)} />}
            {Number.isFinite(canopyStats?.avgScore) && <Metric label="Avg green score" value={canopyStats.avgScore.toFixed(2)} />}
            {Number.isFinite(canopyStats?.minScore) && <Metric label="Min/Max green" value={`${canopyStats.minScore.toFixed(2)} / ${canopyStats.maxScore?.toFixed?.(2) ?? "?"}`} />}
            {Number.isFinite(canopyStats?.authoritySamples) && <Metric label="Placement checks" value={canopyStats.authoritySamples} />}
            {Number.isFinite(canopyStats?.accepted) && <Metric label="High-score accepted" value={canopyStats.accepted} />}
            {Number.isFinite(canopyStats?.lowScoreAllowed) && <Metric label="Fallback allowed" value={canopyStats.lowScoreAllowed} />}
            {Number.isFinite(canopyStats?.rejected) && <Metric label="Rejected" value={canopyStats.rejected} />}
            {Number.isFinite(canopyStats?.acceptanceRate) && <Metric label="Acceptance rate" value={`${Math.round(canopyStats.acceptanceRate * 100)}%`} />}
            {Number.isFinite(canopyStats?.elapsedMs) && <Metric label="Probe time" value={`${Math.round(canopyStats.elapsedMs)}ms`} />}
            {canopyStats?.message && <p className="pt-1 text-slate-400">{canopyStats.message}</p>}
          </div>
        </Section>
      </div>
    </div>
  );
}
