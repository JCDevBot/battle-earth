import { describe, expect, it, vi } from "vitest";
import { runContextualMapGeneration } from "../src/app/runContextualMapGeneration.js";

function createEngine() {
  const mapData = {
    elements: Array.from({ length: 20 }, (_, index) => ({
      type: "node",
      id: index + 1,
      lat: 44.9362,
      lon: -93.0977,
      tags: {},
    })),
  };

  const callbacks = {
    onLoadingChange: vi.fn(),
    onAnalysis: vi.fn(),
    onGenerationStats: vi.fn(),
    onCanopyStats: vi.fn(),
    onDestructionStats: vi.fn(),
    onTacticalStats: vi.fn(),
  };

  return {
    callbacks,
    log: vi.fn(),
    useTerrainLodRenderer: false,
    terrain: {
      useRealData: false,
      setHeightExaggeration: vi.fn(),
      getWorldHeight: vi.fn(() => 4),
    },
    terrainLOD: { dispose: vi.fn(), generate: vi.fn() },
    osm: {
      fetchMapData: vi.fn(async () => ({ data: mapData, fromCache: false })),
    },
    canopy: { fetchCanopyGrid: vi.fn() },
    performance: {
      removeLayerEntries: vi.fn(),
      indexBuilder: vi.fn(),
      getStats: vi.fn(() => ({ layerVisibility: {} })),
    },
    infantry: { clear: vi.fn() },
    builder: {
      build: vi.fn(),
      getGenerationDiagnostics: vi.fn(() => ({ buildings: 3 })),
      getCanopyAuthorityDiagnostics: vi.fn(() => ({})),
      buildingLOD: { setVisible: vi.fn() },
      vegetationLOD: { setVisible: vi.fn() },
      setGroundClassificationDebugVisible: vi.fn(),
    },
    strategicPois: {
      pois: [{ id: "poi-1" }],
      hqs: [],
      build: vi.fn(),
    },
    tacticalBuildings: { build: vi.fn() },
    battlefieldGrid: { build: vi.fn() },
    tactical: {
      indexDestructibles: vi.fn(),
      getStats: vi.fn(() => ({ total: 0 })),
    },
    destruction: { getStats: vi.fn(() => ({ total: 0 })) },
    navigation: { build: vi.fn() },
    fog: { build: vi.fn() },
    territory: { build: vi.fn(), cells: [] },
    bounds: { build: vi.fn() },
    applyReplicaModeDefaults: vi.fn(),
    frameMap: vi.fn(),
  };
}

describe("contextual MapEngine orchestration", () => {
  it("routes buffered render dimensions without expanding gameplay systems", async () => {
    const engine = createEngine();
    const config = {
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
      sizeMeters: 1200,
      useRealTerrain: false,
      vegetationSource: "osmOnly",
      osmProfile: "broadBase",
      seed: 7,
      contextBufferRatio: 0.18,
      contextMinBufferMeters: 60,
      contextMaxBufferMeters: 250,
    };

    const result = await runContextualMapGeneration(engine, config);

    expect(result.plan.visualFeatures).toMatchObject({
      mapWidthMeters: 1088,
      mapDepthMeters: 1632,
      sizeMeters: 1632,
    });
    expect(engine.builder.build).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        mapWidthMeters: 1088,
        mapDepthMeters: 1632,
        sizeMeters: 1632,
      }),
    );
    expect(engine.navigation.build).toHaveBeenCalledWith(
      1200,
      engine.destruction,
      expect.any(Function),
    );
    expect(engine.fog.build).toHaveBeenCalledWith(1200, expect.any(Function));
    expect(engine.territory.build).toHaveBeenCalledWith(
      1200,
      expect.any(Function),
      engine.strategicPois.pois,
    );
    expect(engine.bounds.build).toHaveBeenCalledWith(
      1200,
      expect.any(Function),
      { showOuterSkirt: false },
    );
    expect(engine.frameMap).toHaveBeenCalledWith(1200, 800, 1200);
  });

  it("reports contextual diagnostics and restores loading state", async () => {
    const engine = createEngine();

    await runContextualMapGeneration(engine, {
      lat: 44.9537,
      lon: -93.09,
      sizeMeters: 350,
      useRealTerrain: false,
      vegetationSource: "osmOnly",
    });

    expect(engine.callbacks.onLoadingChange.mock.calls).toEqual([[true], [false]]);
    expect(engine.callbacks.onGenerationStats).toHaveBeenCalledWith(
      expect.objectContaining({
        buildings: 3,
        contextual: expect.objectContaining({
          enabled: true,
          playableWidthMeters: 350,
          renderedWidthMeters: expect.any(Number),
          renderedAreaMultiplier: expect.any(Number),
        }),
      }),
    );
  });

  it("keeps canopy queries on rendered context dimensions", async () => {
    const engine = createEngine();
    engine.canopy.fetchCanopyGrid.mockResolvedValue({
      available: true,
      message: "Canopy ready.",
    });

    await runContextualMapGeneration(engine, {
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
      useRealTerrain: false,
      vegetationSource: "planetaryNaip",
    });

    expect(engine.canopy.fetchCanopyGrid).toHaveBeenCalledWith({
      lat: 44.9362,
      lon: -93.0977,
      sizeMeters: 1536,
    });
  });
});
