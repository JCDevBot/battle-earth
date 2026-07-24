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
    contextEnabled: initialBattleRequest.contextEnabled !== false,
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
              <div className="text-[11px] text-slate-500">{config.battleRequest?.selectedName ?? "Test Location"}</div>
            </div>
            <span className="font-mono text-[10px] text-slate-500">{config.battleRequest?.gameMode ?? "freeplay"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className={`rounded border px-2 py-1 ${deployMode === "friendly" ? "border-sky-400 bg-sky-900/50" : "border-slate-700 bg-slate-900"}`} onClick={spawnFriendlySquad}>Deploy Friendly</button>
            <button className={`rounded border px-2 py-1 ${deployMode === "enemy" ? "border-rose-400 bg-rose-900/50" : "border-slate-700 bg-slate-900"}`} onClick={spawnEnemySquad}>Deploy Enemy</button>
            <button className="rounded border border-slate-700 bg-slate-900 px-2 py-1" onClick={selectNextSquad}>Select Next</button>
            <button className="rounded border border-slate-700 bg-slate-900 px-2 py-1" onClick={resetInfantry}>Clear Units</button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">Click the map after choosing a side. You control both teams for testing movement, cover, and feel.</p>
        </div>
      )}

      <div className="absolute right-5 top-20 z-20 rounded border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-300 shadow-xl">
        <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">N</div>
        <div className="relative mx-auto h-12 w-12 rounded-full border border-slate-600">
          <div className="absolute left-1/2 top-1/2 h-0.5 w-5 origin-left -translate-y-1/2 bg-rose-400" style={{ transform: `translateY(-50%) rotate(${cameraStats.headingDegrees - 90}deg)` }} />
        </div>
        <div className="mt-1 text-center font-mono text-[10px] text-slate-500">{Math.round(cameraStats.headingDegrees)}°</div>
      </div>

      {sidebarOpen && (
        <UnifiedConfigPanel
          config={config}
          setConfig={setConfig}
          onGenerate={generateMap}
          onClearCache={clearCache}
          logs={logs}
          analysis={analysis}
          renderStats={renderStats}
          performanceStats={performanceStats}
          generationStats={generationStats}
          destructionStats={destructionStats}
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
          debugDamageEnabled={debugDamageEnabled}
          onToggleDebugDamage={toggleDebugDamage}
          sandboxWeapon={sandboxWeapon}
          onSetSandboxWeapon={setWeapon}
          onDebugBlast={debugBlast}
          onResetDestruction={resetDestruction}
          onSetLayerVisible={setLayerVisible}
          onSetTacticalOverlayVisible={setTacticalOverlayVisible}
          onSetTacticalOverlayMode={setTacticalOverlayMode}
          onSpawnFriendly={spawnFriendlySquad}
          onSpawnEnemy={spawnEnemySquad}
          onSelectNextFriendly={selectNextFriendlySquad}
          onSelectNextEnemy={selectNextEnemySquad}
          onOrderSelected={orderSelectedSquad}
          onIssueSquadMission={issueSquadMission}
          onHoldSelected={holdSelectedSquad}
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
          classificationInspect={classificationInspect}
        />
      )}

      {loading && <LoadingOverlay />}

      <UnitDashboard
        squads={engineRef.current?.getSquadSnapshots?.() ?? []}
        onSelectSquad={selectSquadFromDashboard}
      />

      {activeCommandCardId && commandCardPosition && (
        <UnitCommandCard
          squad={engineRef.current?.getSquadSnapshotById?.(activeCommandCardId)}
          screenPosition={commandCardPosition}
          commandMode={unitCommandMode}
          onStartCommand={startUnitCommand}
          onHold={holdFromCommandCard}
          onRetreat={retreatFromCommandCard}
          onCancel={cancelUnitCommand}
          onClose={closeUnitCommandCard}
        />
      )}

      <DebugPanel
        buildingCommandMenu={buildingCommandMenu}
        missionCommandMenu={missionCommandMenu}
        onIssueBuildingOrder={issueBuildingOrder}
        onIssueTerrainMission={issueTerrainMission}
        onCloseBuildingMenu={closeBuildingMenu}
        onCloseMissionMenu={closeMissionMenu}
      />
    </div>
  );
}
