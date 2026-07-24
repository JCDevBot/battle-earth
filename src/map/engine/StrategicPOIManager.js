import * as THREE from "three";

const OWNERSHIP_STYLE = {
  friendly: { color: 0x38bdf8, label: "Friendly" },
  enemy: { color: 0xfb7185, label: "Enemy" },
  neutral: { color: 0x94a3b8, label: "Neutral" },
  contested: { color: 0xf59e0b, label: "Contested" }
};

const ARCHETYPE_STYLE = {
  logistics: { color: 0x22c55e, label: "Logistics", bonusLabel: "+ Command income" },
  transport: { color: 0xfacc15, label: "Transport", bonusLabel: "+ Movement / vehicle access" },
  strategic_crossing: { color: 0xf59e0b, label: "Strategic Crossing", bonusLabel: "+ Chokepoint control" },
  observation: { color: 0x38bdf8, label: "Observation", bonusLabel: "+ Recon vision" },
  civic: { color: 0xfb7185, label: "Civic", bonusLabel: "+ Victory influence" },
  infrastructure: { color: 0xa78bfa, label: "Infrastructure", bonusLabel: "+ Faction systems" },
  hq: { color: 0xffffff, label: "HQ", bonusLabel: "Main operating base" }
};

const TYPE_TO_ARCHETYPE = {
  chokepoint: "strategic_crossing",
  bridge: "strategic_crossing",
  intersection: "transport",
  observation: "observation",
  logistics: "logistics",
  infrastructure: "infrastructure",
  population: "civic"
};

