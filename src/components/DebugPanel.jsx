const WEAPONS = [
  { id: "rifle", label: "Rifle", hint: "direct" },
  { id: "grenade", label: "Grenade", hint: "small radius" },
  { id: "shell", label: "Shell", hint: "medium radius" },
  { id: "airstrike", label: "Airstrike", hint: "large radius" }
];

const LAYER_LABELS = { tactical: "Tactical Overlay" };

export function DebugPanel({
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
  onResetCamera
}) {
  const categoryEntries = Object.entries(destructionStats.byCategory ?? {});

  return (
    <aside className="absolute right-5 top-5 z-40 max-h-[calc(100vh-2.5rem)] w-80 overflow-y-auto rounded border border-slate-700 bg-slate-950/95 p-4 text-xs text-slate-200 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold uppercase tracking-widest text-sky-400">Destruction Sandbox</h2>
        <label className="flex items-center gap-2">
          <span>Enabled</span>
          <input type="checkbox" checked={debugDamageEnabled} onChange={(event) => onToggleDebugDamage(event.target.checked)} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-3">
        <Metric label="FPS" value={renderStats.fps} />
        <Metric label="Draw calls" value={renderStats.drawCalls} />
        <Metric label="Triangles" value={renderStats.triangles?.toLocaleString?.() ?? 0} />
        <Metric label="Geometries" value={renderStats.geometries} />
        <Metric label="Chunks" value={performanceStats.chunks ?? renderStats.chunks ?? 0} />
        <Metric label="Visible objs" value={performanceStats.visibleObjects ?? renderStats.visibleObjects ?? 0} />
      </div>

      <div className="mt-3 border-b border-slate-800 pb-3">
        <div className="mb-2 font-bold uppercase tracking-wide text-slate-400">Render Layers</div>
        <div className="grid grid-cols-2 gap-2">
          {["terrain", "roads", "buildings", "vegetation", "water", "props", "tactical", "units", "fog", "territory"].map((layer) => (
            <label key={layer} className="flex items-center gap-2 rounded bg-slate-800 p-2 capitalize">
              <input
                type="checkbox"
                checked={performanceStats.layerVisibility?.[layer] !== false}
                onChange={(event) => onSetLayerVisible?.(layer, event.target.checked)}
              />
              <span>{LAYER_LABELS[layer] ?? layer}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-slate-400"><span>LOD hidden</span><b>{performanceStats.hiddenByLod ?? 0}</b></div>
        <div className="flex justify-between text-slate-400"><span>Layer hidden</span><b>{performanceStats.hiddenByLayer ?? 0}</b></div>
        <LayerBreakdown breakdown={performanceStats.layerBreakdown} />
      </div>


      <div className="mt-3 border-b border-slate-800 pb-3">
        <div className="mb-2 font-bold uppercase tracking-wide text-slate-400">Generation Diagnostics</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-400">
          <Diag label="OSM elements" value={generationStats?.osmElements} />
          <Diag label="OSM ways" value={generationStats?.osmWays} />
          <Diag label="OSM roads" value={generationStats?.osmRoadWays} />
          <Diag label="Road segs" value={generationStats?.roadSegments} />
          <Diag label="OSM buildings" value={generationStats?.osmBuildingWays} />
          <Diag label="Buildings" value={generationStats?.buildings} />
          <Diag label="Building chunks" value={generationStats?.buildingChunks} />
          <Diag label="Water features" value={generationStats?.waterFeatures} />
          <Diag label="Veg zones" value={generationStats?.vegetationZones} />
          <Diag label="Trees" value={generationStats?.treesGenerated} />
          <Diag label="Tree cap" value={generationStats?.treesCapped} />
          <Diag label="Veg chunks" value={generationStats?.vegetationChunks} />
          <Diag label="Residential blocks" value={generationStats?.residentialBlocks} />
          <Diag label="Residential greens" value={generationStats?.residentialGreenspaces} />
          <Diag label="Riparian candidates" value={generationStats?.riparianCandidates} />
          <Diag label="Riparian trees" value={generationStats?.riparianTrees} />
          <Diag label="Class features" value={generationStats?.classificationFeatures} />
          <Diag label="Props" value={generationStats?.props} />
        </div>
      </div>

      <div className="mt-3 border-b border-slate-800 pb-3">
        <div className="mb-2 font-bold uppercase tracking-wide text-slate-400">Map Bounds / Camera</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center justify-between rounded bg-slate-800 p-2">
            <span>Bounds visual</span>
            <input type="checkbox" checked={boundsStats?.visible !== false} onChange={(event) => onSetBoundsVisible?.(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded bg-slate-800 p-2">
            <span>Camera clamp</span>
            <input type="checkbox" checked={boundsStats?.cameraClampEnabled !== false} onChange={(event) => onSetCameraClampEnabled?.(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded bg-slate-800 p-2">
            <span>Edge pan</span>
            <input type="checkbox" defaultChecked={false} onChange={(event) => onSetEdgePanEnabled?.(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded bg-slate-800 p-2">
            <span>Follow squad</span>
            <input type="checkbox" onChange={(event) => onSetFollowSelectedSquad?.(event.target.checked)} />
          </label>
          <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={() => onSetCameraPreset?.("topDown")}>Top-down</button>
          <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={() => onSetCameraPreset?.("angled")}>Angled</button>
          <button className="col-span-2 rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={onResetCamera}>Reset camera</button>
        </div>
        <div className="mt-2 rounded bg-black/20 p-2 text-slate-400">
          <div>WASD/Arrows pan · Q/E rotate · R/F tilt · Home reset</div>
          <div className="mt-1 flex justify-between"><span>Playable size</span><b>{Math.round(boundsStats?.sizeMeters ?? 0)}m</b></div>
        </div>
      </div>

      <div className="mt-3 border-b border-slate-800 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wide text-slate-400">Tactical Overlays</span>
          <label className="flex items-center gap-2">
            <span>Show</span>
            <input
              type="checkbox"
              checked={Boolean(tacticalStats?.visible)}
              onChange={(event) => onSetTacticalOverlayVisible?.(event.target.checked)}
            />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["cover", "los", "movement"].map((mode) => (
            <button
              key={mode}
              className={`rounded p-2 text-center font-bold capitalize hover:bg-cyan-700 ${tacticalStats?.overlayMode === mode ? "bg-cyan-700" : "bg-slate-800"}`}
              onClick={() => onSetTacticalOverlayMode?.(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-400">
          <div className="flex justify-between"><span>Hard cover</span><b>{tacticalStats?.hardCover ?? 0}</b></div>
          <div className="flex justify-between"><span>Soft cover</span><b>{tacticalStats?.softCover ?? 0}</b></div>
          <div className="flex justify-between"><span>LOS block</span><b>{tacticalStats?.losBlockers ?? 0}</b></div>
          <div className="flex justify-between"><span>Move block</span><b>{tacticalStats?.movementBlockers ?? 0}</b></div>
          <div className="flex justify-between"><span>Concealment</span><b>{tacticalStats?.concealment ?? 0}</b></div>
          <div className="flex justify-between"><span>Occupiable</span><b>{tacticalStats?.occupiable ?? 0}</b></div>
          <div className="flex justify-between"><span>Destructible</span><b>{tacticalStats?.destructible ?? 0}</b></div>
          <div className="col-span-2 flex justify-between"><span>Movement penalties</span><b>{tacticalStats?.movementPenalties ?? 0}</b></div>
        </div>
      </div>

      <div className="mt-3 border-b border-slate-800 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wide text-slate-400">Fog / Territory</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <label className="flex items-center justify-between rounded bg-slate-800 p-2">
            <span>Fog of war</span>
            <input type="checkbox" checked={Boolean(fogStats?.enabled)} onChange={(event) => onSetFogOfWarEnabled?.(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded bg-slate-800 p-2">
            <span>Vision radius debug</span>
            <input type="checkbox" checked={Boolean(fogStats?.debugVision)} onChange={(event) => onSetFogVisionDebug?.(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded bg-slate-800 p-2">
            <span>Territory control</span>
            <input type="checkbox" checked={Boolean(territoryStats?.enabled)} onChange={(event) => onSetTerritoryOverlayEnabled?.(event.target.checked)} />
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-400">
          <div className="flex justify-between"><span>Visible cells</span><b>{fogStats?.visible ?? 0}</b></div>
          <div className="flex justify-between"><span>Explored</span><b>{fogStats?.explored ?? 0}</b></div>
          <div className="flex justify-between"><span>Hidden</span><b>{fogStats?.hidden ?? 0}</b></div>
          <div className="flex justify-between"><span>Visible enemies</span><b>{fogStats?.visibleEnemies ?? 0}</b></div>
          <div className="flex justify-between text-sky-300"><span>Friendly</span><b>{territoryStats?.friendly ?? 0}</b></div>
          <div className="flex justify-between text-rose-300"><span>Enemy</span><b>{territoryStats?.enemy ?? 0}</b></div>
          <div className="flex justify-between text-yellow-300"><span>Contested</span><b>{territoryStats?.contested ?? 0}</b></div>
          <div className="flex justify-between"><span>Neutral</span><b>{territoryStats?.neutral ?? 0}</b></div>
        </div>
      </div>

      <div className="mt-3 border-b border-slate-800 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wide text-slate-400">Infantry Sandbox</span>
          <span className="text-[10px] text-slate-500">Click any unit · click ground move</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded bg-sky-800 p-2 font-bold hover:bg-sky-700" onClick={onSpawnFriendlySquad}>Spawn Friendly</button>
          <button className="rounded bg-rose-900 p-2 font-bold hover:bg-rose-800" onClick={onSpawnEnemySquad}>Spawn Enemy</button>
          <button className="rounded bg-slate-800 p-2 font-bold hover:bg-slate-700" onClick={onSelectNextSquad}>Next Any</button>
          <button className="rounded bg-emerald-800 p-2 font-bold hover:bg-emerald-700" onClick={onOrderSelectedSquad}>Move Camera</button>
          <button className="rounded bg-sky-900 p-2 font-bold hover:bg-sky-800" onClick={onSelectNextFriendlySquad}>Next Friendly</button>
          <button className="rounded bg-rose-950 p-2 font-bold hover:bg-rose-900" onClick={onSelectNextEnemySquad}>Next Enemy</button>
        </div>
        <button className="mt-2 w-full rounded bg-amber-800 p-2 font-bold hover:bg-amber-700" onClick={onHoldSelectedSquad}>Hold Selected</button>
        <button className="mt-2 w-full rounded bg-red-900 p-2 font-bold hover:bg-red-800" onClick={onResetInfantry}>Reset Infantry</button>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-400">
          <div className="flex justify-between"><span>Squads</span><b>{infantryStats?.totalSquads ?? 0}</b></div>
          <div className="flex justify-between"><span>Alive</span><b>{infantryStats?.alive ?? 0}/{infantryStats?.soldiers ?? 0}</b></div>
          <div className="col-span-2 flex justify-between"><span>Selected</span><b>{infantryStats?.selectedLabel ?? "None"}</b></div>
          <div className="flex justify-between"><span>State</span><b>{infantryStats?.selectedState ?? "None"}</b></div>
          <div className="flex justify-between"><span>Morale</span><b>{infantryStats?.selectedMorale ?? "n/a"}</b></div>
          <div className="col-span-2 flex justify-between"><span>Mission</span><b>{infantryStats?.selectedMission ?? "None"}</b></div>
          <div className="flex justify-between"><span>ROE</span><b>{infantryStats?.selectedROE ?? "n/a"}</b></div>
          <div className="flex justify-between"><span>Cover</span><b>{infantryStats?.selectedCover ?? 0}%</b></div>
          <div className="flex justify-between"><span>Suppression</span><b>{infantryStats?.selectedSuppression ?? 0}</b></div>
          <div className="flex justify-between"><span>Wounded/KIA</span><b>{infantryStats?.selectedWounded ?? 0}/{infantryStats?.selectedCasualties ?? 0}</b></div>
          <div className="flex justify-between"><span>Contact</span><b>{infantryStats?.selectedContactBearing ?? "n/a"}</b></div>
          <div className="flex justify-between"><span>Range</span><b>{infantryStats?.selectedContactRange ?? 0}m</b></div>
          <div className="flex justify-between"><span>Confidence</span><b>{infantryStats?.selectedContactConfidence ?? 0}%</b></div>
          <div className="flex justify-between"><span>Shots</span><b>{infantryStats?.selectedShotsFired ?? 0}</b></div>
          <div className="flex justify-between"><span>Path pts</span><b>{infantryStats?.selectedPathWaypoints ?? 0}</b></div>
          <div className="flex justify-between"><span>Waypoint</span><b>{infantryStats?.selectedPathIndex ?? 0}</b></div>
        </div>
        <div className="mt-3 rounded bg-black/20 p-2 text-slate-400">
          <div className="mb-1 font-bold uppercase text-slate-500">Navigation Grid</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="flex justify-between"><span>Cells</span><b>{navigationStats?.cells ?? 0}</b></div>
            <div className="flex justify-between"><span>Cell size</span><b>{navigationStats?.cellSize ?? 0}m</b></div>
            <div className="flex justify-between"><span>Blocked</span><b>{navigationStats?.blocked ?? 0}</b></div>
            <div className="flex justify-between"><span>High cost</span><b>{navigationStats?.highCost ?? 0}</b></div>
            <div className="flex justify-between"><span>Paths</span><b>{navigationStats?.pathSuccess ?? 0}/{navigationStats?.pathRequests ?? 0}</b></div>
            <div className="flex justify-between"><span>Failed</span><b>{navigationStats?.pathFailed ?? 0}</b></div>
            <div className="col-span-2 flex justify-between"><span>Last path / expanded</span><b>{navigationStats?.lastPathLength ?? 0} / {navigationStats?.lastExpanded ?? 0}</b></div>
          </div>
        </div>
      </div>

      <div className="mt-3 border-b border-slate-800 pb-3">
        <div className="mb-2 font-bold uppercase tracking-wide text-slate-400">Weapons</div>
        <div className="grid grid-cols-2 gap-2">
          {WEAPONS.map((weapon) => (
            <button
              key={weapon.id}
              className={`rounded p-2 text-left font-bold hover:bg-sky-700 ${sandboxWeapon === weapon.id ? "bg-sky-700" : "bg-slate-800"}`}
              onClick={() => onSetSandboxWeapon(weapon.id)}
            >
              <div>{weapon.label}</div>
              <div className="text-[10px] font-normal text-slate-300">{weapon.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-1 border-b border-slate-800 pb-3">
        <div className="flex justify-between"><span>Total destructibles</span><b>{destructionStats.total ?? 0}</b></div>
        <div className="flex justify-between"><span>Damaged</span><b>{(destructionStats.damaged ?? 0) + (destructionStats.heavy ?? 0) + (destructionStats.critical ?? 0)}</b></div>
        <div className="flex justify-between"><span>Destroyed</span><b>{destructionStats.destroyed ?? 0}</b></div>
        <div className="flex justify-between"><span>Impact decals</span><b>{destructionStats.decals ?? 0}</b></div>
      </div>

      {categoryEntries.length > 0 ? (
        <div className="mt-3 max-h-28 overflow-y-auto border-b border-slate-800 pb-3">
          {categoryEntries.map(([category, count]) => (
            <div key={category} className="flex justify-between">
              <span className="capitalize">{category}</span>
              <b>{count}</b>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="rounded bg-orange-700 p-2 font-bold hover:bg-orange-600" onClick={onDebugBlast}>Airstrike Target</button>
        <button className="rounded bg-slate-700 p-2 font-bold hover:bg-slate-600" onClick={onResetDestruction}>Reset</button>
      </div>
      <p className="mt-2 text-slate-400">Move the mouse to preview blast radius. Left-click the map to fire the selected weapon.</p>
    </aside>
  );
}

function LayerBreakdown({ breakdown = {} }) {
  const rows = Object.entries(breakdown)
    .filter(([, stats]) => (stats?.tracked ?? 0) > 0)
    .sort((a, b) => (b[1]?.estimatedDrawCalls ?? 0) - (a[1]?.estimatedDrawCalls ?? 0));

  if (!rows.length) return null;

  return (
    <div className="mt-3 max-h-28 overflow-y-auto rounded bg-black/20 p-2 text-[10px] text-slate-400">
      <div className="mb-1 grid grid-cols-4 gap-1 font-bold uppercase text-slate-500">
        <span>Layer</span>
        <span className="text-right">Vis</span>
        <span className="text-right">Draw</span>
        <span className="text-right">Geo</span>
      </div>
      {rows.map(([layer, stats]) => (
        <div key={layer} className="grid grid-cols-4 gap-1">
          <span className="capitalize">{layer}</span>
          <span className="text-right">{stats.visible ?? 0}</span>
          <span className="text-right">{stats.estimatedDrawCalls ?? 0}</span>
          <span className="text-right">{stats.geometries ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded bg-black/30 p-2">
      <div className="text-slate-400">{label}</div>
      <div className="text-sm font-bold text-sky-300">{value ?? 0}</div>
    </div>
  );
}


function Diag({ label, value }) {
  const safe = value == null ? 0 : value;
  return <div className="flex justify-between"><span>{label}</span><b>{Number(safe).toLocaleString?.() ?? safe}</b></div>;
}
