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

  return {
    lat,
    lon,
    sizeMeters:
      request.sizeMeters ?? (sizeMeters === 1000 ? 1200 : sizeMeters),
    mapAspect:
      request.mapAspect ??
      (sizeMeters === 1000 ? "operational" : "square"),
    mapWidthMeters:
      request.mapWidthMeters ?? (sizeMeters === 1000 ? 800 : sizeMeters),
    mapDepthMeters:
      request.mapDepthMeters ?? (sizeMeters === 1000 ? 1200 : sizeMeters),
    useRealTerrain: request.useRealTerrain ?? true,
    terrainScale: request.terrainScale ?? 1.35,
    seed: request.seed ?? 1,
    osmProfile: request.osmProfile ?? "broadBase",
    vegetationSource: request.vegetationSource ?? "planetaryNaip",
    battleRequest: request,
  };
}
