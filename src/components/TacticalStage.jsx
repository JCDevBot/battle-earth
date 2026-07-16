import { useEffect, useRef, useState } from "react";
import { MapEngine } from "../map/engine/MapEngine";
import { UnifiedConfigPanel } from "./UnifiedConfigPanel";
import { LoadingOverlay } from "./LoadingOverlay";
import { DebugPanel } from "./DebugPanel";
import { UnitDashboard, UnitCommandCard } from "./UnitDashboard";

export function TacticalStage({ lat, lon, sizeMeters = 350, battleRequest = null, onBack }) {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const initialBattleRequest = battleRequest ?? {
    playerMode: "sandbox",
    gameMode: "freeplay",
    scale: sizeMeters === 1000 ? "neighborhood" : "testSlice",
    selectedName: "Custom Location",
    mapAspect: sizeMeters === 1000 ? "operational" : "square",
    mapWidthMeters: sizeMeters === 1000 ? 800 : sizeMeters,
    mapDepthMeters: sizeMeters === 1000 ? 1200 : sizeMeters,
    sizeMeters: sizeMeters === 1000 ? 1200 : sizeMeters,
    sandbox: { enabled: true, allowBothSides: true, allowManualDeployment: true }
  };
  const [config, setConfig] = useState({
    lat,
    lon,
    sizeMeters: initialBattleRequest.sizeMeters ?? (sizeMeters === 1000 ? 1200 : sizeMeters),
    mapAspect: initialBattleRequest.mapAspect ?? (sizeMeters === 1000 ? "operational" : "square"),
    mapWidthMeters: initialBattleRequest.mapWidthMeters ?? (sizeMeters === 1000 ? 800 : sizeMeters),
    mapDepthMeters: initialBattleRequest.mapDepthMeters ?? (sizeMeters === 1000 ? 1200 : sizeMeters),
    useRealTerrain: true,
    terrainScale: 1.35,
    seed: 1,
    osmProfile: "broadBase",
    vegetationSource: "planetaryNaip",
    battleRequest: initialBattleRequest
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analysis, setAnalysis] = useState([]);
  const [renderStats, setRenderStats] = useState({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, visibleObjects: 0, hiddenByLod: 0, chunks: 0 });
  const [performanceStats, setPerformanceStats] = useState({ chunks: 0, trackedObjects: 0, visibleObjects: 0, hiddenByLod: 0, hiddenByLayer: 0, layerVisibility: {} });
  const [generationStats, setGenerationStats] = useState({});
  const [destructionStats, setDestructionStats] = useState({ total: 0, intact: 0, damaged: 0, heavy: 0, critical: 0, destroyed: 0, byCategory: {} });
  const [tacticalStats, setTacticalStats] = useState({ total: 0, hardCover: 0, softCover: 0, losBlockers: 0, movementBlockers: 0, movementPenalties: 0, overlayMode: "cover", visible: false });
  const [infantryStats, setInfantryStats] = useState({ totalSquads: 0, friendlySquads: 0, enemySquads: 0, soldiers: 0, alive: 0, selectedLabel: "None", selectedState: "None", selectedMission: "None", selectedSuppression: 0, selectedMorale: "n/a" });
  const [fogStats, setFogStats] = useState({ enabled: false, debugVision: true, cells: 0, hidden: 0, explored: 0, visible: 0, visibleEnemies: 0, visionRadius: 0 });
  const [territoryStats, setTerritoryStats] = useState({ enabled: false, cells: 0, neutral: 0, friendly: 0, enemy: 0, contested: 0 });
  const [navigationStats, setNavigationStats] = useState({ enabled: false, cells: 0, cellSize: 0, blocked: 0, highCost: 0, pathRequests: 0, pathSuccess: 0, pathFailed: 0, lastPathLength: 0, lastExpanded: 0 });
  const [boundsStats, setBoundsStats] = useState({ sizeMeters: 0, half: 0, visible: true, cameraClampEnabled: true });
  const [canopyStats, setCanopyStats] = useState({ enabled: false, source: "osm-only" });
  const [strategicPoiStats, setStrategicPoiStats] = useState({ enabled: true, total: 0, byType: {}, top: [] });
  const [battlefieldGridStats, setBattlefieldGridStats] = useState({ enabled: true, rows: 5, columns: 3, total: 15, selected: null });
  const [tacticalBuildingStats, setTacticalBuildingStats] = useState({ enabled: true, total: 0, byRole: {}, generatedCompounds: 0, poiLinked: 0, garrisonCapacity: 0, averageCover: 0, top: [] });
  const [cameraStats, setCameraStats] = useState({ headingDegrees: 0 });
  const [debugDamageEnabled, setDebugDamageEnabled] = useState(false);
  const [sandboxWeapon, setSandboxWeapon] = useState("grenade");
  const [deployMode, setDeployMode] = useState(null);
  const [buildingCommandMenu, setBuildingCommandMenu] = useState({ visible: false });
  const [missionCommandMenu, setMissionCommandMenu] = useState({ visible: false });
  const [unitCommandMode, setUnitCommandMode] = useState(null);
  const [activeCommandCardId, setActiveCommandCardId] = useState(null);
  const [commandCardPosition, setCommandCardPosition] = useState(null);
  const [classificationInspect, setClassificationInspect] = useState(null);

  const addLog = (message, type = "info") => {
    setLogs((current) => [...current.slice(-80), { message, type, id: crypto.randomUUID() }]);
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const engine = new MapEngine(mountRef.current, {
      skipGlobe: true,
      onLog: addLog,
      onLoadingChange: setLoading,
      onAnalysis: setAnalysis,
      onRenderStats: setRenderStats,
      onDestructionStats: setDestructionStats,
      onPerformanceStats: setPerformanceStats,
      onGenerationStats: setGenerationStats,
      onTacticalStats: setTacticalStats,
      onInfantryStats: setInfantryStats,
      onFogStats: setFogStats,
      onTerritoryStats: setTerritoryStats,
      onNavigationStats: setNavigationStats,
      onBoundsStats: setBoundsStats,
      onCanopyStats: setCanopyStats,
      onStrategicPoiStats: setStrategicPoiStats,
      onBattlefieldGridStats: setBattlefieldGridStats,
      onTacticalBuildingStats: setTacticalBuildingStats,
      onCameraStats: setCameraStats,
      onClassificationInspect: setClassificationInspect,
      onDeployModeChange: setDeployMode,
      onBuildingCommandMenuChange: setBuildingCommandMenu,
      onMissionCommandMenuChange: setMissionCommandMenu,
      onSquadCommandModeChange: (mode) => {
        setUnitCommandMode(mode ? { command: mode.command, label: mode.label } : null);
        if (!mode) setActiveCommandCardId(null);
      },
      onTacticalEvent: (event) => addLog(`Tactical update: ${event.category} now cover=${event.tactical.cover.toFixed(2)}, LOS=${event.tactical.losBlock.toFixed(2)}, move=${Math.max(event.tactical.movementBlock, event.tactical.movementPenalty).toFixed(2)}`, "info")
    });

    engineRef.current = engine;
    engine.setDebugDamageEnabled(false);
    engine.generateMap(config);

    return () => engine.dispose();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        setSidebarOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!activeCommandCardId) {
      setCommandCardPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      setCommandCardPosition(engineRef.current?.getSquadScreenPosition?.(activeCommandCardId) ?? null);
    };

    updatePosition();
    const id = window.setInterval(updatePosition, 120);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", updatePosition);
    };
  }, [activeCommandCardId]);

  const generateMap = () => engineRef.current?.generateMap(config);
  const clearCache = async () => await engineRef.current?.clearCache();
  const toggleDebugDamage = (enabled) => { setDebugDamageEnabled(enabled); engineRef.current?.setDebugDamageEnabled(enabled); };
  const resetDestruction = () => engineRef.current?.resetDestruction();
  const setWeapon = (weapon) => { setSandboxWeapon(weapon); engineRef.current?.setSandboxWeapon(weapon); };
  const debugBlast = () => engineRef.current?.applyDebugBlast();
  const setLayerVisible = (layer, visible) => engineRef.current?.setLayerVisible(layer, visible);
  const setTacticalOverlayVisible = (visible) => engineRef.current?.setTacticalOverlayVisible(visible);
  const setTacticalOverlayMode = (mode) => engineRef.current?.setTacticalOverlayMode(mode);
  const setDeployModeOnEngine = (mode) => {
    const nextMode = engineRef.current?.setDeployMode(mode) ?? null;
    setDeployMode(nextMode);
  };
  const spawnFriendlySquad = () => setDeployModeOnEngine("friendly");
  const spawnEnemySquad = () => setDeployModeOnEngine("enemy");
  const selectNextSquad = () => engineRef.current?.selectNextSquad();
  const selectNextFriendlySquad = () => engineRef.current?.selectNextFriendlySquad();
  const selectNextEnemySquad = () => engineRef.current?.selectNextEnemySquad();
  const orderSelectedSquad = () => engineRef.current?.orderSelectedSquadToTarget();
  const issueSquadMission = (missionType) => engineRef.current?.issueSelectedSquadMissionAtCamera?.(missionType);
  const holdSelectedSquad = () => engineRef.current?.holdSelectedSquad();
  const holdFromCommandCard = () => {
    engineRef.current?.holdSelectedSquad();
    setActiveCommandCardId(null);
  };
  const retreatFromCommandCard = () => {
    engineRef.current?.retreatSelectedSquad?.();
    setActiveCommandCardId(null);
  };
  const selectSquadFromDashboard = (id) => {
    engineRef.current?.selectSquadById?.(id, { centerCamera: false });
    setActiveCommandCardId(id);
  };
  const closeUnitCommandCard = () => {
    engineRef.current?.cancelSelectedSquadMapCommand?.();
    setUnitCommandMode(null);
    setActiveCommandCardId(null);
  };
  const startUnitCommand = (command) => {
    const labels = { move: "Move", defend: "Defend", suppress: "Suppress" };
    const mode = engineRef.current?.startSelectedSquadMapCommand?.(command);
    setUnitCommandMode(mode ? { command, label: labels[command] ?? command } : null);
  };
  const cancelUnitCommand = () => {
    engineRef.current?.cancelSelectedSquadMapCommand?.();
    setUnitCommandMode(null);
    setActiveCommandCardId(null);
  };
  const resetInfantry = () => engineRef.current?.resetInfantry();
  const setFogOfWarEnabled = (enabled) => engineRef.current?.setFogOfWarEnabled(enabled);
  const setFogVisionDebug = (enabled) => engineRef.current?.setFogVisionDebug(enabled);
  const setTerritoryOverlayEnabled = (enabled) => engineRef.current?.setTerritoryOverlayEnabled(enabled);
  const setBoundsVisible = (visible) => engineRef.current?.setBoundsVisible(visible);
  const setCameraClampEnabled = (enabled) => engineRef.current?.setCameraClampEnabled(enabled);
  const setEdgePanEnabled = (enabled) => engineRef.current?.setEdgePanEnabled(enabled);
  const setFollowSelectedSquad = (enabled) => engineRef.current?.setFollowSelectedSquad(enabled);
  const setCameraPreset = (preset) => engineRef.current?.setCameraPreset(preset);
  const resetCamera = () => engineRef.current?.resetCamera();
  const issueBuildingOrder = (order) => engineRef.current?.issueSelectedSquadBuildingOrder(buildingCommandMenu.featureId, order);
  const issueTerrainMission = (missionType) => engineRef.current?.issueSelectedSquadTerrainMission?.(missionType);
  const closeBuildingMenu = () => {
    engineRef.current?.hideBuildingCommandMenu?.();
    setBuildingCommandMenu({ visible: false });
  };
  const closeMissionMenu = () => {
    engineRef.current?.hideTerrainMissionMenu?.();
    setMissionCommandMenu({ visible: false });
  };

  return (
    <div className="relative h-full w-full text-slate-100">
      <div ref={mountRef} className="absolute inset-0" />

      <button
        className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded border border-slate-600 bg-slate-950/90 text-xl hover:bg-sky-700"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label="Toggle map controls"
      >
        ⚙
      </button>

      <button
        className="absolute left-18 top-5 z-20 flex h-10 items-center justify-center rounded border border-slate-600 bg-slate-950/90 px-3 text-sm hover:bg-sky-700"
        onClick={onBack}
      >
        ← Globe
      </button>

      {config.battleRequest?.sandbox?.enabled && (
        <div className="absolute left-5 top-20 z-20 w-72 rounded border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-300 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="font-bold uppercase tracking-wide text-sky-300">Sandbox Mode</div>
              <div className="text-[11px] text-slate-500">{config.battleRequest?.selectedName ?? "Custom Location"}</div>
            </div>
            <div className="rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-400">{config.battleRequest?.gameMode ?? "freeplay"}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className={`rounded border px-2 py-1 ${deployMode === "friendly" ? "border-emerald-300 bg-emerald-900 text-white" : "border-slate-700 bg-slate-900 hover:border-emerald-400"}`} onClick={spawnFriendlySquad}>Deploy Friendly</button>
            <button className={`rounded border px-2 py-1 ${deployMode === "enemy" ? "border-rose-300 bg-rose-900 text-white" : "border-slate-700 bg-slate-900 hover:border-rose-400"}`} onClick={spawnEnemySquad}>Deploy Enemy</button>
            <button className="rounded border border-slate-700 bg-slate-900 px-2 py-1 hover:border-sky-400" onClick={selectNextSquad}>Select Next</button>
            <button className="rounded border border-slate-700 bg-slate-900 px-2 py-1 hover:border-amber-400" onClick={resetInfantry}>Clear Units</button>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Click the map after choosing a side. You control both teams for testing movement, cover, and feel.
          </div>
        </div>
      )}

      <div className="absolute right-5 top-20 z-20 rounded border border-slate-600 bg-slate-950/90 px-3 py-2 text-center text-xs shadow-lg">
        <div className="relative mx-auto mb-1 h-12 w-12 rounded-full border border-slate-500">
          <div className="absolute left-1/2 top-1/2 h-8 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full bg-red-400" style={{ transform: `translate(-50%, -100%) rotate(${-cameraStats.headingDegrees}deg)` }} />
          <div className="absolute inset-x-0 top-0 text-[10px] font-bold text-red-300">N</div>
          <div className="absolute inset-x-0 bottom-0 text-[10px] text-slate-400">S</div>
        </div>
        <div className="font-mono text-slate-300">{Math.round(cameraStats.headingDegrees)}°</div>
      </div>

      {sidebarOpen && (
        <UnifiedConfigPanel
          config={config}
          setConfig={setConfig}
          onGenerate={generateMap}
          onClearCache={clearCache}
          analysis={analysis}
          renderStats={renderStats}
          destructionStats={destructionStats}
          performanceStats={performanceStats}
          generationStats={generationStats}
          tacticalStats={tacticalStats}
          infantryStats={infantryStats}
          fogStats={fogStats}
          territoryStats={territoryStats}
          navigationStats={navigationStats}
          boundsStats={boundsStats}
          canopyStats={canopyStats}
          strategicPoiStats={strategicPoiStats}
          battlefieldGridStats={battlefieldGridStats}
          tacticalBuildingStats={tacticalBuildingStats}
          deployMode={deployMode}
          debugDamageEnabled={debugDamageEnabled}
          sandboxWeapon={sandboxWeapon}
          onSetSandboxWeapon={setWeapon}
          onToggleDebugDamage={toggleDebugDamage}
          onResetDestruction={resetDestruction}
          onDebugBlast={debugBlast}
          onSetLayerVisible={setLayerVisible}
          onSetTacticalOverlayVisible={setTacticalOverlayVisible}
          onSetTacticalOverlayMode={setTacticalOverlayMode}
          onSpawnFriendlySquad={spawnFriendlySquad}
          onSpawnEnemySquad={spawnEnemySquad}
          onSelectNextSquad={selectNextSquad}
          onSelectNextFriendlySquad={selectNextFriendlySquad}
          onSelectNextEnemySquad={selectNextEnemySquad}
          onOrderSelectedSquad={orderSelectedSquad}
          onIssueSquadMission={issueSquadMission}
          onHoldSelectedSquad={holdSelectedSquad}
          onResetInfantry={resetInfantry}
          onSetFogOfWarEnabled={setFogOfWarEnabled}
          onSetFogVisionDebug={setFogVisionDebug}
          onSetTerritoryOverlayEnabled={setTerritoryOverlayEnabled}
          onSetBoundsVisible={setBoundsVisible}
          onSetCameraClampEnabled={setCameraClampEnabled}
          onSetEdgePanEnabled={setEdgePanEnabled}
          onSetFollowSelectedSquad={setFollowSelectedSquad}
          onSetCameraPreset={setCameraPreset}
          onResetCamera={resetCamera}
          onClose={() => setSidebarOpen(false)}
        />
      )}


      {classificationInspect && (
        <ClassificationInspectorPanel
          inspection={classificationInspect}
          onClose={() => setClassificationInspect(null)}
        />
      )}

      <UnitDashboard
        infantryStats={infantryStats}
        onSelectSquad={selectSquadFromDashboard}
      />

      <UnitCommandCard
        squad={(infantryStats?.squads ?? []).find((squad) => squad.id === activeCommandCardId)}
        position={commandCardPosition}
        commandMode={unitCommandMode}
        onCommand={startUnitCommand}
        onHold={holdFromCommandCard}
        onRetreat={retreatFromCommandCard}
        onClose={closeUnitCommandCard}
      />


      {missionCommandMenu.visible && (
        <div
          className="absolute z-30 w-48 rounded border border-sky-400/60 bg-slate-950/95 p-3 text-xs shadow-2xl"
          style={{ left: Math.min(missionCommandMenu.x ?? 20, window.innerWidth - 220), top: Math.min(missionCommandMenu.y ?? 20, window.innerHeight - 190) }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-sky-200">Mission order</div>
              <div className="mt-1 text-[11px] text-slate-500">Choose the squad's intent for this location.</div>
            </div>
            <button className="rounded px-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={closeMissionMenu}>×</button>
          </div>
          <div className="space-y-1">
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-emerald-800" onClick={() => issueTerrainMission("defend")}>Defend</button>
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-rose-800" onClick={() => issueTerrainMission("attack")}>Attack</button>
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-amber-800" onClick={() => issueTerrainMission("ambush")}>Ambush</button>
          </div>
        </div>
      )}
      {buildingCommandMenu.visible && (
        <div
          className="absolute z-30 w-64 rounded border border-yellow-400/60 bg-slate-950/95 p-3 text-xs shadow-2xl"
          style={{ left: Math.min(buildingCommandMenu.x ?? 20, window.innerWidth - 290), top: Math.min(buildingCommandMenu.y ?? 20, window.innerHeight - 260) }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-yellow-200">Building orders</div>
              <div className="text-slate-400">{buildingCommandMenu.state} · {buildingCommandMenu.health}/{buildingCommandMenu.maxHealth} HP</div>
              <div className="mt-1 text-[11px] text-slate-500">Single-click defaults to defensive line. Use rally for a maintained position.</div>
            </div>
            <button className="rounded px-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={closeBuildingMenu}>×</button>
          </div>
          <div className="space-y-1">
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-sky-800" onClick={() => issueBuildingOrder({ type: "occupy_building", fireMode: "free" })}>Occupy building · fire at will</button>
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-sky-800" onClick={() => issueBuildingOrder({ type: "occupy_building", fireMode: "return" })}>Occupy building · return fire</button>
            <button className="w-full rounded border border-violet-500/60 bg-violet-950/60 px-2 py-1 text-left hover:bg-violet-800" onClick={() => issueBuildingOrder({ type: "occupy_building", fireMode: "return", rallyPoint: true, reinforcementPolicy: "maintain" })}>Occupy + rally point · maintain strength</button>
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-sky-800" onClick={() => issueBuildingOrder({ type: "occupy_building", fireMode: "hold" })}>Occupy building · ambush / hold fire</button>
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-emerald-800" onClick={() => issueBuildingOrder({ type: "use_building_cover", fireMode: "free" })}>Defensive line · fire at will</button>
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-emerald-800" onClick={() => issueBuildingOrder({ type: "use_building_cover", fireMode: "return" })}>Defensive line · return fire</button>
            <button className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-emerald-800" onClick={() => issueBuildingOrder({ type: "use_building_cover", fireMode: "hold" })}>Defensive line · hold fire</button>
          </div>
        </div>
      )}
      <LoadingOverlay visible={loading} />
    </div>
  );
}


function formatTag(tags = {}) {
  for (const key of ["natural", "landuse", "leisure", "waterway", "water", "building", "highway"]) {
    if (tags?.[key]) return `${key}=${tags[key]}`;
  }
  return "none";
}

function yesNo(value) {
  return value ? "YES" : "NO";
}

function ClassificationInspectorPanel({ inspection, onClose }) {
  const className = String(inspection.groundClass ?? "unknown").toUpperCase();
  const canopy = inspection.canopyScore == null ? "n/a" : inspection.canopyScore.toFixed(2);
  const threshold = inspection.canopyThreshold == null ? "n/a" : inspection.canopyThreshold.toFixed(2);
  return (
    <div className="absolute bottom-5 right-5 z-30 w-[360px] rounded border border-cyan-400/70 bg-slate-950/95 p-4 text-xs shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-cyan-200">Classification inspector</div>
          <div className="mt-1 text-[11px] text-slate-400">Click another color-coded polygon to inspect it.</div>
        </div>
        <button className="rounded px-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={onClose}>×</button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
        <div className="text-slate-500">Position</div><div>X {inspection.position.x.toFixed(1)} · Z {inspection.position.z.toFixed(1)}</div>
        <div className="text-slate-500">Ground class</div><div className="font-bold text-yellow-200">{className}</div>
        <div className="text-slate-500">OSM tag</div><div>{formatTag(inspection.tags)}</div>
        <div className="text-slate-500">Area</div><div>{Math.round(inspection.area).toLocaleString()} m²</div>
        <div className="text-slate-500">Chunk</div><div>{inspection.chunk}</div>
        <div className="text-slate-500">Vegetation</div><div className={inspection.vegetationEligible ? "text-emerald-300" : "text-rose-300"}>{inspection.vegetationEligible ? "ELIGIBLE" : "BLOCKED"}</div>
      </div>

      <div className="mt-3 rounded border border-slate-700 bg-slate-900/80 p-2">
        <div className="mb-1 font-bold text-slate-300">Exclusions</div>
        <div className="grid grid-cols-2 gap-y-1 font-mono">
          <div>Water buffer</div><div className={inspection.exclusions.waterBuffer ? "text-rose-300" : "text-emerald-300"}>{yesNo(inspection.exclusions.waterBuffer)}</div>
          <div>Road buffer</div><div className={inspection.exclusions.roadBuffer ? "text-rose-300" : "text-emerald-300"}>{yesNo(inspection.exclusions.roadBuffer)}</div>
          <div>Building buffer</div><div className={inspection.exclusions.buildingBuffer ? "text-rose-300" : "text-emerald-300"}>{yesNo(inspection.exclusions.buildingBuffer)}</div>
          <div>Canopy score</div><div>{canopy} / {threshold}</div>
        </div>
      </div>

      {inspection.water && (
        <div className="mt-3 rounded border border-blue-500/50 bg-slate-900/80 p-2">
          <div className="mb-1 font-bold text-blue-200">Water feature</div>
          <div className="grid grid-cols-2 gap-y-1 font-mono">
            <div>Type</div><div>{String(inspection.water.type ?? "water").toUpperCase()}</div>
            <div>Surface elev.</div><div>{inspection.water.surfaceElevation?.toFixed?.(2) ?? "n/a"} m</div>
            <div>Terrain min/max</div><div>{inspection.water.terrainMin?.toFixed?.(2) ?? "n/a"} / {inspection.water.terrainMax?.toFixed?.(2) ?? "n/a"} m</div>
            <div>Est. depth</div><div>{inspection.water.estimatedDepth?.toFixed?.(2) ?? "n/a"} m</div>
            <div>Actual point depth</div><div>{inspection.water.pointDepth?.toFixed?.(2) ?? "n/a"} m</div>
            <div>Flow speed</div><div>{inspection.water.flowSpeed?.toFixed?.(2) ?? "n/a"} m/s</div>
            <div>Flow vector</div><div>X {inspection.water.flowVector?.x ?? 0} · Z {inspection.water.flowVector?.z ?? 0}</div>
            <div>Terrain modified</div><div className={inspection.water.terrainModified ? "text-emerald-300" : "text-amber-300"}>{yesNo(inspection.water.terrainModified)}</div>
          </div>
        </div>
      )}

      {inspection.terrain && (
        <div className="mt-3 rounded border border-slate-700 bg-slate-900/80 p-2">
          <div className="mb-1 font-bold text-slate-300">Terrain sample</div>
          <div className="grid grid-cols-2 gap-y-1 font-mono">
            <div>Base height</div><div>{inspection.terrain.baseHeight?.toFixed?.(2) ?? "n/a"} m</div>
            <div>Final height</div><div>{inspection.terrain.finalHeight?.toFixed?.(2) ?? "n/a"} m</div>
            <div>Modifier delta</div><div className={(inspection.terrain.modifierDelta ?? 0) < 0 ? "text-blue-300" : "text-slate-300"}>{inspection.terrain.modifierDelta?.toFixed?.(2) ?? "0.00"} m</div>
          </div>
        </div>
      )}

      <div className="mt-3 rounded border border-slate-700 bg-slate-900/80 p-2">
        <div className="mb-1 font-bold text-slate-300">Decision trace</div>
        <ol className="list-decimal space-y-1 pl-4 text-slate-300">
          {(inspection.ruleTrace ?? []).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
        </ol>
      </div>

      {!!inspection.overlapping?.length && (
        <div className="mt-3 text-[11px] text-slate-400">
          Overlaps: {inspection.overlapping.map((item) => `${String(item.type).toUpperCase()} (${formatTag(item.tags)})`).join(" · ")}
        </div>
      )}
    </div>
  );
}
