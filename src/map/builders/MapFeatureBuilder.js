import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SeededRandom } from "../utils/SeededRandom";
import { METERS_PER_DEGREE_LAT } from "../utils/geo";
import { BuildingLODManager } from "../engine/BuildingLODManager";
import { VegetationLODManager } from "../engine/VegetationLODManager";
import { RoadBuilder, convexHull } from "./RoadBuilder";

export class MapFeatureBuilder {
  safeMergeGeometries(geometries) {
    const normalized = geometries
      .filter(Boolean)
      .map((geometry) => geometry.index ? geometry.toNonIndexed() : geometry);
    if (!normalized.length) return null;
    return mergeGeometries(normalized, false);
  }

  constructor(scene, terrain, materials, destruction = null) {
    this.scene = scene;
    this.terrain = terrain;
    this.materials = materials;
    this.destruction = destruction;
    this.group = new THREE.Group();
    this.vegGroup = new THREE.Group();
    this.classificationDebugGroup = new THREE.Group();
    this.classificationDebugGroup.name = "ground-classification-debug";
    this.classificationDebugGroup.visible = false;
    this.classificationDebugFeatures = [];
    this.naturalClassifiedItems = [];
    this.manMadeClassifiedItems = [];
    this.resolvedSurfaceItems = [];
    this.osmSurfaceFeatures = [];
    this.osmReplicaStats = this.createOsmReplicaStats();
    this.residentialGreenspaceZones = [];
    this.scene.add(this.group);
    this.scene.add(this.vegGroup);
    this.scene.add(this.classificationDebugGroup);
    this.centerLat = 0;
    this.centerLon = 0;
    this.currentSize = 1000;
    this.scaleFactor = METERS_PER_DEGREE_LAT;
    this.rng = new SeededRandom(1);
    this.buildingBoxes = [];
    this.roadSegments = [];
    this.roadJunctions = new Map();
    this.vegetationZones = [];
    this.naturalClassifiedItems = [];
    this.manMadeClassifiedItems = [];
    this.resolvedSurfaceItems = [];
    this.osmSurfaceFeatures = [];
    this.osmReplicaStats = this.createOsmReplicaStats();
    this.residentialGreenspaceZones = [];
    this.residentialBlockZones = [];
    this.waterSegments = [];
    this.waterMeshes = [];
    this.waterPolygons = [];
    this.waterIslands = [];
    this.waterFeatures = [];
    this.reconstructionZones = [];
    this.landmarkRegistry = this.createLandmarkRegistry();
    this.worldDetailStats = { fences: 0, driveways: 0, parkingPads: 0, roadsideProps: 0 };
    this.worldDetailBatches = this.createWorldDetailBatchState();
    this.buildingVisualBatches = new Map();
    this.canopyAuthorityStats = this.createCanopyAuthorityStats();
    this.buildingBatchStats = { queued: 0, meshes: 0 };
    this.buildingAttributionStats = this.createBuildingAttributionStats();
    this.residentialBlockZones = [];
    this.generationStats = this.createGenerationStats();
    this.buildingLOD = new BuildingLODManager(scene, materials);
    this.vegetationLOD = new VegetationLODManager(scene, terrain);
    this.roadBuilder = new RoadBuilder(this);
    this.canopyAuthorityStats = this.createCanopyAuthorityStats();
  }

  build(osmData, { lat, lon, sizeMeters, mapWidthMeters = sizeMeters, mapDepthMeters = sizeMeters, seed, preserveLayerVisibility = true, externalCanopy = null }) {
    this.clear({ preserveLayerVisibility });
    this.centerLat = lat;
    this.centerLon = lon;
    this.currentSize = sizeMeters;
    this.currentWidth = mapWidthMeters;
    this.currentDepth = mapDepthMeters;
    this.vegetationLOD?.setMapSize?.(sizeMeters);
    this.externalCanopy = externalCanopy;
    this.canopyAuthorityStats = this.createCanopyAuthorityStats();
    this.rng = new SeededRandom(seed);
    this.generationStats = this.createGenerationStats(osmData);

    const nodes = {};
    for (const element of osmData.elements ?? []) {
      if (element.type === "node") nodes[element.id] = { lat: element.lat, lon: element.lon };
    }

    this.terrain.generateGround(mapWidthMeters, mapDepthMeters, lat, lon, this.scaleFactor);

    for (const way of osmData.elements ?? []) {
      if (way.type !== "way" || !way.tags) continue;
      if (way.tags.natural === "water" || way.tags.water) this.createRegion(way, nodes, "water");
      else if (way.tags.waterway) this.createWaterway(way, nodes);
      else if (this.resolveOsmSurfaceType(way.tags)) this.createOsmSurfaceRegion(way, nodes, this.resolveOsmSurfaceType(way.tags));
      else if (way.tags.landuse === "forest" || way.tags.natural === "wood") this.createRegion(way, nodes, "forest");
      else if (way.tags.natural === "wetland") this.createRegion(way, nodes, "wetland");
      else if (way.tags.natural === "scrub" || way.tags.natural === "heath") this.createRegion(way, nodes, "scrub");
      else if (way.tags.leisure === "park" || way.tags.landuse === "grass") this.createRegion(way, nodes, "park");
    }

    // D43: after OSM water has been classified, apply shallow basin modifiers
    // before roads/buildings/vegetation sample terrain heights. Water is now a
    // gameplay feature, not just a decal on top of grass.
    this.applyWaterTerrainInteractions();

    for (const way of osmData.elements ?? []) {
      if (way.type !== "way" || !way.tags) continue;
      if (way.tags.highway) this.createRoad(way, nodes);
      else if (way.tags.railway) this.createRailway(way, nodes);
      else if (way.tags.barrier || way.tags.man_made || way.tags.power || way.tags.military) this.createTacticalLineOrRegion(way, nodes);
    }

    this.createIntersectionPads();
    this.createExplicitOsmTreeNodes(osmData.elements ?? []);

    for (const way of osmData.elements ?? []) {
      if (way.type === "way" && way.tags?.building) this.createBuilding(way, nodes);
    }

    this.buildingLOD.flush();

    // D44-R: infer block-level residential fabric for inspector/classification only.
    // This does not replace or mutate road/building/vegetation source collections.
    this.buildInferredResidentialBlockZones();
    this.scatterResidentialCanopyClustersLOD();

    // D41: classify first, generate second, decorate third.
    // Existing passes still build their normal geometry, but we now create a
    // resolved classification index before debug overlays and vegetation décor.
    this.buildInferredResidentialGreenspaceZones();
    this.buildResolvedClassificationItems();

    this.injectSmallSliceReconstructionFramework();
    this.createGroundClassificationDebugOverlay();
    this.populateVegetationZonesLOD();
    this.scatterCanopyDiffusionLOD();
    this.scatterStreetTreesLOD();
    this.scatterResidentialGreenspaceTreesLOD();
    this.scatterExternalCanopyProbeLOD();
    this.scatterShorelineEcologyLOD();
    this.scatterWaterIslandBiomeLOD();
    this.scatterRiverbankTreesLOD();
    this.recordCanopyAuthorityDiagnostics();
    this.createCanopyGroundDarkening();
    this.createWaterTowerLandmarkIfSmallSlice();
    this.vegetationLOD.flush();
    this.createRoadsideProps();
    this.flushWorldDetailBatches();
  }

  clear({ preserveLayerVisibility = false } = {}) {
    this.group.clear();
    this.vegGroup.clear();
    this.clearGroundClassificationDebugOverlay();
    this.destruction?.clear();
    this.buildingLOD?.clear?.({ preserveVisibility: preserveLayerVisibility });
    this.vegetationLOD?.clear?.({ preserveVisibility: preserveLayerVisibility });
    this.buildingBoxes = [];
    this.roadSegments = [];
    this.roadJunctions = new Map();
    this.vegetationZones = [];
    this.naturalClassifiedItems = [];
    this.manMadeClassifiedItems = [];
    this.resolvedSurfaceItems = [];
    this.osmSurfaceFeatures = [];
    this.osmReplicaStats = this.createOsmReplicaStats();
    this.residentialGreenspaceZones = [];
    this.residentialBlockZones = [];
    this.waterSegments = [];
    this.waterMeshes = [];
    this.waterPolygons = [];
    this.waterIslands = [];
    this.waterFeatures = [];
    this.reconstructionZones = [];
    this.worldDetailStats = { fences: 0, driveways: 0, parkingPads: 0, roadsideProps: 0 };
    this.worldDetailBatches = this.createWorldDetailBatchState();
    this.buildingVisualBatches = new Map();
    this.canopyAuthorityStats = this.createCanopyAuthorityStats();
    this.buildingBatchStats = { queued: 0, meshes: 0 };
    this.buildingAttributionStats = this.createBuildingAttributionStats();
    this.riparianCorridorStats = { attempted: 0, accepted: 0 };
    this.generationStats = this.createGenerationStats();
  }




  createBuildingAttributionStats() {
    return {
      explicit: 0,
      inferred: 0,
      weakBuildingYes: 0,
      byContext: {},
      roofShapes: {},
      roofsGenerated: 0,
      roofedResidential: 0
    };
  }

  incrementBuildingAttribution(bucket, key = null) {
    if (!this.buildingAttributionStats) this.buildingAttributionStats = this.createBuildingAttributionStats();
    this.buildingAttributionStats[bucket] = (this.buildingAttributionStats[bucket] ?? 0) + 1;
    if (key) {
      this.buildingAttributionStats.byContext[key] = (this.buildingAttributionStats.byContext[key] ?? 0) + 1;
    }
  }

  createGenerationStats(osmData = null) {
    const elements = osmData?.elements ?? [];
    const ways = elements.filter((e) => e.type === "way");
    return {
      osmElements: elements.length,
      osmWays: ways.length,
      osmNodes: elements.filter((e) => e.type === "node").length,
      osmRoadWays: ways.filter((w) => !!w.tags?.highway).length,
      osmBuildingWays: ways.filter((w) => !!w.tags?.building).length,
      osmWaterWays: ways.filter((w) => w.tags?.natural === "water" || !!w.tags?.water || !!w.tags?.waterway).length,
      osmVegetationWays: ways.filter((w) => w.tags?.landuse === "forest" || w.tags?.natural === "wood" || w.tags?.natural === "wetland" || w.tags?.natural === "scrub" || w.tags?.natural === "heath" || w.tags?.leisure === "park" || w.tags?.landuse === "grass").length,
      osmSurfaceWays: ways.filter((w) => !!this.resolveOsmSurfaceType(w.tags ?? {})).length,
      osmParkingWays: ways.filter((w) => (w.tags?.amenity === "parking" || w.tags?.parking || w.tags?.landuse === "parking")).length,
      osmSportsWays: ways.filter((w) => w.tags?.leisure === "pitch" || !!w.tags?.sport).length
    };
  }

  getGenerationDiagnostics() {
    const treeStats = this.vegetationLOD?.getVegetationStats?.() ?? {};
    const buildingChunks = this.buildingLOD?.chunks?.size ?? 0;
    const vegetationChunks = this.vegetationLOD?.chunks?.size ?? 0;
    return {
      ...this.generationStats,
      terrainMeshes: this.terrain?.group?.children?.length ?? 1,
      waterFeatures: this.waterFeatures?.length ?? 0,
      waterPolygons: this.waterPolygons?.length ?? 0,
      roadSegments: this.roadSegments?.length ?? 0,
      roadJunctions: this.roadJunctions?.size ?? 0,
      buildings: this.buildingBoxes?.length ?? 0,
      buildingClassCounts: this.getBuildingClassCounts(),
      buildingAttributionStats: this.buildingAttributionStats ?? this.createBuildingAttributionStats(),
      buildingRoleCounts: this.getBuildingRoleCounts(),
      buildingChunks,
      vegetationZones: this.vegetationZones?.length ?? 0,
      treesRequested: treeStats.requested ?? 0,
      treesGenerated: treeStats.accepted ?? 0,
      treesCapped: treeStats.capped ?? 0,
      vegetationChunks,
      residentialBlocks: this.residentialBlockZones?.length ?? 0,
      residentialGreenspaces: this.residentialGreenspaceZones?.length ?? 0,
      riparianCandidates: this.riparianCorridorStats?.attempted ?? 0,
      riparianTrees: this.riparianCorridorStats?.accepted ?? 0,
      classificationFeatures: this.classificationDebugFeatures?.length ?? 0,
      props: (this.worldDetailStats?.fences ?? 0) + (this.worldDetailStats?.driveways ?? 0) + (this.worldDetailStats?.parkingPads ?? 0) + (this.worldDetailStats?.roadsideProps ?? 0),
      fences: this.worldDetailStats?.fences ?? 0,
      driveways: this.worldDetailStats?.driveways ?? 0,
      parkingPads: this.worldDetailStats?.parkingPads ?? 0,
      roadsideProps: this.worldDetailStats?.roadsideProps ?? 0,
      osmSurfacesRendered: this.osmReplicaStats?.surfaces ?? 0,
      osmParkingRendered: this.osmReplicaStats?.parking ?? 0,
      osmSportsRendered: this.osmReplicaStats?.sports ?? 0,
      osmTreeNodesRendered: this.osmReplicaStats?.treeNodes ?? 0,
      inferredResidentialCanopyTrees: this.osmReplicaStats?.inferredResidentialCanopyTrees ?? 0
    };
  }


