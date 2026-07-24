import { analyzeOsmData } from "../map/services/analyzeOsmData";
import { generateProceduralOsmData } from "../map/services/ProceduralFallback";
import { mergeCompatibleGeometries } from "../map/utils/mergeCompatibleGeometries.js";
import { createContextualGenerationDiagnostics } from "./contextualGenerationDiagnostics.js";
import { filterMapDataForDiagnosticLayer } from "./diagnosticMapLayers.js";
import { beginContextualRuntimeMeasurement } from "./contextualRuntimeMeasurement.js";
import { createMapEngineGenerationPlan } from "./mapEngineGenerationPlan.js";

function heightReader(engine) {
  return (x, z) => engine.terrain?.getWorldHeight?.(x, z) ?? 0;
}

/**
 * Runs one tactical map generation through explicit render and gameplay domains.
 *
 * This orchestration is intentionally independent of React and Three.js object
 * construction. MapEngine remains responsible for owning the concrete systems;
 * this function only routes the contextual plan to those systems consistently.
 */
export async function runContextualMapGeneration(engine, config = {}) {
  if (!engine) throw new TypeError("A MapEngine-compatible instance is required.");

  const plan = createMapEngineGenerationPlan(config);
  const measurement = beginContextualRuntimeMeasurement();
  const groundHeight = heightReader(engine);
  const diagnosticLayerMode =
    config.diagnosticLayerMode ?? config.battleRequest?.diagnosticLayerMode;

  engine.callbacks.onLoadingChange?.(true);
  try {
    engine.terrain.useRealData = config.useRealTerrain;
    engine.terrain.setHeightExaggeration?.(config.terrainScale ?? 1.35);

    if (config.useRealTerrain) {
      engine.log("Fetching terrain tiles.");
      await engine.terrain.fetchTerrainTile(config.lat, config.lon);
      if (engine.useTerrainLodRenderer) {
        await engine.terrainLOD.generate(
          config.lat,
          config.lon,
          plan.terrainLod.sizeMeters,
        );
      } else {
        engine.terrainLOD?.dispose?.();
      }
    }

    const queryBounds = plan.sourceQuery.bounds;
    const result = await engine.osm.fetchMapData(
      queryBounds.south,
      queryBounds.west,
      queryBounds.north,
      queryBounds.east,
      { profileName: plan.sourceQuery.profileName },
    );

    const osmCount = result.data.elements?.length ?? 0;
    engine.log(
      `OSM elements: ${osmCount}${result.fromCache ? " from cache" : ""}.`,
      "success",
    );

    let sourceMapData = result.data;
    if (osmCount < 20) {
      engine.log("Sparse OSM data — generating procedural fill.", "warn");
      const procedural = generateProceduralOsmData(plan.proceduralFallback);
      sourceMapData = {
        elements: [...(result.data.elements ?? []), ...procedural.elements],
      };
    }

    const mapData = filterMapDataForDiagnosticLayer(
      sourceMapData,
      diagnosticLayerMode,
    );
    if (diagnosticLayerMode && diagnosticLayerMode !== "all") {
      engine.log(`Diagnostic layer mode: ${diagnosticLayerMode}.`, "warn");
    }

    const analysis = analyzeOsmData(mapData);
    engine.callbacks.onAnalysis?.(analysis);
    console.table(analysis);

    let externalCanopy = null;
    if (config.vegetationSource === "planetaryNaip") {
      engine.callbacks.onCanopyStats?.({
        enabled: true,
        available: false,
        source: "planetary-computer-naip",
        mode: "planetaryNaip",
        queryExecuted: false,
        stage: "queued",
        message: "Queued Planetary Computer NAIP canopy probe.",
      });
      try {
        engine.log(
          "Fetching Microsoft Planetary Computer NAIP canopy probe.",
          "info",
        );
        externalCanopy = await engine.canopy.fetchCanopyGrid(plan.canopy);
        engine.callbacks.onCanopyStats?.(externalCanopy);
        engine.log(
          externalCanopy.message ?? "Canopy probe complete.",
          externalCanopy.available ? "success" : "warn",
        );
      } catch (error) {
        externalCanopy = {
          enabled: true,
          available: false,
          source: "planetary-computer-naip",
          mode: "planetaryNaip",
          queryExecuted: true,
          querySucceeded: false,
          stage: "engine-fetch",
          message: error.message,
        };
        engine.callbacks.onCanopyStats?.(externalCanopy);
        engine.log(`Canopy probe failed: ${error.message}`, "warn");
      }
    } else {
      engine.callbacks.onCanopyStats?.({
        enabled: false,
        available: false,
        source: "osm-only",
        mode: "osmOnly",
        queryExecuted: false,
        stage: "disabled",
        message: "Vegetation source is set to OSM + procedural.",
      });
    }

    engine.performance?.removeLayerEntries?.("units");
    engine.infantry?.clear?.();
    if (engine.builder) {
      engine.builder.safeMergeGeometries = mergeCompatibleGeometries;
    }
    engine.builder.build(mapData, {
      ...config,
      ...plan.visualFeatures,
      externalCanopy,
    });
    engine.strategicPois?.build?.({
      mapData,
      builder: engine.builder,
      terrain: engine.terrain,
      ...plan.strategicPois,
    });
    const initialObjectiveSources = [
      ...(engine.strategicPois?.pois ?? []),
      ...(engine.strategicPois?.hqs ?? []),
    ];
    engine.tacticalBuildings?.build?.({
      builder: engine.builder,
      terrain: engine.terrain,
      pois: initialObjectiveSources,
    });
    engine.battlefieldGrid?.build?.({
      sizeMeters: plan.gameplay.sizeMeters,
      terrain: engine.terrain,
      pois: initialObjectiveSources,
    });

    if (config.vegetationSource === "planetaryNaip") {
      engine.callbacks.onCanopyStats?.({
        ...(externalCanopy ?? {}),
        ...(engine.builder.getCanopyAuthorityDiagnostics?.() ?? {}),
      });
    }

    engine.performance.indexBuilder(engine.builder, engine.terrain);
    const layerVisibility =
      engine.performance?.getStats?.().layerVisibility ?? {};
    engine.builder?.buildingLOD?.setVisible?.(
      layerVisibility.buildings !== false,
    );
    engine.builder?.vegetationLOD?.setVisible?.(
      layerVisibility.vegetation !== false,
    );
    engine.builder?.setGroundClassificationDebugVisible?.(
      layerVisibility["classification-debug"] !== false,
    );
    engine.tactical.indexDestructibles(engine.destruction);

    engine.navigation?.build?.(
      plan.gameplay.sizeMeters,
      engine.destruction,
      groundHeight,
    );
    engine.fog?.build?.(plan.gameplay.sizeMeters, groundHeight);
    const objectiveSources = [
      ...(engine.strategicPois?.pois ?? []),
      ...(engine.strategicPois?.hqs ?? []),
    ];
    engine.territory?.build?.(
      plan.gameplay.sizeMeters,
      groundHeight,
      objectiveSources,
    );
    engine.battlefieldGrid?.build?.({
      sizeMeters: plan.gameplay.sizeMeters,
      terrain: engine.terrain,
      pois: objectiveSources,
      territoryCells: engine.territory?.cells ?? [],
    });
    engine.bounds?.build?.(
      plan.boundsManager.sizeMeters,
      groundHeight,
      { showOuterSkirt: plan.boundsManager.showOuterSkirt },
    );

    engine.callbacks.onDestructionStats?.(engine.destruction.getStats());
    engine.callbacks.onTacticalStats?.(engine.tactical.getStats());
    engine.applyReplicaModeDefaults();
    engine.frameMap(
      plan.camera.sizeMeters,
      plan.camera.mapWidthMeters,
      plan.camera.mapDepthMeters,
    );

    const contextualDiagnostics = createContextualGenerationDiagnostics(
      plan,
      measurement.finish(),
    );
    engine.callbacks.onGenerationStats?.({
      ...(engine.builder.getGenerationDiagnostics?.() ?? {}),
      contextual: contextualDiagnostics,
      diagnosticLayerMode: diagnosticLayerMode ?? "all",
    });
    engine.log("Map generated.", "success");

    return Object.freeze({
      plan,
      mapData,
      analysis,
      externalCanopy,
      contextualDiagnostics,
    });
  } catch (error) {
    console.error(error);
    engine.log(error.message ?? "Map generation failed.", "error");
    return null;
  } finally {
    engine.callbacks.onLoadingChange?.(false);
  }
}