const MAJOR_ROADS = new Set(["motorway", "trunk", "primary", "secondary", "tertiary"]);
const LOGISTICS_TAGS = new Set(["industrial", "warehouse", "retail", "commercial", "depot", "storage_tank", "hangar", "transportation"]);
const INFRASTRUCTURE_TAGS = new Set(["power", "substation", "tower", "water_tower", "communications_tower", "wastewater_plant", "water_works", "pumping_station"]);
const POPULATION_TAGS = new Set(["school", "university", "college", "hospital", "townhall", "civic", "public", "government", "stadium"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqueId(prefix, index) {
  return `${prefix}:${index}`;
}

function titleCase(value) {
  return String(value ?? "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function makeLabelTexture(text, subtext, tier = "secondary", owner = "neutral") {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 188;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const ownerColor = owner === "friendly" ? "rgba(56, 189, 248, 0.95)" : owner === "enemy" ? "rgba(251, 113, 133, 0.95)" : owner === "contested" ? "rgba(245, 158, 11, 0.95)" : "rgba(148, 163, 184, 0.9)";
  ctx.fillStyle = tier === "hq" ? "rgba(2, 6, 23, 0.96)" : tier === "major" ? "rgba(2, 6, 23, 0.9)" : "rgba(15, 23, 42, 0.76)";
  ctx.strokeStyle = ownerColor;
  ctx.lineWidth = tier === "hq" ? 7 : tier === "major" ? 5 : 3;
  ctx.beginPath();
  ctx.roundRect(12, 18, 696, 128, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = ownerColor;
  ctx.fillRect(28, 34, 9, 90);
  ctx.fillStyle = "#f8fafc";
  ctx.font = `${tier === "hq" ? "900 38px" : tier === "major" ? "800 34px" : "700 30px"} system-ui, sans-serif`;
  ctx.fillText(text, 50, 70);
  ctx.fillStyle = tier === "hq" ? "#fde68a" : "#cbd5e1";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText(subtext, 50, 111);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function quadrantName(position, sizeMeters) {
  const dead = Math.max(45, sizeMeters * 0.08);
  const eastWest = position.x < -dead ? "West" : position.x > dead ? "East" : "Central";
  const northSouth = position.y < -dead ? "North" : position.y > dead ? "South" : "Central";
  if (eastWest === "Central" && northSouth === "Central") return "Central";
  if (eastWest === "Central") return northSouth;
  if (northSouth === "Central") return eastWest;
  return `${northSouth} ${eastWest}`;
}

function labelForArchetype(archetype, type, position, sizeMeters, count) {
  const q = quadrantName(position, sizeMeters);
  if (archetype === "strategic_crossing") return `${q} Strategic Crossing`;
  if (archetype === "transport") return count >= 3 ? `${q} Transit Hub` : `${q} Interchange`;
  if (archetype === "observation") return `${q} Overlook`;
  if (archetype === "logistics") return count >= 3 ? `${q} Logistics District` : `${q} Supply Node`;
  if (archetype === "infrastructure") return `${q} Infrastructure Node`;
  if (archetype === "civic") return `${q} Civic Center`;
  return `${q} Objective`;
}

function benefitsForArchetype(archetype, priority, sourceCount) {
  const value = Math.round(clamp(priority + sourceCount * 2, 35, 100));
  const captureTime = Math.round(clamp(20 + value * 0.45 + sourceCount * 2, 25, 80));
  if (archetype === "logistics") return { strategicValue: value, captureTime, resourceBonus: 0.45, visionBonus: 0, victoryValue: 0, benefit: "+0.45 command/sec" };
  if (archetype === "infrastructure") return { strategicValue: value, captureTime: captureTime + 10, resourceBonus: 0.65, visionBonus: 35, victoryValue: 0, benefit: "+0.65 command/sec, +systems" };
  if (archetype === "strategic_crossing") return { strategicValue: Math.min(100, Math.round(value * 1.25)), captureTime: captureTime + 10, resourceBonus: 0.35, visionBonus: 30, victoryValue: 1, benefit: "+chokepoint control, +artillery priority" };
  if (archetype === "transport") return { strategicValue: value, captureTime, resourceBonus: 0.25, visionBonus: 15, victoryValue: 0, benefit: "+mobility corridor" };
  if (archetype === "observation") return { strategicValue: value, captureTime, resourceBonus: 0.1, visionBonus: 120, victoryValue: 0, benefit: "+120m recon vision" };
  if (archetype === "civic") return { strategicValue: value, captureTime: captureTime + 5, resourceBonus: 0.2, visionBonus: 20, victoryValue: 2, benefit: "+2 victory influence" };
  return { strategicValue: value, captureTime, resourceBonus: 0.15, visionBonus: 0, victoryValue: 0, benefit: "+minor command" };
}

export class StrategicPOIManager {
  constructor(scene, { onStrategicPoiStats } = {}) {
    this.scene = scene;
    this.callbacks = { onStrategicPoiStats };
    this.group = new THREE.Group();
    this.group.name = "strategic-pois";
    this.scene.add(this.group);
    this.visible = true;
    this.pois = [];
    this.hqs = [];
    this.labelTextures = [];
    this.materials = [];
    this.geometries = [];
    this.sizeMeters = 1000;
  }

  clear() {
    this.group.clear();
    for (const texture of this.labelTextures) texture.dispose?.();
    for (const material of this.materials) material.dispose?.();
    for (const geometry of this.geometries) geometry.dispose?.();
    this.labelTextures = [];
    this.materials = [];
    this.geometries = [];
    this.pois = [];
    this.hqs = [];
    this.emitStats();
  }

  dispose() {
    this.clear();
    this.scene?.remove?.(this.group);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.group.visible = this.visible;
    this.emitStats();
  }

  setInfluenceRingsVisible(visible) {
    this.group.traverse((object) => {
      if (object.userData?.feature === "influence-ring") object.visible = Boolean(visible);
    });
    this.influenceRingsVisible = Boolean(visible);
    this.emitStats();
  }

  build({ builder, terrain, sizeMeters }) {
    this.clear();
    this.sizeMeters = sizeMeters ?? 1000;
    if (!builder || !terrain) return;

    const candidates = [];
    candidates.push(...this.findBridgeAndRoadChokepoints(builder));
    candidates.push(...this.findMajorIntersections(builder));
    candidates.push(...this.findTaggedBuildingPois(builder));
    candidates.push(...this.findObservationPoints({ terrain, sizeMeters: this.sizeMeters }));

    const clusters = this.clusterCandidates(candidates, this.sizeMeters);
    this.pois = this.selectBattlefieldPois(clusters);
    this.hqs = this.generateHQs(this.pois, this.sizeMeters);
    this.assignInitialOwnership(this.pois, this.hqs, this.sizeMeters);
    this.renderPois(terrain);
    this.emitStats();
  }

  findBridgeAndRoadChokepoints(builder) {
    const pois = [];
    let index = 0;
    for (const segment of builder.roadSegments ?? []) {
      if (segment.tags?.bridge !== "yes") continue;
      const center = new THREE.Vector2().addVectors(segment.a, segment.b).multiplyScalar(0.5);
      pois.push({ id: uniqueId("bridge", index++), type: "bridge", position: center, priority: MAJOR_ROADS.has(segment.highway) ? 98 : 86, reasons: ["bridge=yes", `${segment.highway ?? "road"} crossing`, "strategic crossing"] });
    }
    return pois;
  }

  findMajorIntersections(builder) {
    const pois = [];
    let index = 0;
    for (const junction of builder.roadJunctions?.values?.() ?? []) {
      const majorApproaches = [...(junction.highways ?? [])].filter((highway) => MAJOR_ROADS.has(highway)).length;
      const approachCount = junction.approaches?.length ?? junction.count ?? 0;
      if (approachCount < 3 && majorApproaches < 2) continue;
      const priority = clamp(42 + approachCount * 8 + majorApproaches * 12 + (junction.width ?? 0), 45, 92);
      pois.push({ id: uniqueId("intersection", index++), type: "intersection", position: junction.point.clone(), priority, reasons: [`${approachCount} approaches`, `${majorApproaches} major road types`] });
    }
    return pois.sort((a, b) => b.priority - a.priority).slice(0, 36);
  }

  findTaggedBuildingPois(builder) {
    const pois = [];
    let index = 0;
    for (const building of builder.buildingBoxes ?? []) {
      const tags = building.tags ?? {};
      const tagValues = [tags.amenity, tags.building, tags.landuse, tags.man_made, tags.power, tags.military, tags.public_transport, tags.office].filter(Boolean).map(String);
      const hasLogistics = tagValues.some((value) => LOGISTICS_TAGS.has(value));
      const hasInfrastructure = tagValues.some((value) => INFRASTRUCTURE_TAGS.has(value)) || Boolean(tags.power || tags.man_made === "tower" || tags.man_made === "water_tower");
      const hasPopulation = tagValues.some((value) => POPULATION_TAGS.has(value)) || Boolean(tags.office === "government");
      if (!hasLogistics && !hasInfrastructure && !hasPopulation && building.area < 1800) continue;
      const type = hasInfrastructure ? "infrastructure" : hasPopulation ? "population" : "logistics";
      const areaBonus = clamp(Math.sqrt(building.area) * 0.7, 0, 35);
      pois.push({ id: uniqueId("building", index++), type, position: building.center.clone(), priority: clamp(45 + areaBonus + (hasInfrastructure ? 14 : 0) + (hasPopulation ? 8 : 0), 45, 92), reasons: tagValues.slice(0, 4).length ? tagValues.slice(0, 4).map(titleCase) : [`large footprint ${Math.round(building.area)}m²`] });
    }
    return pois.sort((a, b) => b.priority - a.priority).slice(0, 32);
  }

  findObservationPoints({ terrain, sizeMeters }) {
    const pois = [];
    const half = sizeMeters * 0.5;
    const step = Math.max(45, sizeMeters / 12);
    const samples = [];
    for (let x = -half + step; x <= half - step; x += step) {
      for (let z = -half + step; z <= half - step; z += step) {
        const h = terrain.getWorldHeight?.(x, z) ?? terrain.getHeight?.(x, z) ?? 0;
        samples.push({ x, z, h });
      }
    }
    if (!samples.length) return pois;
    const heights = samples.map((s) => s.h).sort((a, b) => a - b);
    const median = heights[Math.floor(heights.length * 0.5)] ?? 0;
    const high = samples.filter((sample) => sample.h > median + 1.5).sort((a, b) => b.h - a.h).slice(0, 10);
    for (let i = 0; i < high.length; i++) {
      const sample = high[i];
      pois.push({ id: uniqueId("observation", i), type: "observation", position: new THREE.Vector2(sample.x, sample.z), priority: clamp(46 + (sample.h - median) * 4, 46, 84), reasons: [`+${(sample.h - median).toFixed(1)}m over median terrain`] });
    }
    return pois;
  }

  clusterCandidates(candidates, sizeMeters) {
    const sorted = candidates.filter((candidate) => candidate.position && Number.isFinite(candidate.position.x) && Number.isFinite(candidate.position.y)).sort((a, b) => b.priority - a.priority);
    const clusters = [];
    const baseRadius = clamp(sizeMeters * 0.095, 54, 110);
    for (const candidate of sorted) {
      const archetype = TYPE_TO_ARCHETYPE[candidate.type] ?? "logistics";
      const radius = archetype === "observation" ? baseRadius * 1.2 : archetype === "strategic_crossing" ? baseRadius * 0.85 : baseRadius;
      let best = null;
      let bestDistance = Infinity;
      for (const cluster of clusters) {
        if (cluster.archetype !== archetype) continue;
        const d = cluster.position.distanceTo(candidate.position);
        if (d < radius && d < bestDistance) {
          best = cluster;
          bestDistance = d;
        }
      }
      if (!best) {
        clusters.push({ id: uniqueId(`cluster-${archetype}`, clusters.length), type: candidate.type, archetype, position: candidate.position.clone(), priority: candidate.priority, reasons: [...(candidate.reasons ?? [])], candidates: [candidate] });
      } else {
        best.candidates.push(candidate);
        best.position.add(candidate.position).multiplyScalar(0.5);
        best.priority = clamp(Math.max(best.priority, candidate.priority) + Math.min(20, best.candidates.length * 3), 45, 100);
        if (best.type !== candidate.type && candidate.priority > best.priority - 8) best.type = candidate.type;
        for (const reason of candidate.reasons ?? []) {
          if (best.reasons.length < 6 && !best.reasons.includes(reason)) best.reasons.push(reason);
        }
      }
    }

    return clusters.map((cluster) => {
      const sourceCount = cluster.candidates.length;
      const benefits = benefitsForArchetype(cluster.archetype, cluster.priority, sourceCount);
      return {
        ...cluster,
        label: labelForArchetype(cluster.archetype, cluster.type, cluster.position, sizeMeters, sourceCount),
        sourceCount,
        captureRadius: sourceCount >= 3 ? 48 : 36,
        influenceRadius: clamp(82 + cluster.priority * 1.45 + sourceCount * 9, 130, 260),
        ...benefits
      };
    }).sort((a, b) => b.strategicValue - a.strategicValue);
  }

  selectBattlefieldPois(clusters) {
    const majorLimit = 8;
    const secondaryLimit = 10;
    const accepted = [];
    const byArchetype = new Map();
    const sorted = [...clusters].sort((a, b) => {
      const aBoost = a.archetype === "strategic_crossing" ? 35 : 0;
      const bBoost = b.archetype === "strategic_crossing" ? 35 : 0;
      return (b.strategicValue + bBoost) - (a.strategicValue + aBoost);
    });
    for (const cluster of sorted) {
      const countForType = byArchetype.get(cluster.archetype) ?? 0;
      if (countForType >= (cluster.archetype === "strategic_crossing" ? 5 : 4)) continue;
      const minDistance = accepted.some((poi) => poi.tier === "major") ? 76 : 50;
      if (accepted.some((poi) => poi.position.distanceTo(cluster.position) < minDistance)) continue;
      byArchetype.set(cluster.archetype, countForType + 1);
      accepted.push(cluster);
      if (accepted.length >= majorLimit + secondaryLimit) break;
    }
    return accepted.map((poi, index) => {
      const isMajor = poi.archetype === "strategic_crossing" || poi.strategicValue >= 82 || index < majorLimit;
      return { ...poi, id: uniqueId("strategic-poi", index), tier: isMajor ? "major" : "secondary", objectiveClass: isMajor ? "major" : "minor", ownership: "neutral" };
    });
  }

  generateHQs(pois, sizeMeters) {
    const candidates = pois.filter((poi) => poi.tier === "major" || poi.strategicValue >= 55);
    if (candidates.length < 2) return [];

    // D50 rule: lock battle orientation so the player always reads the map south-to-north.
    // In this world coordinate system, negative Z/Y is north and positive Z/Y is south.
    const half = sizeMeters * 0.5;
    const northBandLimit = -half + sizeMeters * 0.32;
    const southBandLimit = half - sizeMeters * 0.32;
    const minimumSeparation = sizeMeters * 0.38;

    const scoreForSouthHQ = (poi) => {
      const southness = clamp((poi.position.y + half) / Math.max(1, sizeMeters), 0, 1);
      const centerBias = 1 - clamp(Math.abs(poi.position.x) / Math.max(1, half), 0, 1) * 0.35;
      return (poi.strategicValue ?? 50) * 2 + southness * 120 + centerBias * 35 + (poi.archetype === "logistics" ? 22 : 0) + (poi.archetype === "transport" ? 12 : 0);
    };
    const scoreForNorthHQ = (poi) => {
      const northness = clamp((half - poi.position.y) / Math.max(1, sizeMeters), 0, 1);
      const centerBias = 1 - clamp(Math.abs(poi.position.x) / Math.max(1, half), 0, 1) * 0.35;
      return (poi.strategicValue ?? 50) * 2 + northness * 120 + centerBias * 35 + (poi.archetype === "logistics" ? 22 : 0) + (poi.archetype === "transport" ? 12 : 0);
    };

    const southern = candidates.filter((poi) => poi.position.y >= southBandLimit).sort((a, b) => scoreForSouthHQ(b) - scoreForSouthHQ(a));
    const northern = candidates.filter((poi) => poi.position.y <= northBandLimit).sort((a, b) => scoreForNorthHQ(b) - scoreForNorthHQ(a));

    const southPool = southern.length ? southern : [...candidates].sort((a, b) => scoreForSouthHQ(b) - scoreForSouthHQ(a));
    const northPool = northern.length ? northern : [...candidates].sort((a, b) => scoreForNorthHQ(b) - scoreForNorthHQ(a));

    let friendly = southPool[0];
    let enemy = northPool.find((poi) => poi !== friendly && poi.position.distanceTo(friendly.position) >= minimumSeparation) ?? northPool.find((poi) => poi !== friendly);

    // If the best southern/northern picks are too close on sparse maps, keep Friendly in the south
    // and choose the farthest northern-leaning option for Enemy.
    if (friendly && enemy && friendly.position.distanceTo(enemy.position) < minimumSeparation) {
      enemy = [...candidates]
        .filter((poi) => poi !== friendly)
        .sort((a, b) => {
          const aScore = a.position.distanceTo(friendly.position) + scoreForNorthHQ(a) * 0.7;
          const bScore = b.position.distanceTo(friendly.position) + scoreForNorthHQ(b) * 0.7;
          return bScore - aScore;
        })[0];
    }

    if (!friendly || !enemy) return [];
    friendly.ownership = "friendly";
    enemy.ownership = "enemy";
    friendly.hqPlacement = southern.includes(friendly) ? "southern-band" : "southern-fallback";
    enemy.hqPlacement = northern.includes(enemy) ? "northern-band" : "northern-fallback";

    return [
      { ...friendly, id: "hq:friendly", label: "Friendly HQ", tier: "hq", archetype: "hq", ownership: "friendly", hqPlacement: friendly.hqPlacement, influenceRadius: Math.max(230, friendly.influenceRadius + 45), captureRadius: 62, strategicValue: 100, resourceBonus: 1.0, benefit: "+1 base command/sec" },
      { ...enemy, id: "hq:enemy", label: "Enemy HQ", tier: "hq", archetype: "hq", ownership: "enemy", hqPlacement: enemy.hqPlacement, influenceRadius: Math.max(230, enemy.influenceRadius + 45), captureRadius: 62, strategicValue: 100, resourceBonus: 1.0, benefit: "+1 base command/sec" }
    ];
  }


  assignInitialOwnership(pois, hqs, sizeMeters) {
    const friendlyHQ = hqs.find((hq) => hq.ownership === "friendly");
    const enemyHQ = hqs.find((hq) => hq.ownership === "enemy");
    if (!friendlyHQ || !enemyHQ) return;

    const span = Math.max(1, friendlyHQ.position.distanceTo(enemyHQ.position));
    const friendlyOwned = [];
    const enemyOwned = [];
    const neutralFrontier = [];

    for (const poi of pois) {
      if (poi.id === friendlyHQ.id || poi.label === friendlyHQ.label || poi.position.distanceTo(friendlyHQ.position) < 1) {
        poi.ownership = "friendly";
        poi.ownershipStrength = 100;
        poi.captureProgress = 100;
        poi.connectedToHQ = true;
        poi.defenseLevel = 1;
        continue;
      }
      if (poi.id === enemyHQ.id || poi.label === enemyHQ.label || poi.position.distanceTo(enemyHQ.position) < 1) {
        poi.ownership = "enemy";
        poi.ownershipStrength = 100;
        poi.captureProgress = 100;
        poi.connectedToHQ = true;
        poi.defenseLevel = 1;
        continue;
      }

      const friendlyDistance = poi.position.distanceTo(friendlyHQ.position);
      const enemyDistance = poi.position.distanceTo(enemyHQ.position);
      const balance = (enemyDistance - friendlyDistance) / span;
      const absoluteBalance = Math.abs(balance);
      poi.frontlineScore = Number((1 - clamp(absoluteBalance, 0, 1)).toFixed(2));
      poi.captureProgress = 0;
      poi.defenseLevel = 0;
      poi.connectedToHQ = false;

      if (absoluteBalance < 0.16) {
        poi.ownership = "contested";
        poi.ownershipStrength = Math.round((1 - absoluteBalance / 0.16) * 55 + 20);
        neutralFrontier.push(poi);
      } else if (balance > 0.34) {
        poi.ownership = "friendly";
        poi.ownershipStrength = Math.round(clamp(45 + absoluteBalance * 75, 55, 100));
        poi.captureProgress = poi.ownershipStrength;
        poi.connectedToHQ = true;
        poi.defenseLevel = poi.tier === "major" ? 1 : 0;
        friendlyOwned.push(poi);
      } else if (balance < -0.34) {
        poi.ownership = "enemy";
        poi.ownershipStrength = Math.round(clamp(45 + absoluteBalance * 75, 55, 100));
        poi.captureProgress = poi.ownershipStrength;
        poi.connectedToHQ = true;
        poi.defenseLevel = poi.tier === "major" ? 1 : 0;
        enemyOwned.push(poi);
      } else {
        poi.ownership = "neutral";
        poi.ownershipStrength = Math.round(clamp(35 + absoluteBalance * 70, 35, 70));
        neutralFrontier.push(poi);
      }
    }

    // Ensure each side has at least one owned non-HQ objective where the map allows it.
    const byFriendlyDistance = [...pois].filter((poi) => poi.ownership !== "friendly" && poi.ownership !== "enemy").sort((a, b) => a.position.distanceTo(friendlyHQ.position) - b.position.distanceTo(friendlyHQ.position));
    const byEnemyDistance = [...pois].filter((poi) => poi.ownership !== "friendly" && poi.ownership !== "enemy").sort((a, b) => a.position.distanceTo(enemyHQ.position) - b.position.distanceTo(enemyHQ.position));
    if (!friendlyOwned.length && byFriendlyDistance[0]) {
      byFriendlyDistance[0].ownership = "friendly";
      byFriendlyDistance[0].ownershipStrength = 72;
      byFriendlyDistance[0].captureProgress = 72;
      byFriendlyDistance[0].connectedToHQ = true;
      byFriendlyDistance[0].defenseLevel = 1;
    }
    if (!enemyOwned.length && byEnemyDistance[0]) {
      byEnemyDistance[0].ownership = "enemy";
      byEnemyDistance[0].ownershipStrength = 72;
      byEnemyDistance[0].captureProgress = 72;
      byEnemyDistance[0].connectedToHQ = true;
      byEnemyDistance[0].defenseLevel = 1;
    }
  }


  renderPois(terrain) {
    const pinGeometry = new THREE.ConeGeometry(5, 16, 8);
    const smallPinGeometry = new THREE.ConeGeometry(3.5, 11, 8);
    const hqGeometry = new THREE.BoxGeometry(15, 15, 15);
    const haloGeometry = new THREE.RingGeometry(8, 13, 32);
    this.geometries.push(pinGeometry, smallPinGeometry, hqGeometry, haloGeometry);

    const renderSet = [...this.pois, ...this.hqs];
    for (const poi of renderSet) {
      const style = ARCHETYPE_STYLE[poi.archetype] ?? ARCHETYPE_STYLE.logistics;
      const ownerStyle = OWNERSHIP_STYLE[poi.ownership] ?? OWNERSHIP_STYLE.neutral;
      const y = (terrain.getWorldHeight?.(poi.position.x, poi.position.y) ?? 0) + 8;
      const marker = new THREE.Group();
      marker.name = `${poi.tier}-${poi.archetype}`;
      marker.position.set(poi.position.x, y, poi.position.y);
      marker.userData = { feature: "strategic-poi", poi };

      const influenceGeometry = new THREE.RingGeometry(poi.captureRadius, poi.influenceRadius, 72);
      this.geometries.push(influenceGeometry);
      const influenceColor = poi.ownership === "neutral" ? style.color : ownerStyle.color;
      const influenceMaterial = new THREE.MeshBasicMaterial({ color: influenceColor, transparent: true, opacity: poi.tier === "hq" ? 0.24 : poi.tier === "major" ? 0.17 : 0.08, side: THREE.DoubleSide, depthWrite: false });
      this.materials.push(influenceMaterial);
      const influence = new THREE.Mesh(influenceGeometry, influenceMaterial);
      influence.rotation.x = -Math.PI / 2;
      influence.position.y = -6;
      influence.visible = false;
      influence.userData = { feature: "influence-ring", poiId: poi.id };
      marker.add(influence);

      const captureGeometry = new THREE.RingGeometry(Math.max(5, poi.captureRadius - 2), poi.captureRadius, 48);
      this.geometries.push(captureGeometry);
      const captureMaterial = new THREE.MeshBasicMaterial({ color: ownerStyle.color, transparent: true, opacity: poi.tier === "hq" ? 0.9 : 0.55, side: THREE.DoubleSide, depthWrite: false });
      this.materials.push(captureMaterial);
      const capture = new THREE.Mesh(captureGeometry, captureMaterial);
      capture.rotation.x = -Math.PI / 2;
      capture.position.y = -5.7;
      marker.add(capture);

      const bodyMaterial = new THREE.MeshBasicMaterial({ color: style.color, depthWrite: false });
      this.materials.push(bodyMaterial);
      const body = poi.tier === "hq" ? new THREE.Mesh(hqGeometry, bodyMaterial) : new THREE.Mesh(poi.tier === "major" ? pinGeometry : smallPinGeometry, bodyMaterial);
      if (poi.tier === "hq") body.position.y = 8;
      else {
        body.rotation.x = Math.PI;
        body.position.y = poi.tier === "major" ? 8 : 5;
      }
      marker.add(body);

      const haloMaterial = new THREE.MeshBasicMaterial({ color: ownerStyle.color, transparent: true, opacity: poi.tier === "hq" ? 0.78 : poi.tier === "major" ? 0.45 : 0.25, side: THREE.DoubleSide, depthWrite: false });
      this.materials.push(haloMaterial);
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.rotation.x = -Math.PI / 2;
      marker.add(halo);

      if (poi.tier === "major" || poi.tier === "hq") {
        const labelType = poi.tier === "hq" ? ownerStyle.label : `${ownerStyle.label} ${style.label}`;
        const control = poi.ownership === "neutral" ? "open" : poi.ownership === "contested" ? "frontline" : `${poi.ownershipStrength ?? 0}% control`;
        const texture = makeLabelTexture(poi.label, `${labelType} · ${control} · value ${Math.round(poi.strategicValue)}`, poi.tier, poi.ownership);
        this.labelTextures.push(texture);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
        this.materials.push(sprite.material);
        sprite.position.set(0, poi.tier === "hq" ? 39 : 31, 0);
        sprite.scale.set(poi.tier === "hq" ? 112 : 104, poi.tier === "hq" ? 29 : 27, 1);
        marker.add(sprite);
      }

      this.group.add(marker);
    }
    this.group.visible = this.visible;
  }

  getStats() {
    const byArchetype = {};
    const byTier = { major: 0, secondary: 0, hq: this.hqs.length };
    const ownership = { friendly: 0, enemy: 0, neutral: 0, contested: 0 };
    let clusteredSources = 0;
    let friendlyIncome = 1;
    let enemyIncome = 1;
    for (const poi of this.pois) {
      byArchetype[poi.archetype] = (byArchetype[poi.archetype] ?? 0) + 1;
      byTier[poi.tier] = (byTier[poi.tier] ?? 0) + 1;
      ownership[poi.ownership] = (ownership[poi.ownership] ?? 0) + 1;
      clusteredSources += poi.sourceCount ?? 1;
      if (poi.ownership === "friendly") friendlyIncome += poi.resourceBonus ?? 0;
      if (poi.ownership === "enemy") enemyIncome += poi.resourceBonus ?? 0;
    }
    for (const hq of this.hqs) {
      ownership[hq.ownership] = (ownership[hq.ownership] ?? 0) + 1;
    }
    const top = [...this.hqs, ...this.pois.slice(0, 10)].map((poi) => ({
      id: poi.id,
      type: poi.type,
      archetype: poi.archetype,
      tier: poi.tier,
      objectiveClass: poi.objectiveClass ?? (poi.tier === "secondary" ? "minor" : "major"),
      ownership: poi.ownership,
      ownershipStrength: poi.ownershipStrength ?? 0,
      captureProgress: poi.captureProgress ?? 0,
      defenseLevel: poi.defenseLevel ?? 0,
      connectedToHQ: Boolean(poi.connectedToHQ),
      frontlineScore: poi.frontlineScore ?? 0,
      label: poi.label,
      strategicValue: Math.round(poi.strategicValue ?? poi.priority ?? 0),
      priority: Math.round(poi.priority ?? poi.strategicValue ?? 0),
      sourceCount: poi.sourceCount ?? 1,
      captureRadius: Math.round(poi.captureRadius ?? 0),
      influenceRadius: Math.round(poi.influenceRadius ?? 0),
      captureTime: Math.round(poi.captureTime ?? 0),
      resourceBonus: Number(poi.resourceBonus ?? 0).toFixed(2),
      visionBonus: Math.round(poi.visionBonus ?? 0),
      benefit: poi.benefit,
      reasons: poi.reasons ?? []
    }));
    const controlledValue = { friendly: 0, enemy: 0, neutral: 0, contested: 0 };
    for (const poi of this.pois) controlledValue[poi.ownership] = (controlledValue[poi.ownership] ?? 0) + (poi.strategicValue ?? 0);
    return { enabled: this.visible, influenceRingsVisible: Boolean(this.influenceRingsVisible), total: this.pois.length, hqs: this.hqs.length, battlefieldOrientation: "Friendly South / Enemy North", clusteredSources, byArchetype, byTier, ownership, controlledValue, economy: { friendlyIncome: Number(friendlyIncome.toFixed(2)), enemyIncome: Number(enemyIncome.toFixed(2)), neutralValue: this.pois.filter((p) => p.ownership === "neutral").reduce((sum, p) => sum + (p.strategicValue ?? 0), 0) }, top };
  }

  emitStats() {
    this.callbacks.onStrategicPoiStats?.(this.getStats());
  }
}
