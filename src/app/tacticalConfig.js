import { createContextualBoundsPlan } from "./contextualBounds.js";

export function createInitialTacticalConfig({
  lat,
  lon,
  sizeMeters = 350,
  battleRequest,
}) {
  const request = battleRequest ?? {
    playerMode: "sandbox",
    gameMode: "freeplay",
    scale: sizeMeters === 1000 ? "neighborhood" : "testSlice",
    selectedName: "Custom Location",
    mapAspect: sizeMeters === 1000 ? "operational" : "square",
    mapWidthMeters: sizeMeters === 1000 ? 800 : sizeMeters,
    mapDepthMeters: sizeMeters === 1000 ? 1200 : sizeMeters,
    sizeMeters: sizeMeters === 1000 ? 1200 : sizeMeters,
    sandbox: {
      enabled: true,
      allowBothSides: true,
      allowManualDeployment: true,
    },
  };

  const mapWidthMeters =
    request.mapWidthMeters ?? (sizeMeters === 1000 ? 800 : sizeMeters);
  const mapDepthMeters =
    request.mapDepthMeters ?? (sizeMeters === 1000 ? 1200 : sizeMeters);
  const contextPlan = createContextualBoundsPlan({
    playableWidthMeters: mapWidthMeters,
    playableDepthMeters: mapDepthMeters,
    bufferRatio: request.contextBufferRatio,
    minBufferMeters: request.contextBufferMinMeters,
    maxBufferMeters: request.contextBufferMaxMeters,
  });

  return {
    lat,
    lon,
    sizeMeters:
      request.sizeMeters ?? (sizeMeters === 1000 ? 1200 : sizeMeters),
    mapAspect:
      request.mapAspect ??
      (sizeMeters === 1000 ? "operational" : "square"),
    mapWidthMeters,
    mapDepthMeters,
    renderedWidthMeters: contextPlan.renderedWidthMeters,
    renderedDepthMeters: contextPlan.renderedDepthMeters,
    playableBounds: contextPlan.playableBounds,
    renderedContextBounds: contextPlan.renderedContextBounds,
    contextBufferXMeters: contextPlan.bufferXMeters,
    contextBufferZMeters: contextPlan.bufferZMeters,
    useRealTerrain: request.useRealTerrain ?? true,
    terrainScale: request.terrainScale ?? 1.35,
    seed: request.seed ?? 1,
    osmProfile: request.osmProfile ?? "broadBase",
    vegetationSource: request.vegetationSource ?? "planetaryNaip",
    battleRequest: request,
  };
}