  getBuildingClassCounts() {
    const counts = {};
    for (const building of this.buildingBoxes ?? []) {
      const key = building.profile?.kind ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  getBuildingRoleCounts() {
    const counts = {};
    for (const building of this.buildingBoxes ?? []) {
      const key = building.profile?.role ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  setGroundClassificationDebugVisible(visible) {
    if (this.classificationDebugGroup) this.classificationDebugGroup.visible = !!visible;
  }

  clearGroundClassificationDebugOverlay() {
    if (!this.classificationDebugGroup) return;
    for (const child of this.classificationDebugGroup.children) {
      child.traverse?.((obj) => {
        obj.geometry?.dispose?.();
        if (obj.material?.map) obj.material.map.dispose?.();
        obj.material?.dispose?.();
      });
    }
    this.classificationDebugGroup.clear();
    this.classificationDebugFeatures = [];
  }

  createGroundClassificationDebugOverlay() {
    if (!this.classificationDebugGroup) return;
    const wasVisible = this.classificationDebugGroup.visible;
    this.clearGroundClassificationDebugOverlay();
    this.classificationDebugGroup.visible = wasVisible;

    const features = [];
    for (const zone of this.vegetationZones) {
      features.push({
        polygon: zone.polygon,
        bounds: zone.bounds,
        type: zone.type,
        source: zone.source ?? "osm-ground-classification",
        tags: zone.tags ?? {},
        color: this.debugColorForClassification(zone.type)
      });
    }
    for (const water of this.waterPolygons) {
      features.push({
        polygon: water.points,
        bounds: water.bounds,
        type: water.tags?.waterway ?? water.tags?.water ?? "water",
        source: water.source ?? "osm-water",
        tags: water.tags ?? {},
        color: this.debugColorForClassification("water"),
        waterFeature: water.feature ?? null
      });
    }
    for (const zone of this.residentialBlockZones) {
      if (!zone?.polygon || !zone?.bounds) continue;
      features.push({
        polygon: zone.polygon,
        bounds: zone.bounds,
        type: zone.type ?? "residential-block",
        source: zone.source ?? "inferred-residential-block",
        tags: zone.tags ?? { inferred: "residential-block" },
        color: this.debugColorForClassification("residential-block")
      });
    }

    for (const zone of this.residentialGreenspaceZones) {
      if (!zone?.polygon || !zone?.bounds) continue;
      features.push({
        polygon: zone.polygon,
        bounds: zone.bounds,
        type: zone.type ?? "residential-greenspace",
        source: zone.source ?? "inferred-residential",
        tags: zone.tags ?? { inferred: "residential-greenspace" },
        color: this.debugColorForClassification("residential-greenspace")
      });
    }

    for (const zone of this.reconstructionZones) {
      if (!zone?.polygon || !zone?.bounds) continue;
      features.push({
        polygon: zone.polygon,
        bounds: zone.bounds,
        type: zone.type ?? "reconstruction",
        source: zone.source ?? "canopy-reconstruction",
        tags: { reconstruction: true },
        color: this.debugColorForClassification("reconstruction")
      });
    }

    this.classificationDebugFeatures = features.map((feature) => ({
      ...feature,
      area: Math.abs(THREE.ShapeUtils.area(feature.polygon ?? []))
    })).filter((feature) => feature.area >= 18);

    for (const feature of this.classificationDebugFeatures) this.addClassificationDebugFeature(feature);
    this.addClassificationChunkGrid();
  }

  debugColorForClassification(type) {
    if (type === "forest") return 0x0b5d1e;
    if (type === "park") return 0xfacc15;
    if (type === "wetland") return 0x0891b2;
    if (type === "scrub") return 0xf97316;
    if (type === "water" || type === "river" || type === "stream") return 0x38bdf8;
    if (type === "residential-block") return 0x84cc16;
    if (type === "residential-greenspace" || type === "residential") return 0xa3e635;
    if (type === "commercial" || type === "industrial") return 0xc084fc;
    if (type === "road" || type === "bridge") return 0x94a3b8;
    if (type === "building") return 0xf8fafc;
    if (type === "reconstruction") return 0xf97316;
    return 0xe5e7eb;
  }

  addClassificationDebugFeature({ polygon, bounds, type, source, tags, color }) {
    if (!polygon?.length || !bounds) return;
    const area = Math.abs(THREE.ShapeUtils.area(polygon));
    if (area < 18) return;

    const center = this.centroidForPolygon(polygon);
    // Keep debug fills just above the terrain, not at mid-building height.
    // D40.1: the first coverage overlay sat ~1.35m above the ground with
    // transparent depthWrite disabled. From tactical camera angles that plane
    // intersected building walls/foundations and made buildings appear to blink.
    const y = this.terrain.getHeight(center.x, center.y, this.centerLat, this.centerLon, this.scaleFactor) + 0.08;
    const group = new THREE.Group();
    group.userData = { layer: "classification-debug", feature: "ground-classification-polygon", type, source, tags, area };

    // D40: classification debug is now primarily color-coded polygon coverage.
    // Text labels are intentionally suppressed by default because they hide the
    // actual spatial relationship between OSM classes, water, roads, and canopy.
    const shape = new THREE.Shape(polygon);
    const fillGeo = new THREE.ShapeGeometry(shape);
    // D41: terrain-drape classification layers. ShapeGeometry is born flat in
    // local XY coordinates; rewrite every vertex to world X/Y/Z so debug color
    // coverage follows creek banks, ravines, and gorges instead of floating as a
    // single level sheet.
    const pos = fillGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getY(i);
      const h = this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor) + 0.09;
      pos.setXYZ(i, x, h, z);
    }
    pos.needsUpdate = true;
    fillGeo.computeVertexNormals();
    const fill = new THREE.Mesh(
      fillGeo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: type === "water" || type === "river" ? 0.26 : 0.20,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -20,
        polygonOffsetUnits: -20
      })
    );
    // Draw after terrain/water/roads for readability, but still respect the
    // depth buffer so buildings and other raised geometry occlude the overlay.
    fill.renderOrder = 18;
    fill.userData = { layer: "classification-debug", feature: "ground-classification-fill", type, source, tags, area };
    group.add(fill);

    const outlinePts = polygon.map((p) => new THREE.Vector3(p.x, this.terrain.getHeight(p.x, p.y, this.centerLat, this.centerLon, this.scaleFactor) + 0.20, p.y));
    outlinePts.push(outlinePts[0].clone());
    const outline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outlinePts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: true })
    );
    outline.renderOrder = 19;
    group.add(outline);

    this.classificationDebugGroup.add(group);
  }

  formatClassificationLabel(type, source, tags, area) {
    const tagParts = [];
    if (tags?.landuse) tagParts.push(`landuse=${tags.landuse}`);
    if (tags?.natural) tagParts.push(`natural=${tags.natural}`);
    if (tags?.leisure) tagParts.push(`leisure=${tags.leisure}`);
    if (tags?.waterway) tagParts.push(`waterway=${tags.waterway}`);
    if (tags?.water) tagParts.push(`water=${tags.water}`);
    const detail = tagParts.length ? tagParts.join(" · ") : source;
    return `${String(type).toUpperCase()}\n${detail}\n${Math.round(area).toLocaleString()} m²`;
  }

  createClassificationLabelSprite(text, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
    ctx.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 8;
    this.roundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 20);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = String(text).split("\n").slice(0, 3);
    lines.forEach((line, index) => ctx.fillText(line, canvas.width / 2, 52 + index * 48));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    return new THREE.Sprite(material);
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  addClassificationChunkGrid() {
    const chunkSize = this.vegetationLOD?.chunkSize ?? 180;
    const half = this.currentSize * 0.5;
    const points = [];
    const start = Math.floor(-half / chunkSize) * chunkSize;
    const end = Math.ceil(half / chunkSize) * chunkSize;
    const pushDrapedSegment = (ax, az, bx, bz, steps = 16) => {
      let prev = null;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const v = new THREE.Vector3(x, this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor) + 0.32, z);
        if (prev) points.push(prev, v);
        prev = v;
      }
    };
    for (let x = start; x <= end; x += chunkSize) pushDrapedSegment(x, -half, x, half);
    for (let z = start; z <= end; z += chunkSize) pushDrapedSegment(-half, z, half, z);
    const grid = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false, depthTest: true })
    );
    grid.userData = { layer: "classification-debug", feature: "vegetation-lod-chunk-grid", chunkSize };
    grid.renderOrder = 17;
    this.classificationDebugGroup.add(grid);
  }



  getClassificationDebugAtPoint(point) {
    if (!point) return null;
    const p = new THREE.Vector2(point.x, point.z);
    const candidates = [];

    for (const feature of this.classificationDebugFeatures ?? []) {
      if (!feature?.polygon?.length) continue;
      const b = feature.bounds;
      if (b && (p.x < b.minX || p.x > b.maxX || p.y < b.minZ || p.y > b.maxZ)) continue;
      if (this.isPointInPolygon(p, feature.polygon)) candidates.push(feature);
    }

    candidates.sort((a, b) => {
      const aw = this.debugClassificationPriority(a.type);
      const bw = this.debugClassificationPriority(b.type);
      if (aw !== bw) return bw - aw;
      return (a.area ?? Infinity) - (b.area ?? Infinity);
    });

    let primary = candidates[0] ?? null;
    const inferred = primary ? null : this.inferClassifiedItemAtPoint(p);
    if (!primary && inferred) primary = inferred;
    const groundClass = primary?.type ?? "unknown";
    const waterBuffer = this.isInWater(p, 5.5);
    const buildingBuffer = this.isInBuildingExclusion(p);
    const roadBuffer = this.isInRoadExclusion(p);
    const smartEligible = !waterBuffer && !buildingBuffer && !roadBuffer && Math.abs(point.x) <= this.currentSize / 2 && Math.abs(point.z) <= this.currentSize / 2;
    const canopyScore = this.getExternalCanopyScoreAt(point.x, point.z);
    const canopyThreshold = this.canopyThresholdForContext(groundClass);
    const canopyEligible = canopyScore == null ? null : canopyScore >= canopyThreshold;
    const vegetationEligible = smartEligible && (canopyEligible !== false);

    let reason = "Accepted by current rules";
    if (!primary) reason = "No OSM classification polygon here";
    else if (primary.source === "inferred-residential") reason = buildingBuffer ? "Rejected by building footprint" : "Residential greenspace inferred from nearby homes/canopy";
    else if (primary.source === "inferred-residential-block") reason = buildingBuffer ? "Rejected by building footprint" : "Residential block inferred from clustered homes";
    else if (waterBuffer) reason = "Rejected by water buffer";
    else if (roadBuffer) reason = "Rejected by road buffer";
    else if (buildingBuffer) reason = "Rejected by building footprint";
    else if (canopyEligible === false) reason = "Rejected by canopy authority";

    const chunkSize = this.vegetationLOD?.chunkSize ?? 180;
    const chunk = `${Math.floor(point.x / chunkSize)}:${Math.floor(point.z / chunkSize)}`;

    return {
      position: { x: point.x, z: point.z },
      groundClass,
      source: primary?.source ?? "none",
      tags: primary?.tags ?? {},
      area: primary?.area ?? 0,
      overlapping: candidates.slice(0, 6).map((f) => ({ type: f.type, area: f.area ?? 0, tags: f.tags ?? {} })),
      vegetationEligible,
      reason,
      exclusions: { waterBuffer, roadBuffer, buildingBuffer },
      canopyScore,
      canopyThreshold,
      canopyEligible,
      chunk,
      water: primary?.waterFeature ? this.formatWaterInspection(primary.waterFeature, point) : null,
      terrain: this.formatTerrainInspection(point),
      ruleTrace: this.buildClassificationRuleTrace(primary, { waterBuffer, roadBuffer, buildingBuffer, canopyScore, canopyThreshold, vegetationEligible, reason })
    };
  }


  formatWaterInspection(feature, point) {
    if (!feature) return null;
    return {
      type: feature.waterType ?? "water",
      surfaceElevation: feature.surfaceElevation,
      terrainMin: feature.terrainMin,
      terrainMax: feature.terrainMax,
      terrainAvg: feature.terrainAvg,
      estimatedDepth: feature.estimatedDepth,
      actualDepth: feature.actualDepth ?? Math.max(0, (feature.surfaceElevation ?? 0) - (feature.terrainMin ?? 0)),
      flowSpeed: feature.flowSpeed,
      flowVector: feature.flowVector ?? { x: 0, z: 0 },
      terrainModified: !!feature.terrainModified,
      pointDepth: Math.max(0, (feature.surfaceElevation ?? 0) - (this.terrain?.getWorldHeight?.(point.x, point.z) ?? 0))
    };
  }

  formatTerrainInspection(point) {
    const base = this.terrain?.getRawHeight?.(point.x, point.z, this.centerLat, this.centerLon, this.scaleFactor) * (this.terrain?.heightExaggeration ?? 1);
    const final = this.terrain?.getWorldHeight?.(point.x, point.z) ?? point.y ?? 0;
    return {
      baseHeight: Number.isFinite(base) ? base : final,
      finalHeight: final,
      modifierDelta: Number.isFinite(base) ? final - base : 0
    };
  }

  debugClassificationPriority(type) {
    if (type === "water" || type === "river" || type === "stream") return 100;
    if (type === "wetland") return 80;
    if (type === "forest") return 70;
    if (type === "scrub") return 65;
    if (type === "residential-greenspace" || type === "residential") return 55;
    if (type === "residential-block") return 52;
    if (type === "park") return 50;
    if (type === "reconstruction") return 40;
    return 10;
  }

  isInRoadExclusion(p) {
    for (const r of this.roadSegments) {
      const buffer = Math.max(8, (r.width ?? 5) + 3);
      if (this.distToSegment(p, r.a, r.b) < buffer) return true;
    }
    return false;
  }

  isInBuildingExclusion(p) {
    for (const b of this.buildingBoxes) {
      if (p.distanceTo(b.center) < 60 && this.isPointInPolygon(p, b.points)) return true;
    }
    return false;
  }

  buildClassificationRuleTrace(feature, status) {
    if (!feature) return ["No containing OSM feature", "Ground class: UNKNOWN", status.reason];
    const tag = this.primaryDebugTag(feature.tags);
    const trace = [
      tag ? `OSM tag: ${tag}` : `OSM source: ${feature.source ?? "unknown"}`,
      `Ground class: ${String(feature.type ?? "unknown").toUpperCase()}`,
      this.vegetationIntentForClass(feature.type),
      `Canopy threshold: ${status.canopyThreshold?.toFixed?.(2) ?? "n/a"}`,
      status.reason
    ];
    return trace;
  }

  primaryDebugTag(tags = {}) {
    for (const key of ["natural", "landuse", "leisure", "waterway", "water", "building", "highway"]) {
      if (tags?.[key]) return `${key}=${tags[key]}`;
    }
    return null;
  }

  vegetationIntentForClass(type) {
    if (type === "forest") return "Vegetation rule: dense woodland candidates";
    if (type === "wetland") return "Vegetation rule: wetland/reed/riparian candidates";
    if (type === "scrub") return "Vegetation rule: shrub and small-tree candidates";
    if (type === "park") return "Vegetation rule: sparse park/open-space candidates";
    if (type === "residential-block") return "Classification rule: inferred residential block; decoration not changed in D44-R";
    if (type === "residential-greenspace" || type === "residential") return "Vegetation rule: sparse yard/street décor candidates";
    if (type === "water" || type === "river" || type === "stream") return "Water rule: surface only; depth/flow handled by WaterFeature";
    return "Vegetation rule: no explicit class rule";
  }

  buildResolvedClassificationItems() {
    // D41 architectural index: source data is normalized into classified items,
    // then generators/decorators consume that resolved intent. This is initially
    // diagnostic, but gives us a single place to tune priorities.
    this.naturalClassifiedItems = [
      ...this.vegetationZones.map((z) => ({ kind: "natural", type: z.type, polygon: z.polygon, bounds: z.bounds, tags: z.tags ?? {}, source: z.source ?? "osm-ground-classification" })),
      ...this.waterPolygons.map((w) => ({ kind: "natural", type: "water", polygon: w.points, bounds: w.bounds, tags: w.tags ?? {}, source: w.source ?? "osm-water" }))
    ];
    this.manMadeClassifiedItems = [
      ...this.roadSegments.map((r) => ({ kind: "manmade", type: r.bridge ? "bridge" : "road", line: [r.a, r.b], tags: { highway: r.highway, bridge: r.bridge || undefined }, source: "osm-road" })),
      ...this.buildingBoxes.map((b) => ({ kind: "manmade", type: "building", polygon: b.points, bounds: this.boundsForPolygon(b.points), tags: b.tags ?? {}, source: "osm-building" })),
      ...this.residentialBlockZones.map((z) => ({ kind: "manmade-inferred", type: "residential-block", polygon: z.polygon, bounds: z.bounds, tags: z.tags ?? {}, source: z.source })),
      ...this.residentialGreenspaceZones.map((z) => ({ kind: "manmade-decoration", type: "residential-greenspace", polygon: z.polygon, bounds: z.bounds, tags: z.tags ?? {}, source: z.source }))
    ];
    this.resolvedSurfaceItems = [
      ...this.naturalClassifiedItems,
      ...this.manMadeClassifiedItems
    ];
  }


  buildInferredResidentialBlockZones() {
    this.residentialBlockZones = [];
    const homeLike = this.buildingBoxes.filter((b) => {
      const tag = String(b.tags?.building ?? "").toLowerCase();
      const kind = String(b.profile?.kind ?? "").toLowerCase();
      if (["commercial", "industrial", "retail", "warehouse"].includes(tag) || kind === "industrial") return false;
      return (b.area ?? 0) > 18 && (b.area ?? 0) < 900;
    });
    const used = new Set();
    const limit = this.currentSize * 0.5;
    const maxBlocks = 90;
    for (let i = 0; i < homeLike.length && this.residentialBlockZones.length < maxBlocks; i++) {
      if (used.has(i)) continue;
      const seed = homeLike[i];
      const cluster = [];
      for (let j = 0; j < homeLike.length; j++) {
        if (used.has(j)) continue;
        const other = homeLike[j];
        const d = seed.center.distanceTo(other.center);
        if (d <= 115) cluster.push({ index: j, building: other });
      }
      if (cluster.length < 3) continue;
      cluster.forEach((c) => used.add(c.index));
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const { building } of cluster) {
        const bb = this.boundsForPolygon(building.points);
        minX = Math.min(minX, bb.minX);
        minZ = Math.min(minZ, bb.minZ);
        maxX = Math.max(maxX, bb.maxX);
        maxZ = Math.max(maxZ, bb.maxZ);
      }
      const pad = THREE.MathUtils.clamp(24 + cluster.length * 2.2, 28, 64);
      minX = Math.max(-limit, minX - pad);
      minZ = Math.max(-limit, minZ - pad);
      maxX = Math.min(limit, maxX + pad);
      maxZ = Math.min(limit, maxZ + pad);
      if (maxX - minX < 45 || maxZ - minZ < 45) continue;
      const polygon = [new THREE.Vector2(minX, minZ), new THREE.Vector2(maxX, minZ), new THREE.Vector2(maxX, maxZ), new THREE.Vector2(minX, maxZ)];
      const center = this.centroidForPolygon(polygon);
      if (this.findContainingNaturalClass(center)) continue;
      this.residentialBlockZones.push({
        polygon,
        bounds: { minX, maxX, minZ, maxZ },
        type: "residential-block",
        source: "inferred-residential-block",
        tags: { inferred: "residential-block", rule: "clustered-home-like-buildings", buildingCount: String(cluster.length) },
        buildings: cluster.map((c) => c.building)
      });
    }
  }

  buildInferredResidentialGreenspaceZones() {
    this.residentialGreenspaceZones = [];
    const homeLike = this.buildingBoxes.filter((b) => {
      const kind = b.profile?.kind ?? "";
      const buildingTag = b.tags?.building;
      return b.area < 650 && !["commercial", "industrial", "retail", "warehouse"].includes(buildingTag) && kind !== "industrial";
    });
    const limit = this.currentSize * 0.5;
    const maxZones = 260;
    for (const b of homeLike.slice(0, maxZones)) {
      const bb = this.boundsForPolygon(b.points);
      const pad = THREE.MathUtils.clamp(Math.sqrt(Math.max(40, b.area)) * 0.72, 10, 22);
      const minX = Math.max(-limit, bb.minX - pad);
      const maxX = Math.min(limit, bb.maxX + pad);
      const minZ = Math.max(-limit, bb.minZ - pad);
      const maxZ = Math.min(limit, bb.maxZ + pad);
      if (maxX - minX < 8 || maxZ - minZ < 8) continue;
      const polygon = [new THREE.Vector2(minX, minZ), new THREE.Vector2(maxX, minZ), new THREE.Vector2(maxX, maxZ), new THREE.Vector2(minX, maxZ)];
      const center = this.centroidForPolygon(polygon);
      // Do not paint residential greenspace over explicit natural/water classes;
      // this fallback is for UNKNOWN urban fabric around homes.
      if (this.findContainingNaturalClass(center)) continue;
      const bounds = { minX, maxX, minZ, maxZ };
      this.residentialGreenspaceZones.push({
        polygon,
        bounds,
        type: "residential-greenspace",
        source: "inferred-residential",
        tags: { inferred: "residential-greenspace", rule: "near-building-unknown-urban-fabric" },
        building: b
      });
    }
  }

  findContainingNaturalClass(p) {
    for (const w of this.waterPolygons) {
      if (w.bounds && (p.x < w.bounds.minX || p.x > w.bounds.maxX || p.y < w.bounds.minZ || p.y > w.bounds.maxZ)) continue;
      if (this.isPointInPolygon(p, w.points)) return { type: "water", source: w.source ?? "osm-water", tags: w.tags ?? {}, polygon: w.points, bounds: w.bounds, area: Math.abs(THREE.ShapeUtils.area(w.points ?? [])) };
    }
    for (const z of this.vegetationZones) {
      if (z.bounds && (p.x < z.bounds.minX || p.x > z.bounds.maxX || p.y < z.bounds.minZ || p.y > z.bounds.maxZ)) continue;
      if (this.isPointInPolygon(p, z.polygon)) return { type: z.type, source: z.source ?? "osm-ground-classification", tags: z.tags ?? {}, polygon: z.polygon, bounds: z.bounds, area: Math.abs(THREE.ShapeUtils.area(z.polygon ?? [])) };
    }
    return null;
  }

  inferClassifiedItemAtPoint(p) {
    for (const z of this.residentialGreenspaceZones ?? []) {
      if (z.bounds && (p.x < z.bounds.minX || p.x > z.bounds.maxX || p.y < z.bounds.minZ || p.y > z.bounds.maxZ)) continue;
      if (!this.isPointInPolygon(p, z.polygon)) continue;
      return {
        type: "residential-greenspace",
        source: "inferred-residential",
        tags: z.tags ?? {},
        area: Math.abs(THREE.ShapeUtils.area(z.polygon ?? [])),
        polygon: z.polygon,
        bounds: z.bounds
      };
    }
    for (const z of this.residentialBlockZones ?? []) {
      if (z.bounds && (p.x < z.bounds.minX || p.x > z.bounds.maxX || p.y < z.bounds.minZ || p.y > z.bounds.maxZ)) continue;
      if (!this.isPointInPolygon(p, z.polygon)) continue;
      return {
        type: "residential-block",
        source: "inferred-residential-block",
        tags: z.tags ?? {},
        area: Math.abs(THREE.ShapeUtils.area(z.polygon ?? [])),
        polygon: z.polygon,
        bounds: z.bounds
      };
    }
    return null;
  }

  scatterResidentialGreenspaceTreesLOD() {
    const positions = [];
    const remaining = this.vegetationLOD?.getRemainingTreeBudget?.() ?? 0;
    if (remaining <= 0) return;
    const zones = this.residentialGreenspaceZones ?? [];
    for (const zone of zones) {
      const b = zone.bounds;
      const area = Math.abs(THREE.ShapeUtils.area(zone.polygon ?? []));
      const attempts = Math.max(2, Math.min(8, Math.floor(area / 95)));
      for (let i = 0; i < attempts; i++) {
        const x = b.minX + this.rng.next() * (b.maxX - b.minX);
        const z = b.minZ + this.rng.next() * (b.maxZ - b.minZ);
        const p = new THREE.Vector2(x, z);
        if (!this.isPointInPolygon(p, zone.polygon)) continue;
        if (!this.isSmartLocation(x, z)) continue;
        const score = this.getExternalCanopyScoreAt(x, z);
        const threshold = this.canopyThresholdForContext("residential-greenspace");
        const noise = this.deterministicCanopyNoise(x, z, 41);
        const allowedByCanopy = score == null ? noise < 0.28 : score >= threshold || (score >= threshold * 0.72 && noise < 0.38);
        if (!allowedByCanopy) continue;
        positions.push({ x, z, clump: noise < 0.16 ? 2 : 1, sizeBand: 0.82 + noise * 0.55 });
        if (positions.length >= Math.min(remaining, 120)) break;
      }
      if (positions.length >= Math.min(remaining, 120)) break;
    }
    this.vegetationLOD.scatterIndividual({
      positions,
      zoneType: "park",
      lat: this.centerLat,
      lon: this.centerLon,
      rng: this.rng,
      isValidLocation: (x, z) => this.isVegetationPlacementLocation(x, z, "residential-greenspace")
    });
  }

  createWorldDetailBatchState() {
    return {
      fenceRails: [],
      fencePosts: [],
      drivewaySurfaces: [],
      parkingSurfaces: [],
      parkedCars: []
    };
  }

  project(lat, lon) {
    return new THREE.Vector2(
      (lon - this.centerLon) * (this.scaleFactor * Math.cos((this.centerLat * Math.PI) / 180)),
      -(lat - this.centerLat) * this.scaleFactor
    );
  }

  getWayPoints(way, nodes) {
    const points = [];
    for (const id of way.nodes ?? []) {
      if (nodes[id]) points.push(this.project(nodes[id].lat, nodes[id].lon));
    }
    return points;
  }

  createBuilding(way, nodes) {
    const rawPts = this.getWayPoints(way, nodes);
    if (rawPts.length < 3) return;

    // Keep building geometry inside the playable/rendered square. OSM ways can
    // cross the requested bbox, and without clipping the LOD manager may render
    // partial neighborhoods beyond the orange boundary.
    const pts = this.clipPolygonToBounds(rawPts, this.currentSize * 0.5);
    if (pts.length < 3) return;

    const footprint = this.normalizeFootprint(pts);
    if (footprint.length < 3) return;

    const center = footprint.reduce((sum, point) => sum.add(point), new THREE.Vector2()).divideScalar(footprint.length);
    const terrainRange = this.sampleFootprintTerrainRange(footprint, center);
    // Use a single flat building base, but choose the high side of the footprint
    // so houses on slopes do not visibly hover.  The foundation skirt added below
    // reaches down to the low side of the terrain.
    const terrainH = terrainRange.baseH;
    const area = Math.abs(THREE.ShapeUtils.area(footprint));
    const profile = this.resolveBuildingProfile(way.tags, area, footprint, center);
    const shape = this.createShapeFromFootprint(footprint);

    const wallMaterial = this.pickBuildingWallMaterial(profile);
    const roofMaterial = this.pickBuildingRoofMaterial(profile);

    const walls = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: profile.height, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 }),
      wallMaterial
    );
    walls.rotateX(Math.PI / 2);
    walls.position.y = terrainH + profile.height;
    walls.castShadow = true;
    walls.receiveShadow = true;
    walls.userData = { feature: "building-walls", tags: way.tags, damagePart: "walls" };

    const roofGroup = this.createBuildingRoof(shape, footprint, center, terrainH, profile, roofMaterial);
    const detailGroup = this.createRooftopDetails(center, footprint, terrainH + profile.height, profile);

    const buildingGroup = new THREE.Group();
    const visualDetails = this.createBuildingVisualDetails(footprint, center, terrainH, profile);
    buildingGroup.add(walls, roofGroup, detailGroup, visualDetails);
    buildingGroup.userData = {
      feature: "building",
      tags: way.tags,
      profile,
      osmId: way.id,
      source: "osm-exact-footprint",
      replicaFootprint: true
    };

    // Register with LOD manager for multi-level detail
    this.buildingLOD.register({
      fullDetail: buildingGroup,
      footprint,
      center,
      terrainH,
      profile,
      area
    });

    this.createBuildingGroundDetails(`building:${way.id}`, footprint, center, terrainH, profile, area, way.tags);

    const worldCenter = new THREE.Vector3(center.x, terrainH + profile.height / 2, center.y);
    this.destruction?.register({
      id: `building:${way.id}`,
      category: "building",
      meshes: [walls, roofGroup, detailGroup, visualDetails],
      position: worldCenter,
      bounds: { radius: Math.sqrt(area / Math.PI), height: profile.height },
      maxHealth: profile.health,
      tags: { ...way.tags, profile: profile.kind, buildingClass: profile.className, role: profile.role, roofShape: profile.roofShape }
    });
    this.buildingBoxes.push({ points: footprint, center, area, profile, tags: way.tags, osmId: way.id, source: "osm-exact-footprint" });
  }

  shouldBatchBuildingVisuals(profile, area) {
    // Phase 9D: merge the thousands of small residential structures that dominate
    // suburban maps. Larger/commercial buildings remain individual so their
    // destruction visuals still read well at close range.
    return profile?.kind === "residential" && area < 950 && profile.height < 11;
  }

  buildingBatchKey(material, profile, center) {
    const chunkSize = 220;
    const cx = Math.floor(center.x / chunkSize);
    const cz = Math.floor(center.y / chunkSize);
    const materialKey = material?.uuid ?? material?.name ?? "default";
    const visualClass = profile?.roofShape === "flat" ? "flat" : "pitched";
    return `${cx}:${cz}:${materialKey}:${visualClass}`;
  }

  queueBuildingVisualBatch(buildingGroup, profile, center) {
    buildingGroup.updateMatrixWorld(true);
    const scratch = [];
    buildingGroup.traverse((child) => {
      if (!child.isMesh || !child.geometry || !child.material) return;
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      scratch.push({ geometry, material: child.material });
    });

    for (const entry of scratch) {
      const key = this.buildingBatchKey(entry.material, profile, center);
      if (!this.buildingVisualBatches.has(key)) {
        this.buildingVisualBatches.set(key, {
          key,
          material: entry.material,
          geometries: [],
          count: 0
        });
      }
      const batch = this.buildingVisualBatches.get(key);
      batch.geometries.push(entry.geometry);
      batch.count += 1;
    }

    this.buildingBatchStats.queued += 1;
  }

  flushBuildingVisualBatches() {
    for (const batch of this.buildingVisualBatches.values()) {
      if (!batch.geometries.length) continue;
      const merged = this.safeMergeGeometries(batch.geometries);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, batch.material);
      mesh.userData = {
        feature: "building-batch",
        perfLayer: "buildings",
        batched: true,
        count: batch.count,
        sourceBuildings: this.buildingBatchStats.queued
      };
      this.group.add(mesh);
      this.buildingBatchStats.meshes += 1;
    }

    // Allow the temporary source geometries to be garbage-collected after the
    // merged chunk meshes have been created.
    this.buildingVisualBatches.clear();
  }

  createShapeFromFootprint(footprint) {
    // D56: keep the OSM way geometry as the source of truth.  This helper is
    // intentionally small, but centralizes shape creation so roofs, slabs,
    // debug metadata, and future destruction states all derive from the same
    // exact polygon instead of from a bounding rectangle.
    const shape = new THREE.Shape();
    footprint.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    return shape;
  }

  normalizeFootprint(points) {
    const cleaned = points.filter((point, index, array) => {
      const previous = array[index - 1];
      return !previous || point.distanceTo(previous) > 0.2;
    });
    if (cleaned.length > 2 && cleaned[0].distanceTo(cleaned[cleaned.length - 1]) < 0.2) cleaned.pop();
    return cleaned;
  }

  normalizeBuildingValue(value) {
    return String(value ?? "yes").toLowerCase().trim();
  }

  resolveBuildingClass(tags = {}, area = 100, footprint = null, center = null) {
    const building = this.normalizeBuildingValue(tags.building);
    const amenity = this.normalizeBuildingValue(tags.amenity);
    const shop = this.normalizeBuildingValue(tags.shop);
    const landuse = this.normalizeBuildingValue(tags.landuse);
    const power = this.normalizeBuildingValue(tags.power);
    const manMade = this.normalizeBuildingValue(tags.man_made);
    const military = this.normalizeBuildingValue(tags.military);

    const civicAmenities = new Set(["school", "college", "university", "library", "townhall", "community_centre", "hospital", "clinic", "police", "fire_station", "place_of_worship", "courthouse", "post_office"]);
    const civicBuildings = new Set(["school", "civic", "public", "hospital", "church", "cathedral", "chapel", "mosque", "synagogue", "temple", "university", "college", "kindergarten"]);
    const garageBuildings = new Set(["garage", "garages", "carport", "shed", "hut", "roof", "greenhouse"]);
    const agriculturalBuildings = new Set(["barn", "farm_auxiliary", "stable", "cowshed", "sty", "slurry_tank"]);
    const industrialBuildings = new Set(["industrial", "warehouse", "hangar", "manufacture", "factory", "depot", "storage_tank"]);
    const commercialBuildings = new Set(["commercial", "retail", "supermarket", "office", "hotel", "kiosk", "service", "train_station", "transportation"]);
    const apartmentBuildings = new Set(["apartments", "dormitory", "residential"]);
    const houseBuildings = new Set(["house", "detached", "semidetached_house", "terrace", "bungalow", "cabin", "static_caravan", "yes"]);
    const utilityBuildings = new Set(["service", "transformer_tower", "water_tower", "digester", "utility", "storage_tank"]);
    const weakBuilding = !building || building === "yes" || building === "building";

    const explicitResult = (result) => {
      this.incrementBuildingAttribution("explicit");
      return { ...result, attribution: "explicit" };
    };
    const inferredResult = (result, reason) => {
      this.incrementBuildingAttribution("inferred", reason);
      if (weakBuilding) this.incrementBuildingAttribution("weakBuildingYes");
      return { ...result, attribution: "inferred", attributionReason: reason };
    };

    if (military !== "yes" || building === "bunker") return explicitResult({ kind: "military", className: building === "bunker" ? "bunker" : "military", role: "military", visual: "hardened" });
    if (power !== "yes" || manMade === "works" || manMade === "water_works" || manMade === "wastewater_plant" || utilityBuildings.has(building)) return explicitResult({ kind: "utility", className: power !== "yes" ? `power:${power}` : "utility", role: "infrastructure", visual: "utility" });
    if (industrialBuildings.has(building) || landuse === "industrial") return explicitResult({ kind: "industrial", className: building === "yes" ? "industrial" : building, role: "tactical", visual: building === "warehouse" ? "warehouse" : "industrial" });
    if (civicBuildings.has(building) || civicAmenities.has(amenity)) return explicitResult({ kind: "civic", className: amenity !== "yes" ? amenity : building, role: "tactical", visual: "civic" });
    if (commercialBuildings.has(building) || shop !== "yes") return explicitResult({ kind: "commercial", className: shop !== "yes" ? `shop:${shop}` : building, role: "tactical", visual: "commercial" });
    if (apartmentBuildings.has(building) && area > 260) return explicitResult({ kind: "apartments", className: building, role: "civilian", visual: "apartments" });
    if (agriculturalBuildings.has(building)) return explicitResult({ kind: "agricultural", className: building, role: "civilian", visual: "agricultural" });
    if (garageBuildings.has(building) || area < 40) return explicitResult({ kind: "garage", className: building, role: "civilian", visual: "outbuilding" });

    // D57: Microsoft building footprints often arrive as building=yes.  The
    // footprint is accurate, but the type is missing.  Use surrounding OSM
    // context to avoid turning every real-world commercial parcel into a house.
    if (weakBuilding) {
      const contextual = this.inferWeakBuildingClassFromContext(tags, area, footprint, center);
      if (contextual) return inferredResult(contextual.result, contextual.reason);
    }

    if (houseBuildings.has(building)) return explicitResult({ kind: "residential", className: building === "yes" ? "unclassified-building" : building, role: "civilian", visual: "house" });
    const fallback = area > 900
      ? { kind: "commercial", className: building, role: "tactical", visual: "generic-large" }
      : { kind: "residential", className: building, role: "civilian", visual: "generic-small" };
    return weakBuilding ? inferredResult(fallback, area > 900 ? "large-generic-footprint" : "small-generic-footprint") : explicitResult(fallback);
  }

  inferWeakBuildingClassFromContext(tags = {}, area = 100, footprint = null, center = null) {
    const ctx = this.getBuildingContext(footprint, center);
    if (area < 42) return { reason: "small-outbuilding-footprint", result: { kind: "garage", className: "inferred-garage", role: "civilian", visual: "outbuilding" } };

    if (ctx.nearIndustrialSurface || area > 1800) {
      return { reason: ctx.nearIndustrialSurface ? "near-industrial-landuse" : "very-large-footprint", result: { kind: "industrial", className: "inferred-industrial", role: "tactical", visual: "industrial" } };
    }

    if (ctx.insideParking || ctx.nearParkingAisle || ctx.nearParkingSurface) {
      if (area > 180) return { reason: ctx.insideParking ? "inside-parking-parcel" : "near-parking-context", result: { kind: "commercial", className: "inferred-commercial", role: "tactical", visual: "commercial" } };
      return { reason: "parking-access-outbuilding", result: { kind: "garage", className: "inferred-service-garage", role: "civilian", visual: "outbuilding" } };
    }

    if (ctx.nearMajorRoad && area > 260) {
      return { reason: "near-major-road", result: { kind: "commercial", className: "inferred-roadside-commercial", role: "tactical", visual: "commercial" } };
    }

    if (area > 700 && ctx.nearServiceRoad) {
      return { reason: "large-service-road-footprint", result: { kind: "commercial", className: "inferred-service-commercial", role: "tactical", visual: "commercial" } };
    }

    if (area > 420 && !ctx.nearResidentialRoad) {
      return { reason: "large-nonresidential-context", result: { kind: "commercial", className: "inferred-commercial", role: "tactical", visual: "commercial" } };
    }

    if (area < 115 && ctx.nearResidentialRoad) {
      return { reason: "small-residential-accessory", result: { kind: "garage", className: "inferred-garage", role: "civilian", visual: "outbuilding" } };
    }

    return { reason: "residential-block-default", result: { kind: "residential", className: "inferred-house", role: "civilian", visual: "house" } };
  }

  getBuildingContext(footprint = null, center = null) {
    const c = center ?? this.centroidForPolygon(footprint ?? []);
    const ctx = {
      insideParking: false,
      nearParkingSurface: false,
      nearIndustrialSurface: false,
      nearParkingAisle: false,
      nearMajorRoad: false,
      nearServiceRoad: false,
      nearResidentialRoad: false
    };

    for (const surface of this.osmSurfaceFeatures ?? []) {
      const dist = this.distanceToBounds(c, surface.bounds);
      if (surface.surfaceType === "parking") {
        if (this.isPointInPolygon(c, surface.polygon)) ctx.insideParking = true;
        if (dist < 38) ctx.nearParkingSurface = true;
      }
      if (["developed-land", "asphalt", "concrete"].includes(surface.surfaceType) && dist < 42) {
        const landuse = String(surface.tags?.landuse ?? "").toLowerCase();
        if (landuse === "industrial") ctx.nearIndustrialSurface = true;
      }
    }

    for (const road of this.roadSegments ?? []) {
      const distance = this.distToSegment(c, road.a, road.b);
      if (distance > 70) continue;
      const highway = String(road.highway ?? "").toLowerCase();
      const service = String(road.tags?.service ?? "").toLowerCase();
      if (service === "parking_aisle" && distance < 38) ctx.nearParkingAisle = true;
      if (["primary", "secondary", "tertiary"].includes(highway) && distance < 55) ctx.nearMajorRoad = true;
      if (highway === "service" && distance < 42) ctx.nearServiceRoad = true;
      if (["residential", "living_street"].includes(highway) && distance < 60) ctx.nearResidentialRoad = true;
    }
    return ctx;
  }

  distanceToBounds(point, bounds) {
    if (!point || !bounds) return Infinity;
    const dx = point.x < bounds.minX ? bounds.minX - point.x : point.x > bounds.maxX ? point.x - bounds.maxX : 0;
    const dz = point.y < bounds.minZ ? bounds.minZ - point.y : point.y > bounds.maxZ ? point.y - bounds.maxZ : 0;
    return Math.sqrt(dx * dx + dz * dz);
  }

  resolveBuildingProfile(tags = {}, area = 100, footprint = null, center = null) {
    const classification = this.resolveBuildingClass(tags, area, footprint, center);
    let height = 5;
    const levels = Number.parseFloat(tags["building:levels"] ?? tags.levels);
    const explicitHeight = Number.parseFloat(tags.height);

    if (Number.isFinite(explicitHeight) && explicitHeight > 0) height = explicitHeight;
    else if (Number.isFinite(levels) && levels > 0) height = levels * 3.3 + 1.2;
    else if (classification.kind === "garage") height = 2.8 + this.rng.next() * 0.9;
    else if (classification.kind === "agricultural") height = area > 400 ? 7.8 : 5.8;
    else if (classification.kind === "industrial") height = area > 1600 ? 12.5 : area > 700 ? 9.5 : 7.5;
    else if (classification.kind === "utility") height = area > 500 ? 8.5 : 5.6;
    else if (classification.kind === "civic") height = area > 1500 ? 14 : area > 700 ? 10.5 : 7.5;
    else if (classification.kind === "commercial") height = area > 1200 ? 15 : area > 450 ? 10.5 : 7.2;
    else if (classification.kind === "apartments") height = area > 900 ? 16 : 11;
    else if (classification.kind === "military") height = classification.className === "bunker" ? 3.8 : 7.5;
    else if (area > 1800) height = 15;
    else if (area > 800) height = 9;
    else height = 4.4 + this.rng.next() * 1.8;

    height = Math.max(2.4, Math.min(70, height));

    const roofTagRaw = tags.roof?.shape ?? tags["roof:shape"];
    const roofTag = this.normalizeRoofShape(roofTagRaw);
    let roofShape = roofTag || "flat";

    // D56.1 hotfix: residential roofs must be visually present.  Many OSM
    // residential homes either omit roof tags or use weak/generic values.  In
    // those cases we force a pitched silhouette instead of allowing the house
    // to collapse back into a beige flat-topped box.
    const isLowRiseResidential = classification.kind === "residential" && area < 1400 && height < 13;
    if (isLowRiseResidential && (!roofTag || roofTag === "flat" || roofTag === "yes" || roofTag === "unknown")) {
      roofShape = this.selectResidentialRoofShape(area);
    } else if (!roofTag) {
      if (classification.kind === "agricultural" && area < 1200 && height < 11) roofShape = this.rng.next() > 0.42 ? "gable" : "hipped";
      else if (classification.kind === "garage" && area < 130) roofShape = this.rng.next() > 0.55 ? "gable" : "flat";
      else if (classification.kind === "industrial") roofShape = this.rng.next() > 0.62 ? "sawtooth" : "flat";
      else roofShape = "flat";
    }

    const materialClass = classification.kind === "industrial" ? "steel-concrete"
      : classification.kind === "utility" ? "concrete-utility"
        : classification.kind === "military" ? "hardened-concrete"
          : classification.kind === "garage" ? "light-frame"
            : classification.kind === "agricultural" ? "wood-metal"
              : ["commercial", "civic", "apartments"].includes(classification.kind) ? "masonry-concrete" : "wood-masonry";

    const coverValue = classification.role === "military" ? 0.92
      : classification.kind === "industrial" ? 0.78
        : ["commercial", "civic", "apartments"].includes(classification.kind) ? 0.68
          : classification.kind === "garage" ? 0.34 : 0.48;
    const strategicValue = classification.role === "infrastructure" ? 0.84
      : classification.role === "military" ? 0.9
        : classification.kind === "industrial" ? 0.7
          : classification.kind === "civic" ? 0.62
            : classification.kind === "commercial" ? 0.5 : 0.18;

    return {
      ...classification,
      height,
      roofShape,
      area,
      materialClass,
      coverValue,
      strategicValue,
      heightClass: height < 5 ? "low" : height < 11 ? "medium" : "tall",
      garrisonCapacity: Math.max(0, Math.floor(area / (classification.kind === "garage" ? 95 : classification.kind === "residential" ? 70 : 45))),
      health: Math.max(70, Math.min(760, area / 8 + height * (classification.kind === "military" ? 18 : classification.kind === "industrial" ? 14 : 10)))
    };
  }


  normalizeRoofShape(value) {
    if (value == null) return null;
    const v = String(value).toLowerCase().trim().replace(/[_\s]+/g, "-");
    if (!v || v === "no" || v === "none") return null;
    if (["gabled", "gable-roof", "pitched", "skillion-gable"].includes(v)) return "gable";
    if (["hip", "hipped-roof", "hip-roof"].includes(v)) return "hipped";
    if (["flat-roof", "terrace"].includes(v)) return "flat";
    if (["yes", "unknown"].includes(v)) return v;
    return v;
  }

  selectResidentialRoofShape(area = 100) {
    // Rectangular small homes read best as gables.  Wider/larger homes get some
    // hips for visual variety while staying recognizably residential.
    if (area < 95) return "gable";
    return this.rng.next() > 0.32 ? "gable" : "hipped";
  }

  pickBuildingWallMaterial(profile) {
    if (profile.kind === "industrial") return this.materials.buildingIndustrial ?? this.materials.building;
    if (profile.kind === "utility") return this.materials.buildingUtility ?? this.materials.buildingConcrete ?? this.materials.building;
    if (profile.kind === "military") return this.materials.buildingConcrete ?? this.materials.building;
    if (profile.kind === "civic") return this.materials.buildingCivic ?? this.materials.buildingConcrete ?? this.materials.building;
    if (profile.kind === "commercial") return this.materials.buildingGlass ?? this.materials.buildingConcrete ?? this.materials.building;
    if (profile.kind === "apartments") return this.materials.buildingConcrete ?? this.materials.building;
    if (profile.kind === "garage") return this.materials.buildingGarage ?? this.materials.buildingPlaster ?? this.materials.building;
    if (profile.kind === "agricultural") return this.materials.buildingAgricultural ?? this.materials.buildingBrick ?? this.materials.building;
    const options = [this.materials.building, this.materials.buildingBrick, this.materials.buildingPlaster].filter(Boolean);
    return options[Math.floor(this.rng.next() * options.length)] ?? this.materials.building;
  }

  pickBuildingRoofMaterial(profile) {
    if (profile.kind === "industrial" || profile.kind === "agricultural") return this.materials.roofMetal ?? this.materials.roof;
    if (profile.kind === "utility" || profile.kind === "military") return this.materials.roofUtility ?? this.materials.roofMetal ?? this.materials.roof;
    if (profile.kind === "civic") return this.materials.roofCivic ?? this.materials.roofDark ?? this.materials.roof;
    if (profile.roofShape === "gable" || profile.roofShape === "hipped") return this.materials.roofTile ?? this.materials.roof;
    const options = [this.materials.roof, this.materials.roofDark, this.materials.roofMetal].filter(Boolean);
    return options[Math.floor(this.rng.next() * options.length)] ?? this.materials.roof;
  }

  createBuildingRoof(shape, footprint, center, terrainH, profile, material) {
    const group = new THREE.Group();
    if (!this.buildingAttributionStats) this.buildingAttributionStats = this.createBuildingAttributionStats();
    const roofY = terrainH + profile.height + 0.12;
    const roofFrame = this.computeRoofFrame(footprint, center);

    // D56.1 hotfix: make pitched residential roofs impossible to miss.  The
    // previous implementation generated a mesh, but the roof could disappear
    // because of one-sided triangle winding, too-shallow pitch, or weak profile
    // assignment.  Pitched roofs now use a dedicated double-sided material,
    // stronger ridge height, visible eaves, and a ridge cap.
    if ((profile.roofShape === "gable" || profile.roofShape === "hipped") && roofFrame) {
      const roofMaterial = material?.clone ? material.clone() : material;
      if (roofMaterial) {
        roofMaterial.side = THREE.DoubleSide;
        roofMaterial.polygonOffset = true;
        roofMaterial.polygonOffsetFactor = -1;
        roofMaterial.polygonOffsetUnits = -1;
        roofMaterial.needsUpdate = true;
      }

      const ridgeHeight = profile.kind === "residential"
        ? Math.min(4.6, Math.max(1.8, profile.height * 0.42))
        : Math.min(3.6, Math.max(1.0, profile.height * 0.28));
      const eaveOverhang = profile.kind === "residential" ? 0.85 : 0.35;

      const pitchedRoof = profile.roofShape === "hipped"
        ? this.createHipRoofMesh(roofFrame, roofY, ridgeHeight, eaveOverhang, roofMaterial)
        : this.createGableRoofMesh(roofFrame, roofY, ridgeHeight, eaveOverhang, roofMaterial);

      pitchedRoof.castShadow = true;
      pitchedRoof.receiveShadow = true;
      pitchedRoof.renderOrder = 2;
      pitchedRoof.userData = { feature: "building-roof", damagePart: "roof", roofShape: profile.roofShape, d56_1VisibleResidentialRoof: profile.kind === "residential" };
      group.add(pitchedRoof);
      this.buildingAttributionStats.roofsGenerated += 1;
      if (profile.kind === "residential") this.buildingAttributionStats.roofedResidential += 1;
      this.buildingAttributionStats.roofShapes[profile.roofShape] = (this.buildingAttributionStats.roofShapes[profile.roofShape] ?? 0) + 1;

      // Thin fascia/eave slab hides tiny gaps between arbitrary OSM footprints and
      // the simplified oriented roof frame.
      const fascia = new THREE.Mesh(
        new THREE.BoxGeometry(
          roofFrame.longLength + eaveOverhang * 2,
          0.22,
          roofFrame.shortLength + eaveOverhang * 2
        ),
        roofMaterial
      );
      fascia.position.set(center.x, roofY - 0.06, center.y);
      fascia.rotation.y = roofFrame.angle;
      fascia.castShadow = true;
      fascia.receiveShadow = true;
      fascia.userData = { feature: "roof-fascia", damagePart: "roof" };
      group.add(fascia);

      if (profile.kind === "residential") {
        const ridgeCap = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(1.8, roofFrame.longLength * 0.82), 0.16, 0.22),
          roofMaterial
        );
        ridgeCap.position.set(center.x, roofY + ridgeHeight + 0.08, center.y);
        ridgeCap.rotation.y = roofFrame.angle;
        ridgeCap.castShadow = true;
        ridgeCap.userData = { feature: "roof-ridge-cap", damagePart: "roof" };
        group.add(ridgeCap);
      }
    } else {
      const roof = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
      roof.rotateX(Math.PI / 2);
      roof.position.y = roofY;
      roof.castShadow = true;
      roof.receiveShadow = true;
      roof.userData.damagePart = "roof";
      group.add(roof);
      this.buildingAttributionStats.roofsGenerated += 1;
      this.buildingAttributionStats.roofShapes[profile.roofShape || "flat"] = (this.buildingAttributionStats.roofShapes[profile.roofShape || "flat"] ?? 0) + 1;

      if (profile.roofShape === "sawtooth") {
        const box = this.boundsForPoints(footprint);
        const toothCount = Math.max(2, Math.min(6, Math.floor((box.maxX - box.minX) / 14)));
        for (let i = 0; i < toothCount; i++) {
          const tooth = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, Math.max(8, (box.maxZ - box.minZ) * 0.75)), material);
          tooth.position.set(box.minX + ((i + 0.5) / toothCount) * (box.maxX - box.minX), roofY + 0.55, center.y);
          tooth.rotation.z = 0.18;
          group.add(tooth);
        }
      }
    }

    group.userData = { feature: "building-roof", damagePart: "roof" };
    return group;
  }

  computeRoofFrame(footprint, center) {
    if (!footprint || footprint.length < 3) return null;

    let longest = 0;
    let angle = 0;
    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i];
      const b = footprint[(i + 1) % footprint.length];
      const dx = b.x - a.x;
      const dz = b.y - a.y;
      const length = Math.hypot(dx, dz);
      if (length > longest) {
        longest = length;
        angle = Math.atan2(dz, dx);
      }
    }

    const axisLong = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const axisShort = new THREE.Vector2(-Math.sin(angle), Math.cos(angle));
    let minLong = Infinity;
    let maxLong = -Infinity;
    let minShort = Infinity;
    let maxShort = -Infinity;

    for (const point of footprint) {
      const relative = new THREE.Vector2(point.x - center.x, point.y - center.y);
      const alongLong = relative.dot(axisLong);
      const alongShort = relative.dot(axisShort);
      minLong = Math.min(minLong, alongLong);
      maxLong = Math.max(maxLong, alongLong);
      minShort = Math.min(minShort, alongShort);
      maxShort = Math.max(maxShort, alongShort);
    }

    const longLength = maxLong - minLong;
    const shortLength = maxShort - minShort;
    if (longLength < 2 || shortLength < 2) return null;

    return {
      center,
      angle,
      axisLong,
      axisShort,
      longLength,
      shortLength,
      minLong,
      maxLong,
      minShort,
      maxShort
    };
  }

  roofPoint(frame, alongLong, alongShort, y, overhang = 0) {
    const longOffset = alongLong + Math.sign(alongLong || 1) * overhang;
    const shortOffset = alongShort + Math.sign(alongShort || 1) * overhang;
    return new THREE.Vector3(
      frame.center.x + frame.axisLong.x * longOffset + frame.axisShort.x * shortOffset,
      y,
      frame.center.y + frame.axisLong.y * longOffset + frame.axisShort.y * shortOffset
    );
  }

  createGableRoofMesh(frame, roofY, ridgeHeight, overhang, material) {
    const l0 = frame.minLong;
    const l1 = frame.maxLong;
    const s0 = frame.minShort;
    const s1 = frame.maxShort;

    const vertices = [
      this.roofPoint(frame, l0, s0, roofY, overhang), // 0 front-left eave
      this.roofPoint(frame, l1, s0, roofY, overhang), // 1 back-left eave
      this.roofPoint(frame, l1, s1, roofY, overhang), // 2 back-right eave
      this.roofPoint(frame, l0, s1, roofY, overhang), // 3 front-right eave
      this.roofPoint(frame, l0, 0, roofY + ridgeHeight, 0), // 4 front ridge
      this.roofPoint(frame, l1, 0, roofY + ridgeHeight, 0)  // 5 back ridge
    ];

    const positions = [];
    const pushTri = (a, b, c) => {
      for (const v of [vertices[a], vertices[b], vertices[c]]) positions.push(v.x, v.y, v.z);
    };

    // two sloped roof planes
    pushTri(0, 1, 5);
    pushTri(0, 5, 4);
    pushTri(3, 4, 5);
    pushTri(3, 5, 2);

    // triangular gable ends
    pushTri(0, 4, 3);
    pushTri(1, 2, 5);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, material);
  }

  createHipRoofMesh(frame, roofY, ridgeHeight, overhang, material) {
    const l0 = frame.minLong;
    const l1 = frame.maxLong;
    const s0 = frame.minShort;
    const s1 = frame.maxShort;
    const inset = Math.min(frame.longLength * 0.22, frame.shortLength * 0.55);
    const r0 = l0 + inset;
    const r1 = l1 - inset;

    const vertices = [
      this.roofPoint(frame, l0, s0, roofY, overhang),
      this.roofPoint(frame, l1, s0, roofY, overhang),
      this.roofPoint(frame, l1, s1, roofY, overhang),
      this.roofPoint(frame, l0, s1, roofY, overhang),
      this.roofPoint(frame, r0, 0, roofY + ridgeHeight, 0),
      this.roofPoint(frame, r1, 0, roofY + ridgeHeight, 0)
    ];

    const positions = [];
    const pushTri = (a, b, c) => {
      for (const v of [vertices[a], vertices[b], vertices[c]]) positions.push(v.x, v.y, v.z);
    };

    pushTri(0, 1, 5);
    pushTri(0, 5, 4);
    pushTri(3, 4, 5);
    pushTri(3, 5, 2);
    pushTri(0, 4, 3);
    pushTri(1, 2, 5);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, material);
  }

  createRooftopDetails(center, footprint, roofY, profile) {
    const group = new THREE.Group();
    const box = this.boundsForPoints(footprint);
    const width = box.maxX - box.minX;
    const depth = box.maxZ - box.minZ;
    const area = Math.max(1, width * depth);
    const detailCount = profile.kind === "industrial"
      ? Math.min(10, Math.max(2, Math.floor(area / 700)))
      : Math.min(5, Math.max(0, Math.floor(area / 950)));

    const material = this.materials.roofMetal ?? this.materials.roof;
    for (let i = 0; i < detailCount; i++) {
      const x = box.minX + width * (0.2 + this.rng.next() * 0.6);
      const z = box.minZ + depth * (0.2 + this.rng.next() * 0.6);
      if (!this.isPointInPolygon(new THREE.Vector2(x, z), footprint)) continue;
      const w = 1.5 + this.rng.next() * 3.5;
      const d = 1.5 + this.rng.next() * 3.5;
      const h = 0.5 + this.rng.next() * 1.0;
      const unit = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      unit.position.set(x, roofY + h / 2 + 0.12, z);
      unit.rotation.y = this.rng.next() * Math.PI;
      unit.userData = { feature: "rooftop-detail", damagePart: "rooftop-detail" };
      group.add(unit);
    }

    group.userData = { feature: "rooftop-details", damagePart: "details" };
    return group;
  }

  boundsForPoints(points) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.y);
      maxZ = Math.max(maxZ, point.y);
    }
    return { minX, maxX, minZ, maxZ };
  }


  sampleFootprintTerrainRange(footprint, center) {
    const samples = [center, ...footprint];
    // Also sample edge midpoints.  This catches the common case where a home is
    // placed across a slope and one wall edge sits over lower ground.
    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i];
      const b = footprint[(i + 1) % footprint.length];
      samples.push(new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2));
    }

    let minH = Infinity;
    let maxH = -Infinity;
    for (const sample of samples) {
      const h = this.terrain.getHeight(sample.x, sample.y, this.centerLat, this.centerLon, this.scaleFactor);
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
    }

    if (!Number.isFinite(minH) || !Number.isFinite(maxH)) {
      const h = this.terrain.getHeight(center.x, center.y, this.centerLat, this.centerLon, this.scaleFactor);
      return { minH: h, maxH: h, baseH: h };
    }
    return { minH, maxH, baseH: maxH + 0.04 };
  }


  addTypeSpecificBuildingMarkers(group, footprint, center, terrainH, profile) {
    const box = this.boundsForPoints(footprint);
    const width = box.maxX - box.minX;
    const depth = box.maxZ - box.minZ;
    const trimMat = this.materials.buildingTrim ?? this.materials.buildingPlaster ?? this.materials.building;
    const metalMat = this.materials.propMetal ?? this.materials.roofMetal ?? trimMat;

    const addDoor = (x, z, rotY, w = 1.25, h = 2.1) => {
      const door = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.11), this.materials.propDark ?? trimMat);
      door.position.set(x, terrainH + h / 2 + 0.08, z);
      door.rotation.y = rotY;
      door.userData = { feature: "building-door", damagePart: "details", role: profile.role };
      group.add(door);
    };

    const addBand = (x, z, rotY, w, h, material = trimMat) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), material);
      band.position.set(x, terrainH + Math.min(profile.height - 0.7, Math.max(2.2, profile.height * 0.55)), z);
      band.rotation.y = rotY;
      band.userData = { feature: "building-facade-marker", damagePart: "details", buildingClass: profile.className };
      group.add(band);
    };

    if (profile.kind === "commercial" || profile.kind === "civic") {
      addBand(center.x, box.minZ - 0.07, 0, Math.max(3, Math.min(width * 0.7, 18)), 1.15, profile.kind === "commercial" ? (this.materials.buildingGlass ?? trimMat) : trimMat);
      addDoor(center.x, box.minZ - 0.13, 0, profile.kind === "civic" ? 1.8 : 1.4, 2.35);
    } else if (profile.kind === "industrial") {
      const doors = Math.max(1, Math.min(4, Math.floor(width / 18)));
      for (let i = 0; i < doors; i++) {
        const x = box.minX + ((i + 1) / (doors + 1)) * width;
        addDoor(x, box.minZ - 0.13, 0, 3.6, 3.1);
      }
      addBand(center.x, box.maxZ + 0.07, 0, Math.max(5, Math.min(width * 0.55, 26)), 0.45, metalMat);
    } else if (profile.kind === "utility") {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(Math.min(width * 0.5, 8), 0.25, Math.min(depth * 0.5, 8)), metalMat);
      pad.position.set(center.x, terrainH + profile.height + 0.25, center.y);
      pad.userData = { feature: "utility-rooftop-marker", damagePart: "details" };
      group.add(pad);
    } else if (profile.kind === "agricultural") {
      addDoor(center.x, box.minZ - 0.13, 0, Math.max(2.4, Math.min(width * 0.35, 5.2)), 2.8);
    } else if (profile.kind === "military") {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3, width * 0.62), 0.35, Math.max(3, depth * 0.62)), metalMat);
      cap.position.set(center.x, terrainH + profile.height + 0.25, center.y);
      cap.userData = { feature: "hardened-roof-cap", damagePart: "roof" };
      group.add(cap);
    } else if (profile.kind === "garage") {
      addDoor(center.x, box.minZ - 0.13, 0, Math.max(1.8, Math.min(width * 0.55, 3.0)), 1.9);
    }
  }

  offsetFootprintOutward(footprint, center, amount = 0.2) {
    return footprint.map((point) => {
      const dir = new THREE.Vector2(point.x - center.x, point.y - center.y);
      if (dir.lengthSq() < 0.0001) return point.clone();
      return point.clone().add(dir.normalize().multiplyScalar(amount));
    });
  }

  createBuildingVisualDetails(footprint, center, terrainH, profile) {
    const group = new THREE.Group();
    const box = this.boundsForPoints(footprint);
    const width = box.maxX - box.minX;
    const depth = box.maxZ - box.minZ;
    const terrainRange = this.sampleFootprintTerrainRange(footprint, center);
    const baseFoundationHeight = Math.min(0.45, Math.max(0.22, profile.height * 0.055));
    const foundationHeight = Math.max(baseFoundationHeight, terrainH - terrainRange.minH + 0.55);

    const foundationShape = this.createShapeFromFootprint(this.offsetFootprintOutward(footprint, center, 0.22));
    const foundation = new THREE.Mesh(
      new THREE.ExtrudeGeometry(foundationShape, { depth: foundationHeight, bevelEnabled: false }),
      this.materials.foundation ?? this.materials.buildingConcrete
    );
    foundation.rotateX(Math.PI / 2);
    foundation.position.y = terrainH + 0.08;
    foundation.userData = { feature: "building-foundation", damagePart: "walls", exactFootprint: true };
    foundation.receiveShadow = true;
    group.add(foundation);

    const trimMat = this.materials.buildingTrim ?? this.materials.buildingPlaster ?? this.materials.building;
    if ((profile.kind === "residential" || profile.kind === "apartments") && width > 5 && depth > 5) {
      const longWindowCount = Math.max(1, Math.min(4, Math.floor(width / 10)));
      const sideWindowCount = Math.max(1, Math.min(3, Math.floor(depth / 10)));
      const addWindow = (x, z, rotY) => {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.0, 0.08), trimMat);
        win.position.set(x, terrainH + Math.min(profile.height - 0.9, 2.25), z);
        win.rotation.y = rotY;
        win.userData = { feature: "building-window-trim", damagePart: "walls" };
        group.add(win);
      };
      for (let i = 0; i < longWindowCount; i++) {
        const x = box.minX + ((i + 1) / (longWindowCount + 1)) * width;
        addWindow(x, box.minZ - 0.06, 0);
        addWindow(x, box.maxZ + 0.06, 0);
      }
      for (let i = 0; i < sideWindowCount; i++) {
        const z = box.minZ + ((i + 1) / (sideWindowCount + 1)) * depth;
        addWindow(box.minX - 0.06, z, Math.PI / 2);
        addWindow(box.maxX + 0.06, z, Math.PI / 2);
      }
    }

    this.addTypeSpecificBuildingMarkers(group, footprint, center, terrainH, profile);

    group.userData = { feature: "building-visual-details", damagePart: "details", buildingClass: profile.className, role: profile.role };
    return group;
  }

  createBuildingGroundDetails(buildingId, footprint, center, terrainH, profile, area, tags = {}) {
    if (!profile || !footprint?.length) return;

    const nearestRoad = this.findNearestRoadSegment(center, profile.kind === "residential" ? 85 : 130);
    const isResidential = profile.kind === "residential" && area < 1200;
    const isCommercial = ["commercial", "industrial", "civic", "utility", "military"].includes(profile.kind) || tags.shop || tags.amenity;

    if (isResidential) {
      this.createFenceAroundFootprint(`${buildingId}:fence`, footprint, center, terrainH, nearestRoad);
      const drivewayRoad = this.findResidentialDrivewayTarget(center, nearestRoad);
      if (drivewayRoad && this.rng.next() > 0.18) {
        this.createDriveway(`${buildingId}:driveway`, footprint, center, terrainH, drivewayRoad, area);
      }
      this.createResidentialLandscaping(`${buildingId}:landscaping`, footprint, center, nearestRoad);
    } else if (isCommercial && nearestRoad && area > 180) {
      this.createParkingPad(`${buildingId}:parking`, center, terrainH, nearestRoad, area);
    }
  }


  createResidentialLandscaping(id, footprint, center, nearestRoad = null) {
    // Phase 4: small yard context so homes stop floating in empty green boxes.
    // Bushes are intentionally low and chunky to match the same low-poly language
    // as the new trees without competing with unit readability.
    const shrubGeo = new THREE.DodecahedronGeometry(1, 0);
    const shrubMat = this.materials.scrub ?? this.materials.forestCanopy ?? this.materials.leaves;
    const placements = [];

    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i];
      const b = footprint[(i + 1) % footprint.length];
      const length = a.distanceTo(b);
      if (length < 6 || length > 70) continue;

      const mid = new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (nearestRoad && this.distToSegment(mid, nearestRoad.a, nearestRoad.b) < 9 && this.rng.next() < 0.65) continue;

      const dir = new THREE.Vector2().subVectors(b, a).normalize();
      const normal = new THREE.Vector2(-dir.y, dir.x);
      const outward = normal.dot(new THREE.Vector2().subVectors(mid, center)) > 0 ? normal : normal.multiplyScalar(-1);
      const shrubCount = Math.min(5, Math.max(1, Math.floor(length / 9)));
      for (let n = 0; n < shrubCount; n++) {
        if (this.rng.next() < 0.28) continue;
        const t = shrubCount === 1 ? 0.5 : (n + 0.35 + this.rng.next() * 0.3) / shrubCount;
        const x = a.x + (b.x - a.x) * t + outward.x * (2.8 + this.rng.next() * 2.8);
        const z = a.y + (b.y - a.y) * t + outward.y * (2.8 + this.rng.next() * 2.8);
        if (!this.isSmartLocation(x, z)) continue;
        placements.push({ x, z, scale: 0.55 + this.rng.next() * 0.9 });
      }
    }

    if (!placements.length) return;
    const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, placements.length);
    const dummy = new THREE.Object3D();
    placements.forEach((placement, index) => {
      const h = this.terrain.getHeight(placement.x, placement.z, this.centerLat, this.centerLon, this.scaleFactor);
      dummy.position.set(placement.x, h + 0.38, placement.z);
      dummy.scale.set(placement.scale * 1.45, placement.scale * 0.55, placement.scale * 1.1);
      dummy.rotation.set(0, this.rng.next() * Math.PI * 2, 0);
      dummy.updateMatrix();
      shrubs.setMatrixAt(index, dummy.matrix);
    });
    shrubs.instanceMatrix.needsUpdate = true;
    shrubs.castShadow = true;
    shrubs.receiveShadow = true;
    shrubs.userData = { feature: "residential-landscaping", source: id, layer: "vegetation" };
    this.vegGroup.add(shrubs);
  }

  isAlleySegment(seg) {
    const tags = seg?.tags ?? {};
    return seg?.highway === "service" && (tags.service === "alley" || tags.access === "private" || tags.name?.toLowerCase?.().includes("alley"));
  }

  findNearestAlleySegment(point, maxDistance = 95) {
    let best = null;
    let bestDistance = maxDistance;
    for (const seg of this.roadSegments) {
      if (!this.isAlleySegment(seg)) continue;
      const distance = this.distToSegment(point, seg.a, seg.b);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { ...seg, distance };
      }
    }
    return best;
  }

  findResidentialDrivewayTarget(center, nearestRoad) {
    const alley = this.findNearestAlleySegment(center, 90);
    if (!alley) return nearestRoad;

    // Residential blocks with mapped alleys should generally put the driveway
    // behind the house.  Allow the alley to win even when the front street is a
    // little closer, because homes are often centered closer to the street face
    // than their rear parking access.
    if (!nearestRoad) return alley;
    if (alley.distance <= nearestRoad.distance + 38) return alley;
    return nearestRoad;
  }

  findNearestRoadSegment(point, maxDistance = 100) {
    let best = null;
    let bestDistance = maxDistance;
    for (const seg of this.roadSegments) {
      if (["motorway", "trunk"].includes(seg.highway)) continue;
      const distance = this.distToSegment(point, seg.a, seg.b);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { ...seg, distance };
      }
    }
    return best;
  }

  createFenceAroundFootprint(id, footprint, center, terrainH, nearestRoad = null) {
    let addedSegments = 0;
    const postBase = new THREE.BoxGeometry(0.35, 1.2, 0.35);
    const railBase = new THREE.BoxGeometry(1, 0.18, 0.22);
    const railHeight = 0.75;
    const temp = new THREE.Object3D();

    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i];
      const b = footprint[(i + 1) % footprint.length];
      const length = a.distanceTo(b);
      if (length < 5 || length > 85) continue;

      const mid = new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (nearestRoad && this.distToSegment(mid, nearestRoad.a, nearestRoad.b) < 13 && this.rng.next() < 0.65) continue;

      const dir = new THREE.Vector2().subVectors(b, a).normalize();
      const normal = new THREE.Vector2(-dir.y, dir.x);
      const yardOffset = normal.dot(new THREE.Vector2().subVectors(mid, center)) > 0 ? normal : normal.multiplyScalar(-1);
      const aa = a.clone().addScaledVector(yardOffset, 2.4);
      const bb = b.clone().addScaledVector(yardOffset, 2.4);
      const worldMid = new THREE.Vector2((aa.x + bb.x) / 2, (aa.y + bb.y) / 2);
      const y = this.terrain.getHeight(worldMid.x, worldMid.y, this.centerLat, this.centerLon, this.scaleFactor) + railHeight;

      temp.position.set(worldMid.x, y, worldMid.y);
      temp.rotation.set(0, -Math.atan2(dir.y, dir.x), 0);
      temp.scale.set(length, 1, 1);
      temp.updateMatrix();
      this.worldDetailBatches.fenceRails.push(railBase.clone().applyMatrix4(temp.matrix));

      const postCount = Math.max(2, Math.min(7, Math.ceil(length / 9)));
      for (let p = 0; p < postCount; p++) {
        const t = postCount === 1 ? 0.5 : p / (postCount - 1);
        const px = aa.x + (bb.x - aa.x) * t;
        const pz = aa.y + (bb.y - aa.y) * t;
        const py = this.terrain.getHeight(px, pz, this.centerLat, this.centerLon, this.scaleFactor) + 0.6;
        temp.position.set(px, py, pz);
        temp.rotation.set(0, 0, 0);
        temp.scale.set(1, 1, 1);
        temp.updateMatrix();
        this.worldDetailBatches.fencePosts.push(postBase.clone().applyMatrix4(temp.matrix));
      }
      addedSegments++;
    }

    if (addedSegments > 0) this.worldDetailStats.fences += 1;
  }

  createDriveway(id, footprint, center, terrainH, road, area) {
    const roadPoint = this.closestPointOnSegment(center, road.a, road.b);
    const dist = center.distanceTo(roadPoint);
    if (dist < 8 || dist > 95) return;

    // Start the driveway at the building edge nearest the access road/alley so
    // it does not draw through the middle of the home footprint.
    let housePoint = center.clone();
    let best = Infinity;
    for (let i = 0; i < footprint.length; i++) {
      const edgePoint = this.closestPointOnSegment(roadPoint, footprint[i], footprint[(i + 1) % footprint.length]);
      const d = edgePoint.distanceTo(roadPoint);
      if (d < best) {
        best = d;
        housePoint = edgePoint;
      }
    }

    const dir = new THREE.Vector2().subVectors(roadPoint, housePoint);
    if (dir.length() < 5 || dir.length() > 90) return;
    dir.normalize();
    const start = housePoint.clone().addScaledVector(dir, 1.2);
    const end = roadPoint.clone().addScaledVector(dir, -Math.max(1.0, (road.width ?? 3) * 0.25));

    const width = this.isAlleySegment(road)
      ? Math.max(2.8, Math.min(4.4, Math.sqrt(area) * 0.16))
      : Math.max(3.2, Math.min(6.5, Math.sqrt(area) * 0.22));
    const geo = this.createSurfaceSegmentGeometry(start, end, width, 0.24);
    if (!geo) return;
    this.worldDetailBatches.drivewaySurfaces.push(geo);
    this.worldDetailStats.driveways += 1;
  }

  createParkingPad(id, center, terrainH, road, area) {
    const toRoad = this.closestPointOnSegment(center, road.a, road.b).sub(center);
    if (toRoad.lengthSq() === 0) return;
    const angle = Math.atan2(toRoad.y, toRoad.x);
    const width = Math.max(16, Math.min(42, Math.sqrt(area) * 0.8));
    const depth = Math.max(10, Math.min(28, Math.sqrt(area) * 0.45));
    const padCenter = new THREE.Vector2(center.x + Math.cos(angle) * (depth * 0.55), center.y + Math.sin(angle) * (depth * 0.55));

    const pad = new THREE.PlaneGeometry(width, depth);
    const temp = new THREE.Object3D();
    temp.position.set(padCenter.x, terrainH + 0.23, padCenter.y);
    temp.rotation.set(-Math.PI / 2, 0, -angle);
    temp.updateMatrix();
    this.worldDetailBatches.parkingSurfaces.push(pad.applyMatrix4(temp.matrix));
    this.worldDetailStats.parkingPads += 1;

    const carCount = Math.min(6, Math.max(2, Math.floor(width / 10)));
    for (let i = 0; i < carCount; i++) {
      const local = new THREE.Vector3((i - (carCount - 1) / 2) * 4.8, 0.78, -depth * 0.18 + (i % 2) * 4.5);
      const world = local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle).add(new THREE.Vector3(padCenter.x, terrainH, padCenter.y));
      this.worldDetailBatches.parkedCars.push({
        pos: new THREE.Vector2(world.x, world.z),
        y: terrainH + 0.78,
        angle: -angle + (i % 2 ? Math.PI / 2 : -Math.PI / 2)
      });
    }
  }

  createSurfaceSegmentGeometry(a, b, halfWidth, yOffset = 0.22) {
    const dir = new THREE.Vector2().subVectors(b, a);
    const length = dir.length();
    if (length < 2) return null;
    dir.normalize();
    const perp = new THREE.Vector2(-dir.y, dir.x);
    const verts2 = [
      a.clone().addScaledVector(perp, halfWidth),
      a.clone().addScaledVector(perp, -halfWidth),
      b.clone().addScaledVector(perp, -halfWidth),
      b.clone().addScaledVector(perp, halfWidth)
    ];

    const verts = [];
    for (const p of verts2) {
      const y = this.terrain.getHeight(p.x, p.y, this.centerLat, this.centerLon, this.scaleFactor) + yOffset;
      verts.push(p.x, y, p.y);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([
      ...verts.slice(0, 3), ...verts.slice(3, 6), ...verts.slice(6, 9),
      ...verts.slice(0, 3), ...verts.slice(6, 9), ...verts.slice(9, 12)
    ], 3));
    geo.computeVertexNormals();
    return geo;
  }

  renderSurfaceSegment(a, b, halfWidth, material, yOffset = 0.22) {
    const geo = this.createSurfaceSegmentGeometry(a, b, halfWidth, yOffset);
    if (!geo) return null;
    const mesh = new THREE.Mesh(geo, material);
    this.group.add(mesh);
    return mesh;
  }

  flushWorldDetailBatches() {
    const makeMergedMesh = (geometries, material, feature, propType, y = 1, maxHealth = 40) => {
      if (!geometries.length) return null;
      const merged = this.safeMergeGeometries(geometries);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.userData = { feature, propType, batched: true, count: geometries.length };
      this.group.add(mesh);
      const center = merged.boundingSphere?.center ?? new THREE.Vector3();
      const radius = Math.min(1200, merged.boundingSphere?.radius ?? 100);
      this.destruction?.register({
        id: `batched:${propType}`,
        category: "prop",
        meshes: [mesh],
        position: new THREE.Vector3(center.x, y, center.z),
        bounds: { radius, height: Math.max(1, y * 2) },
        maxHealth,
        tags: { propType, tacticalClass: "batched-light-cover", batched: true, count: geometries.length }
      });
      return mesh;
    };

    makeMergedMesh(this.worldDetailBatches.fenceRails, this.materials.fence ?? this.materials.tactical, "prop-fence-rails-batched", "fence", 0.8, 120);
    makeMergedMesh(this.worldDetailBatches.fencePosts, this.materials.fence ?? this.materials.tactical, "prop-fence-posts-batched", "fence", 0.7, 120);
    makeMergedMesh(this.worldDetailBatches.drivewaySurfaces, this.materials.driveway ?? this.materials.sidewalk, "prop-driveways-batched", "driveway", 0.25, 180);
    makeMergedMesh(this.worldDetailBatches.parkingSurfaces, this.materials.parking ?? this.materials.driveway ?? this.materials.road, "prop-parking-batched", "parking", 0.25, 180);

    if (this.worldDetailBatches.parkedCars.length) {
      const carGeo = new THREE.BoxGeometry(2.1, 1.1, 4.2);
      const cars = new THREE.InstancedMesh(carGeo, this.materials.carBody ?? this.materials.propMetal ?? this.materials.tactical, this.worldDetailBatches.parkedCars.length);
      const dummy = new THREE.Object3D();
      this.worldDetailBatches.parkedCars.forEach((entry, i) => {
        dummy.position.set(entry.pos.x, entry.y, entry.pos.y);
        dummy.rotation.set(0, entry.angle, 0);
        dummy.updateMatrix();
        cars.setMatrixAt(i, dummy.matrix);
      });
      cars.userData = { feature: "prop-parked-cars-batched", propType: "parked-car", batched: true, count: this.worldDetailBatches.parkedCars.length };
      this.group.add(cars);
      this.registerInstancedPropSet("batched:parked-cars", cars, this.worldDetailBatches.parkedCars, "parked-car", 160);
    }
  }

  closestPointOnSegment(p, a, b) {
    const l2 = a.distanceToSquared(b);
    if (l2 === 0) return a.clone();
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return new THREE.Vector2(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
  }

  createRoadsideProps() {
    const polePositions = [];
    const lightPositions = [];
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 6.5, 6);
    const lightGeo = new THREE.BoxGeometry(0.8, 0.25, 0.35);
    const dummy = new THREE.Object3D();

    for (const seg of this.roadSegments) {
      const dist = seg.a.distanceTo(seg.b);
      if (dist < 75 || ["motorway", "trunk", "footway", "path", "cycleway"].includes(seg.highway)) continue;
      const dir = new THREE.Vector2().subVectors(seg.b, seg.a).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      const interval = seg.highway === "primary" || seg.highway === "secondary" ? 55 : 75;
      const sideBias = this.rng.next() > 0.5 ? 1 : -1;

      for (let s = 22 + this.rng.next() * 20; s < dist - 22; s += interval + this.rng.next() * 18) {
        const side = this.rng.next() > 0.25 ? sideBias : -sideBias;
        const offset = Math.max(7.5, (seg.width ?? 4) + 5) + this.rng.next() * 4;
        const pos = new THREE.Vector2(seg.a.x + dir.x * s + perp.x * offset * side, seg.a.y + dir.y * s + perp.y * offset * side);
        if (!this.isSmartLocation(pos.x, pos.y)) continue;
        if (seg.highway === "residential" && this.rng.next() < 0.55) polePositions.push({ pos, angle: Math.atan2(dir.x, dir.y), type: "utility-pole" });
        else lightPositions.push({ pos, angle: Math.atan2(dir.x, dir.y), type: "streetlight" });
      }
    }

    if (polePositions.length) {
      const poles = new THREE.InstancedMesh(poleGeo, this.materials.fence ?? this.materials.tactical, polePositions.length);
      polePositions.forEach((entry, i) => {
        const y = this.terrain.getHeight(entry.pos.x, entry.pos.y, this.centerLat, this.centerLon, this.scaleFactor) + 3.25;
        dummy.position.set(entry.pos.x, y, entry.pos.y);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        poles.setMatrixAt(i, dummy.matrix);
      });
      poles.userData = { feature: "prop-utility-poles", propType: "utility-pole" };
      this.group.add(poles);
      this.registerInstancedPropSet("roadside:utility-poles", poles, polePositions, "utility-pole", 28);
    }

    if (lightPositions.length) {
      const posts = new THREE.InstancedMesh(poleGeo, this.materials.propMetal ?? this.materials.tactical, lightPositions.length);
      const lamps = new THREE.InstancedMesh(lightGeo, this.materials.propDark ?? this.materials.tactical, lightPositions.length);
      lightPositions.forEach((entry, i) => {
        const y = this.terrain.getHeight(entry.pos.x, entry.pos.y, this.centerLat, this.centerLon, this.scaleFactor);
        dummy.position.set(entry.pos.x, y + 3.25, entry.pos.y);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        posts.setMatrixAt(i, dummy.matrix);

        dummy.position.set(entry.pos.x + Math.sin(entry.angle) * 0.55, y + 6.35, entry.pos.y + Math.cos(entry.angle) * 0.55);
        dummy.rotation.set(0, entry.angle, 0);
        dummy.updateMatrix();
        lamps.setMatrixAt(i, dummy.matrix);
      });
      posts.userData = { feature: "prop-streetlight-posts", propType: "streetlight" };
      lamps.userData = { feature: "prop-streetlight-lamps", propType: "streetlight" };
      this.group.add(posts, lamps);
      this.registerInstancedPropSet("roadside:streetlights", [posts, lamps], lightPositions, "streetlight", 34);
    }

    this.worldDetailStats.roadsideProps += polePositions.length + lightPositions.length;
  }

  registerInstancedPropSet(id, meshes, positions, propType, maxHealth = 35) {
    const list = Array.isArray(meshes) ? meshes : [meshes];
    if (!positions.length) return;
    const center = positions.reduce((sum, entry) => sum.add(new THREE.Vector3(entry.pos.x, 0, entry.pos.y)), new THREE.Vector3()).divideScalar(positions.length);
    center.y = 3;
    this.destruction?.register({
      id,
      category: "prop",
      meshes: list,
      position: center,
      bounds: { radius: Math.min(120, Math.sqrt(positions.length) * 18), height: 7 },
      maxHealth,
      tags: { propType, tacticalClass: "soft-cover", instanced: true, count: positions.length }
    });
  }


  createRoad(way, nodes) {
    return this.roadBuilder.createRoad(way, nodes);
  }

  roadJunctionKey(point) {
    return this.roadBuilder.roadJunctionKey(point);
  }

  registerRoadJunction(point, neighbor, style, isBridge = false) {
    return this.roadBuilder.registerRoadJunction(point, neighbor, style, isBridge);
  }

  createIntersectionPads() {
    return this.roadBuilder.createIntersectionPads();
  }

  convexHull(points) {
    return convexHull(points);
  }

  renderOffsetDashedPath(points, material, width, offset, isBridge = false, yOffset = 0.62, dashLength = 12, gapLength = 8) {
    return this.roadBuilder.renderOffsetDashedPath(points, material, width, offset, isBridge, yOffset, dashLength, gapLength);
  }

  createRailway(way, nodes) {
    const points = this.getWayPoints(way, nodes);
    if (points.length < 2) return;
    const mesh = this.renderPath(points, this.materials.railway, 2.5, false);
    if (mesh) mesh.userData = { feature: "railway", tags: way.tags };
  }

  createWaterway(way, nodes) {
    const rawPoints = this.getWayPoints(way, nodes);
    if (rawPoints.length < 2) return;

    const waterway = way.tags.waterway ?? "stream";
    const halfWidth = this.getWaterwayHalfWidth(waterway, way.tags);
    const smoothedPoints = this.smoothWaterPath(rawPoints, 2);
    const wetBankWidth = Math.min(halfWidth + 3.0, halfWidth * 1.55 + 2.0);
    const shoreWidth = Math.min(halfWidth + 1.0, halfWidth * 1.25 + 1.0);

    // D42: Keep the Water layer literal. Earlier builds assigned wet-bank and
    // shoreline helper strips to the water layer, so toggling Terrain + Water
    // showed three stacked ribbons. The water layer should render only the
    // actual wetted channel. Bank/shore context belongs to vegetation/props.
    const wetBank = this.renderSmoothPath(smoothedPoints, this.materials.wetBank, wetBankWidth, false, 0.055);
    const shoreline = this.renderSmoothPath(smoothedPoints, this.materials.waterShoreline, shoreWidth, false, 0.09);
    const water = this.renderSmoothPath(smoothedPoints, this.materials.water, halfWidth, false, 0.16);

    if (wetBank) {
      wetBank.renderOrder = 1;
      wetBank.userData = { feature: "wet-bank", layer: "vegetation", waterContext: true, waterway };
    }
    if (shoreline) {
      shoreline.renderOrder = 1;
      shoreline.userData = { feature: "shoreline", layer: "props", waterContext: true, waterway };
    }
    if (water) {
      water.renderOrder = 2;
      water.userData = {
        feature: "water",
        layer: "water",
        waterway,
        waterDepth: this.estimateWaterDepth(waterway, way.tags),
        flowSpeed: this.estimateWaterFlowSpeed(waterway, way.tags),
        flowVector: this.estimatePathFlowVector(smoothedPoints)
      };
      this.waterMeshes.push(water);
    }

    for (let i = 0; i < smoothedPoints.length - 1; i++) {
      const a = smoothedPoints[i];
      const b = smoothedPoints[i + 1];
      if (a.distanceTo(b) > 1 && a.distanceTo(b) < this.currentSize) {
        this.waterSegments.push({ a, b, width: wetBankWidth, waterway });
      }
    }

    this.createLinearWaterEdgeDetails(smoothedPoints, halfWidth, waterway);
  }

  smoothWaterPath(points, iterations = 1) {
    let current = points
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .filter((point, index, array) => index === 0 || point.distanceTo(array[index - 1]) > 0.5);

    const limit = this.currentSize / 2 + 80;
    current = current.filter((point) => Math.abs(point.x) <= limit && Math.abs(point.y) <= limit);
    if (current.length < 3) return current;

    for (let pass = 0; pass < iterations; pass++) {
      const next = [current[0].clone()];
      for (let i = 0; i < current.length - 1; i++) {
        const p0 = current[i];
        const p1 = current[i + 1];
        next.push(p0.clone().lerp(p1, 0.25), p0.clone().lerp(p1, 0.75));
      }
      next.push(current[current.length - 1].clone());
      current = next;
    }
    return current;
  }

  renderSmoothPath(points, material, width, isBridge = false, yOffset = 0.5) {
    const densePoints = [];
    const limit = this.currentSize / 2;
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return null;

    const entryH = this.terrain.getHeight(first.x, first.y, this.centerLat, this.centerLon, this.scaleFactor) + yOffset;
    const exitH = this.terrain.getHeight(last.x, last.y, this.centerLat, this.centerLon, this.scaleFactor) + yOffset;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = p1.distanceTo(p2);
      if (!Number.isFinite(dist) || dist <= 0.25 || dist > this.currentSize) continue;
      const steps = Math.max(1, Math.min(12, Math.ceil(dist / 8)));
      for (let j = 0; j <= steps; j++) {
        if (i > 0 && j === 0) continue;
        const t = j / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const z = p1.y + (p2.y - p1.y) * t;
        if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
        const globalT = (i + t) / Math.max(1, points.length - 1);
        const y = isBridge ? entryH + (exitH - entryH) * globalT : this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor) + yOffset;
        densePoints.push(new THREE.Vector3(x, y, z));
      }
    }

    if (densePoints.length > 1) return this.renderContinuousStrip(densePoints, material, width);
    return null;
  }

  renderContinuousStrip(densePts, material, width) {
    const left = [];
    const right = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < densePts.length; i++) {
      const prev = densePts[Math.max(0, i - 1)];
      const next = densePts[Math.min(densePts.length - 1, i + 1)];
      const dir = new THREE.Vector3().subVectors(next, prev);
      if (dir.lengthSq() === 0) continue;
      dir.normalize();
      const norm = new THREE.Vector3().crossVectors(dir, up).normalize();
      left.push(densePts[i].clone().addScaledVector(norm, width));
      right.push(densePts[i].clone().addScaledVector(norm, -width));
    }

    if (left.length < 2 || right.length < 2 || left.length !== right.length) return null;

    const verts = [];
    const uvs = [];
    for (let i = 0; i < left.length - 1; i++) {
      const v1 = left[i];
      const v2 = right[i];
      const v3 = left[i + 1];
      const v4 = right[i + 1];
      const u0 = i / Math.max(1, left.length - 1);
      const u1 = (i + 1) / Math.max(1, left.length - 1);
      verts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z, v2.x, v2.y, v2.z, v4.x, v4.y, v4.z, v3.x, v3.y, v3.z);
      uvs.push(u0, 0, u0, 1, u1, 0, u0, 1, u1, 1, u1, 0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    this.group.add(mesh);
    return mesh;
  }

  getWaterwayHalfWidth(waterway, tags = {}) {
    const explicitWidth = Number.parseFloat(tags.width);
    if (Number.isFinite(explicitWidth) && explicitWidth > 0) return Math.max(1.5, Math.min(30, explicitWidth / 2));
    if (waterway === "river") return 9;
    if (waterway === "canal") return 6;
    if (waterway === "stream") return 3;
    if (waterway === "ditch" || waterway === "drain") return 2;
    return 5;
  }

  estimateWaterDepth(waterway, tags = {}) {
    const taggedDepth = Number.parseFloat(tags.depth);
    if (Number.isFinite(taggedDepth) && taggedDepth > 0) return Math.max(0.15, Math.min(12, taggedDepth));
    if (waterway === "river") return 2.4;
    if (waterway === "canal") return 1.8;
    if (waterway === "stream") return 0.55;
    if (waterway === "ditch" || waterway === "drain") return 0.28;
    return 1.0;
  }

  estimateWaterFlowSpeed(waterway, tags = {}) {
    const taggedSpeed = Number.parseFloat(tags.flow_rate ?? tags.speed);
    if (Number.isFinite(taggedSpeed) && taggedSpeed >= 0) return Math.min(4, taggedSpeed);
    if (waterway === "river") return 0.9;
    if (waterway === "stream") return 0.55;
    if (waterway === "canal") return 0.18;
    if (waterway === "ditch" || waterway === "drain") return 0.25;
    return 0.15;
  }

  estimatePathFlowVector(points) {
    const first = points?.[0];
    const last = points?.[points.length - 1];
    if (!first || !last) return { x: 0, z: 0 };
    const dir = new THREE.Vector2(last.x - first.x, last.y - first.y);
    if (dir.lengthSq() === 0) return { x: 0, z: 0 };
    dir.normalize();
    return { x: Number(dir.x.toFixed(3)), z: Number(dir.y.toFixed(3)) };
  }

  createTacticalLineOrRegion(way, nodes) {
    const points = this.getWayPoints(way, nodes);
    if (points.length < 2) return;
    if (points.length > 3 && way.nodes?.[0] === way.nodes?.[way.nodes.length - 1]) this.createRegion(way, nodes, "tactical");
    else {
      const mesh = this.renderPath(points, this.materials.tactical, 2, false, 0.7);
      if (mesh) mesh.userData = { feature: way.tags.barrier ? "barrier" : "infrastructure", tags: way.tags };
    }
  }


  createOsmReplicaStats() {
    return { surfaces: 0, parking: 0, sports: 0, treeNodes: 0, inferredResidentialCanopyTrees: 0 };
  }

  resolveOsmSurfaceType(tags = {}) {
    if (!tags) return null;
    if (tags.amenity === "parking" || tags.parking || tags.landuse === "parking") return "parking";
    if (tags.leisure === "pitch") {
      if (tags.sport === "tennis") return "tennis";
      if (tags.sport === "baseball" || tags.sport === "softball") return "baseball";
      return "sports-field";
    }
    if (tags.leisure === "track") return "track";
    if (tags.surface === "asphalt" || tags.surface === "paved" || tags.surface === "concrete") return tags.surface === "concrete" ? "concrete" : "asphalt";
    if (["commercial", "retail", "industrial"].includes(tags.landuse) && !tags.building) return "developed-land";
    return null;
  }

  materialForOsmSurface(type) {
    if (type === "parking" || type === "asphalt" || type === "developed-land") return this.materials.parking ?? this.materials.road;
    if (type === "concrete" || type === "tennis") return this.materials.sidewalk ?? this.materials.driveway;
    if (type === "baseball") return this.materials.mudFlat ?? this.materials.park;
    if (type === "sports-field") return this.materials.park;
    if (type === "track") return this.materials.roadShoulder ?? this.materials.road;
    return this.materials.park;
  }

  createOsmSurfaceRegion(way, nodes, surfaceType) {
    const rawPts = this.getWayPoints(way, nodes);
    if (rawPts.length < 3) return;
    const pts = this.clipPolygonToBounds(rawPts, this.currentSize / 2);
    if (pts.length < 3) return;
    const bounds = this.boundsForPolygon(pts);
    const center = this.centroidForPolygon(pts);
    const area = Math.abs(THREE.ShapeUtils.area(pts));
    if (area < 18) return;

    const mat = this.materialForOsmSurface(surfaceType);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), mat);
    mesh.rotateX(Math.PI / 2);
    mesh.position.y = this.terrain.getHeight(center.x, center.y, this.centerLat, this.centerLon, this.scaleFactor) + 0.19;
    mesh.renderOrder = surfaceType === "parking" ? 2 : 1;
    mesh.userData = { feature: "osm-surface", surfaceType, tags: way.tags, osmId: way.id, source: "osm-replica-fidelity" };
    this.group.add(mesh);

    this.osmSurfaceFeatures.push({ id: way.id, surfaceType, polygon: pts, bounds, area, tags: way.tags });
    this.osmReplicaStats.surfaces += 1;
    if (surfaceType === "parking") {
      this.osmReplicaStats.parking += 1;
      this.createParkingLotDetails(pts, bounds, center, area);
    }
    if (["tennis", "baseball", "sports-field", "track"].includes(surfaceType)) {
      this.osmReplicaStats.sports += 1;
      this.createSportsSurfaceDetails(surfaceType, pts, bounds, center, area);
    }
  }

  createParkingLotDetails(poly, bounds, center, area) {
    if (area < 140) return;
    const longAxisX = (bounds.maxX - bounds.minX) >= (bounds.maxZ - bounds.minZ);
    const spacing = 8.5;
    const stripeCount = Math.min(34, Math.max(4, Math.floor(Math.sqrt(area) / 4.2)));
    const stripeGeos = [];
    const start = -((stripeCount - 1) * spacing) / 2;
    for (let i = 0; i < stripeCount; i++) {
      const offset = start + i * spacing;
      const a = longAxisX ? new THREE.Vector2(center.x + offset, bounds.minZ + 4) : new THREE.Vector2(bounds.minX + 4, center.y + offset);
      const b = longAxisX ? new THREE.Vector2(center.x + offset, bounds.maxZ - 4) : new THREE.Vector2(bounds.maxX - 4, center.y + offset);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      if (!this.isPointInPolygon(mid, poly)) continue;
      const geo = this.createSurfaceSegmentGeometry(a, b, 0.16, 0.32);
      if (geo) stripeGeos.push(geo);
    }
    if (stripeGeos.length) {
      const merged = this.safeMergeGeometries(stripeGeos);
      const stripeMesh = new THREE.Mesh(merged, this.materials.roadEdgeLine ?? this.materials.sidewalk);
      stripeMesh.userData = { feature: "parking-stripes", source: "osm-parking" };
      this.group.add(stripeMesh);
    }

    const carSlots = Math.min(18, Math.max(2, Math.floor(area / 520)));
    for (let i = 0; i < carSlots; i++) {
      const x = bounds.minX + this.rng.next() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + this.rng.next() * (bounds.maxZ - bounds.minZ);
      if (!this.isPointInPolygon(new THREE.Vector2(x, z), poly)) continue;
      this.worldDetailBatches.parkedCars.push({ pos: new THREE.Vector2(x, z), y: this.terrain.getWorldHeight(x, z) + 0.78, angle: this.rng.next() * Math.PI * 2 });
    }
  }

  createSportsSurfaceDetails(surfaceType, poly, bounds, center, area) {
    if (area < 80) return;
    const mat = this.materials.roadEdgeLine ?? this.materials.sidewalk;
    const geos = [];
    const inset = surfaceType === "baseball" ? 9 : 5;
    const p1 = new THREE.Vector2(bounds.minX + inset, bounds.minZ + inset);
    const p2 = new THREE.Vector2(bounds.maxX - inset, bounds.minZ + inset);
    const p3 = new THREE.Vector2(bounds.maxX - inset, bounds.maxZ - inset);
    const p4 = new THREE.Vector2(bounds.minX + inset, bounds.maxZ - inset);
    for (const [a, b] of [[p1,p2],[p2,p3],[p3,p4],[p4,p1]]) {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      if (this.isPointInPolygon(mid, poly)) {
        const geo = this.createSurfaceSegmentGeometry(a, b, 0.18, 0.33);
        if (geo) geos.push(geo);
      }
    }
    if (surfaceType === "tennis") {
      const midLineA = new THREE.Vector2(center.x, bounds.minZ + inset);
      const midLineB = new THREE.Vector2(center.x, bounds.maxZ - inset);
      const geo = this.createSurfaceSegmentGeometry(midLineA, midLineB, 0.14, 0.34);
      if (geo) geos.push(geo);
    }
    if (geos.length) {
      const mesh = new THREE.Mesh(this.safeMergeGeometries(geos), mat);
      mesh.userData = { feature: "sports-markings", surfaceType, source: "osm-sports" };
      this.group.add(mesh);
    }
  }

  createExplicitOsmTreeNodes(elements = []) {
    const positions = [];
    const limit = this.currentSize / 2;
    for (const element of elements) {
      if (element.type !== "node" || element.tags?.natural !== "tree") continue;
      const p = this.project(element.lat, element.lon);
      if (Math.abs(p.x) > limit || Math.abs(p.y) > limit) continue;
      if (!this.isSmartLocation(p.x, p.y, "explicit-tree")) continue;
      positions.push({ x: p.x, z: p.y, sizeBand: 1.1 + this.rng.next() * 0.65, clump: 1 });
    }
    if (!positions.length) return;
    this.osmReplicaStats.treeNodes += positions.length;
    this.vegetationLOD.scatterIndividual({
      positions,
      zoneType: "park",
      lat: this.centerLat,
      lon: this.centerLon,
      rng: this.rng,
      isValidLocation: (x, z) => this.isSmartLocation(x, z, "explicit-tree")
    });
  }

  scatterResidentialCanopyClustersLOD() {
    const remaining = this.vegetationLOD?.getRemainingTreeBudget?.() ?? 0;
    if (remaining <= 0) return;
    const positions = [];
    const zones = this.residentialBlockZones ?? [];
    for (const zone of zones) {
      const area = Math.abs(THREE.ShapeUtils.area(zone.polygon ?? []));
      if (area < 600) continue;
      const target = Math.max(4, Math.min(24, Math.floor(area / 950)));
      for (let i = 0; i < target; i++) {
        const x = zone.bounds.minX + this.rng.next() * (zone.bounds.maxX - zone.bounds.minX);
        const z = zone.bounds.minZ + this.rng.next() * (zone.bounds.maxZ - zone.bounds.minZ);
        const p = new THREE.Vector2(x, z);
        if (!this.isPointInPolygon(p, zone.polygon)) continue;
        if (!this.isSmartLocation(x, z, "residential-canopy")) continue;
        // leave some open yards so houses are still readable at tactical zoom
        if (this.deterministicCanopyNoise(x, z, 53) > 0.64) continue;
        positions.push({ x, z, sizeBand: 1.25 + this.rng.next() * 0.55, clump: this.rng.next() < 0.36 ? 2 : 1 });
        if (positions.length >= Math.min(remaining, this.currentSize <= 500 ? 150 : 260)) break;
      }
      if (positions.length >= Math.min(remaining, this.currentSize <= 500 ? 150 : 260)) break;
    }
    if (!positions.length) return;
    this.osmReplicaStats.inferredResidentialCanopyTrees += positions.length;
    this.vegetationLOD.scatterIndividual({
      positions,
      zoneType: "forest",
      lat: this.centerLat,
      lon: this.centerLon,
      rng: this.rng,
      isValidLocation: (x, z) => this.isSmartLocation(x, z, "residential-canopy")
    });
  }

  createRegion(way, nodes, type) {
    const rawPts = this.getWayPoints(way, nodes);
    if (rawPts.length < 3) return;

    const limit = this.currentSize / 2;
    const pts = this.clipPolygonToBounds(rawPts, limit);
    if (pts.length < 3) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const point of pts) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.y);
      maxZ = Math.max(maxZ, point.y);
    }

    const center = new THREE.Vector2((minX + maxX) / 2, (minZ + maxZ) / 2);
    const holes = type === "water" ? this.resolveRegionInnerRings(way, nodes) : [];
    const bounds = { minX, maxX, minZ, maxZ };

    // D38.6: only water regions should render as flat polygon surfaces.
    // Vegetation/ground-classification polygons are placement and tactical metadata,
    // not visible map plates. Rendering forest/wetland/scrub/park regions as a
    // single ShapeGeometry at centroid height creates obvious floating blankets
    // on sloped terrain and creek banks. Let trees, shrubs, reeds, and canopy
    // mounds carry the visual vegetation instead.
    let mesh = null;
    const shouldRenderRegionSurface = type === "water";
    if (shouldRenderRegionSurface) {
      const shape = new THREE.Shape(pts);
      for (const hole of holes) {
        if (hole.length >= 3) shape.holes.push(new THREE.Path(hole));
      }
      mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.materials[type] ?? this.materials.park);
      mesh.rotateX(Math.PI / 2);
      mesh.position.y = this.terrain.getHeight(center.x, center.y, this.centerLat, this.centerLon, this.scaleFactor) + (type === "water" ? 0.16 : 0.22);
      mesh.userData = {
        feature: type,
        tags: way.tags,
        layer: type === "water" ? "water" : "vegetation",
        osmGroundClassification: type !== "water"
      };
      this.group.add(mesh);
    }

    if (type === "water") {
      if (!mesh) return;
      const waterFeature = this.createWaterFeatureMetadata(pts, bounds, holes, way.tags, mesh);
      mesh.userData.waterType = waterFeature.waterType;
      mesh.userData.waterDepth = waterFeature.estimatedDepth;
      mesh.userData.flowSpeed = waterFeature.flowSpeed;
      mesh.userData.flowVector = waterFeature.flowVector;
      mesh.userData.surfaceElevation = waterFeature.surfaceElevation;
      mesh.userData.terrainModified = false;
      mesh.renderOrder = 3;
      this.waterMeshes.push(mesh);
      this.waterFeatures.push(waterFeature);
      this.waterPolygons.push({ points: pts, bounds, holes, type, tags: way.tags, source: "osm-water", feature: waterFeature });
      this.createWaterShoreline(pts, bounds);
      for (const hole of holes) this.createWaterIslandReconstruction(hole, { source: "osm-inner-ring", renderLand: false });
      this.createWaterVegetationHint(pts, bounds);
    }

    if (type === "park" || type === "forest" || type === "wetland" || type === "scrub") {
      const zone = {
        polygon: pts,
        bounds,
        type,
        source: "osm-ground-classification",
        tags: way.tags,
        osmId: way.id,
        visibleSurface: shouldRenderRegionSurface
      };
      this.vegetationZones.push(zone);
      // Parks/grass areas are useful for scatter and tactical terrain metadata,
      // but rendering a persistent mass layer over open parks reads like an
      // accidental blanket. Forest/wetland/scrub still get the readability layer.
      if (type !== "park") this.createVegetationReadabilityLayer(zone, center);
    }
  }

  createVegetationReadabilityLayer(zone, center) {
    const { polygon, bounds, type } = zone;
    const area = Math.max(1, Math.abs(THREE.ShapeUtils.area(polygon)));
    if (area < 120) return;

    // Phase 10G.3: forests and parks must remain readable from tactical altitude.
    // This is a persistent mass layer underneath the detailed tree LODs, so a
    // forest becomes a forest-shaped volume instead of disappearing into dots.
    const mat = type === "forest"
      ? (this.materials.forestCanopyDark ?? this.materials.forest)
      : type === "wetland"
        ? (this.materials.wetlandCanopy ?? this.materials.wetland)
        : type === "scrub"
          ? (this.materials.forestCanopy ?? this.materials.scrub)
          : (this.materials.parkCanopy ?? this.materials.park);

    const reconstruction = !!zone.reconstruction;
    const moundCount = type === "forest"
      ? Math.min(reconstruction ? 84 : 160, Math.max(8, Math.floor(area / (reconstruction ? 1700 : 950))))
      : type === "park"
        ? Math.min(reconstruction ? 30 : 48, Math.max(3, Math.floor(area / (reconstruction ? 3900 : 2800))))
        : Math.min(reconstruction ? 54 : 90, Math.max(4, Math.floor(area / (reconstruction ? 2400 : 1500))));

    const geo = type === "forest"
      ? new THREE.SphereGeometry(1, 8, 5)
      : new THREE.SphereGeometry(1, 7, 4);
    const mounds = new THREE.InstancedMesh(geo, mat, moundCount);
    const dummy = new THREE.Object3D();
    let added = 0;
    let attempts = 0;
    while (added < moundCount && attempts < moundCount * 16) {
      attempts++;
      const x = bounds.minX + this.rng.next() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + this.rng.next() * (bounds.maxZ - bounds.minZ);
      const pt = new THREE.Vector2(x, z);
      if (!this.isPointInPolygon(pt, polygon)) continue;
      if (!this.isSmartLocation(x, z)) continue;
      if (reconstruction) {
        const edgeDistance = this.distanceToPolygonEdges(pt, polygon);
        const edgeKeep = THREE.MathUtils.clamp(edgeDistance / 12, 0.16, 0.95);
        if (this.rng.next() > edgeKeep) continue;
        // Punch small holes in the persistent canopy layer so it supports the
        // individual trees instead of becoming a continuous dark blanket.
        if (Math.sin(x * 0.115 + z * 0.071) + Math.sin(x * 0.051 - z * 0.129) > 1.16) continue;
      }

      const h = this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor);
      const base = (type === "forest" ? 8.5 : type === "park" ? 5.5 : 6.5) * (reconstruction ? 0.82 : 1);
      const sx = base + this.rng.next() * base * (reconstruction ? 0.9 : 1.35);
      const sz = base + this.rng.next() * base * (reconstruction ? 0.9 : 1.35);
      const sy = type === "forest" ? 1.8 + this.rng.next() * (reconstruction ? 3.0 : 4.5) : 0.9 + this.rng.next() * 1.6;
      dummy.position.set(x, h + sy * 0.42 + 0.35, z);
      dummy.scale.set(sx, sy, sz);
      dummy.rotation.set(0, this.rng.next() * Math.PI * 2, 0);
      dummy.updateMatrix();
      mounds.setMatrixAt(added, dummy.matrix);
      added++;
    }

    if (!added) {
      geo.dispose();
      return;
    }

    if (added < moundCount) mounds.count = added;
    mounds.instanceMatrix.needsUpdate = true;
    mounds.frustumCulled = false;
    mounds.userData = {
      feature: `${type}-canopy-mass`,
      layer: "vegetation",
      persistentRepresentation: true,
      zoneType: type,
      area
    };
    this.vegGroup.add(mounds);
  }

  resolveRegionInnerRings(way, nodes) {
    // D22: OSM multipolygon water can include inner rings. Those inner rings are
    // islands/holes and must stay as land so ponds do not swallow island terrain.
    const rings = [];
    for (const ring of way.innerRings ?? []) {
      const raw = [];
      for (const id of ring ?? []) {
        if (nodes[id]) raw.push(this.project(nodes[id].lat, nodes[id].lon));
      }
      if (raw.length < 3) continue;
      const clipped = this.clipPolygonToBounds(raw, this.currentSize * 0.5);
      if (clipped.length >= 3) rings.push(clipped);
    }
    return rings;
  }


  getIslandSurfaceHeight(islandOrCenter) {
    const center = islandOrCenter?.center ?? islandOrCenter;
    if (!center) return 0.9;
    // D25: water is a flat visual surface that can otherwise cover tiny island
    // polygons. Give reconstructed pond islands a deliberately raised land plane
    // so they read as landforms instead of submerged biome decals.
    return this.terrain.getHeight(center.x, center.y, this.centerLat, this.centerLon, this.scaleFactor) + 1.18;
  }

  prepareIslandLandMaterial() {
    const base = this.materials.park ?? this.materials.grass;
    const mat = base?.clone?.() ?? base;
    if (mat) {
      mat.depthWrite = true;
      mat.depthTest = true;
      mat.transparent = false;
      mat.opacity = 1;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -36;
      mat.polygonOffsetUnits = -36;
    }
    return mat;
  }

  createWaterIslandReconstruction(points, { source = "generated", renderLand = true } = {}) {
    if (!points || points.length < 3) return;
    const clipped = this.clipPolygonToBounds(points, this.currentSize * 0.5);
    if (clipped.length < 3) return;
    const bounds = this.boundsForPolygon(clipped);
    const center = this.centroidForPolygon(clipped);
    const interior = this.shrinkPolygonTowardCentroid(clipped, 5.5);
    const interiorBounds = interior.length >= 3 ? this.boundsForPolygon(interior) : bounds;
    const surfaceY = this.getIslandSurfaceHeight(center);
    this.waterIslands.push({ points: clipped, bounds, source, interior, interiorBounds, center, surfaceY });

    const landMat = renderLand ? this.prepareIslandLandMaterial() : null;
    if (landMat) {
      const land = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(clipped)), landMat);
      land.rotateX(Math.PI / 2);
      land.position.y = surfaceY;
      land.renderOrder = 12;
      land.userData = { feature: "island-land", layer: "terrain", source, generated: true };
      this.group.add(land);
    }

    // D26: do not add the previous translucent wet-bank overlay on island land.
    // In top-down play it read as an unwanted light-green patch and could look
    // like an extra map layer rather than shoreline detail. Reeds/shrubs from
    // scatterWaterIslandBiomeLOD now carry the island edge visually.

    // D23: do not feed water islands into the normal canopy-zone generator.
    // The generic zone pass places trunks on land but lets large crowns spill
    // over water. Islands now get a dedicated biome pass that contains full
    // canopy in the interior and uses shrubs/reeds/saplings along the edge.
    this.reconstructionZones.push({ id: `${source}-water-island`, type: "island", density: "d23-dense-riparian", shorelineBuffer: 5.5 });
  }

  injectSmallSlicePondIslandReconstruction() {
    if (!this.isSmallSliceTestMap()) return;
    // D22: the Bryant Park pond has a real vegetated island. Until the live
    // canopy/imagery layer is connected, model it explicitly in the small-slice
    // test range so water does not cover it and the vegetation generator can use it.
    const mainIsland = this.ellipsePolygon(-78, -83, 33, 21, 13, 24);
    // D27: keep the hand-authored island only as invisible support geometry for
    // water exclusion and contained vegetation. Rendering the helper ellipse
    // produced the unwanted light-green oval in review screenshots.
    this.createWaterIslandReconstruction(mainIsland, { source: "small-slice-pond-main", renderLand: false });

    // D26: leave out the small hand-authored emergent patches. In the review
    // screenshots these read as stray light-green artifacts. Keep only the real
    // central island until live imagery/OSM supplies more reliable island rings.
  }


  createWaterFeatureMetadata(points, bounds, holes = [], tags = {}, mesh = null) {
    const waterType = tags.waterway ?? tags.water ?? (tags.natural === "water" ? "pond" : "water");
    const sampled = this.sampleWaterTerrainStats(points, bounds, holes);
    const estimatedDepth = this.estimateWaterDepth(waterType, tags);
    const flowSpeed = this.estimateWaterFlowSpeed(waterType, tags);
    const flowVector = this.estimatePolygonFlowVector(points, waterType);
    // Closed ponds/lakes should read as level surfaces. Put them near the lower
    // quartile of the existing terrain so the basin cut creates visible banks
    // without flooding nearby grass. Rivers/streams keep a modest flow vector.
    const surfaceElevation = Number.isFinite(sampled.lowShore)
      ? sampled.lowShore + 0.10
      : this.terrain.getHeight((bounds.minX + bounds.maxX) * 0.5, (bounds.minZ + bounds.maxZ) * 0.5, this.centerLat, this.centerLon, this.scaleFactor) + 0.12;
    return {
      kind: "water",
      type: "water",
      waterType,
      points,
      polygon: points,
      bounds,
      holes,
      tags,
      mesh,
      source: "osm-water",
      area: Math.abs(THREE.ShapeUtils.area(points ?? [])),
      surfaceElevation,
      terrainMin: sampled.min,
      terrainMax: sampled.max,
      terrainAvg: sampled.avg,
      lowShoreElevation: sampled.lowShore,
      estimatedDepth,
      flowSpeed,
      flowVector,
      terrainModified: false
    };
  }

  sampleWaterTerrainStats(points, bounds, holes = []) {
    const samples = [];
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanZ = Math.max(1, bounds.maxZ - bounds.minZ);
    const stepsX = Math.max(3, Math.min(10, Math.ceil(spanX / 18)));
    const stepsZ = Math.max(3, Math.min(10, Math.ceil(spanZ / 18)));
    for (let ix = 0; ix <= stepsX; ix++) {
      for (let iz = 0; iz <= stepsZ; iz++) {
        const x = bounds.minX + (spanX * ix) / stepsX;
        const z = bounds.minZ + (spanZ * iz) / stepsZ;
        const p = new THREE.Vector2(x, z);
        if (!this.isPointInPolygon(p, points)) continue;
        if ((holes ?? []).some((hole) => this.isPointInPolygon(p, hole))) continue;
        samples.push(this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor));
      }
    }
    for (const p of points) samples.push(this.terrain.getHeight(p.x, p.y, this.centerLat, this.centerLon, this.scaleFactor));
    if (!samples.length) return { min: 0, max: 0, avg: 0, lowShore: 0 };
    samples.sort((a, b) => a - b);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const lowShore = samples[Math.floor(samples.length * 0.28)] ?? samples[0];
    return { min: samples[0], max: samples[samples.length - 1], avg, lowShore };
  }

  applyWaterTerrainInteractions() {
    if (!this.waterFeatures?.length) {
      this.terrain?.setWaterBasinModifiers?.([]);
      return;
    }
    const modifiers = [];
    for (const feature of this.waterFeatures) {
      const type = feature.waterType ?? "water";
      const isClosedStillWater = !["river", "stream", "canal", "ditch", "drain"].includes(type);
      const targetDepth = isClosedStillWater ? Math.min(2.2, Math.max(0.45, feature.estimatedDepth ?? 1.0)) : Math.min(0.85, Math.max(0.18, (feature.estimatedDepth ?? 0.6) * 0.35));
      modifiers.push({
        type: "water-basin",
        polygon: feature.points,
        bounds: feature.bounds,
        holes: feature.holes,
        depth: targetDepth,
        rimWidth: isClosedStillWater ? 18 : 8,
        waterType: type
      });
      feature.terrainModified = true;
    }
    this.terrain?.setWaterBasinModifiers?.(modifiers);

    for (const feature of this.waterFeatures) {
      if (!feature.mesh) continue;
      const refreshed = this.sampleWaterTerrainStats(feature.points, feature.bounds, feature.holes);
      feature.terrainMin = refreshed.min;
      feature.terrainMax = refreshed.max;
      feature.terrainAvg = refreshed.avg;
      feature.actualDepth = Math.max(0, feature.surfaceElevation - refreshed.min);
      feature.mesh.position.y = feature.surfaceElevation;
      feature.mesh.userData.surfaceElevation = feature.surfaceElevation;
      feature.mesh.userData.actualDepth = feature.actualDepth;
      feature.mesh.userData.terrainModified = true;
    }
  }

  estimatePolygonFlowVector(points, waterType = "water") {
    if (!["river", "stream", "canal", "ditch", "drain"].includes(waterType)) return { x: 0, z: 0 };
    return this.estimatePathFlowVector(points);
  }

  createWaterShoreline(points, bounds) {
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector2()).divideScalar(points.length);

    // D42: Do not render filled polygon shoreline/bank helper surfaces. The old
    // center-outward ring expansion can self-intersect on concave rivers and
    // clipped water polygons, producing the large light-blue/green triangular
    // artifact visible when only Terrain + Water is enabled. Keep physical water
    // constrained to the OSM water polygon and let reeds/rocks/shrubs carry the
    // shoreline detail.
    this.createPolygonWaterEdgeDetails(points, center);
  }

  createPolygonWaterEdgeDetails(points, center) {
    const reedMatrices = [];
    const rockMatrices = [];
    const shrubMatrices = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dist = a.distanceTo(b);
      if (dist < 8 || dist > this.currentSize) continue;
      const dir = new THREE.Vector2().subVectors(b, a).normalize();
      const outward = new THREE.Vector2().subVectors(a.clone().lerp(b, 0.5), center);
      if (outward.lengthSq() === 0) continue;
      outward.normalize();

      const spacing = 8 + this.rng.next() * 8;
      for (let s = 3; s < dist - 3; s += spacing + this.rng.next() * 8) {
        const baseX = a.x + dir.x * s;
        const baseZ = a.y + dir.y * s;
        const jitter = (this.rng.next() - 0.5) * 3.5;
        const band = 2.2 + this.rng.next() * 8;
        const x = baseX + outward.x * band + dir.x * jitter;
        const z = baseZ + outward.y * band + dir.y * jitter;
        if (!this.isSmartLocation(x, z)) continue;
        const h = this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor);

        const detailRoll = this.rng.next();
        if (detailRoll < 0.46) {
          dummy.position.set(x, h + 0.35, z);
          dummy.scale.set(0.35 + this.rng.next() * 0.28, 0.7 + this.rng.next() * 1.2, 0.35 + this.rng.next() * 0.28);
          dummy.rotation.set((this.rng.next() - 0.5) * 0.18, this.rng.next() * Math.PI * 2, (this.rng.next() - 0.5) * 0.18);
          dummy.updateMatrix();
          reedMatrices.push(dummy.matrix.clone());
        } else if (detailRoll < 0.82) {
          // Phase 2: low, full shoreline bushes to soften the pond edge.
          dummy.position.set(x, h + 0.55, z);
          const scale = 0.85 + this.rng.next() * 1.65;
          dummy.scale.set(scale * (1.15 + this.rng.next() * 0.7), scale * (0.45 + this.rng.next() * 0.35), scale * (0.95 + this.rng.next() * 0.8));
          dummy.rotation.set(0, this.rng.next() * Math.PI * 2, 0);
          dummy.updateMatrix();
          shrubMatrices.push(dummy.matrix.clone());
        } else {
          dummy.position.set(x, h + 0.08, z);
          const scale = 0.35 + this.rng.next() * 0.65;
          dummy.scale.set(scale * (1.2 + this.rng.next()), scale * 0.35, scale * (0.9 + this.rng.next() * 0.8));
          dummy.rotation.set(0, this.rng.next() * Math.PI * 2, 0);
          dummy.updateMatrix();
          rockMatrices.push(dummy.matrix.clone());
        }
      }
    }

    this.flushWaterEdgeDetailInstances(reedMatrices, rockMatrices, "polygon-shoreline", shrubMatrices);
  }

  createLinearWaterEdgeDetails(points, halfWidth, waterway) {
    const reedMatrices = [];
    const rockMatrices = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dist = a.distanceTo(b);
      if (dist < 12 || dist > this.currentSize) continue;
      const dir = new THREE.Vector2().subVectors(b, a).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);

      for (let s = 4 + this.rng.next() * 6; s < dist - 4; s += 10 + this.rng.next() * 10) {
        for (const side of [-1, 1]) {
          if (this.rng.next() < 0.28) continue;
          const edgeOffset = halfWidth + 1.8 + this.rng.next() * 5.5;
          const x = a.x + dir.x * s + perp.x * edgeOffset * side;
          const z = a.y + dir.y * s + perp.y * edgeOffset * side;
          if (!this.isSmartLocation(x, z)) continue;
          const h = this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor);

          if (this.rng.next() < (waterway === "river" ? 0.55 : 0.78)) {
            dummy.position.set(x, h + 0.38, z);
            dummy.scale.set(0.28 + this.rng.next() * 0.2, 0.7 + this.rng.next() * 1.1, 0.28 + this.rng.next() * 0.2);
            dummy.rotation.set((this.rng.next() - 0.5) * 0.22, this.rng.next() * Math.PI * 2, (this.rng.next() - 0.5) * 0.22);
            dummy.updateMatrix();
            reedMatrices.push(dummy.matrix.clone());
          } else {
            dummy.position.set(x, h + 0.08, z);
            const scale = 0.25 + this.rng.next() * 0.55;
            dummy.scale.set(scale * 1.5, scale * 0.35, scale);
            dummy.rotation.set(0, this.rng.next() * Math.PI * 2, 0);
            dummy.updateMatrix();
            rockMatrices.push(dummy.matrix.clone());
          }
        }
      }
    }

    this.flushWaterEdgeDetailInstances(reedMatrices, rockMatrices, `linear-${waterway}`);
  }

  flushWaterEdgeDetailInstances(reedMatrices, rockMatrices, source = "water-edge", shrubMatrices = []) {
    if (reedMatrices.length) {
      const reedGeo = new THREE.CylinderGeometry(0.08, 0.14, 1, 5);
      const reeds = new THREE.InstancedMesh(reedGeo, this.materials.reed ?? this.materials.scrub, reedMatrices.length);
      reedMatrices.forEach((matrix, index) => reeds.setMatrixAt(index, matrix));
      reeds.instanceMatrix.needsUpdate = true;
      reeds.userData = { feature: "shoreline-reeds", source };
      this.vegGroup.add(reeds);
    }

    if (shrubMatrices.length) {
      const shrubGeo = new THREE.DodecahedronGeometry(1, 0);
      const shrubMat = this.materials.scrub ?? this.materials.forestCanopy ?? this.materials.leaves;
      const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubMatrices.length);
      shrubMatrices.forEach((matrix, index) => shrubs.setMatrixAt(index, matrix));
      shrubs.instanceMatrix.needsUpdate = true;
      shrubs.castShadow = true;
      shrubs.receiveShadow = true;
      shrubs.userData = { feature: "shoreline-bushes", source, layer: "vegetation" };
      this.vegGroup.add(shrubs);
    }

    if (rockMatrices.length) {
      const rockGeo = new THREE.DodecahedronGeometry(1, 0);
      const rocks = new THREE.InstancedMesh(rockGeo, this.materials.shorelineRock ?? this.materials.railway, rockMatrices.length);
      rockMatrices.forEach((matrix, index) => rocks.setMatrixAt(index, matrix));
      rocks.instanceMatrix.needsUpdate = true;
      rocks.userData = { feature: "shoreline-rocks", source };
      this.vegGroup.add(rocks);
    }
  }

  createWaterVegetationHint(points, bounds) {
    // Treat broad water edges as vegetation attractors for the existing riverbank pass.
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a.distanceTo(b) > 12) this.waterSegments.push({ a, b, width: 16, waterway: "shoreline" });
    }
  }

  renderPath(points, material, width, isBridge = false, yOffset = 0.5) {
    const densePoints = [];
    const limit = this.currentSize / 2;
    const first = points[0];
    const last = points[points.length - 1];
    const entryH = this.terrain.getHeight(first.x, first.y, this.centerLat, this.centerLon, this.scaleFactor) + yOffset;
    const exitH = this.terrain.getHeight(last.x, last.y, this.centerLat, this.centerLon, this.scaleFactor) + yOffset;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = p1.distanceTo(p2);
      const steps = Math.max(1, Math.ceil(dist / 10));
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const z = p1.y + (p2.y - p1.y) * t;
        if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
        const y = isBridge ? entryH + (exitH - entryH) * ((i + t) / (points.length - 1)) : this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor) + yOffset;
        densePoints.push(new THREE.Vector3(x, y, z));
      }
    }

    if (densePoints.length > 1) return this.renderStrip(densePoints, material, width);
    return null;
  }

  renderStrip(densePts, material, width) {
    const verts = [];
    const uvs = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < densePts.length - 1; i++) {
      const p1 = densePts[i];
      const p2 = densePts[i + 1];
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const norm = new THREE.Vector3().crossVectors(dir, up).normalize();
      const v1 = p1.clone().addScaledVector(norm, width);
      const v2 = p1.clone().addScaledVector(norm, -width);
      const v3 = p2.clone().addScaledVector(norm, width);
      const v4 = p2.clone().addScaledVector(norm, -width);
      verts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z, v2.x, v2.y, v2.z, v4.x, v4.y, v4.z, v3.x, v3.y, v3.z);
      uvs.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    this.group.add(mesh);
    return mesh;
  }


  createLandmarkRegistry() {
    // v18 reconstruction scaffold: OSM tags are mapped to landmark renderers here.
    // Water towers are the first supported landmark; schools/churches/substations
    // are intentionally registered now so future passes can add dedicated models
    // without touching the OSM parsing pipeline again.
    return {
      water_tower: { tags: { man_made: "water_tower" }, renderer: "waterTower" },
      school: { tags: { amenity: "school" }, renderer: "campus" },
      church: { tags: { amenity: "place_of_worship" }, renderer: "church" },
      apartment: { tags: { building: "apartments" }, renderer: "apartmentBlock" },
      substation: { tags: { power: "substation" }, renderer: "substation" }
    };
  }

  injectSmallSliceReconstructionFramework() {
    if (!this.isSmallSliceTestMap()) return;

    this.injectSmallSlicePondIslandReconstruction();

    // v18: manual reconstruction zones for the 350m test range.  These are not
    // intended to be final truth data. They prove the architecture we will later
    // connect to canopy/landcover data: canopy polygons drive trees, surface
    // polygons drive ground materials, and procedural random fill becomes a fallback.
    const canopyZones = [
      // D20: keep D19's overall canopy ambition, but reduce painted density and
      // let VegetationLODManager break these zones into tree communities with
      // internal gaps, edge erosion, and mixed height classes.
      { id: "pond-canopy-northwest", type: "wetland", polygon: this.ellipsePolygon(-112, -78, 82, 54, 22, 28), density: 1.22, dominantSpecies: "mixed-riparian", avgHeight: 14 },
      { id: "pond-canopy-east", type: "forest", polygon: this.ellipsePolygon(-44, -50, 68, 48, -8, 28), density: 1.16, dominantSpecies: "mature-deciduous", avgHeight: 17 },
      // D25: island vegetation is now handled by scatterWaterIslandBiomeLOD so
      // generic canopy zones do not put oversized crowns/trunks into open water.
      { id: "shoreline-south-canopy", type: "wetland", polygon: this.rotatedRectPolygon(-82, -20, 145, 34, -6), density: 1.08, dominantSpecies: "shoreline-buffer", avgHeight: 13 },
      { id: "rear-lot-canopy-west", type: "forest", polygon: this.rotatedRectPolygon(-108, 44, 128, 54, -10), density: 1.06, dominantSpecies: "mature-deciduous", avgHeight: 16 },
      { id: "rear-lot-canopy-central", type: "forest", polygon: this.rotatedRectPolygon(-10, 36, 122, 50, 8), density: 0.92, dominantSpecies: "mixed-yard", avgHeight: 14 },
      { id: "southwest-block-canopy", type: "forest", polygon: this.ellipsePolygon(-116, 112, 74, 48, -18, 24), density: 1.12, dominantSpecies: "mature-backyard", avgHeight: 16 },
      { id: "south-central-block-canopy", type: "forest", polygon: this.ellipsePolygon(-16, 106, 58, 42, 10, 22), density: 0.95, dominantSpecies: "mature-backyard", avgHeight: 15 },
      { id: "east-residential-backyard-canopy", type: "park", polygon: this.rotatedRectPolygon(62, 34, 74, 128, -2), density: 0.82, dominantSpecies: "yard-canopy", avgHeight: 12 },
      { id: "apartment-perimeter-canopy", type: "park", polygon: this.rotatedRectPolygon(112, 2, 84, 64, -4), density: 0.76, dominantSpecies: "ornamental", avgHeight: 11 },
      { id: "water-tower-neighborhood-canopy", type: "park", polygon: this.ellipsePolygon(82, -102, 64, 42, 12, 22), density: 0.66, dominantSpecies: "street-tree", avgHeight: 12 }
    ];

    const surfaceZones = [
      { id: "pond-wet-edge-zone", type: "wet-edge", polygon: this.ellipsePolygon(-82, -66, 74, 48, 16), material: this.materials.wetBank, opacity: 0.26, yOffset: 0.071 },
      { id: "rear-residential-lawn-zone", type: "residential-lawn", polygon: this.rotatedRectPolygon(-62, 42, 188, 58, 0), material: this.materials.park, opacity: 0.30, yOffset: 0.058 },
      { id: "apartment-landscape-zone", type: "commercial-landscape", polygon: this.rotatedRectPolygon(112, 6, 100, 56, -2), material: this.materials.scrub, opacity: 0.24, yOffset: 0.061 },
      { id: "water-tower-open-space-zone", type: "open-grass", polygon: this.ellipsePolygon(84, -104, 70, 42, 8), material: this.materials.park, opacity: 0.22, yOffset: 0.056 }
    ];

    // D38.6: keep hand-authored reconstruction surface zones as metadata only.
    // These flat translucent shapes were useful scaffolding during early small-slice
    // tests, but on real elevation they sit at a single centroid height and appear
    // to float over creek banks and yards.
    for (const zone of surfaceZones) {
      this.reconstructionZones.push({
        id: zone.id,
        type: "surface",
        surfaceType: zone.type,
        visualDisabled: true,
        reason: "d38.6-no-floating-ground-overlays"
      });
    }

    for (const zone of canopyZones) {
      const bounds = this.boundsForPolygon(zone.polygon);
      const clipped = this.clipPolygonToBounds(zone.polygon, this.currentSize * 0.5);
      if (clipped.length < 3) continue;
      const finalZone = { ...zone, polygon: clipped, bounds: this.boundsForPolygon(clipped), reconstruction: true };
      this.vegetationZones.push(finalZone);
      this.createVegetationReadabilityLayer(finalZone, this.centroidForPolygon(clipped));
      this.reconstructionZones.push({ id: zone.id, type: "canopy", density: zone.density, dominantSpecies: zone.dominantSpecies, avgHeight: zone.avgHeight });
    }
  }

  isSmallSliceTestMap() {
    return Math.abs(this.centerLat - 44.849758) < 0.0025
      && Math.abs(this.centerLon - (-93.289793)) < 0.0025
      && this.currentSize <= 420;
  }

  createReconstructionSurfaceZone(zone) {
    const clipped = this.clipPolygonToBounds(zone.polygon, this.currentSize * 0.5);
    if (clipped.length < 3) return;
    const center = this.centroidForPolygon(clipped);
    const material = zone.material?.clone ? zone.material.clone() : zone.material;
    if (!material) return;
    material.transparent = true;
    material.opacity = zone.opacity ?? 0.25;
    material.depthWrite = false;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1.8;
    material.polygonOffsetUnits = -1.8;
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(clipped)), material);
    mesh.rotateX(Math.PI / 2);
    mesh.position.y = this.terrain.getHeight(center.x, center.y, this.centerLat, this.centerLon, this.scaleFactor) + (zone.yOffset ?? 0.06);
    mesh.renderOrder = 1;
    mesh.userData = { feature: "reconstruction-surface-zone", zoneType: zone.type, id: zone.id, generated: true };
    this.group.add(mesh);
    this.reconstructionZones.push({ id: zone.id, type: "surface", surfaceType: zone.type });
  }

  rotatedRectPolygon(cx, cz, width, depth, degrees = 0) {
    const hw = width / 2;
    const hd = depth / 2;
    const pts = [new THREE.Vector2(-hw, -hd), new THREE.Vector2(hw, -hd), new THREE.Vector2(hw, hd), new THREE.Vector2(-hw, hd)];
    const r = THREE.MathUtils.degToRad(degrees);
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    return pts.map((p) => new THREE.Vector2(cx + p.x * cos - p.y * sin, cz + p.x * sin + p.y * cos));
  }

  ellipsePolygon(cx, cz, rx, rz, degrees = 0, segments = 22) {
    const r = THREE.MathUtils.degToRad(degrees);
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const x = Math.cos(a) * rx;
      const z = Math.sin(a) * rz;
      pts.push(new THREE.Vector2(cx + x * cos - z * sin, cz + x * sin + z * cos));
    }
    return pts;
  }

  centroidForPolygon(poly) {
    return poly.reduce((sum, point) => sum.add(point), new THREE.Vector2()).divideScalar(Math.max(1, poly.length));
  }

  boundsForPolygon(poly) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const point of poly) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.y);
      maxZ = Math.max(maxZ, point.y);
    }
    return { minX, maxX, minZ, maxZ };
  }

  populateVegetationZonesLOD() {
    for (const zone of this.vegetationZones) {
      this.vegetationLOD.scatter({
        polygon: zone.polygon,
        bounds: zone.bounds,
        zoneType: zone.type,
        density: zone.density ?? 1,
        reconstruction: !!zone.reconstruction,
        lat: this.centerLat,
        lon: this.centerLon,
        rng: this.rng,
        isValidLocation: (x, z) => this.isVegetationPlacementLocation(x, z, zone.type)
      });
    }
  }

  scatterStreetTreesLOD() {
    // D21: boulevard trees are their own reconstruction layer, not a side-effect
    // of canopy zones. Minneapolis residential streets read as tree-lined corridors;
    // this pass places medium/large specimens along residential edges while keeping
    // intersections, alleys, major roads, driveways, and pavement clear.
    const positions = [];
    const smallSlice = this.isSmallSliceTestMap();
    const eligibleSegments = this.roadSegments.filter((seg) => {
      const dist = seg.a.distanceTo(seg.b);
      if (dist < 48) return false;
      if (["motorway", "trunk", "primary"].includes(seg.highway)) return false;
      return ["residential", "living_street", "tertiary", "secondary"].includes(seg.highway) || (smallSlice && seg.highway === "service" && !this.isAlleySegment(seg));
    });

    const isNearJunction = (point, radius = 16) => {
      for (const key of this.roadJunctions.keys()) {
        const [x, z] = key.split(":").map(Number);
        if (Number.isFinite(x) && Number.isFinite(z) && point.distanceTo(new THREE.Vector2(x, z)) < radius) return true;
      }
      return false;
    };

    const isLikelyDrivewayConflict = (point, seg) => {
      // Driveways and service alleys are short service ways. We do not have exact
      // driveway metadata everywhere, so use service-road proximity plus building
      // edge proximity to leave realistic gaps.
      for (const road of this.roadSegments) {
        if (road === seg) continue;
        if (road.highway !== "service") continue;
        if (this.distToSegment(point, road.a, road.b) < 7) return true;
      }
      for (const b of this.buildingBoxes) {
        if (point.distanceTo(b.center) < 13) return true;
      }
      return false;
    };

    for (const seg of eligibleSegments) {
      const dist = seg.a.distanceTo(seg.b);
      const dir = new THREE.Vector2().subVectors(seg.b, seg.a).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      const isResidential = seg.highway === "residential" || seg.highway === "living_street";
      const baseOffset = Math.max(isResidential ? 7.2 : 9.5, (seg.width ?? 5) + (isResidential ? 4.2 : 5.5));
      const spacingBase = isResidential ? (smallSlice ? 25 : 29) : 35;
      const spacingJitter = isResidential ? 15 : 20;
      const skipChance = isResidential ? 0.16 : 0.30;

      for (let s = 16 + this.rng.next() * 9; s < dist - 16; s += spacingBase + this.rng.next() * spacingJitter) {
        for (const side of [1, -1]) {
          if (this.rng.next() < skipChance) continue;
          const offset = baseOffset + (this.rng.next() - 0.35) * 3.4;
          const x = seg.a.x + dir.x * s + perp.x * offset * side;
          const z = seg.a.y + dir.y * s + perp.y * offset * side;
          const point = new THREE.Vector2(x, z);
          if (isNearJunction(point, isResidential ? 14 : 18)) continue;
          if (isLikelyDrivewayConflict(point, seg)) continue;
          if (this.isVegetationPlacementLocation(x, z, "street-tree")) positions.push({ x, z, sizeBand: 1.15 + this.rng.next() * 0.42, clump: this.rng.next() < 0.22 ? 2 : 1 });
        }
      }
    }

    if (positions.length) {
      this.vegetationLOD.scatterIndividual({
        positions,
        zoneType: "park",
        lat: this.centerLat,
        lon: this.centerLon,
        rng: this.rng,
        isValidLocation: (x, z) => this.isVegetationPlacementLocation(x, z, "street-tree")
      });
      this.reconstructionZones.push({ id: "d21-boulevard-street-trees", type: "canopy", dominantSpecies: "street-tree-corridors", count: positions.length });
    }
  }



  scatterExternalCanopyProbeLOD() {
    // D37 research spike: use Microsoft Planetary Computer NAIP rendered imagery
    // as an external canopy candidate mask. This is not yet a production-grade
    // tree-crown detector. It is a pipeline test: can the browser fetch public
    // imagery, classify green/canopy-ish pixels, and feed those candidates into
    // the existing tactical vegetation renderer while respecting roads/buildings/water?
    const grid = this.externalCanopy;
    if (!grid?.available || !Array.isArray(grid.values) || !grid.values.length) return;

    const size = this.currentSize;
    const rows = grid.values.length;
    const cols = grid.values[0]?.length ?? 0;
    if (!cols) return;

    const positions = [];
    const areaScale = Math.max(0.18, Math.min(1, (size * size) / (1000 * 1000)));
    const maxCanopyTrees = Math.round(55 + 340 * areaScale);
    const threshold = 0.24;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const score = grid.values[row][col] ?? 0;
        if (score < threshold) continue;
        // Convert grid cell to world location. Add deterministic jitter so the
        // result reads as individual trees/clusters rather than a raster grid.
        const cellW = size / cols;
        const cellH = size / rows;
        const x = -size / 2 + (col + 0.5) * cellW + (this.rng.next() - 0.5) * cellW * 0.75;
        const z = -size / 2 + (row + 0.5) * cellH + (this.rng.next() - 0.5) * cellH * 0.75;
        if (!this.isSmartLocation(x, z)) continue;

        // Avoid simply painting every green lawn as a forest. Candidate cells
        // become trees probabilistically, weighted by image score and nearby map context.
        const nearRoad = this.roadSegments.some((seg) => this.distToSegment(new THREE.Vector2(x, z), seg.a, seg.b) < 18);
        const residentialBonus = nearRoad ? 0.18 : 0;
        const chance = Math.max(0.10, Math.min(0.62, (score - threshold) * 1.65 + residentialBonus));
        if (this.rng.next() > chance) continue;

        positions.push({
          x,
          z,
          sizeBand: nearRoad ? 1.05 + this.rng.next() * 0.45 : 0.9 + this.rng.next() * 0.55,
          clump: score > 0.56 && this.rng.next() < 0.32 ? 2 : 1,
          source: "planetary-naip-canopy-probe"
        });
        if (positions.length >= maxCanopyTrees) break;
      }
      if (positions.length >= maxCanopyTrees) break;
    }

    if (!positions.length) return;
    this.vegetationLOD.scatterIndividual({
      positions,
      zoneType: "park",
      lat: this.centerLat,
      lon: this.centerLon,
      rng: this.rng,
      isValidLocation: (x, z) => this.isSmartLocation(x, z)
    });
    this.reconstructionZones.push({
      id: "d37-planetary-naip-canopy-probe",
      type: "external-canopy",
      source: grid.source,
      itemId: grid.itemId,
      count: positions.length,
      avgScore: grid.avgScore,
      canopyCells: grid.canopyCells
    });
  }

  scatterCanopyDiffusionLOD() {
    // D21: soften the hard edge of hand-authored canopy zones with fringe trees,
    // pairs, and small clusters. This keeps D20's coverage while making the edge
    // transition read as urban canopy instead of painted forest patches.
    if (!this.isSmallSliceTestMap()) return;
    const positions = [];
    for (const zone of this.vegetationZones) {
      if (!zone.reconstruction || !zone.polygon || !zone.bounds) continue;
      const area = Math.max(1, Math.abs(THREE.ShapeUtils.area(zone.polygon)));
      const count = Math.min(70, Math.max(8, Math.floor(area / (zone.type === "park" ? 520 : 430))));
      let attempts = 0;
      let added = 0;
      while (added < count && attempts < count * 26) {
        attempts++;
        const x = zone.bounds.minX - 20 + this.rng.next() * ((zone.bounds.maxX - zone.bounds.minX) + 40);
        const z = zone.bounds.minZ - 20 + this.rng.next() * ((zone.bounds.maxZ - zone.bounds.minZ) + 40);
        const p = new THREE.Vector2(x, z);
        const inside = this.isPointInPolygon(p, zone.polygon);
        const edgeDistance = this.distanceToPolygonEdges(p, zone.polygon);
        // Accept either just outside the zone or very near a soft inside edge.
        if (inside && edgeDistance > 9) continue;
        if (!inside && edgeDistance > 22) continue;
        if (this.rng.next() > (inside ? 0.52 : THREE.MathUtils.clamp(1 - edgeDistance / 24, 0.12, 0.68))) continue;
        if (!this.isVegetationPlacementLocation(x, z, "canopy-fringe")) continue;
        positions.push({ x, z, sizeBand: 0.72 + this.rng.next() * 0.55, clump: this.rng.next() < 0.36 ? 2 : 1 });
        added++;
      }
    }

    if (positions.length) {
      this.vegetationLOD.scatterIndividual({
        positions,
        zoneType: "park",
        lat: this.centerLat,
        lon: this.centerLon,
        rng: this.rng,
        isValidLocation: (x, z) => this.isVegetationPlacementLocation(x, z, "canopy-fringe")
      });
      this.reconstructionZones.push({ id: "d21-canopy-diffusion", type: "canopy", dominantSpecies: "fringe-transition", count: positions.length });
    }
  }


  shrinkPolygonTowardCentroid(points, inset = 5) {
    if (!points || points.length < 3) return [];
    const center = this.centroidForPolygon(points);
    return points.map((point) => {
      const v = new THREE.Vector2().subVectors(point, center);
      const len = v.length();
      if (len < 0.001) return point.clone();
      const nextLen = Math.max(len * 0.18, len - inset);
      return center.clone().add(v.normalize().multiplyScalar(nextLen));
    });
  }

  scatterWaterIslandBiomeLOD() {
    // D23: land inside ponds behaves like a tiny riparian ecosystem, not a normal
    // yard/park canopy patch. Keep full crowns inside the island interior, then
    // fill the shoreline buffer with reeds, shrubs, and saplings so the island
    // reads as vegetation mass rather than a green polygon with trees on top.
    if (!this.waterIslands?.length) return;

    const reedMatrices = [];
    const shrubMatrices = [];
    const smallTrees = [];
    const mediumTrees = [];
    const dominantTrees = [];
    const dummy = new THREE.Object3D();

    for (const island of this.waterIslands) {
      const points = island.points;
      const interior = island.interior?.length >= 3 ? island.interior : this.shrinkPolygonTowardCentroid(points, 5.5);
      const bounds = island.bounds;
      const interiorBounds = island.interiorBounds ?? this.boundsForPolygon(interior);
      const center = island.center ?? this.centroidForPolygon(points);
      const area = Math.max(1, Math.abs(THREE.ShapeUtils.area(points)));
      const edgeCount = Math.max(10, Math.min(46, Math.floor(area / 22)));
      const interiorCount = Math.max(4, Math.min(20, Math.floor(area / 82)));
      const dominantCount = Math.max(1, Math.min(2, Math.floor(area / 680) + (this.rng.next() < 0.35 ? 1 : 0)));

      // Shoreline buffer: reeds closest to water, shrubs/saplings just inside.
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const dist = a.distanceTo(b);
        if (dist < 3) continue;
        const dir = new THREE.Vector2().subVectors(b, a).normalize();
        const toCenter = new THREE.Vector2().subVectors(center, a.clone().lerp(b, 0.5));
        if (toCenter.lengthSq() === 0) continue;
        toCenter.normalize();
        for (let s = 1.5 + this.rng.next() * 3; s < dist - 1.5; s += 3.2 + this.rng.next() * 3.8) {
          const base = a.clone().add(dir.clone().multiplyScalar(s));
          const jitter = (this.rng.next() - 0.5) * 2.2;
          const band = this.rng.next();
          const inward = band < 0.45 ? 1.0 + this.rng.next() * 2.2 : 3.2 + this.rng.next() * 3.0;
          const p = base.clone().add(toCenter.clone().multiplyScalar(inward)).add(dir.clone().multiplyScalar(jitter));
          if (!this.isPointInPolygon(p, points)) continue;
          const edgeDistance = this.distanceToPolygonEdges(p, points);
          const h = island.surfaceY ?? this.getIslandSurfaceHeight(island);
          if (band < 0.42 && edgeDistance < 3.6) {
            dummy.position.set(p.x, h + 0.10, p.y);
            dummy.scale.set(0.42 + this.rng.next() * 0.26, 0.9 + this.rng.next() * 0.95, 0.42 + this.rng.next() * 0.26);
            dummy.rotation.set(0, this.rng.next() * Math.PI * 2, 0);
            dummy.updateMatrix();
            reedMatrices.push(dummy.matrix.clone());
          } else if (edgeDistance < 7.0) {
            dummy.position.set(p.x, h + 0.08, p.y);
            const scale = 0.8 + this.rng.next() * 1.2;
            dummy.scale.set(scale * (0.9 + this.rng.next() * 0.35), 0.38 + this.rng.next() * 0.38, scale * (0.9 + this.rng.next() * 0.35));
            dummy.rotation.set(0, this.rng.next() * Math.PI * 2, 0);
            dummy.updateMatrix();
            shrubMatrices.push(dummy.matrix.clone());
          }
        }
      }

      // Interior small/medium trees. Require edge clearance so the full canopy
      // stays visually contained inside the island instead of hanging over water.
      let attempts = 0;
      let added = 0;
      while (added < interiorCount && attempts < interiorCount * 36) {
        attempts++;
        const x = interiorBounds.minX + this.rng.next() * (interiorBounds.maxX - interiorBounds.minX);
        const z = interiorBounds.minZ + this.rng.next() * (interiorBounds.maxZ - interiorBounds.minZ);
        const p = new THREE.Vector2(x, z);
        if (!this.isPointInPolygon(p, interior)) continue;
        const edgeDistance = this.distanceToPolygonEdges(p, points);
        if (edgeDistance < 8.5) continue;
        if (this.rng.next() < 0.58) smallTrees.push({ x, z, sizeBand: 0.48 + this.rng.next() * 0.22, clump: 1 });
        else mediumTrees.push({ x, z, sizeBand: 0.72 + this.rng.next() * 0.28, clump: this.rng.next() < 0.35 ? 2 : 1 });
        added++;
      }

      // One to three dominant trees near the middle, contained by edge clearance.
      let domAttempts = 0;
      let domAdded = 0;
      while (domAdded < dominantCount && domAttempts < 42) {
        domAttempts++;
        const angle = this.rng.next() * Math.PI * 2;
        const radius = this.rng.next() * Math.min(8, Math.sqrt(area) * 0.22);
        const x = center.x + Math.cos(angle) * radius;
        const z = center.y + Math.sin(angle) * radius;
        const p = new THREE.Vector2(x, z);
        if (!this.isPointInPolygon(p, interior)) continue;
        if (this.distanceToPolygonEdges(p, points) < 12.0) continue;
        dominantTrees.push({ x, z, sizeBand: 1.02 + this.rng.next() * 0.34, clump: 1 });
        domAdded++;
      }

      this.reconstructionZones.push({
        id: `${island.source ?? "water"}-d23-island-biome`,
        type: "island-biome",
        count: edgeCount + interiorCount + dominantCount,
        shorelineBuffer: 5.5
      });
    }

    this.flushWaterEdgeDetailInstances(reedMatrices, [], "d23-island-biome", shrubMatrices);

    const islandValid = (x, z) => {
      const p = new THREE.Vector2(x, z);
      return this.waterIslands.some((island) => {
        const inner = island.interior?.length >= 3 ? island.interior : island.points;
        return this.isPointInPolygon(p, inner) && this.distanceToPolygonEdges(p, island.points) > 11.0 && !this.isInWater(p, 2.0);
      });
    };

    if (smallTrees.length) this.vegetationLOD.scatterIndividual({
      positions: smallTrees,
      zoneType: "scrub",
      lat: this.centerLat,
      lon: this.centerLon,
      rng: this.rng,
      isValidLocation: islandValid
    });
    if (mediumTrees.length) this.vegetationLOD.scatterIndividual({
      positions: mediumTrees,
      zoneType: "riparian",
      lat: this.centerLat,
      lon: this.centerLon,
      rng: this.rng,
      isValidLocation: islandValid
    });
    if (dominantTrees.length) this.vegetationLOD.scatterIndividual({
      positions: dominantTrees,
      zoneType: "forest",
      lat: this.centerLat,
      lon: this.centerLon,
      rng: this.rng,
      isValidLocation: islandValid
    });
  }

  scatterShorelineEcologyLOD() {
    // D21: pond edges should read as an ecosystem: reeds at water, shrubs/understory,
    // then small and medium canopy trees. This is deliberately polygon-shoreline
    // aware so the Bryant Park pond stops reading as water + grass ring.
    if (!this.waterPolygons.length) return;
    const understory = [];
    const canopy = [];
    for (const water of this.waterPolygons) {
      const points = water.points;
      const center = this.centroidForPolygon(points);
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const dist = a.distanceTo(b);
        if (dist < 6) continue;
        const dir = new THREE.Vector2().subVectors(b, a).normalize();
        const outward = new THREE.Vector2().subVectors(a.clone().lerp(b, 0.5), center);
        if (outward.lengthSq() === 0) continue;
        outward.normalize();

        for (let s = 3 + this.rng.next() * 5; s < dist - 3; s += 8 + this.rng.next() * 7) {
          const baseX = a.x + dir.x * s;
          const baseZ = a.y + dir.y * s;
          const jitter = (this.rng.next() - 0.5) * 4.2;
          const bandRoll = this.rng.next();
          const offset = bandRoll < 0.34
            ? 5 + this.rng.next() * 8      // bushes / understory
            : 14 + this.rng.next() * 15;   // small canopy fringe
          const x = baseX + outward.x * offset + dir.x * jitter;
          const z = baseZ + outward.y * offset + dir.y * jitter;
          if (!this.isVegetationPlacementLocation(x, z, "riparian")) continue;
          if (bandRoll < 0.60) understory.push({ x, z, sizeBand: 0.55 + this.rng.next() * 0.28, clump: 2 });
          else canopy.push({ x, z, sizeBand: 0.78 + this.rng.next() * 0.48, clump: this.rng.next() < 0.5 ? 2 : 1 });
        }
      }
    }

    if (understory.length) {
      this.vegetationLOD.scatterIndividual({
        positions: understory,
        zoneType: "scrub",
        lat: this.centerLat,
        lon: this.centerLon,
        rng: this.rng,
        isValidLocation: (x, z) => this.isVegetationPlacementLocation(x, z, "riparian")
      });
    }
    if (canopy.length) {
      this.vegetationLOD.scatterIndividual({
        positions: canopy,
        zoneType: "riparian",
        lat: this.centerLat,
        lon: this.centerLon,
        rng: this.rng,
        isValidLocation: (x, z) => this.isVegetationPlacementLocation(x, z, "riparian")
      });
    }
    if (understory.length || canopy.length) this.reconstructionZones.push({ id: "d21-shoreline-ecology", type: "canopy", dominantSpecies: "shoreline-gradient", count: understory.length + canopy.length });
  }

  recordCanopyAuthorityDiagnostics() {
    if (!this.hasExternalCanopyAuthority()) return;
    const stats = this.getCanopyAuthorityDiagnostics();
    this.reconstructionZones.push({
      id: "d38-canopy-authority-mask",
      type: "external-canopy-authority",
      source: stats.source,
      itemId: stats.itemId,
      accepted: stats.accepted,
      rejected: stats.rejected,
      lowScoreAllowed: stats.lowScoreAllowed,
      sampled: stats.authoritySamples,
      avgScore: stats.avgScore,
      canopyCells: stats.canopyCells,
      acceptanceRate: stats.acceptanceRate,
      thresholds: { ...(stats.thresholds ?? {}) }
    });
  }

  getCanopyAuthorityDiagnostics() {
    const stats = this.canopyAuthorityStats ?? this.createCanopyAuthorityStats();
    const authoritySamples = Math.max(0, stats.sampled ?? 0);
    const accepted = Math.max(0, stats.accepted ?? 0);
    const rejected = Math.max(0, stats.rejected ?? 0);
    const lowScoreAllowed = Math.max(0, stats.lowScoreAllowed ?? 0);
    const acceptedTotal = accepted + lowScoreAllowed;
    const acceptanceRate = authoritySamples > 0 ? acceptedTotal / authoritySamples : 0;
    return {
      enabled: !!this.externalCanopy?.enabled,
      available: this.hasExternalCanopyAuthority(),
      source: this.externalCanopy?.source ?? "osm-only",
      itemId: this.externalCanopy?.itemId,
      itemDatetime: this.externalCanopy?.itemDatetime,
      itemCount: this.externalCanopy?.itemCount,
      zoom: this.externalCanopy?.zoom,
      gridSize: this.externalCanopy?.gridSize,
      sampled: this.externalCanopy?.sampled ?? 0,
      failedTiles: this.externalCanopy?.failedTiles ?? 0,
      avgScore: this.externalCanopy?.avgScore,
      minScore: this.externalCanopy?.minScore,
      maxScore: this.externalCanopy?.maxScore,
      canopyCandidateThreshold: this.externalCanopy?.canopyCandidateThreshold,
      mediumCanopyCells: this.externalCanopy?.mediumCanopyCells,
      highCanopyCells: this.externalCanopy?.highCanopyCells,
      canopyCells: this.externalCanopy?.canopyCells ?? 0,
      authoritySamples,
      accepted,
      rejected,
      lowScoreAllowed,
      acceptedTotal,
      acceptanceRate,
      thresholds: { ...(stats.thresholds ?? {}) }
    };
  }

  createCanopyGroundDarkening() {
    // D38.6: disabled. These flat shade pads were terrain decals in name only;
    // they used one centroid elevation for an entire polygon and visibly floated
    // above sloped terrain. Future ground-cover shading should be generated as
    // a draped mesh or texture, not as a single elevated ShapeGeometry.
    return;
    const shadeMat = new THREE.MeshBasicMaterial({ color: 0x061207, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
    for (const zone of this.vegetationZones) {
      if (!zone.reconstruction || !zone.polygon) continue;
      if (!["forest", "wetland", "riparian"].includes(zone.type)) continue;
      const clipped = this.clipPolygonToBounds(zone.polygon, this.currentSize * 0.5);
      if (clipped.length < 3) continue;
      const center = this.centroidForPolygon(clipped);
      const mat = shadeMat.clone();
      mat.opacity = zone.type === "wetland" ? 0.10 : 0.14;
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(clipped)), mat);
      mesh.rotateX(Math.PI / 2);
      mesh.position.y = this.terrain.getHeight(center.x, center.y, this.centerLat, this.centerLon, this.scaleFactor) + 0.049;
      mesh.renderOrder = 0;
      mesh.userData = { feature: "d21-canopy-ground-darkening", layer: "surface", generated: true };
      this.group.add(mesh);
    }
  }

  createWaterTowerLandmarkIfSmallSlice() {
    // Temporary procedural landmark marker for the known small-slice test map.
    // It gives us the hierarchy/visibility test before full OSM special-site
    // reconstruction is generalized.
    if (!this.isSmallSliceTestMap()) return;
    const x = 82;
    const z = -102;
    if (!this.isSmartLocation(x, z)) return;
    const h = this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor);
    const group = new THREE.Group();
    group.position.set(x, h, z);
    const tankMat = this.materials.concrete ?? this.materials.buildingWall;
    const metalMat = this.materials.railway ?? this.materials.utility;
    const legMat = this.materials.utility ?? this.materials.trunk;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 5.2, 16), tankMat);
    tank.position.y = 34;
    tank.castShadow = true;
    tank.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.4, 16), metalMat);
    cap.position.y = 37.8;
    cap.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.65, 27, 10), legMat);
    stem.position.y = 18;
    stem.castShadow = true;
    group.add(stem, tank, cap);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 31, 6), legMat);
      leg.position.set(Math.cos(a) * 4.3, 16.2, Math.sin(a) * 4.3);
      leg.rotation.z = Math.sin(a) * 0.07;
      leg.rotation.x = Math.cos(a) * -0.07;
      leg.castShadow = true;
      group.add(leg);
    }
    group.userData = { feature: "landmark-water-tower-d21", category: "landmark", persistentRepresentation: true };
    group.frustumCulled = false;
    this.group.add(group);
    this.reconstructionZones.push({ id: "d21-water-tower-landmark", type: "landmark", renderer: "waterTower", height: 39 });
  }

  getRiparianCorridorWidth(waterway = "stream", segmentWidth = 8) {
    // D45: rivers/creeks are ecological anchors even when adjacent OSM land is
    // tagged as park, grass, or unknown.  Width is per side from the channel.
    if (waterway === "river") return Math.max(34, segmentWidth * 2.7);
    if (waterway === "canal") return Math.max(18, segmentWidth * 1.8);
    if (waterway === "stream" || waterway === "creek") return Math.max(16, segmentWidth * 2.2);
    if (waterway === "ditch" || waterway === "drain") return Math.max(8, segmentWidth * 1.2);
    return Math.max(14, segmentWidth * 1.8);
  }

  isRiparianPlacementLocation(x, z) {
    // D45: placement is authorized by the river corridor itself.  Do not require
    // the experimental canopy probe to approve a riverbank; still respect hard
    // exclusions such as roads, buildings, and open water.
    return this.isSmartLocation(x, z, "riparian");
  }

  getVegetationRoadBuffer(r, context = "default") {
    const base = Math.max(8, (r.width ?? 5) + 3);
    // D45.1: road clearances need to protect the full crown, not just the trunk.
    // Riparian trees are large and clumpy, so they need a wider no-canopy band
    // around roads/bridges. This keeps the river corridor wooded without letting
    // mature crowns swallow streets.
    if (context === "riparian") {
      const highway = r.highway ?? r.tags?.highway ?? "";
      const major = ["motorway", "trunk", "primary", "secondary"].includes(highway);
      return Math.max(major ? 24 : 18, base + (major ? 16 : 11));
    }
    if (context === "street-tree") return Math.max(5.5, base - 2.5);
    return base;
  }

  getRiparianKeepProbability(waterway = "stream", lateral01 = 0.5, segmentT = 0.5, side = 1) {
    // D45.2: make riparian vegetation an influence gradient instead of a binary
    // corridor.  Banks should feel continuous but uneven: denser near the water,
    // patchier toward the outside, with deterministic breaks so it does not form
    // a perfect wall of trees.
    const nearBank = 1 - THREE.MathUtils.clamp(lateral01, 0, 1);
    const base = waterway === "river" ? 0.78 : waterway === "stream" || waterway === "creek" ? 0.68 : 0.48;
    const distanceFalloff = 0.22 + 0.78 * Math.pow(nearBank, 1.35);
    const wave = 0.72 + 0.28 * Math.sin(segmentT * Math.PI * 2.0 + side * 1.7);
    return THREE.MathUtils.clamp(base * distanceFalloff * wave, 0.08, 0.88);
  }

  scatterRiverbankTreesLOD() {
    // D45.2: rivers/creeks produce a distance-weighted ecological influence map.
    // This keeps D45's "river corridor wins over PARK/UNKNOWN" behavior, but
    // avoids hard blobs and bare runs by combining probabilistic placement with
    // a light minimum-coverage pass along each water segment.
    const positions = [];
    let attempted = 0;
    let forcedFillers = 0;
    const remaining = this.vegetationLOD?.getRemainingTreeBudget?.() ?? 0;
    const maxRiparianTrees = Math.max(120, Math.min(620, Math.floor(remaining * 0.58)));

    const tryAddRiparian = (x, z, opts = {}) => {
      if (positions.length >= maxRiparianTrees) return false;
      attempted++;
      if (!this.isRiparianPlacementLocation(x, z)) return false;
      positions.push({
        x,
        z,
        source: opts.source ?? "d45-2-riparian-gradient",
        sizeBand: opts.sizeBand ?? 0.78 + this.rng.next() * 0.46,
        clump: opts.clump ?? 1
      });
      return true;
    };

    for (const seg of this.waterSegments) {
      if (positions.length >= maxRiparianTrees) break;
      const dist = seg.a.distanceTo(seg.b);
      if (dist < 18) continue;
      const dir = new THREE.Vector2().subVectors(seg.b, seg.a).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      const corridor = this.getRiparianCorridorWidth(seg.waterway, seg.width ?? 8);
      const step = seg.waterway === "river" ? 9 : 10.5;
      const innerBank = Math.max(6.5, (seg.width ?? 8) * 0.55 + 2.5);
      let segmentAccepted = 0;

      for (let s = 5 + this.rng.next() * 5; s < dist - 5; s += step + this.rng.next() * 5.5) {
        if (positions.length >= maxRiparianTrees) break;
        const segmentT = s / Math.max(1, dist);
        for (const side of [1, -1]) {
          if (positions.length >= maxRiparianTrees) break;
          const lateral01 = Math.pow(this.rng.next(), 1.35); // bias toward water, with some outer-bank samples
          const bankOffset = innerBank + lateral01 * corridor;
          const keep = this.getRiparianKeepProbability(seg.waterway, lateral01, segmentT, side);
          if (this.rng.next() > keep) continue;

          const lateralJitter = (this.rng.next() - 0.5) * 5.2;
          const alongJitter = (this.rng.next() - 0.5) * 6.4;
          const x = seg.a.x + dir.x * (s + alongJitter) + perp.x * (bankOffset * side + lateralJitter);
          const z = seg.a.y + dir.y * (s + alongJitter) + perp.y * (bankOffset * side + lateralJitter);
          const nearWater = lateral01 < 0.34;
          if (tryAddRiparian(x, z, {
            sizeBand: nearWater ? 0.88 + this.rng.next() * 0.48 : 0.56 + this.rng.next() * 0.42,
            clump: this.rng.next() < (nearWater ? 0.24 : 0.10) ? 2 : 1
          })) segmentAccepted++;
        }
      }

      // Minimum coverage pass: if a long stretch generated almost nothing, seed a
      // few small trees/shrubs on alternating banks.  This prevents the creek from
      // visually disappearing while still respecting hard exclusions.
      const desiredMin = Math.max(1, Math.floor(dist / (seg.waterway === "river" ? 42 : 55)));
      let guard = 0;
      while (segmentAccepted < desiredMin && guard++ < desiredMin * 8 && positions.length < maxRiparianTrees) {
        const s = 8 + this.rng.next() * Math.max(1, dist - 16);
        const side = this.rng.next() < 0.5 ? 1 : -1;
        const lateral01 = 0.08 + this.rng.next() * 0.34;
        const bankOffset = innerBank + lateral01 * corridor;
        const x = seg.a.x + dir.x * s + perp.x * bankOffset * side;
        const z = seg.a.y + dir.y * s + perp.y * bankOffset * side;
        if (tryAddRiparian(x, z, {
          source: "d45-2-riparian-gap-fill",
          sizeBand: 0.48 + this.rng.next() * 0.36,
          clump: 1
        })) {
          segmentAccepted++;
          forcedFillers++;
        }
      }
    }

    this.riparianCorridorStats = { attempted, accepted: positions.length, forcedFillers };
    if (positions.length) {
      this.vegetationLOD.scatterIndividual({
        positions,
        zoneType: "riparian",
        lat: this.centerLat,
        lon: this.centerLon,
        rng: this.rng,
        isValidLocation: (x, z) => this.isRiparianPlacementLocation(x, z)
      });
      this.reconstructionZones.push({ id: "d45-2-riparian-gradient", type: "canopy", dominantSpecies: "riparian-gradient", count: positions.length, forcedFillers });
    }
  }

  populateVegetationZones() {
    for (const zone of this.vegetationZones) {
      this.scatterTrees(zone.polygon, zone.bounds, zone.type);
    }
  }

  scatterTrees(polygon, bounds, type) {
    const area = Math.max(1, Math.abs(THREE.ShapeUtils.area(polygon)));
    const clusterCount = type === "forest"
      ? Math.max(4, Math.min(22, Math.floor(area / 3800)))
      : Math.max(2, Math.min(10, Math.floor(area / 7000)));

    let created = 0;
    for (let c = 0; c < clusterCount; c++) {
      const center = this.findVegetationPointInPolygon(polygon, bounds, 40);
      if (!center) continue;

      const clusterRadius = type === "forest"
        ? 12 + this.rng.next() * 22
        : 8 + this.rng.next() * 18;
      const treeCount = type === "forest"
        ? 10 + Math.floor(this.rng.next() * 18)
        : 4 + Math.floor(this.rng.next() * 9);

      const cluster = this.createTreeCluster({
        center,
        radius: clusterRadius,
        count: treeCount,
        type,
        placement: "cluster",
        acceptsPoint: (point) => this.isPointInPolygon(point, polygon)
      });

      if (cluster) created++;
    }

    // Parks get a few deliberate open-space specimen trees so they do not read as random noise.
    if (type === "park") {
      const specimenCount = Math.min(12, Math.max(2, Math.floor(area / 12000)));
      for (let i = 0; i < specimenCount; i++) {
        const center = this.findVegetationPointInPolygon(polygon, bounds, 30);
        if (!center) continue;
        this.createTreeCluster({
          center,
          radius: 4 + this.rng.next() * 5,
          count: 1 + Math.floor(this.rng.next() * 3),
          type: "park",
          placement: "specimen",
          acceptsPoint: (point) => this.isPointInPolygon(point, polygon)
        });
      }
    }
  }

  createTreeCluster({ center, radius, count, type = "park", placement = "cluster", acceptsPoint = null }) {
    const folGeo = type === "forest" ? new THREE.ConeGeometry(1, 8, 5) : new THREE.DodecahedronGeometry(4, 0);
    const trkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1, 5);
    const folIM = new THREE.InstancedMesh(folGeo, this.materials.leaves, count);
    const trkIM = new THREE.InstancedMesh(trkGeo, this.materials.trunk, count);
    const dummy = new THREE.Object3D();
    const accepted = [];
    let added = 0;

    for (let i = 0; i < count * 8 && added < count; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const falloff = Math.sqrt(this.rng.next());
      const x = center.x + Math.cos(angle) * radius * falloff;
      const z = center.y + Math.sin(angle) * radius * falloff;
      const point = new THREE.Vector2(x, z);

      if (acceptsPoint && !acceptsPoint(point)) continue;
      if (!this.isSmartLocation(x, z)) continue;

      const h = this.terrain.getHeight(x, z, this.centerLat, this.centerLon, this.scaleFactor);
      const trunkHeight = (type === "forest" ? 4.5 : 2.8) + this.rng.next() * (type === "forest" ? 4 : 2.5);
      const crownScale = (type === "forest" ? 0.7 : 0.75) + this.rng.next() * 0.75;

      dummy.rotation.y = this.rng.next() * Math.PI;
      dummy.scale.set(1, trunkHeight, 1);
      dummy.position.set(x, h + trunkHeight / 2, z);
      dummy.updateMatrix();
      trkIM.setMatrixAt(added, dummy.matrix);

      dummy.scale.setScalar(crownScale);
      dummy.position.set(x, h + trunkHeight + 2.5 * crownScale, z);
      dummy.updateMatrix();
      folIM.setMatrixAt(added, dummy.matrix);

      accepted.push(point);
      added++;
    }

    if (added === 0) {
      folIM.dispose?.();
      trkIM.dispose?.();
      return null;
    }

    folIM.count = added;
    trkIM.count = added;
    folIM.castShadow = true;
    folIM.receiveShadow = true;
    trkIM.castShadow = true;
    trkIM.receiveShadow = true;
    folIM.userData.feature = "tree-cluster";
    trkIM.userData.feature = "tree-cluster";
    this.vegGroup.add(folIM, trkIM);

    const actualCenter = accepted.reduce((sum, point) => sum.add(point), new THREE.Vector2()).divideScalar(accepted.length);
    const maxRadius = Math.max(5, ...accepted.map((point) => point.distanceTo(actualCenter))) + 3;
    this.destruction?.register({
      id: `tree-cluster:${placement}:${Math.round(actualCenter.x)}:${Math.round(actualCenter.y)}:${Math.round(this.rng.next() * 100000)}`,
      category: "tree",
      meshes: [folIM, trkIM],
      position: new THREE.Vector3(actualCenter.x, this.terrain.getHeight(actualCenter.x, actualCenter.y, this.centerLat, this.centerLon, this.scaleFactor) + 3, actualCenter.y),
      bounds: { radius: maxRadius },
      maxHealth: Math.max(20, added * (type === "forest" ? 9 : 7)),
      tags: { vegetationType: type, placement, count: added }
    });

    return { folIM, trkIM, count: added };
  }

  findVegetationPointInPolygon(polygon, bounds, attempts = 30) {
    for (let i = 0; i < attempts; i++) {
      const x = bounds.minX + this.rng.next() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + this.rng.next() * (bounds.maxZ - bounds.minZ);
      if (this.isPointInPolygon(new THREE.Vector2(x, z), polygon) && this.isSmartLocation(x, z)) {
        return new THREE.Vector2(x, z);
      }
    }
    return null;
  }

  scatterStreetTrees() {
    const eligibleSegments = this.roadSegments.filter((seg) => {
      const dist = seg.a.distanceTo(seg.b);
      return dist >= 55 && !["motorway", "trunk", "primary"].includes(seg.highway);
    });

    for (const seg of eligibleSegments) {
      const dist = seg.a.distanceTo(seg.b);
      const dir = new THREE.Vector2().subVectors(seg.b, seg.a).normalize();
      const baseOffset = Math.max(8, (seg.width ?? 5) + 4);
      const perp = new THREE.Vector2(-dir.y, dir.x);

      for (let s = 18 + this.rng.next() * 14; s < dist - 18; s += 34 + this.rng.next() * 22) {
        for (const side of [1, -1]) {
          if (this.rng.next() < 0.35) continue; // leave gaps for driveways, yards, and sight lines
          const offset = baseOffset + this.rng.next() * 7;
          const center = new THREE.Vector2(
            seg.a.x + dir.x * s + perp.x * offset * side,
            seg.a.y + dir.y * s + perp.y * offset * side
          );

          this.createTreeCluster({
            center,
            radius: 3.5 + this.rng.next() * 3,
            count: 1 + Math.floor(this.rng.next() * 2),
            type: "residential",
            placement: "roadside"
          });
        }
      }
    }
  }

  scatterRiverbankTrees() {
    for (const seg of this.waterSegments) {
      const dist = seg.a.distanceTo(seg.b);
      if (dist < 35) continue;

      const dir = new THREE.Vector2().subVectors(seg.b, seg.a).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      const spacing = 28;

      for (let s = 10 + this.rng.next() * 18; s < dist - 10; s += spacing + this.rng.next() * 20) {
        for (const side of [1, -1]) {
          if (this.rng.next() < 0.25) continue;
          const bankOffset = 9 + this.rng.next() * 14;
          const center = new THREE.Vector2(
            seg.a.x + dir.x * s + perp.x * bankOffset * side,
            seg.a.y + dir.y * s + perp.y * bankOffset * side
          );

          this.createTreeCluster({
            center,
            radius: 5 + this.rng.next() * 8,
            count: 2 + Math.floor(this.rng.next() * 5),
            type: "riparian",
            placement: "riverbank"
          });
        }
      }
    }
  }

  update(elapsedSeconds = 0) {
    for (const mesh of this.waterMeshes) {
      const material = mesh.material;
      if (material?.uniforms?.uTime) material.uniforms.uTime.value = elapsedSeconds;
    }
  }

  clipPolygonToBounds(pts, limit) {
    let clipped = pts;
    const planes = [
      { sign: 1, coord: "x", limit },
      { sign: -1, coord: "x", limit: -limit },
      { sign: 1, coord: "y", limit },
      { sign: -1, coord: "y", limit: -limit }
    ];

    for (const plane of planes) {
      const input = clipped;
      clipped = [];
      for (let i = 0; i < input.length; i++) {
        const cur = input[i];
        const prev = input[(i + input.length - 1) % input.length];
        const curIn = plane.sign === 1 ? cur[plane.coord] <= plane.limit : cur[plane.coord] >= plane.limit;
        const prevIn = plane.sign === 1 ? prev[plane.coord] <= plane.limit : prev[plane.coord] >= plane.limit;
        if (curIn) {
          if (!prevIn) clipped.push(this.intersectBoundary(prev, cur, plane));
          clipped.push(cur);
        } else if (prevIn) clipped.push(this.intersectBoundary(prev, cur, plane));
      }
    }
    return clipped;
  }

  intersectBoundary(prev, cur, plane) {
    const t = (plane.limit - prev[plane.coord]) / (cur[plane.coord] - prev[plane.coord]);
    return new THREE.Vector2(prev.x + t * (cur.x - prev.x), prev.y + t * (cur.y - prev.y));
  }

  createCanopyAuthorityStats() {
    return {
      enabled: false,
      available: false,
      source: null,
      accepted: 0,
      rejected: 0,
      lowScoreAllowed: 0,
      sampled: 0,
      thresholds: {}
    };
  }

  hasExternalCanopyAuthority() {
    return !!(this.externalCanopy?.available && Array.isArray(this.externalCanopy.values) && this.externalCanopy.values.length);
  }

  canopyThresholdForContext(context = "default") {
    // D38.5: calibrated against rendered NAIP previews. The D38.4 thresholds
    // were tuned for an overly green score and rejected almost everything in
    // mature residential canopy. These lower thresholds make the external mask
    // a useful placement authority while roads/buildings/water still provide
    // hard exclusions.
    const thresholds = {
      forest: 0.24,
      wetland: 0.22,
      scrub: 0.25,
      park: 0.25,
      "residential-greenspace": 0.22,
      residential: 0.22,
      riparian: 0.21,
      "street-tree": 0.22,
      "canopy-fringe": 0.23,
      default: 0.25
    };
    return thresholds[context] ?? thresholds.default;
  }

  getExternalCanopyScoreAt(x, z) {
    const grid = this.externalCanopy;
    if (!this.hasExternalCanopyAuthority()) return null;
    const rows = grid.values.length;
    const cols = grid.values[0]?.length ?? 0;
    if (!rows || !cols) return null;
    const size = this.currentSize || 1000;
    const colFloat = ((x + size / 2) / size) * cols - 0.5;
    const rowFloat = ((z + size / 2) / size) * rows - 0.5;
    const col = Math.max(0, Math.min(cols - 1, Math.round(colFloat)));
    const row = Math.max(0, Math.min(rows - 1, Math.round(rowFloat)));

    // A small neighborhood max makes the coarse NAIP probe act like a canopy mask
    // instead of a brittle single-pixel lookup. This is especially important for
    // residential blocks where a mature crown may straddle a grid-cell edge.
    let best = 0;
    for (let rr = Math.max(0, row - 1); rr <= Math.min(rows - 1, row + 1); rr++) {
      for (let cc = Math.max(0, col - 1); cc <= Math.min(cols - 1, col + 1); cc++) {
        best = Math.max(best, grid.values[rr]?.[cc] ?? 0);
      }
    }
    return best;
  }

  deterministicCanopyNoise(x, z, salt = 0) {
    const n = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
    return n - Math.floor(n);
  }

  isCanopyAuthorizedForVegetation(x, z, context = "default") {
    if (!this.hasExternalCanopyAuthority()) return true;
    if (!this.canopyAuthorityStats) this.canopyAuthorityStats = this.createCanopyAuthorityStats();
    this.canopyAuthorityStats.enabled = true;
    this.canopyAuthorityStats.available = true;
    this.canopyAuthorityStats.source = this.externalCanopy?.source ?? "external-canopy";

    const score = this.getExternalCanopyScoreAt(x, z) ?? 0;
    const threshold = this.canopyThresholdForContext(context);
    this.canopyAuthorityStats.sampled += 1;
    this.canopyAuthorityStats.thresholds[context] = threshold;

    if (score >= threshold) {
      this.canopyAuthorityStats.accepted += 1;
      return true;
    }

    // Do not let the authority mask create sterile maps when the imagery probe is
    // coarse or imperfect. High-confidence OSM vegetation and stream corridors get
    // a tiny fallback chance, but the majority of low-score candidate trees are now
    // rejected. This changes canopy from "bonus vegetation" to "placement authority"
    // without making the experimental provider a hard single point of failure.
    const fallbackAllowance = ["forest", "wetland", "scrub", "riparian"].includes(context)
      ? Math.max(0, Math.min(0.12, (threshold - score) * 0.16))
      : ["park", "street-tree", "canopy-fringe"].includes(context)
        ? Math.max(0, Math.min(0.09, (threshold - score) * 0.12))
        : 0.04;
    if (fallbackAllowance > 0 && this.deterministicCanopyNoise(x, z, context.length) < fallbackAllowance) {
      this.canopyAuthorityStats.lowScoreAllowed += 1;
      return true;
    }

    this.canopyAuthorityStats.rejected += 1;
    return false;
  }

  isVegetationPlacementLocation(x, z, context = "default") {
    if (!this.isSmartLocation(x, z, context)) return false;
    return this.isCanopyAuthorizedForVegetation(x, z, context);
  }

  isSmartLocation(x, z, context = "default") {
    const p = new THREE.Vector2(x, z);
    const limit = this.currentSize / 2;
    if (Math.abs(x) > limit || Math.abs(z) > limit) return false;

    // Keep vegetation clear of open water. The buffer is intentionally larger
    // than the trunk footprint so full crowns/clusters do not visually spill
    // into ponds after Phase 1 clustering and Phase 3 contact shadows.
    if (this.isInWater(p, 5.5)) return false;

    // D21: keep the water tower landmark readable above the mature canopy.
    // This is a temporary small-slice landmark clearance until special-site
    // reconstruction comes from OSM tags / external context.
    if (this.isSmallSliceTestMap() && p.distanceTo(new THREE.Vector2(82, -102)) < 9.5) return false;

    for (const b of this.buildingBoxes) {
      if (p.distanceTo(b.center) < 60 && this.isPointInPolygon(p, b.points)) return false;
    }
    for (const r of this.roadSegments) {
      const buffer = this.getVegetationRoadBuffer(r, context);
      if (this.distToSegment(p, r.a, r.b) < buffer) return false;
    }
    return true;
  }

  isInWater(p, buffer = 0) {
    // D26: a point is safe from water only when it is actually on island land.
    // Do not let an island-edge buffer cancel the surrounding water buffer, or
    // trees can be accepted with crowns/trunks visually spilling into the pond.
    if (this.isInWaterIsland(p, 0)) return false;

    for (const water of this.waterPolygons) {
      const b = water.bounds;
      if (b && (p.x < b.minX - buffer || p.x > b.maxX + buffer || p.y < b.minZ - buffer || p.y > b.maxZ + buffer)) continue;
      const inOuter = this.isPointInPolygon(p, water.points);
      const inHole = (water.holes ?? []).some((hole) => this.isPointInPolygon(p, hole));
      if (inOuter && !inHole) return true;
      if (buffer > 0 && !inHole && this.distanceToPolygonEdges(p, water.points) < buffer) return true;
    }

    for (const seg of this.waterSegments) {
      const waterBuffer = Math.max(2.5, (seg.width ?? 3) * 0.62) + buffer;
      if (this.distToSegment(p, seg.a, seg.b) < waterBuffer) return true;
    }

    return false;
  }

  isInWaterIsland(p, buffer = 0) {
    for (const island of this.waterIslands ?? []) {
      const b = island.bounds;
      if (b && (p.x < b.minX - buffer || p.x > b.maxX + buffer || p.y < b.minZ - buffer || p.y > b.maxZ + buffer)) continue;
      if (this.isPointInPolygon(p, island.points)) return true;
      if (buffer > 0 && this.distanceToPolygonEdges(p, island.points) < buffer) return true;
    }
    return false;
  }

  distanceToPolygonEdges(p, poly) {
    let nearest = Infinity;
    for (let i = 0; i < poly.length; i++) {
      nearest = Math.min(nearest, this.distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
    }
    return nearest;
  }

  isPointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if ((poly[i].y > p.y) !== (poly[j].y > p.y) && p.x < ((poly[j].x - poly[i].x) * (p.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside;
    }
    return inside;
  }

  distToSegment(p, a, b) {
    const l2 = a.distanceToSquared(b);
    if (l2 === 0) return p.distanceTo(a);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return p.distanceTo(new THREE.Vector2(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)));
  }
}
