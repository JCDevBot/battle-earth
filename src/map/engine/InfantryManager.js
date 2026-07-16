import * as THREE from "three";

const SOLDIER_HEIGHT = 2.2;
const INFANTRY_GROUND_CLEARANCE = 0.12;
const FRIENDLY_COLOR = 0x38bdf8;
const ENEMY_COLOR = 0xf43f5e;
const SELECTED_COLOR = 0xfacc15;
const FRIENDLY_FOOTPRINT_COLOR = 0x38bdf8;
const ENEMY_FOOTPRINT_COLOR = 0xf43f5e;
const CONTESTED_FOOTPRINT_COLOR = 0xa855f7;
const FRONTLINE_COLOR = 0xfef3c7;
const ENGAGEMENT_AREA_FILL_OPACITY = 0.045;
const ENGAGEMENT_AREA_LINE_OPACITY = 0.2;

const SQUAD_TEMPLATES = {
  rifle: {
    label: "Rifle Squad",
    soldiers: 9,
    spacing: 4.5,
    detectionRange: 170,
    engagementRange: 135,
    speed: 18
  }
};

const STATE_LABEL = {
  idle: "Idle",
  moving: "Moving",
  searching: "Searching",
  contact: "Contact",
  engaged: "Engaged",
  suppressed: "Suppressed",
  securing: "Securing",
  defending: "Defending",
  falling_back: "Falling Back",
  retreating: "Retreating"
};

const ROE_LABEL = {
  hold: "Hold Fire",
  return: "Return Fire",
  free: "Fire At Will"
};

const MISSION_LABEL = {
  move: "Move",
  defend: "Defend",
  attack: "Attack",
  ambush: "Ambush",
  secure: "Secure Building"
};

const MISSION_STATUS_LABEL = {
  enroute: "Enroute",
  arrived: "Arrived",
  establishing: "Establishing",
  attacking: "Attacking",
  hidden: "Hidden",
  contact: "Contact",
  engaged: "Engaged",
  fallback: "Fallback",
  idle: "Idle"
};

const READINESS_LABEL = {
  establishing: "Establishing",
  prepared: "Prepared",
  entrenched: "Entrenched",
  fortified: "Fortified"
};

const MORALE_LABEL = {
  steady: "Steady",
  concerned: "Concerned",
  shaken: "Shaken",
  broken: "Broken"
};

const CONTACT_MEMORY_MS = 22000;
const ENGAGEMENT_TICK_MS = 2200;
const ENGAGEMENT_MIN_RETREAT_MS = 9000;
const POSITION_BREAK_THRESHOLD = 0;
const PATH_HISTORY_MS = 45000;
const PATH_HISTORY_MIN_DISTANCE = 6;
const FALLBACK_MIN_DISTANCE = 28;
const FALLBACK_MAX_DISTANCE = 72;

const FORMATION_OFFSETS = [
  [0, 0],
  [-5, 5],
  [5, 5],
  [-9, 10],
  [9, 10],
  [-13, 15],
  [13, 15],
  [-17, 20],
  [17, 20],
  [-21, 24],
  [21, 24]
];

const DEFENSIVE_INNER_RADIUS = 13;
const DEFENSIVE_OUTER_RADIUS = 23;
const DEFENSIVE_SLOT_MIN_SPACING = 4.8;
const REINFORCEMENT_Y_OFFSET = 0.18;

const DUMMY = new THREE.Object3D();

function cloneGroundPosition(position, y = 1.1) {
  return new THREE.Vector3(position.x, y, position.z);
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function stableHash(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function moveToward(current, target, maxStep) {
  const dx = target.x - current.x;
  const dz = target.z - current.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  if (distance <= maxStep || distance < 0.001) {
    current.x = target.x;
    current.z = target.z;
    return true;
  }
  current.x += (dx / distance) * maxStep;
  current.z += (dz / distance) * maxStep;
  return false;
}

function formationPosition(center, index, heading = 0) {
  const [x, z] = FORMATION_OFFSETS[index % FORMATION_OFFSETS.length];
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return new THREE.Vector3(
    center.x + x * c - z * s,
    SOLDIER_HEIGHT * 0.5,
    center.z + x * s + z * c
  );
}

function strongestCoverScore(feature) {
  if (!feature || feature.state === "destroyed") return 0;
  if (feature.category === "building") return 0.95;
  if (feature.category === "tree") return 0.42;
  if (feature.category === "prop") return 0.3;
  if (feature.category === "road") return feature.state === "destroyed" ? 0.25 : 0.03;
  return 0.1;
}

function bearingLabel(from, to) {
  const angle = Math.atan2(to.x - from.x, to.z - from.z);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return labels[Math.round(normalized / (Math.PI / 4)) % labels.length];
}

function sanitizeFireMode(fireMode) {
  if (fireMode === "hold" || fireMode === "return" || fireMode === "free") return fireMode;
  return "return";
}

function commandLabel(order) {
  if (!order) return "awaiting orders";
  if (order.type === "mission") {
    const mission = MISSION_LABEL[order.missionType] ?? order.missionType ?? "mission";
    const roe = ROE_LABEL[order.fireMode] ?? order.fireMode;
    return `${mission} - ${roe.toLowerCase()}`;
  }
  const action = order.type === "occupy_building" ? "occupy building" : "use building as cover";
  const roe = ROE_LABEL[order.fireMode] ?? order.fireMode;
  return `${action} - ${roe.toLowerCase()}`;
}

function sanitizeMissionType(missionType) {
  if (missionType === "defend" || missionType === "attack" || missionType === "ambush") return missionType;
  return "move";
}

function defaultFireModeForMission(missionType) {
  if (missionType === "attack") return "free";
  if (missionType === "ambush") return "hold";
  return "return";
}

function resetReadiness(squad) {
  if (!squad) return;
  squad.readiness = 0;
  squad.readinessState = "establishing";
  squad.readinessStartAt = 0;
  squad.positionStrength = 0;
  squad.positionStrengthMax = 0;
  squad.positionStrengthState = "establishing";
  squad.positionBroken = false;
  squad.positionBrokenAt = 0;
}

function isDefensiveMission(squad) {
  return squad?.missionType === "defend" || squad?.missionType === "ambush";
}

function isDefensivePositionActive(squad) {
  if (!isDefensiveMission(squad)) return false;
  if (squad.destination) return false;
  if (squad.state === "moving" || squad.state === "falling_back" || squad.state === "retreating") return false;
  return squad.state === "defending" || squad.state === "securing" || squad.state === "engaged" || squad.state === "suppressed" || squad.state === "contact" || squad.state === "searching" || squad.state === "idle";
}

function syncPositionStrengthToReadiness(squad) {
  if (!isDefensiveMission(squad)) return;
  const state = squad.readinessState ?? "establishing";
  const previousMax = squad.positionStrengthMax ?? 0;
  const nextMax = POSITION_STRENGTH_BY_READINESS[state] ?? POSITION_STRENGTH_BY_READINESS.establishing;
  if (!squad.positionStrengthMax || squad.positionStrengthState !== state) {
    const gain = Math.max(0, nextMax - previousMax);
    squad.positionStrength = Math.min(nextMax, Math.max(0, squad.positionStrength ?? 0) + gain);
    squad.positionStrengthMax = nextMax;
    squad.positionStrengthState = state;
    if ((squad.positionStrength ?? 0) > POSITION_BREAK_THRESHOLD) {
      squad.positionBroken = false;
      squad.positionBrokenAt = 0;
    }
  }
}

function applyPositionPressure(squad, amount) {
  if (!isDefensivePositionActive(squad)) return false;
  syncPositionStrengthToReadiness(squad);
  if ((squad.positionStrength ?? 0) <= 0) return false;
  squad.positionStrength = Math.max(0, (squad.positionStrength ?? 0) - amount);
  if (squad.positionStrength <= POSITION_BREAK_THRESHOLD) {
    if (!squad.positionBrokenAt) squad.positionBrokenAt = performance.now();
    squad.positionBroken = true;
  }
  return true;
}

function positionStrengthLabel(squad) {
  if (!isDefensiveMission(squad) || !squad.positionStrengthMax) return "n/a";
  return `${Math.round(squad.positionStrength ?? 0)}/${Math.round(squad.positionStrengthMax ?? 0)}`;
}

function objectiveRadiusForMission(missionType) {
  if (missionType === "defend") return 34;
  if (missionType === "ambush") return 30;
  if (missionType === "attack") return 42;
  return 28;
}

const READINESS_THRESHOLDS = {
  prepared: 120,
  entrenched: 300,
  fortified: 600
};

const POSITION_STRENGTH_BY_READINESS = {
  establishing: 25,
  prepared: 50,
  entrenched: 80,
  fortified: 120
};


function readinessKeyForSeconds(seconds) {
  if (seconds >= READINESS_THRESHOLDS.fortified) return "fortified";
  if (seconds >= READINESS_THRESHOLDS.entrenched) return "entrenched";
  if (seconds >= READINESS_THRESHOLDS.prepared) return "prepared";
  return "establishing";
}

function readinessProfile(readinessState, missionType = "defend") {
  const ambushToneDown = missionType === "ambush" ? 0.72 : 1;
  const profiles = {
    // Readiness now reads as position strength, not magic territorial growth.
    // Keep the footprint roughly the same size and make the edge/anchor stronger.
    establishing: { radiusScale: 1, fillOpacity: 0.11 * ambushToneDown, lineOpacity: 0.34 * ambushToneDown, lineWidth: 1, anchorProgress: 0.25, arcOpacity: 0.18 * ambushToneDown, arcScale: 0.9 },
    prepared: { radiusScale: 1.02, fillOpacity: 0.13 * ambushToneDown, lineOpacity: 0.52 * ambushToneDown, lineWidth: 1, anchorProgress: 0.5, arcOpacity: 0.32 * ambushToneDown, arcScale: 1 },
    entrenched: { radiusScale: 1.04, fillOpacity: 0.15 * ambushToneDown, lineOpacity: 0.72 * ambushToneDown, lineWidth: 1, anchorProgress: 0.75, arcOpacity: 0.48 * ambushToneDown, arcScale: 1.08 },
    fortified: { radiusScale: 1.06, fillOpacity: 0.17 * ambushToneDown, lineOpacity: 0.92 * ambushToneDown, lineWidth: 1, anchorProgress: 1, arcOpacity: 0.68 * ambushToneDown, arcScale: 1.16 }
  };
  return profiles[readinessState] ?? profiles.establishing;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds ?? 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function squadAliveCount(squad) {
  return squad?.soldiers?.filter((soldier) => soldier.health > 0).length ?? 0;
}



function livingSoldiers(squad) {
  return squad?.soldiers?.filter((soldier) => soldier.health > 0) ?? [];
}

function angleDelta(a, b) {
  let delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}

function directionVectorFromHeading(heading) {
  return new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
}

function headingFromTo(from, to) {
  if (!from || !to) return 0;
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function slotAngleBias(position, anchor, heading) {
  const angle = headingFromTo(anchor, position);
  const delta = angleDelta(angle, heading);
  // Front-oriented slots score higher, but rear/flank slots still exist so the
  // squad does not collapse into a line.
  return Math.cos(delta) * 10;
}

function shouldShowTacticalFootprint(squad) {
  if (!squad) return false;
  if (squad.missionType !== "defend" && squad.missionType !== "ambush") return false;
  if (squad.state === "moving" || squad.state === "falling_back" || squad.state === "retreating") return false;
  return livingSoldiers(squad).length >= 2;
}

function footprintInfluenceStrength(squad) {
  if (!shouldShowTacticalFootprint(squad)) return 0;
  const base = POSITION_STRENGTH_BY_READINESS[squad.readinessState ?? "establishing"] ?? POSITION_STRENGTH_BY_READINESS.establishing;
  const aliveFactor = THREE.MathUtils.clamp(squadAliveCount(squad) / Math.max(1, squad.soldiers?.length ?? 1), 0.25, 1);
  const strengthFactor = squad.positionStrengthMax ? THREE.MathUtils.clamp((squad.positionStrength ?? 0) / Math.max(1, squad.positionStrengthMax), 0.25, 1) : 1;
  const missionFactor = squad.missionType === "ambush" ? 0.82 : 1;
  return base * aliveFactor * strengthFactor * missionFactor;
}

function activeFootprintInfo(squad) {
  if (!shouldShowTacticalFootprint(squad)) return null;
  const anchor = squad.missionTarget ?? squad.center;
  if (!anchor) return null;
  const profile = readinessProfile(squad.readinessState, squad.missionType);
  const slots = Array.isArray(squad.defensiveSlots) ? squad.defensiveSlots.map((slot) => slot.position).filter(Boolean) : [];
  let maxSlotDistance = squad.missionType === "ambush" ? 18 : 22;
  for (const slot of slots) maxSlotDistance = Math.max(maxSlotDistance, distance2D(anchor, slot));
  const radius = (maxSlotDistance + (squad.missionType === "ambush" ? 12 : 15)) * profile.radiusScale;
  return {
    squad,
    anchor,
    radius,
    strength: footprintInfluenceStrength(squad),
    heading: Number.isFinite(squad.defensiveHeading) ? squad.defensiveHeading : 0
  };
}

function activeEngagementAreaInfo(squad) {
  // Engagement range remains a combat-only value. It is intentionally no longer
  // used for map overlays or front-line placement.
  if (!shouldShowTacticalFootprint(squad)) return null;
  const anchor = squad.missionTarget ?? squad.center;
  if (!anchor) return null;
  const profile = readinessProfile(squad.readinessState, squad.missionType);
  const template = SQUAD_TEMPLATES[squad.template] ?? SQUAD_TEMPLATES.rifle;
  const readinessRangeScale = { establishing: 0.86, prepared: 0.98, entrenched: 1.1, fortified: 1.22 }[squad.readinessState ?? "establishing"] ?? 0.86;
  const missionRangeScale = squad.missionType === "ambush" ? 0.85 : 1;
  const strengthFactor = squad.positionStrengthMax ? THREE.MathUtils.clamp((squad.positionStrength ?? 0) / Math.max(1, squad.positionStrengthMax), 0.55, 1) : 1;
  const radius = template.engagementRange * readinessRangeScale * missionRangeScale * (0.9 + strengthFactor * 0.1) * profile.arcScale;
  return {
    squad,
    anchor,
    radius,
    strength: footprintInfluenceStrength(squad) * (1.15 + readinessRangeScale * 0.25),
    heading: Number.isFinite(squad.defensiveHeading) ? squad.defensiveHeading : 0
  };
}

function squadStrengthPct(squad) {
  return Math.round((squadAliveCount(squad) / Math.max(1, squad?.soldiers?.length ?? 1)) * 100);
}

function confidenceLabel(squad) {
  if (!squad) return "Unknown";
  const strength = squadStrengthPct(squad);
  const suppression = squad.suppression ?? 0;
  const contactRecent = squad.lastContactAt && performance.now() - squad.lastContactAt < CONTACT_MEMORY_MS;
  if (strength < 50 || suppression > 70 || squad.state === "retreating") return "Low";
  if (strength < 75 || suppression > 35 || contactRecent || squad.state === "falling_back") return "Medium";
  return "High";
}

function positionLabel(squad) {
  if (!squad) return "None";
  const order = squad.activeOrder;
  if (order?.targetCategory === "building") {
    if (order.type === "occupy_building") return "Occupied building";
    return "Building cover";
  }
  if (squad.state === "moving") return "Moving route";
  if (squad.state === "falling_back") return "Fallback route";
  if (squad.state === "defending") return "Defensive position";
  if (squad.state === "retreating") return "Withdrawing";
  return "Open ground";
}

function fallbackLabel(squad) {
  if (!squad) return "None";
  if (squad.state === "falling_back") return "Back along route";
  if (squad.activeOrder?.rallyPoint) return "Rally point";
  if (squad.fallbackTarget) return "Fallback point";
  if ((squad.pathHistory?.length ?? 0) > 2) return "Known route";
  return "Home / origin";
}

function squadWoundedCount(squad) {
  return squad?.soldiers?.filter((soldier) => soldier.health > 0 && soldier.health < 50).length ?? 0;
}

function averageCover(squad) {
  if (!squad?.soldiers?.length) return 0;
  return squad.soldiers.reduce((sum, soldier) => sum + (soldier.coverScore ?? 0), 0) / squad.soldiers.length;
}

function classifyMorale(squad) {
  const aliveRatio = squadAliveCount(squad) / Math.max(1, squad.soldiers.length);
  if (aliveRatio <= 0.35 || squad.suppression >= 92) return "broken";
  if (aliveRatio <= 0.55 || squad.suppression >= 70) return "shaken";
  if (aliveRatio <= 0.78 || squad.suppression >= 38) return "concerned";
  return "steady";
}

function detectionChance(observer, target, distance, now) {
  const template = SQUAD_TEMPLATES[observer.template];
  const rangeFactor = 1 - THREE.MathUtils.clamp(distance / template.detectionRange, 0, 1);
  const targetCover = averageCover(target);
  const observerPenalty = THREE.MathUtils.clamp(observer.suppression / 140, 0, 0.7);
  const contactMemoryBoost = observer.lastKnownEnemyPosition && now - (observer.lastContactAt ?? 0) < CONTACT_MEMORY_MS ? 0.22 : 0;
  return THREE.MathUtils.clamp(0.2 + rangeFactor * 0.92 - targetCover * 0.46 - observerPenalty + contactMemoryBoost, 0, 1);
}

export class InfantryManager {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.group = new THREE.Group();
    this.group.name = "infantry";
    this.group.userData.feature = "unit-layer";
    this.scene.add(this.group);

    this.squads = new Map();
    this.selectedSquadId = null;
    this.nextSquadNumber = 1;
    this.enemyThinkMs = 550;
    this.lastThinkAt = 0;
    this.lastStatsEmitAt = 0;
    this.visible = true;
    this.visibleEnemyIds = null;

    this.friendlyMaterial = new THREE.MeshStandardMaterial({ color: FRIENDLY_COLOR, roughness: 0.65, metalness: 0.05 });
    this.enemyMaterial = new THREE.MeshStandardMaterial({ color: ENEMY_COLOR, roughness: 0.65, metalness: 0.05 });
    this.selectedMaterial = new THREE.MeshBasicMaterial({ color: SELECTED_COLOR, transparent: true, opacity: 0.8, depthWrite: false });
    this.pathMaterial = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.8 });
    this.objectiveMaterial = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    this.coverMaterial = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.55, depthWrite: false });
    this.breadcrumbMaterial = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.42, depthWrite: false });
    this.contactMaterial = new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.8, depthWrite: false });
    this.rallyMaterial = new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
    this.friendlyFootprintMaterial = new THREE.MeshBasicMaterial({ color: FRIENDLY_FOOTPRINT_COLOR, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    this.enemyFootprintMaterial = new THREE.MeshBasicMaterial({ color: ENEMY_FOOTPRINT_COLOR, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    this.friendlyFootprintLineMaterial = new THREE.LineBasicMaterial({ color: FRIENDLY_FOOTPRINT_COLOR, transparent: true, opacity: 0.58, depthWrite: false });
    this.enemyFootprintLineMaterial = new THREE.LineBasicMaterial({ color: ENEMY_FOOTPRINT_COLOR, transparent: true, opacity: 0.58, depthWrite: false });
    this.contestedMaterial = new THREE.MeshBasicMaterial({ color: CONTESTED_FOOTPRINT_COLOR, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.frontlineMaterial = new THREE.LineBasicMaterial({ color: FRONTLINE_COLOR, transparent: true, opacity: 0.78, depthWrite: false });
    this.friendlyEngagementAreaMaterial = new THREE.MeshBasicMaterial({ color: FRIENDLY_FOOTPRINT_COLOR, transparent: true, opacity: ENGAGEMENT_AREA_FILL_OPACITY, depthWrite: false, side: THREE.DoubleSide });
    this.enemyEngagementAreaMaterial = new THREE.MeshBasicMaterial({ color: ENEMY_FOOTPRINT_COLOR, transparent: true, opacity: ENGAGEMENT_AREA_FILL_OPACITY, depthWrite: false, side: THREE.DoubleSide });
    this.friendlyEngagementAreaLineMaterial = new THREE.LineBasicMaterial({ color: FRIENDLY_FOOTPRINT_COLOR, transparent: true, opacity: ENGAGEMENT_AREA_LINE_OPACITY, depthWrite: false });
    this.enemyEngagementAreaLineMaterial = new THREE.LineBasicMaterial({ color: ENEMY_FOOTPRINT_COLOR, transparent: true, opacity: ENGAGEMENT_AREA_LINE_OPACITY, depthWrite: false });
    this.contestedFrontlineGroups = [];
  }


  getGroundHeight(x, z) {
    const height = this.callbacks.getGroundHeight?.(x, z);
    return Number.isFinite(height) ? height : 0;
  }

  getSoldierCenterY(x, z) {
    return this.getGroundHeight(x, z) + SOLDIER_HEIGHT * 0.5 + INFANTRY_GROUND_CLEARANCE;
  }

  getMarkerY(x, z, offset = 0.22) {
    return this.getGroundHeight(x, z) + offset;
  }

  placeOnGround(position, centerOffset = SOLDIER_HEIGHT * 0.5 + INFANTRY_GROUND_CLEARANCE) {
    return new THREE.Vector3(
      position.x,
      this.getGroundHeight(position.x, position.z) + centerOffset,
      position.z
    );
  }

  clampVectorToGround(position, centerOffset = SOLDIER_HEIGHT * 0.5 + INFANTRY_GROUND_CLEARANCE) {
    position.y = this.getGroundHeight(position.x, position.z) + centerOffset;
    return position;
  }

  clear() {
    this.clearContestedFrontlines();
    for (const squad of this.squads.values()) this.disposeSquad(squad);
    this.squads.clear();
    this.selectedSquadId = null;
    this.nextSquadNumber = 1;
    this.emitStats();
  }

  dispose() {
    this.clear();
    this.group.parent?.remove(this.group);
    this.friendlyMaterial.dispose();
    this.enemyMaterial.dispose();
    this.selectedMaterial.dispose();
    this.pathMaterial.dispose();
    this.objectiveMaterial.dispose();
    this.coverMaterial.dispose();
    this.breadcrumbMaterial.dispose();
    this.contactMaterial.dispose();
    this.rallyMaterial.dispose();
    this.friendlyFootprintMaterial.dispose();
    this.enemyFootprintMaterial.dispose();
    this.friendlyFootprintLineMaterial.dispose();
    this.enemyFootprintLineMaterial.dispose();
    this.contestedMaterial.dispose();
    this.frontlineMaterial.dispose();
    this.friendlyEngagementAreaMaterial.dispose();
    this.enemyEngagementAreaMaterial.dispose();
    this.friendlyEngagementAreaLineMaterial.dispose();
    this.enemyEngagementAreaLineMaterial.dispose();
  }

  spawnRifleSquad(position, side = "friendly") {
    const template = SQUAD_TEMPLATES.rifle;
    const id = `${side}-${this.nextSquadNumber++}`;
    const label = `${side === "friendly" ? "Alpha" : "Enemy"} ${id.split("-")[1]}`;
    const center = this.placeOnGround(position);
    const squad = {
      id,
      label,
      side,
      template: "rifle",
      state: side === "friendly" ? "idle" : "defending",
      mission: side === "friendly" ? "awaiting orders" : "hold area",
      missionType: side === "friendly" ? "move" : "defend",
      missionTarget: null,
      missionStatus: side === "friendly" ? "idle" : "establishing",
      readiness: 0,
      readinessState: "establishing",
      readinessStartAt: 0,
      positionStrength: side === "friendly" ? 0 : POSITION_STRENGTH_BY_READINESS.establishing,
      positionStrengthMax: side === "friendly" ? 0 : POSITION_STRENGTH_BY_READINESS.establishing,
      positionStrengthState: "establishing",
      positionBroken: false,
      center,
      destination: null,
      activeOrder: null,
      missionProfile: side === "friendly" ? "none" : "hold",
      supportTargetId: null,
      path: [],
      pathIndex: 0,
      objectiveRadius: 42,
      targetEnemyId: null,
      suppression: 0,
      morale: "steady",
      fireMode: side === "friendly" ? "free" : "return",
      contactBearing: "n/a",
      contactRange: 0,
      contactConfidence: 0,
      lastKnownEnemyPosition: null,
      lastContactAt: 0,
      lastContactReportAt: 0,
      shotsFired: 0,
      hitsTaken: 0,
      casualties: 0,
      pathHistory: [],
      fallbackTarget: null,
      fallbackThreatPosition: null,
      fallbackStartedAt: 0,
      lastFallbackAt: 0,
      knownThreatLocations: [],
      soldiers: [],
      group: new THREE.Group(),
      mesh: null,
      selectionRing: null,
      soldierSelectionMesh: null,
      pathLine: null,
      breadcrumbLine: null,
      objectiveMesh: null,
      rallyMesh: null,
      tacticalFootprintMesh: null,
      tacticalFootprintLine: null,
      engagementAreaMesh: null,
      engagementAreaLine: null,
      readinessAnchorMesh: null,
      readinessAnchorFillMesh: null,
      readinessArcLine: null,
      reinforcementGroup: null,
      reinforcementVisualKey: null,
      defensiveHeading: 0,
      defensiveSlots: [],
      contactMarkers: [],
      coverMarkers: [],
      lastShotAt: 0
    };

    squad.group.name = `squad-${id}`;
    squad.group.userData.feature = "unit-squad";
    squad.group.userData.squadId = id;
    this.group.add(squad.group);

    const bodyGeometry = new THREE.CapsuleGeometry(0.55, 1.2, 4, 8);
    const material = side === "friendly" ? this.friendlyMaterial : this.enemyMaterial;
    const mesh = new THREE.InstancedMesh(bodyGeometry, material, template.soldiers);
    // The squad instance matrices are rebuilt every frame and can live far from
    // the group's origin. Three's default frustum culling can use stale bounds
    // for dynamic InstancedMesh objects, which makes squads flicker/blink as the
    // camera moves or right after deployment. Keep these small unit meshes out of
    // frustum culling until we add explicit per-squad bounding volumes.
    mesh.frustumCulled = false;
    mesh.name = `soldiers-${id}`;
    mesh.userData.feature = "unit-soldier";
    mesh.userData.squadId = id;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    squad.mesh = mesh;
    squad.group.add(mesh);

    const heading = side === "friendly" ? 0 : Math.PI;
    for (let i = 0; i < template.soldiers; i++) {
      squad.soldiers.push({
        id: `${id}-soldier-${i + 1}`,
        health: 100,
        initialHealth: 100,
        stance: "standing",
        wounded: false,
        position: this.clampVectorToGround(formationPosition(center, i, heading)),
        targetPosition: this.clampVectorToGround(formationPosition(center, i, heading)),
        coverScore: 0
      });
    }

    this.ensureSelectionRing(squad);
    this.ensureSoldierSelectionRings(squad);
    this.updateSquadVisuals(squad);
    this.squads.set(id, squad);

    if (side === "friendly") this.selectSquad(id);
    this.callbacks.onInfantryEvent?.({ type: "spawn", squad });
    this.emitStats();
    return squad;
  }

  disposeSquad(squad) {
    squad.mesh?.geometry?.dispose?.();
    squad.group?.parent?.remove(squad.group);
    squad.pathLine?.geometry?.dispose?.();
    squad.pathLine?.parent?.remove(squad.pathLine);
    squad.breadcrumbLine?.geometry?.dispose?.();
    squad.breadcrumbLine?.parent?.remove(squad.breadcrumbLine);
    squad.objectiveMesh?.geometry?.dispose?.();
    squad.objectiveMesh?.parent?.remove(squad.objectiveMesh);
    squad.rallyMesh?.geometry?.dispose?.();
    squad.rallyMesh?.parent?.remove(squad.rallyMesh);
    squad.tacticalFootprintMesh?.geometry?.dispose?.();
    squad.tacticalFootprintMesh?.parent?.remove(squad.tacticalFootprintMesh);
    squad.tacticalFootprintLine?.geometry?.dispose?.();
    squad.tacticalFootprintLine?.parent?.remove(squad.tacticalFootprintLine);
    squad.engagementAreaMesh?.geometry?.dispose?.();
    squad.engagementAreaMesh?.parent?.remove(squad.engagementAreaMesh);
    squad.engagementAreaLine?.geometry?.dispose?.();
    squad.engagementAreaLine?.parent?.remove(squad.engagementAreaLine);
    squad.readinessAnchorMesh?.geometry?.dispose?.();
    squad.readinessAnchorMesh?.parent?.remove(squad.readinessAnchorMesh);
    squad.readinessAnchorFillMesh?.geometry?.dispose?.();
    squad.readinessAnchorFillMesh?.parent?.remove(squad.readinessAnchorFillMesh);
    squad.readinessArcLine?.geometry?.dispose?.();
    squad.readinessArcLine?.parent?.remove(squad.readinessArcLine);
    this.disposeReinforcementVisual(squad);
    squad.selectionRing?.geometry?.dispose?.();
    squad.selectionRing?.parent?.remove(squad.selectionRing);
    squad.soldierSelectionMesh?.geometry?.dispose?.();
    squad.soldierSelectionMesh?.parent?.remove(squad.soldierSelectionMesh);
    for (const marker of squad.coverMarkers ?? []) {
      marker.geometry?.dispose?.();
      marker.parent?.remove(marker);
    }
    for (const marker of squad.contactMarkers ?? []) {
      marker.geometry?.dispose?.();
      marker.parent?.remove(marker);
    }
  }

  ensureSelectionRing(squad) {
    // Unit-level selection rings are intentionally disabled. Selection is now
    // shown with small per-soldier rings so the map stays cleaner.
    if (squad.selectionRing) {
      squad.selectionRing.visible = false;
    }
  }

  ensureSoldierSelectionRings(squad) {
    if (squad.soldierSelectionMesh) return;
    const geometry = new THREE.RingGeometry(0.95, 1.18, 20);
    const mesh = new THREE.InstancedMesh(geometry, this.selectedMaterial, squad.soldiers.length);
    mesh.frustumCulled = false;
    mesh.name = `soldier-selection-rings-${squad.id}`;
    mesh.userData.feature = "soldier-selection";
    mesh.userData.squadId = squad.id;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.visible = false;
    squad.soldierSelectionMesh = mesh;
    squad.group.add(mesh);
  }

  clearSelection() {
    this.selectedSquadId = null;
    for (const squad of this.squads.values()) {
      if (squad.selectionRing) squad.selectionRing.visible = false;
      if (squad.soldierSelectionMesh) squad.soldierSelectionMesh.visible = false;
      if (squad.pathLine) squad.pathLine.visible = false;
      if (squad.breadcrumbLine) squad.breadcrumbLine.visible = false;
      if (squad.objectiveMesh) squad.objectiveMesh.visible = false;
      if (squad.rallyMesh) squad.rallyMesh.visible = false;
      for (const marker of squad.coverMarkers ?? []) marker.visible = false;
      for (const marker of squad.contactMarkers ?? []) marker.visible = false;
    }
    this.emitStats();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.applyVisibility();
  }

  applyVisibility() {
    this.group.visible = this.visible;
    for (const squad of this.squads.values()) {
      const enemyHiddenByFog = squad.side === "enemy" && this.visibleEnemyIds instanceof Set && !this.visibleEnemyIds.has(squad.id);
      squad.group.visible = this.visible && !enemyHiddenByFog;
      const isSelected = squad.id === this.selectedSquadId;
      if (squad.pathLine) squad.pathLine.visible = this.visible && isSelected;
      if (squad.breadcrumbLine) squad.breadcrumbLine.visible = this.visible && isSelected;
      if (squad.objectiveMesh) squad.objectiveMesh.visible = this.visible && isSelected;
      if (squad.rallyMesh) squad.rallyMesh.visible = this.visible && isSelected;
      this.updateTacticalFootprint(squad);
      this.updateEngagementAreaVisual(squad);
      this.updateReadinessVisual(squad);
      if (squad.selectionRing) squad.selectionRing.visible = false;
      if (squad.soldierSelectionMesh) squad.soldierSelectionMesh.visible = this.visible && isSelected;
      for (const marker of squad.coverMarkers ?? []) marker.visible = this.visible && isSelected;
      for (const marker of squad.contactMarkers ?? []) marker.visible = this.visible && isSelected;
    }
    this.updateContestedFrontlines();
  }

  selectSquad(id) {
    if (!this.squads.has(id)) return null;
    this.selectedSquadId = id;
    for (const squad of this.squads.values()) {
      this.ensureSelectionRing(squad);
      this.ensureSoldierSelectionRings(squad);
      if (squad.selectionRing) squad.selectionRing.visible = false;
      if (squad.soldierSelectionMesh) squad.soldierSelectionMesh.visible = this.visible && squad.id === id;
    }
    const squad = this.squads.get(id);
    for (const other of this.squads.values()) {
      this.updateObjectiveVisual(other);
      this.updatePathVisual(other);
      this.updateBreadcrumbVisual(other);
      this.updateContactMarkers(other);
      this.updateRallyVisual(other);
    }
    this.callbacks.onInfantryEvent?.({ type: "select", squad });
    this.emitStats();
    return squad;
  }

  selectNext(side = null) {
    const squads = [...this.squads.values()].filter((squad) => !side || squad.side === side);
    if (!squads.length) return null;
    const currentIndex = squads.findIndex((squad) => squad.id === this.selectedSquadId);
    return this.selectSquad(squads[(currentIndex + 1) % squads.length].id);
  }

  selectNextFriendly() {
    return this.selectNext("friendly");
  }

  selectNextEnemy() {
    return this.selectNext("enemy");
  }

  selectAtPoint(point, side = null) {
    let best = null;
    let bestDistance = Infinity;
    for (const squad of this.squads.values()) {
      if (side && squad.side !== side) continue;
      const distance = distance2D(squad.center, point);
      if (distance < bestDistance && distance <= 35) {
        best = squad;
        bestDistance = distance;
      }
    }
    if (best) return this.selectSquad(best.id);
    return null;
  }

  issueBuildingOrder(feature, options = {}, squadId = this.selectedSquadId) {
    const squad = this.squads.get(squadId);
    if (!squad || !feature?.position) return null;

    const orderType = options.type === "occupy_building" ? "occupy_building" : "use_building_cover";
    const fireMode = sanitizeFireMode(options.fireMode ?? (orderType === "occupy_building" ? "free" : "return"));
    const buildingRadius = Math.max(10, feature.bounds?.radius ?? 14);
    const fromBuildingToSquad = squad.center.clone().sub(feature.position);
    fromBuildingToSquad.y = 0;
    if (fromBuildingToSquad.lengthSq() < 0.001) fromBuildingToSquad.set(0, 0, 1);
    fromBuildingToSquad.normalize();

    const destination = orderType === "occupy_building"
      ? feature.position.clone()
      : feature.position.clone().add(fromBuildingToSquad.multiplyScalar(buildingRadius + 10));

    squad.destination = this.placeOnGround(destination);
    squad.pathHistory = [];
    this.recordPathHistory(squad, performance.now(), true);
    squad.path = this.computePath(squad.center, squad.destination);
    squad.pathIndex = squad.path.length > 1 ? 1 : 0;
    squad.activeOrder = {
      type: orderType,
      missionType: orderType === "occupy_building" ? "secure" : "hold",
      targetId: feature.id,
      targetCategory: feature.category,
      targetPosition: this.placeOnGround(feature.position),
      targetRadius: buildingRadius,
      fireMode,
      fallback: "retreat_if_heavy_losses",
      rallyPoint: Boolean(options.rallyPoint),
      reinforcementPolicy: options.reinforcementPolicy ?? "none"
    };
    squad.state = "moving";
    squad.missionType = orderType === "occupy_building" ? "defend" : "defend";
    squad.defensiveHeading = headingFromTo(squad.center, squad.destination);
    squad.missionTarget = squad.destination.clone();
    squad.missionStatus = "enroute";
    resetReadiness(squad);
    squad.defensiveSlots = [];
    squad.missionProfile = squad.activeOrder.missionType;
    squad.mission = commandLabel(squad.activeOrder);
    squad.fireMode = fireMode;
    squad.targetEnemyId = null;
    squad.lastKnownEnemyPosition = null;
    squad.contactBearing = "n/a";
    squad.contactRange = 0;
    squad.contactConfidence = 0;
    squad.objectiveRadius = orderType === "occupy_building" ? Math.max(18, buildingRadius * 0.8) : 34;
    squad.suppression = Math.max(0, squad.suppression - 8);
    this.updateObjectiveVisual(squad);
    this.updatePathVisual(squad);
    this.updateRallyVisual(squad);
    this.callbacks.onInfantryEvent?.({ type: "buildingOrder", squad, feature, order: squad.activeOrder });
    this.emitStats();
    return squad;
  }

  issueMissionAtPoint(point, options = {}, squadId = this.selectedSquadId) {
    const squad = this.squads.get(squadId);
    if (!squad) return null;
    const missionType = sanitizeMissionType(options.missionType ?? "move");
    const fireMode = sanitizeFireMode(options.fireMode ?? defaultFireModeForMission(missionType));
    squad.destination = this.placeOnGround(point);
    squad.pathHistory = [];
    this.recordPathHistory(squad, performance.now(), true);
    squad.activeOrder = {
      type: "mission",
      missionType,
      targetCategory: "point",
      targetPosition: squad.destination.clone(),
      fireMode,
      fallback: missionType === "move" ? "none" : "retreat_if_heavy_losses",
      rallyPoint: Boolean(options.rallyPoint),
      reinforcementPolicy: options.reinforcementPolicy ?? "none"
    };
    squad.missionType = missionType;
    squad.defensiveHeading = headingFromTo(squad.center, squad.destination);
    squad.missionTarget = squad.destination.clone();
    squad.missionStatus = "enroute";
    resetReadiness(squad);
    squad.defensiveSlots = [];
    squad.missionProfile = missionType;
    squad.fireMode = fireMode;
    squad.path = this.computePath(squad.center, squad.destination);
    squad.pathIndex = squad.path.length > 1 ? 1 : 0;
    squad.state = "moving";
    squad.mission = commandLabel(squad.activeOrder);
    squad.targetEnemyId = null;
    squad.lastKnownEnemyPosition = null;
    squad.contactBearing = "n/a";
    squad.contactRange = 0;
    squad.contactConfidence = 0;
    squad.objectiveRadius = objectiveRadiusForMission(missionType);
    squad.suppression = Math.max(0, squad.suppression - 10);
    this.updateObjectiveVisual(squad);
    this.updatePathVisual(squad);
    this.updateRallyVisual(squad);
    this.callbacks.onInfantryEvent?.({ type: "mission", squad, point, missionType, fireMode });
    this.emitStats();
    return squad;
  }

  issueSecureArea(point, squadId = this.selectedSquadId) {
    return this.issueMissionAtPoint(point, { missionType: "move", fireMode: "return" }, squadId);
  }

  holdSelectedPosition(squadId = this.selectedSquadId) {
    const squad = this.squads.get(squadId);
    if (!squad) return null;
    squad.destination = null;
    squad.activeOrder = { type: "mission", missionType: "defend", targetCategory: "self", targetPosition: squad.center.clone(), fireMode: squad.fireMode ?? "return", fallback: "hold_known_ground", rallyPoint: false, reinforcementPolicy: "none" };
    squad.missionType = "defend";
    squad.defensiveHeading = squad.defensiveHeading ?? 0;
    squad.missionTarget = squad.center.clone();
    squad.missionStatus = "establishing";
    resetReadiness(squad);
    squad.defensiveSlots = [];
    squad.missionProfile = "defend";
    squad.fallbackTarget = null;
    squad.fallbackThreatPosition = null;
    squad.path = [];
    squad.pathIndex = 0;
    squad.targetEnemyId = null;
    squad.state = "defending";
    squad.mission = squad.side === "friendly" ? "hold position" : "hold enemy position";
    this.clearCoverMarkers(squad);
    if (squad.pathLine) squad.pathLine.visible = false;
    if (squad.objectiveMesh) squad.objectiveMesh.visible = false;
    if (squad.rallyMesh) squad.rallyMesh.visible = false;
    this.assignSecurityPositions(squad);
    this.callbacks.onInfantryEvent?.({ type: "hold", squad });
    this.emitStats();
    return squad;
  }

  forceSelectedSquadRetreat(squadId = this.selectedSquadId) {
    const squad = this.squads.get(squadId);
    if (!squad) return null;
    const threat = squad.lastKnownEnemyPosition ?? squad.fallbackThreatPosition ?? null;
    const historyFallback = this.findFallbackFromHistory(squad, threat);
    const fallbackTarget = historyFallback || this.clampVectorToGround(
      squad.center.clone().add(new THREE.Vector3(squad.side === "friendly" ? -24 : 24, 0, squad.side === "friendly" ? 24 : -24))
    );
    squad.activeOrder = { type: "mission", missionType: "fallback", targetCategory: "terrain", targetPosition: fallbackTarget.clone(), fireMode: "return", fallback: "manual_retreat", rallyPoint: true, reinforcementPolicy: "none" };
    squad.destination = fallbackTarget.clone();
    squad.missionType = "fallback";
    squad.missionStatus = "fallback";
    squad.missionTarget = fallbackTarget.clone();
    squad.mission = squad.side === "friendly" ? "retreating to fallback" : "enemy retreating";
    squad.fallbackTarget = fallbackTarget.clone();
    squad.fallbackThreatPosition = threat?.clone?.() ?? null;
    squad.path = [];
    squad.pathIndex = 0;
    squad.targetEnemyId = null;
    this.setSquadState(squad, "retreating", "manual retreat order");
    this.updateObjectiveVisual(squad);
    this.updateRallyVisual(squad);
    this.callbacks.onInfantryEvent?.({ type: "fallback", squad, threatPosition: threat ?? squad.center, point: fallbackTarget });
    this.emitStats();
    return squad;
  }

  updateObjectiveVisual(squad) {
    if (!squad.destination) {
      if (squad.objectiveMesh) squad.objectiveMesh.visible = false;
      return;
    }
    if (!squad.objectiveMesh) {
      squad.objectiveMesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), this.objectiveMaterial);
      squad.objectiveMesh.rotateX(-Math.PI / 2);
      squad.objectiveMesh.userData.feature = "unit-objective";
      this.group.add(squad.objectiveMesh);
    }
    squad.objectiveMesh.position.set(squad.destination.x, this.getMarkerY(squad.destination.x, squad.destination.z, 0.18), squad.destination.z);
    squad.objectiveMesh.scale.setScalar(squad.objectiveRadius);
    squad.objectiveMesh.visible = this.visible && squad.id === this.selectedSquadId;
  }

  updatePathVisual(squad) {
    if (squad.pathLine) {
      squad.pathLine.geometry.dispose();
      squad.pathLine.parent?.remove(squad.pathLine);
      squad.pathLine = null;
    }
    if (!squad.destination || !this.visible || squad.id !== this.selectedSquadId) return;

    const route = squad.path?.length ? squad.path : [squad.center, squad.destination];
    const points = route.map((point) => new THREE.Vector3(point.x, this.getMarkerY(point.x, point.z, 0.35), point.z));
    squad.pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.pathMaterial);
    squad.pathLine.userData.feature = "unit-path";
    this.group.add(squad.pathLine);
  }

  updateBreadcrumbVisual(squad) {
    if (squad.breadcrumbLine) {
      squad.breadcrumbLine.geometry.dispose();
      squad.breadcrumbLine.parent?.remove(squad.breadcrumbLine);
      squad.breadcrumbLine = null;
    }
    if (!this.visible || squad.id !== this.selectedSquadId || !squad.pathHistory?.length) return;
    const points = squad.pathHistory.map((entry) => new THREE.Vector3(entry.position.x, this.getMarkerY(entry.position.x, entry.position.z, 0.42), entry.position.z));
    points.push(new THREE.Vector3(squad.center.x, this.getMarkerY(squad.center.x, squad.center.z, 0.42), squad.center.z));
    if (points.length < 2) return;
    squad.breadcrumbLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.breadcrumbMaterial);
    squad.breadcrumbLine.userData.feature = "unit-breadcrumb-route";
    this.group.add(squad.breadcrumbLine);
  }

  updateContactMarkers(squad) {
    for (const marker of squad.contactMarkers ?? []) {
      marker.geometry?.dispose?.();
      marker.parent?.remove(marker);
    }
    squad.contactMarkers = [];
    if (!this.visible || squad.id !== this.selectedSquadId) return;
    const now = performance.now();
    const threats = (squad.knownThreatLocations ?? []).filter((entry) => now - entry.timestamp < 120000).slice(-6);
    for (const threat of threats) {
      const size = threat.threatLevel === "high" ? 10 : 7;
      const y = this.getMarkerY(threat.position.x, threat.position.z, 0.58);
      const points = [
        new THREE.Vector3(threat.position.x - size, y, threat.position.z - size),
        new THREE.Vector3(threat.position.x + size, y, threat.position.z + size),
        new THREE.Vector3(threat.position.x + size, y, threat.position.z - size),
        new THREE.Vector3(threat.position.x - size, y, threat.position.z + size)
      ];
      const marker = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), this.contactMaterial);
      marker.userData.feature = "unit-contact-memory";
      this.group.add(marker);
      squad.contactMarkers.push(marker);
    }
  }

  updateRallyVisual(squad) {
    if (!squad.activeOrder?.rallyPoint || !squad.activeOrder?.targetPosition) {
      if (squad.rallyMesh) squad.rallyMesh.visible = false;
      return;
    }
    if (!squad.rallyMesh) {
      squad.rallyMesh = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.5, 3), this.rallyMaterial);
      squad.rallyMesh.rotateX(-Math.PI / 2);
      squad.rallyMesh.userData.feature = "unit-rally-point";
      this.group.add(squad.rallyMesh);
    }
    const p = squad.activeOrder.targetPosition;
    squad.rallyMesh.position.set(p.x, this.getMarkerY(p.x, p.z, 0.52), p.z);
    squad.rallyMesh.visible = this.visible && squad.id === this.selectedSquadId;
  }

  buildTacticalFootprintGeometry(squad) {
    const soldiers = livingSoldiers(squad);
    if (soldiers.length < 2) return null;

    const plannedSlots = Array.isArray(squad.defensiveSlots) ? squad.defensiveSlots.map((slot) => slot.position).filter(Boolean) : [];
    const sourcePoints = plannedSlots.length >= 2 ? [...plannedSlots] : soldiers.map((soldier) => soldier.position);
    if (squad.missionTarget) sourcePoints.push(squad.missionTarget);

    const center = sourcePoints.reduce((sum, point) => {
      sum.x += point.x;
      sum.z += point.z;
      return sum;
    }, { x: 0, z: 0 });
    center.x /= sourcePoints.length;
    center.z /= sourcePoints.length;

    const bins = 28;
    const profile = readinessProfile(squad.readinessState, squad.missionType);
    const padding = (squad.missionType === "ambush" ? 10 : 13) * profile.radiusScale;
    const minimumRadius = (squad.missionType === "ambush" ? 16 : 20) * profile.radiusScale;
    const defensiveHeading = Number.isFinite(squad.defensiveHeading) ? squad.defensiveHeading : 0;
    const radii = new Array(bins).fill(minimumRadius);

    for (let i = 0; i < bins; i++) {
      const angle = (i / bins) * Math.PI * 2;
      const forwardBias = 1 + Math.max(0, Math.cos(angle - defensiveHeading)) * 0.18 * profile.arcScale;
      for (const point of sourcePoints) {
        const dx = point.x - center.x;
        const dz = point.z - center.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < 0.001) continue;
        const pointAngle = Math.atan2(dz, dx);
        const delta = angleDelta(angle, pointAngle);
        const influence = Math.max(0, Math.cos(delta));
        radii[i] = Math.max(radii[i], (distance * Math.pow(influence, 2.2) + padding) * forwardBias);
      }
    }

    const smoothed = radii.map((radius, i) => {
      const prev = radii[(i - 1 + bins) % bins];
      const next = radii[(i + 1) % bins];
      return (radius * 0.5 + prev * 0.25 + next * 0.25) * profile.radiusScale;
    });

    const ringPoints = smoothed.map((radius, i) => {
      const angle = (i / bins) * Math.PI * 2;
      return new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        this.getMarkerY(center.x + Math.cos(angle) * radius, center.z + Math.sin(angle) * radius, 0.11),
        center.z + Math.sin(angle) * radius
      );
    });

    const curve = new THREE.CatmullRomCurve3(ringPoints, true, "centripetal", 0.45);
    const outline = curve.getPoints(112);

    // Terrain-drape the footprint instead of drawing one flat fan.  A single
    // center fan can slice into hills because every triangle spans from the
    // center to the outer edge.  Building several concentric rings gives the
    // overlay enough vertices to follow local terrain changes and stay visible
    // on slopes.
    const terrainOffset = 0.24;
    const outlineOffset = 0.32;
    const radialSteps = 7;
    const segmentCount = outline.length;
    const vertices = [];

    for (let r = 0; r <= radialSteps; r++) {
      const t = r / radialSteps;
      // Ease the center rings outward a bit so triangles stay better shaped.
      const eased = t * t * (3 - 2 * t);
      for (let i = 0; i < segmentCount; i++) {
        const edge = outline[i];
        const x = THREE.MathUtils.lerp(center.x, edge.x, eased);
        const z = THREE.MathUtils.lerp(center.z, edge.z, eased);
        vertices.push(x, this.getMarkerY(x, z, terrainOffset), z);
      }
    }

    const indices = [];
    for (let r = 0; r < radialSteps; r++) {
      const row = r * segmentCount;
      const nextRow = (r + 1) * segmentCount;
      for (let i = 0; i < segmentCount; i++) {
        const j = (i + 1) % segmentCount;
        const a = row + i;
        const b = row + j;
        const c = nextRow + i;
        const d = nextRow + j;
        indices.push(a, c, b, b, c, d);
      }
    }

    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    fillGeometry.setIndex(indices);
    fillGeometry.computeVertexNormals();
    fillGeometry.computeBoundingSphere();

    const linePoints = outline.map((point) => new THREE.Vector3(
      point.x,
      this.getMarkerY(point.x, point.z, outlineOffset),
      point.z
    ));
    linePoints.push(linePoints[0].clone());
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);

    return { fillGeometry, lineGeometry };
  }

  clearContestedFrontlines() {
    for (const group of this.contestedFrontlineGroups ?? []) {
      group.traverse((child) => child.geometry?.dispose?.());
      group.parent?.remove(group);
    }
    this.contestedFrontlineGroups = [];
  }

  addContestedFrontlinePair(a, b) {
    if (!a || !b || a.strength <= 0 || b.strength <= 0) return;
    const distance = distance2D(a.anchor, b.anchor);
    const overlap = a.radius + b.radius - distance;
    if (overlap <= 0 || distance < 1) return;

    const ax = a.anchor.x;
    const az = a.anchor.z;
    const bx = b.anchor.x;
    const bz = b.anchor.z;
    const dirX = (bx - ax) / distance;
    const dirZ = (bz - az) / distance;
    const totalStrength = Math.max(1, a.strength + b.strength);
    // Stronger positions push the line toward the weaker side.
    const balance = THREE.MathUtils.clamp(a.strength / totalStrength, 0.25, 0.75);
    const cx = ax + dirX * distance * balance;
    const cz = az + dirZ * distance * balance;
    const y = this.getMarkerY(cx, cz, 0.145);

    const group = new THREE.Group();
    group.name = `contested-frontline-${a.squad.id}-${b.squad.id}`;
    group.userData.feature = "unit-contested-frontline";
    group.renderOrder = 11;

    const length = THREE.MathUtils.clamp(Math.min(a.radius, b.radius) * 1.35 + overlap * 0.35, 20, 58);
    const lineHalf = length * 0.5;
    const normalX = -dirZ;
    const normalZ = dirX;
    const linePoints = [
      new THREE.Vector3(cx - normalX * lineHalf, this.getMarkerY(cx - normalX * lineHalf, cz - normalZ * lineHalf, 0.33), cz - normalZ * lineHalf),
      new THREE.Vector3(cx + normalX * lineHalf, this.getMarkerY(cx + normalX * lineHalf, cz + normalZ * lineHalf, 0.33), cz + normalZ * lineHalf)
    ];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), this.frontlineMaterial);
    line.name = "contested-frontline";
    line.userData.feature = "unit-frontline";
    line.renderOrder = 12;
    group.add(line);

    this.group.add(group);
    this.contestedFrontlineGroups.push(group);
  }

  updateContestedFrontlines() {
    this.clearContestedFrontlines();
    if (!this.visible) return;

    const friendly = [];
    const enemy = [];
    for (const squad of this.squads.values()) {
      const enemyHiddenByFog = squad.side === "enemy" && this.visibleEnemyIds instanceof Set && !this.visibleEnemyIds.has(squad.id);
      if (enemyHiddenByFog) continue;
      const info = activeFootprintInfo(squad);
      if (!info) continue;
      if (squad.side === "enemy") enemy.push(info);
      else friendly.push(info);
    }

    for (const a of friendly) {
      for (const b of enemy) this.addContestedFrontlinePair(a, b);
    }
  }

  buildEngagementAreaGeometry(squad) {
    const info = activeEngagementAreaInfo(squad);
    if (!info) return null;
    const anchor = info.anchor;
    const heading = info.heading;
    const radius = info.radius;
    const arc = squad.missionType === "ambush" ? Math.PI * 0.92 : Math.PI * 1.28;
    const segments = 44;
    const start = heading - arc * 0.5;
    const yCenter = this.getMarkerY(anchor.x, anchor.z, 0.085);
    const vertices = [anchor.x, yCenter, anchor.z];
    const outline = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = start + arc * t;
      // Rounded forward sector: slightly stronger straight ahead, softer at edges.
      const edgeFalloff = Math.sin(t * Math.PI);
      const r = radius * (0.72 + edgeFalloff * 0.28);
      const x = anchor.x + Math.sin(angle) * r;
      const z = anchor.z + Math.cos(angle) * r;
      const p = new THREE.Vector3(x, this.getMarkerY(x, z, 0.087), z);
      outline.push(p);
      vertices.push(p.x, p.y, p.z);
    }
    const indices = [];
    for (let i = 1; i < outline.length; i++) indices.push(0, i, i + 1);
    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    fillGeometry.setIndex(indices);
    fillGeometry.computeBoundingSphere();

    const linePoints = [new THREE.Vector3(anchor.x, yCenter, anchor.z), ...outline, new THREE.Vector3(anchor.x, yCenter, anchor.z)];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    return { fillGeometry, lineGeometry };
  }

  updateEngagementAreaVisual(squad) {
    // Engagement range is still used by combat logic, but we no longer draw the
    // large engagement radius on the map. The visible battle line now comes from
    // friendly/enemy tactical footprints touching each other.
    if (squad.engagementAreaMesh) squad.engagementAreaMesh.visible = false;
    if (squad.engagementAreaLine) squad.engagementAreaLine.visible = false;
  }

  updateTacticalFootprint(squad) {
    const enemyHiddenByFog = squad.side === "enemy" && this.visibleEnemyIds instanceof Set && !this.visibleEnemyIds.has(squad.id);
    const show = this.visible && !enemyHiddenByFog && shouldShowTacticalFootprint(squad);
    if (!show) {
      if (squad.tacticalFootprintMesh) squad.tacticalFootprintMesh.visible = false;
      if (squad.tacticalFootprintLine) squad.tacticalFootprintLine.visible = false;
      return;
    }

    const geometry = this.buildTacticalFootprintGeometry(squad);
    if (!geometry) return;

    const color = squad.side === "enemy" ? ENEMY_FOOTPRINT_COLOR : FRIENDLY_FOOTPRINT_COLOR;
    const profile = readinessProfile(squad.readinessState, squad.missionType);
    if (!squad.tacticalFootprintMaterial) {
      squad.tacticalFootprintMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: profile.fillOpacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
      });
    }
    if (!squad.tacticalFootprintLineMaterial) {
      squad.tacticalFootprintLineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: profile.lineOpacity, depthWrite: false });
    }
    const fillMaterial = squad.tacticalFootprintMaterial;
    const lineMaterial = squad.tacticalFootprintLineMaterial;
    fillMaterial.opacity = profile.fillOpacity;
    lineMaterial.opacity = profile.lineOpacity;

    if (!squad.tacticalFootprintMesh) {
      squad.tacticalFootprintMesh = new THREE.Mesh(geometry.fillGeometry, fillMaterial);
      squad.tacticalFootprintMesh.name = `tactical-footprint-${squad.id}`;
      squad.tacticalFootprintMesh.userData.feature = "unit-tactical-footprint";
      squad.tacticalFootprintMesh.renderOrder = 5;
      this.group.add(squad.tacticalFootprintMesh);
    } else {
      squad.tacticalFootprintMesh.geometry.dispose();
      squad.tacticalFootprintMesh.geometry = geometry.fillGeometry;
      squad.tacticalFootprintMesh.material = fillMaterial;
    }

    if (!squad.tacticalFootprintLine) {
      squad.tacticalFootprintLine = new THREE.Line(geometry.lineGeometry, lineMaterial);
      squad.tacticalFootprintLine.name = `tactical-footprint-outline-${squad.id}`;
      squad.tacticalFootprintLine.userData.feature = "unit-tactical-footprint-outline";
      squad.tacticalFootprintLine.renderOrder = 6;
      this.group.add(squad.tacticalFootprintLine);
    } else {
      squad.tacticalFootprintLine.geometry.dispose();
      squad.tacticalFootprintLine.geometry = geometry.lineGeometry;
      squad.tacticalFootprintLine.material = lineMaterial;
    }

    squad.tacticalFootprintMesh.visible = true;
    squad.tacticalFootprintLine.visible = true;
  }

  updateReadinessVisual(squad) {
    const enemyHiddenByFog = squad.side === "enemy" && this.visibleEnemyIds instanceof Set && !this.visibleEnemyIds.has(squad.id);
    const show = this.visible && !enemyHiddenByFog && shouldShowTacticalFootprint(squad) && Boolean(squad.missionTarget);
    if (!show) {
      if (squad.readinessAnchorMesh) squad.readinessAnchorMesh.visible = false;
      if (squad.readinessAnchorFillMesh) squad.readinessAnchorFillMesh.visible = false;
      if (squad.readinessArcLine) squad.readinessArcLine.visible = false;
      return;
    }

    const color = squad.side === "enemy" ? ENEMY_FOOTPRINT_COLOR : FRIENDLY_FOOTPRINT_COLOR;
    const profile = readinessProfile(squad.readinessState, squad.missionType);
    const anchor = this.placeOnGround(squad.missionTarget, 0.16);
    const radius = squad.missionType === "ambush" ? 4.2 : 4.8;
    const theta = Math.PI * 2 * profile.anchorProgress;

    if (!squad.readinessAnchorMaterial) {
      squad.readinessAnchorMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide });
    }
    squad.readinessAnchorMaterial.opacity = Math.max(0.42, profile.lineOpacity);

    const anchorGeometry = new THREE.RingGeometry(radius * 0.72, radius, 64, 1, -Math.PI / 2, theta);
    if (!squad.readinessAnchorMesh) {
      squad.readinessAnchorMesh = new THREE.Mesh(anchorGeometry, squad.readinessAnchorMaterial);
      squad.readinessAnchorMesh.rotateX(-Math.PI / 2);
      squad.readinessAnchorMesh.name = `readiness-anchor-${squad.id}`;
      squad.readinessAnchorMesh.userData.feature = "unit-readiness-anchor";
      squad.readinessAnchorMesh.renderOrder = 8;
      this.group.add(squad.readinessAnchorMesh);
    } else {
      squad.readinessAnchorMesh.geometry.dispose();
      squad.readinessAnchorMesh.geometry = anchorGeometry;
    }
    squad.readinessAnchorMesh.position.set(anchor.x, anchor.y, anchor.z);
    squad.readinessAnchorMesh.visible = true;

    if (!squad.readinessAnchorFillMaterial) {
      squad.readinessAnchorFillMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    }
    squad.readinessAnchorFillMaterial.opacity = squad.readinessState === "fortified" ? 0.36 : squad.readinessState === "entrenched" ? 0.2 : 0.08;
    if (!squad.readinessAnchorFillMesh) {
      squad.readinessAnchorFillMesh = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.42, 40), squad.readinessAnchorFillMaterial);
      squad.readinessAnchorFillMesh.rotateX(-Math.PI / 2);
      squad.readinessAnchorFillMesh.name = `readiness-anchor-fill-${squad.id}`;
      squad.readinessAnchorFillMesh.userData.feature = "unit-readiness-anchor-fill";
      squad.readinessAnchorFillMesh.renderOrder = 7;
      this.group.add(squad.readinessAnchorFillMesh);
    }
    squad.readinessAnchorFillMesh.position.set(anchor.x, anchor.y - 0.01, anchor.z);
    squad.readinessAnchorFillMesh.visible = squad.readinessState === "entrenched" || squad.readinessState === "fortified";

    const heading = Number.isFinite(squad.defensiveHeading) ? squad.defensiveHeading : 0;
    const arcRadius = (squad.missionType === "ambush" ? 20 : 25) * profile.arcScale;
    const spread = squad.missionType === "ambush" ? Math.PI * 0.46 : Math.PI * 0.62;
    const points = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const a = heading - spread * 0.5 + spread * t;
      const x = anchor.x + Math.sin(a) * arcRadius;
      const z = anchor.z + Math.cos(a) * arcRadius;
      points.push(new THREE.Vector3(x, this.getMarkerY(x, z, 0.2), z));
    }
    if (!squad.readinessArcMaterial) {
      squad.readinessArcMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: profile.arcOpacity, depthWrite: false });
    }
    squad.readinessArcMaterial.opacity = profile.arcOpacity;
    const arcGeometry = new THREE.BufferGeometry().setFromPoints(points);
    if (!squad.readinessArcLine) {
      squad.readinessArcLine = new THREE.Line(arcGeometry, squad.readinessArcMaterial);
      squad.readinessArcLine.name = `readiness-defensive-arc-${squad.id}`;
      squad.readinessArcLine.userData.feature = "unit-readiness-arc";
      squad.readinessArcLine.renderOrder = 9;
      this.group.add(squad.readinessArcLine);
    } else {
      squad.readinessArcLine.geometry.dispose();
      squad.readinessArcLine.geometry = arcGeometry;
    }
    squad.readinessArcLine.visible = squad.readinessState !== "establishing";

    this.updateReinforcementVisual(squad, anchor, heading);
  }

  hideReinforcementVisual(squad) {
    if (squad.reinforcementGroup) squad.reinforcementGroup.visible = false;
  }

  disposeReinforcementVisual(squad) {
    if (!squad?.reinforcementGroup) return;
    squad.reinforcementGroup.traverse((child) => {
      child.geometry?.dispose?.();
    });
    for (const material of squad.reinforcementGroup.userData?.materials ?? []) material.dispose?.();
    squad.reinforcementGroup.parent?.remove(squad.reinforcementGroup);
    squad.reinforcementGroup = null;
    squad.reinforcementVisualKey = null;
  }

  makeReinforcementMaterial(squad, baseColor, opacity = 1) {
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.9,
      metalness: 0.02,
      transparent: opacity < 1,
      opacity
    });
    return material;
  }

  addSandbagSegment(group, anchor, angle, radius, yaw, material, length = 5.6) {
    const x = anchor.x + Math.sin(angle) * radius;
    const z = anchor.z + Math.cos(angle) * radius;
    const geometry = new THREE.BoxGeometry(length, 0.72, 1.05);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.ownsMaterial = false;
    mesh.position.set(x, this.getMarkerY(x, z, REINFORCEMENT_Y_OFFSET + 0.18), z);
    mesh.rotation.y = yaw;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = "readiness-sandbag-segment";
    group.add(mesh);
    return mesh;
  }

  addFoxhole(group, anchor, angle, radius, material) {
    const x = anchor.x + Math.sin(angle) * radius;
    const z = anchor.z + Math.cos(angle) * radius;
    const geometry = new THREE.TorusGeometry(1.15, 0.18, 6, 18);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.ownsMaterial = false;
    mesh.position.set(x, this.getMarkerY(x, z, REINFORCEMENT_Y_OFFSET + 0.03), z);
    mesh.rotation.x = Math.PI / 2;
    mesh.name = "readiness-foxhole";
    group.add(mesh);

    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.95, 18), material);
    fill.userData.ownsMaterial = false;
    fill.position.set(x, this.getMarkerY(x, z, REINFORCEMENT_Y_OFFSET + 0.015), z);
    fill.rotation.x = -Math.PI / 2;
    fill.name = "readiness-foxhole-fill";
    group.add(fill);
  }

  addRoadblock(group, anchor, heading, material) {
    const forward = directionVectorFromHeading(heading);
    const x = anchor.x + forward.x * 20;
    const z = anchor.z + forward.z * 20;
    const y = this.getMarkerY(x, z, REINFORCEMENT_Y_OFFSET + 0.25);
    for (const offset of [-1.2, 1.2]) {
      const geometry = new THREE.BoxGeometry(5.8, 0.55, 0.7);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.ownsMaterial = false;
      mesh.position.set(x + Math.cos(heading) * offset, y, z - Math.sin(heading) * offset);
      mesh.rotation.y = heading + Math.PI / 4 * Math.sign(offset);
      mesh.name = "readiness-roadblock";
      group.add(mesh);
    }
  }

  addMgMarker(group, anchor, heading, material) {
    const forward = directionVectorFromHeading(heading);
    const x = anchor.x + forward.x * 8;
    const z = anchor.z + forward.z * 8;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.4), material);
    base.userData.ownsMaterial = false;
    base.position.set(x, this.getMarkerY(x, z, REINFORCEMENT_Y_OFFSET + 0.4), z);
    base.rotation.y = heading;
    base.name = "readiness-mg-position";
    group.add(base);

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 3.2), material);
    barrel.userData.ownsMaterial = false;
    barrel.position.set(x + forward.x * 1.4, this.getMarkerY(x, z, REINFORCEMENT_Y_OFFSET + 0.75), z + forward.z * 1.4);
    barrel.rotation.y = heading;
    barrel.name = "readiness-mg-barrel";
    group.add(barrel);
  }

  updateReinforcementVisual(squad, anchor, heading) {
    const enemyHiddenByFog = squad.side === "enemy" && this.visibleEnemyIds instanceof Set && !this.visibleEnemyIds.has(squad.id);
    const show = this.visible && !enemyHiddenByFog && shouldShowTacticalFootprint(squad) && Boolean(squad.missionTarget) && squad.readinessState !== "establishing";
    if (!show) {
      this.hideReinforcementVisual(squad);
      return;
    }

    const visualKey = `${squad.side}-${squad.missionType}-${squad.readinessState}-${Math.round((heading ?? 0) * 100)}`;
    if (squad.reinforcementGroup && squad.reinforcementVisualKey === visualKey) {
      squad.reinforcementGroup.visible = true;
      return;
    }

    this.disposeReinforcementVisual(squad);
    const group = new THREE.Group();
    group.name = `readiness-reinforcements-${squad.id}`;
    group.userData.feature = "unit-readiness-reinforcements";
    group.renderOrder = 10;

    const sandbagMaterial = this.makeReinforcementMaterial(squad, 0x9a7b45, squad.missionType === "ambush" ? 0.78 : 1);
    const foxholeMaterial = this.makeReinforcementMaterial(squad, 0x332a1d, 0.86);
    const hardpointMaterial = this.makeReinforcementMaterial(squad, squad.side === "enemy" ? 0x5b1f29 : 0x1f3f5b, 0.96);
    sandbagMaterial.userData = { ownsMaterial: true };
    foxholeMaterial.userData = { ownsMaterial: true };
    hardpointMaterial.userData = { ownsMaterial: true };

    const state = squad.readinessState;
    const spread = squad.missionType === "ambush" ? Math.PI * 0.42 : Math.PI * 0.64;
    const baseRadius = squad.missionType === "ambush" ? 13 : 16;
    const anglesByState = {
      prepared: [-0.28, 0.28, 0.02],
      entrenched: [-0.48, -0.24, 0, 0.24, 0.48],
      fortified: [-0.58, -0.38, -0.18, 0.05, 0.28, 0.5]
    };
    const offsets = anglesByState[state] ?? anglesByState.prepared;
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i] * spread;
      const angle = heading + offset;
      const radius = baseRadius + (state === "fortified" ? (i % 2) * 1.6 : 0);
      // Tangent to the arc so the segment reads like a defensive line.
      this.addSandbagSegment(group, anchor, angle, radius, heading + offset + Math.PI / 2, sandbagMaterial, state === "prepared" ? 4.5 : 5.8);
    }

    if (state === "entrenched" || state === "fortified") {
      this.addFoxhole(group, anchor, heading - spread * 0.22, baseRadius - 5.5, foxholeMaterial);
      this.addFoxhole(group, anchor, heading + spread * 0.2, baseRadius - 4.5, foxholeMaterial);
    }

    if (state === "fortified") {
      this.addRoadblock(group, anchor, heading, hardpointMaterial);
      this.addMgMarker(group, anchor, heading, hardpointMaterial);
      this.addSandbagSegment(group, anchor, heading - spread * 0.72, baseRadius - 1.5, heading - spread * 0.72 + Math.PI / 2, sandbagMaterial, 5.2);
      this.addSandbagSegment(group, anchor, heading + spread * 0.72, baseRadius - 1.5, heading + spread * 0.72 + Math.PI / 2, sandbagMaterial, 5.2);
    }

    // Materials are shared by this small group. Mark materials for cleanup on the group.
    for (const child of group.children) child.userData.ownsMaterial = false;
    group.userData.materials = [sandbagMaterial, foxholeMaterial, hardpointMaterial];
    group.visible = true;
    this.group.add(group);
    squad.reinforcementGroup = group;
    squad.reinforcementVisualKey = visualKey;
  }


  computePath(start, destination) {
    const from = this.placeOnGround(start);
    const to = this.placeOnGround(destination);
    const path = this.callbacks.getPath?.(from, to);
    if (Array.isArray(path) && path.length >= 2) {
      return path.map((point) => this.placeOnGround(point));
    }
    return [from, to];
  }

  repathActiveSquads() {
    for (const squad of this.squads.values()) {
      if (!squad.destination || (squad.state !== "moving" && squad.state !== "securing")) continue;
      squad.path = this.computePath(squad.center, squad.destination);
      squad.pathIndex = squad.path.length > 1 ? 1 : 0;
      this.updatePathVisual(squad);
    }
    this.emitStats();
  }

  getCurrentWaypoint(squad) {
    if (!squad.destination) return null;
    if (!squad.path?.length) {
      squad.path = this.computePath(squad.center, squad.destination);
      squad.pathIndex = squad.path.length > 1 ? 1 : 0;
    }
    return squad.path[Math.min(squad.pathIndex, squad.path.length - 1)] ?? squad.destination;
  }

  recordPathHistory(squad, now = performance.now(), force = false) {
    if (!squad?.center) return;
    const last = squad.pathHistory?.[squad.pathHistory.length - 1];
    if (!force && last && distance2D(last.position, squad.center) < PATH_HISTORY_MIN_DISTANCE) return;

    if (!Array.isArray(squad.pathHistory)) squad.pathHistory = [];
    squad.pathHistory.push({
      position: squad.center.clone(),
      timestamp: now,
      safetyScore: squad.targetEnemyId ? 0.25 : Math.max(0.2, 1 - (squad.suppression ?? 0) / 110)
    });
    squad.pathHistory = squad.pathHistory.filter((entry) => now - entry.timestamp <= PATH_HISTORY_MS).slice(-28);
    this.updateBreadcrumbVisual(squad);
  }

  rememberThreatLocation(squad, threatPosition, source = "contact") {
    if (!squad || !threatPosition) return;
    if (!Array.isArray(squad.knownThreatLocations)) squad.knownThreatLocations = [];
    squad.knownThreatLocations.push({
      position: threatPosition.clone(),
      source,
      threatLevel: squad.suppression > 70 ? "high" : "medium",
      timestamp: performance.now()
    });
    squad.knownThreatLocations = squad.knownThreatLocations.slice(-12);
    this.updateContactMarkers(squad);
  }

  findFallbackFromHistory(squad, threatPosition) {
    const history = [...(squad.pathHistory ?? [])].reverse();
    if (!history.length) return null;

    let best = null;
    let bestScore = -Infinity;
    for (const entry of history) {
      const backDistance = distance2D(squad.center, entry.position);
      if (backDistance < FALLBACK_MIN_DISTANCE) continue;
      if (backDistance > FALLBACK_MAX_DISTANCE) continue;

      const awayFromThreat = threatPosition
        ? distance2D(entry.position, threatPosition) - distance2D(squad.center, threatPosition)
        : backDistance;
      const score = awayFromThreat * 1.8 + (entry.safetyScore ?? 0.5) * 40 - backDistance * 0.2;
      if (score > bestScore) {
        best = entry.position;
        bestScore = score;
      }
    }

    if (best) return this.placeOnGround(best);

    const oldestSafe = history.find((entry) => distance2D(squad.center, entry.position) >= FALLBACK_MIN_DISTANCE);
    if (oldestSafe) return this.placeOnGround(oldestSafe.position);

    if (threatPosition) {
      const away = squad.center.clone().sub(threatPosition);
      away.y = 0;
      if (away.lengthSq() < 0.001) away.set(0, 0, 1);
      away.normalize();
      return this.placeOnGround(squad.center.clone().add(away.multiplyScalar(FALLBACK_MIN_DISTANCE)));
    }
    return null;
  }

  initiateFallbackFromContact(squad, threatPosition, reason = "contact while moving") {
    if (!squad || !threatPosition) return false;
    const now = performance.now();
    if (now - (squad.lastFallbackAt ?? 0) < 2200) return false;

    const fallbackTarget = this.findFallbackFromHistory(squad, threatPosition);
    if (!fallbackTarget) return false;

    this.rememberThreatLocation(squad, threatPosition, reason);
    squad.fallbackTarget = fallbackTarget;
    squad.fallbackThreatPosition = threatPosition.clone();
    squad.fallbackStartedAt = now;
    squad.lastFallbackAt = now;
    squad.destination = fallbackTarget.clone();
    squad.path = this.computePath(squad.center, squad.destination);
    squad.pathIndex = squad.path.length > 1 ? 1 : 0;
    squad.objectiveRadius = 34;
    squad.mission = "contact - falling back along known route";
    squad.state = "falling_back";
    this.assignFallbackFormation(squad, threatPosition);
    this.updateObjectiveVisual(squad);
    this.updatePathVisual(squad);
    this.updateBreadcrumbVisual(squad);
    this.updateContactMarkers(squad);
    this.callbacks.onInfantryEvent?.({ type: "fallback", squad, threatPosition, point: fallbackTarget });
    this.emitStats();
    return true;
  }

  assignFallbackFormation(squad, threatPosition) {
    const away = squad.center.clone().sub(threatPosition);
    away.y = 0;
    if (away.lengthSq() < 0.001) away.set(0, 0, 1);
    away.normalize();
    const heading = Math.atan2(threatPosition.x - squad.center.x, threatPosition.z - squad.center.z);

    for (let i = 0; i < squad.soldiers.length; i++) {
      squad.soldiers[i].targetPosition = this.clampVectorToGround(formationPosition(squad.center, i, heading));
      squad.soldiers[i].stance = squad.suppression > 65 ? "crouched" : "standing";
      squad.soldiers[i].coverScore = Math.max(squad.soldiers[i].coverScore ?? 0, 0.12);
    }
  }

  setSquadState(squad, state, mission = squad.mission) {
    if (state === "engaged" || state === "suppressed") squad.missionStatus = "engaged";
    if (state === "contact") squad.missionStatus = "contact";
    if (state === "falling_back" || state === "retreating") squad.missionStatus = "fallback";
    if (squad.state === state && squad.mission === mission) return;
    squad.state = state;
    squad.mission = mission;
    this.callbacks.onInfantryEvent?.({ type: "state", squad });
    this.emitStats();
  }

  update(deltaSeconds, now = performance.now(), tactical = null, destruction = null) {
    const dt = Math.min(0.08, Math.max(0.001, deltaSeconds));
    if (now - this.lastThinkAt > this.enemyThinkMs) {
      this.lastThinkAt = now;
      this.evaluateThreats(destruction);
    }

    for (const squad of this.squads.values()) {
      this.updateSquad(squad, dt, destruction);
      this.updateSquadVisuals(squad);
      this.updateBreadcrumbVisual(squad);
      this.updateContactMarkers(squad);
      this.updateRallyVisual(squad);
      this.updateTacticalFootprint(squad);
      this.updateEngagementAreaVisual(squad);
      this.updateReadinessVisual(squad);
    }
    this.updateContestedFrontlines();
    this.applyVisibility();

    // Readiness/time-in-position is a live timer. Most infantry stat updates are
    // emitted on discrete events (select, move, state changes), so the React panel
    // would otherwise keep showing the last snapshot even though the simulation is
    // advancing correctly. Emit a lightweight stats refresh a few times per second
    // while a squad is selected so Time In Position visibly counts up.
    if (this.selectedSquadId && now - this.lastStatsEmitAt > 350) {
      this.lastStatsEmitAt = now;
      this.emitStats();
    }
  }

  evaluateThreats(destruction) {
    const now = performance.now();
    const friendlies = [...this.squads.values()].filter((squad) => squad.side === "friendly" && squadAliveCount(squad) > 0);
    const enemies = [...this.squads.values()].filter((squad) => squad.side === "enemy" && squadAliveCount(squad) > 0);

    for (const squad of [...friendlies, ...enemies]) {
      const opponents = squad.side === "friendly" ? enemies : friendlies;
      let best = null;
      let bestDistance = Infinity;
      let bestConfidence = 0;

      for (const enemy of opponents) {
        const distance = distance2D(squad.center, enemy.center);
        const detectionRange = SQUAD_TEMPLATES[squad.template].detectionRange;
        if (distance > detectionRange) continue;
        const confidence = detectionChance(squad, enemy, distance, now);
        const score = confidence * 1000 - distance;
        if (score > bestConfidence * 1000 - bestDistance) {
          best = enemy;
          bestDistance = distance;
          bestConfidence = confidence;
        }
      }

      if (best && bestConfidence >= 0.28) {
        const firstContact = squad.targetEnemyId !== best.id || now - (squad.lastContactAt ?? 0) > CONTACT_MEMORY_MS;
        squad.targetEnemyId = best.id;
        squad.lastKnownEnemyPosition = best.center.clone();
        squad.lastContactAt = now;
        squad.contactBearing = bearingLabel(squad.center, best.center);
        squad.contactRange = Math.round(bestDistance);
        squad.contactConfidence = Math.round(bestConfidence * 100);
        squad.suppression = Math.min(100, squad.suppression + (bestDistance < 90 ? 10 : 5));

        if (firstContact || now - (squad.lastContactReportAt ?? 0) > 4500) {
          squad.lastContactReportAt = now;
          this.callbacks.onInfantryEvent?.({
            type: "contact",
            squad,
            target: best,
            bearing: squad.contactBearing,
            range: squad.contactRange,
            confidence: squad.contactConfidence
          });
        }

        const defendingPosition = isDefensivePositionActive(squad);
        // Detection/contact alone should not collapse a prepared position.
        // The position strength buffer is primarily degraded by persistent fire
        // exchange ticks so opposing footprints can remain in contact long enough
        // to create a readable frontline.

        const positionStillHolding = defendingPosition && !squad.positionBroken;
        const brokenLongEnough = squad.positionBrokenAt && now - squad.positionBrokenAt > ENGAGEMENT_MIN_RETREAT_MS;
        const positionCollapsed = defendingPosition && squad.positionBroken && brokenLongEnough && (squad.suppression > 82 || squad.morale === "shaken" || squad.morale === "broken");
        const shouldFallBack = !positionStillHolding && (positionCollapsed || ((squad.state === "moving" || squad.state === "securing") && squad.pathHistory?.length > 1));
        const didFallback = shouldFallBack && this.initiateFallbackFromContact(squad, best.center, positionCollapsed ? "defensive position broken" : "contact while advancing");

        if (!didFallback) {
          if (positionStillHolding) {
            // Defensive missions should hold on first contact. The position absorbs
            // pressure until its strength is degraded instead of instantly falling back.
            const inRange = bestDistance <= SQUAD_TEMPLATES[squad.template].engagementRange;
            const canFire = squad.fireMode === "free" || squad.fireMode === "return" || squad.side === "enemy";
            if (inRange && canFire) this.setSquadState(squad, squad.suppression > 86 ? "suppressed" : "engaged", "contact - holding prepared position");
            else this.setSquadState(squad, "contact", "contact - holding position");
          } else {
            this.assignCoverPositions(squad, destruction, best.center);

            const inRange = bestDistance <= SQUAD_TEMPLATES[squad.template].engagementRange;
            const canFire = squad.fireMode === "free" || squad.fireMode === "return" || squad.side === "enemy";
            if (inRange && canFire) {
              this.setSquadState(squad, squad.suppression > 82 ? "suppressed" : "engaged", "contact - dig in and fight");
            } else {
              this.setSquadState(squad, "contact", "contact - seeking cover");
            }
          }
        }
      } else {
        const hasRecentMemory = squad.lastKnownEnemyPosition && now - (squad.lastContactAt ?? 0) < CONTACT_MEMORY_MS;
        if (hasRecentMemory && (squad.state === "engaged" || squad.state === "contact" || squad.state === "suppressed")) {
          squad.targetEnemyId = null;
          squad.suppression = Math.max(0, squad.suppression - 8);
          this.setSquadState(squad, "searching", "searching last known contact");
        } else if (squad.state === "engaged" || squad.state === "contact" || squad.state === "suppressed" || squad.state === "searching") {
          squad.targetEnemyId = null;
          squad.lastKnownEnemyPosition = null;
          squad.contactBearing = "n/a";
          squad.contactRange = 0;
          squad.contactConfidence = 0;
          squad.suppression = Math.max(0, squad.suppression - 18);
          this.clearCoverMarkers(squad);
          if (squad.destination) this.setSquadState(squad, "moving", "resume secure area");
          else this.setSquadState(squad, squad.side === "enemy" ? "defending" : "idle", squad.side === "enemy" ? "hold area" : "awaiting orders");
        }
      }
    }
  }

  assignMissionPositions(squad, destruction) {
    const missionType = squad.activeOrder?.missionType ?? squad.missionProfile ?? "move";
    if (missionType === "defend" || missionType === "ambush") {
      this.assignDefensiveMissionPositions(squad, destruction, missionType);
      return;
    }

    this.assignSecurityPositions(squad, destruction);
    if (missionType === "attack") {
      squad.fireMode = "free";
    }
  }


  assignDefensiveMissionPositions(squad, destruction, missionType = "defend") {
    const anchor = this.placeOnGround(squad.missionTarget ?? squad.destination ?? squad.center);
    const candidates = this.buildDefensiveSlotCandidates(anchor, squad, destruction, missionType);
    const slots = [];

    for (const candidate of candidates) {
      if (slots.length >= squad.soldiers.length) break;
      const tooClose = slots.some((slot) => distance2D(slot.position, candidate.position) < DEFENSIVE_SLOT_MIN_SPACING);
      if (tooClose) continue;
      slots.push(candidate);
    }

    // If cover candidates were sparse, fill the rest with the planned perimeter
    // slots so the squad still visibly spreads around the ordered location.
    let fallbackIndex = 0;
    while (slots.length < squad.soldiers.length) {
      const baseHeading = Number.isFinite(squad.defensiveHeading) ? squad.defensiveHeading : 0;
      const angle = baseHeading + (((fallbackIndex + 0.5) / Math.max(1, squad.soldiers.length)) * Math.PI * 2);
      const radius = fallbackIndex % 2 === 0 ? DEFENSIVE_INNER_RADIUS : DEFENSIVE_OUTER_RADIUS;
      const position = this.placeOnGround(new THREE.Vector3(
        anchor.x + Math.cos(angle) * radius,
        anchor.y,
        anchor.z + Math.sin(angle) * radius
      ));
      fallbackIndex += 1;
      if (slots.some((slot) => distance2D(slot.position, position) < DEFENSIVE_SLOT_MIN_SPACING)) continue;
      slots.push({ position, coverScore: 0.08, source: "fallback", score: 0 });
    }

    squad.defensiveSlots = slots.map((slot) => ({
      position: slot.position.clone(),
      coverScore: slot.coverScore ?? 0,
      source: slot.source ?? "planned"
    }));

    for (let i = 0; i < squad.soldiers.length; i++) {
      const slot = squad.defensiveSlots[i % squad.defensiveSlots.length];
      squad.soldiers[i].targetPosition = this.placeOnGround(slot.position);
      squad.soldiers[i].stance = missionType === "ambush" || slot.coverScore > 0.35 ? "crouched" : "standing";
      squad.soldiers[i].coverScore = slot.coverScore ?? 0.08;
    }

    if (missionType === "ambush") squad.fireMode = "hold";
    if (missionType === "defend") squad.fireMode = squad.fireMode === "free" ? "return" : squad.fireMode;
    this.updateCoverMarkers(squad, squad.defensiveSlots.slice(0, 8));
  }

  buildDefensiveSlotCandidates(anchor, squad, destruction, missionType = "defend") {
    const candidates = [];
    const plannedRadius = missionType === "ambush" ? 20 : 24;
    const count = Math.max(squad.soldiers.length * 2, 14);
    const defensiveHeading = Number.isFinite(squad.defensiveHeading) ? squad.defensiveHeading : 0;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = i % 2 === 0 ? plannedRadius * 0.58 : plannedRadius;
      const position = this.placeOnGround(new THREE.Vector3(
        anchor.x + Math.cos(angle) * radius,
        anchor.y,
        anchor.z + Math.sin(angle) * radius
      ));
      candidates.push({ position, coverScore: 0.08, source: "planned", score: 20 - Math.abs(radius - plannedRadius * 0.75) + slotAngleBias(position, anchor, defensiveHeading) });
    }

    for (const feature of destruction?.features?.values?.() ?? []) {
      const baseCover = strongestCoverScore(feature);
      if (baseCover < 0.18 || !feature.position) continue;
      const distance = distance2D(anchor, feature.position);
      if (distance > (squad.objectiveRadius ?? 34) + 58) continue;

      const slotCount = feature.category === "building" ? 4 : feature.category === "tree" ? 2 : 1;
      const featureRadius = Math.max(5, feature.bounds?.radius ?? 7);
      const hashAngle = (stableHash(feature.id ?? `${feature.position.x}:${feature.position.z}`) % 628) / 100;
      const distancePenalty = distance * 0.42;
      const featureBonus = feature.category === "building" ? 42 : feature.category === "tree" ? 22 : 12;

      for (let i = 0; i < slotCount; i++) {
        const angle = hashAngle + (i / slotCount) * Math.PI * 2;
        const position = this.placeOnGround(feature.position.clone().add(new THREE.Vector3(
          Math.cos(angle) * (featureRadius + 3.2),
          0,
          Math.sin(angle) * (featureRadius + 3.2)
        )));
        candidates.push({
          position,
          coverScore: baseCover,
          source: feature.category ?? "cover",
          score: baseCover * 100 + featureBonus - distancePenalty + slotAngleBias(position, anchor, defensiveHeading)
        });
      }
    }

    candidates.sort((a, b) => (b.score - a.score) || (b.coverScore - a.coverScore));
    return candidates;
  }

  assignCoverPositions(squad, destruction, threatPosition) {
    const candidates = this.findCoverCandidates(squad.center, destruction, threatPosition);
    if (!candidates.length) {
      const fallbackHeading = Math.atan2(threatPosition.x - squad.center.x, threatPosition.z - squad.center.z) + Math.PI;
      for (let i = 0; i < squad.soldiers.length; i++) {
        squad.soldiers[i].targetPosition = this.clampVectorToGround(formationPosition(squad.center, i, fallbackHeading));
        squad.soldiers[i].stance = "prone";
        squad.soldiers[i].coverScore = 0.1;
      }
      return;
    }

    for (let i = 0; i < squad.soldiers.length; i++) {
      const candidate = candidates[i % candidates.length];
      const jitter = new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
      squad.soldiers[i].targetPosition = this.placeOnGround(candidate.position.clone().add(jitter));
      squad.soldiers[i].stance = candidate.coverScore > 0.5 ? "crouched" : "prone";
      squad.soldiers[i].coverScore = candidate.coverScore;
    }

    this.updateCoverMarkers(squad, candidates.slice(0, Math.min(candidates.length, 8)));
  }

  findCoverCandidates(origin, destruction, threatPosition) {
    const candidates = [];
    for (const feature of destruction?.features?.values?.() ?? []) {
      const coverScore = strongestCoverScore(feature);
      if (coverScore < 0.22) continue;
      const distance = distance2D(origin, feature.position);
      if (distance > 95) continue;

      const away = feature.position.clone().sub(threatPosition);
      away.y = 0;
      if (away.lengthSq() < 0.001) away.set(1, 0, 0);
      away.normalize();
      const coverRadius = Math.max(4, feature.bounds?.radius ?? 8);
      const position = feature.position.clone().add(away.multiplyScalar(coverRadius + 2));
      this.clampVectorToGround(position);

      candidates.push({ position, coverScore, distance });
    }

    candidates.sort((a, b) => (b.coverScore - a.coverScore) || (a.distance - b.distance));
    return candidates.slice(0, 16);
  }

  updateCoverMarkers(squad, candidates) {
    this.clearCoverMarkers(squad);
    if (squad.id !== this.selectedSquadId) return;
    for (const candidate of candidates) {
      const marker = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.8, 16), this.coverMaterial);
      marker.rotateX(-Math.PI / 2);
      marker.position.set(candidate.position.x, this.getMarkerY(candidate.position.x, candidate.position.z, 0.22), candidate.position.z);
      marker.userData.feature = "unit-cover-marker";
      this.group.add(marker);
      squad.coverMarkers.push(marker);
    }
  }

  clearCoverMarkers(squad) {
    for (const marker of squad.coverMarkers ?? []) {
      marker.geometry.dispose();
      marker.parent?.remove(marker);
    }
    squad.coverMarkers = [];
  }

  updateSquad(squad, dt, destruction) {
    const template = SQUAD_TEMPLATES[squad.template];
    if (squad.state === "moving" || squad.state === "securing" || squad.state === "defending" || squad.state === "idle") {
      this.recordPathHistory(squad);
    }

    if ((squad.state === "moving" || squad.state === "falling_back") && squad.destination) {
      const waypoint = this.getCurrentWaypoint(squad);
      const arrivedWaypoint = waypoint ? moveToward(squad.center, waypoint, template.speed * dt) : true;
      this.clampVectorToGround(squad.center);

      if (arrivedWaypoint && squad.path?.length && squad.pathIndex < squad.path.length - 1) {
        squad.pathIndex += 1;
      }

      const steeringTarget = this.getCurrentWaypoint(squad) ?? squad.destination;
      const heading = Math.atan2(steeringTarget.x - squad.center.x, steeringTarget.z - squad.center.z);
      for (let i = 0; i < squad.soldiers.length; i++) {
        squad.soldiers[i].targetPosition = this.clampVectorToGround(formationPosition(squad.center, i, heading));
        squad.soldiers[i].stance = "standing";
      }
      if (distance2D(squad.center, squad.destination) < squad.objectiveRadius * 0.28) {
        if (squad.state === "falling_back") {
          const threat = squad.fallbackThreatPosition ?? squad.lastKnownEnemyPosition;
          if (threat) this.assignCoverPositions(squad, destruction, threat);
          else this.assignSecurityPositions(squad, destruction);
          squad.destination = null;
          squad.path = [];
          squad.pathIndex = 0;
          squad.fallbackTarget = null;
          this.setSquadState(squad, "defending", "fallback complete - holding known ground");
        } else {
          const missionType = squad.activeOrder?.missionType ?? squad.missionType ?? "move";
          const mission = squad.activeOrder ? `setting up: ${commandLabel(squad.activeOrder)}` : "secure area";
          squad.missionStatus = missionType === "move" ? "arrived" : "establishing";

          // We have reached the mission anchor. From here, individual soldiers
          // move into their planned slots, but the squad destination itself must
          // be cleared. Readiness/time-in-position only advances for stationary
          // defend/ambush missions, so leaving destination populated made the UI
          // look stuck at 0:00 and prevented the footprint from strengthening.
          squad.destination = null;
          squad.path = [];
          squad.pathIndex = 0;

          this.setSquadState(squad, missionType === "move" ? "idle" : "securing", missionType === "move" ? "move complete" : mission);
          if (squad.activeOrder?.targetCategory === "building") this.assignBuildingOrderPositions(squad);
          else this.assignMissionPositions(squad, destruction);
        }
      }
      this.updatePathVisual(squad);
    } else if (squad.state === "securing") {
      const allSettled = squad.soldiers.every((soldier) => distance2D(soldier.position, soldier.targetPosition) < 1.5);
      if (allSettled) {
        const missionType = squad.activeOrder?.missionType ?? squad.missionType ?? "defend";
        const nextState = missionType === "attack" ? "engaged" : "defending";
        squad.missionStatus = missionType === "attack" ? "attacking" : missionType === "ambush" ? "hidden" : "establishing";
        if (missionType === "defend" || missionType === "ambush") {
          squad.readinessStartAt = performance.now();
        }
        this.setSquadState(squad, nextState, squad.activeOrder ? commandLabel(squad.activeOrder) : "area secured");
      }
    }

    if (squad.state === "engaged" || squad.state === "suppressed") {
      const target = this.squads.get(squad.targetEnemyId);
      const interval = squad.state === "suppressed" ? ENGAGEMENT_TICK_MS * 1.35 : ENGAGEMENT_TICK_MS;
      if (target && performance.now() - squad.lastShotAt > interval) {
        squad.lastShotAt = performance.now();
        this.resolveFireExchange(squad, target);
      }
    }

    if (squad.state === "searching" && squad.lastKnownEnemyPosition) {
      const heading = Math.atan2(squad.lastKnownEnemyPosition.x - squad.center.x, squad.lastKnownEnemyPosition.z - squad.center.z);
      for (let i = 0; i < squad.soldiers.length; i++) {
        squad.soldiers[i].targetPosition = this.clampVectorToGround(formationPosition(squad.center, i, heading));
        squad.soldiers[i].stance = squad.suppression > 35 ? "crouched" : "standing";
      }
    }

    for (const soldier of squad.soldiers) {
      moveToward(soldier.position, soldier.targetPosition, template.speed * (soldier.stance === "standing" ? 1 : 0.62) * dt);
      this.clampVectorToGround(soldier.position);
    }

    const previousCasualties = squad.casualties ?? 0;
    squad.casualties = squad.soldiers.filter((soldier) => soldier.health <= 0).length;
    if (squad.casualties > previousCasualties) {
      squad.suppression = Math.min(100, squad.suppression + (squad.casualties - previousCasualties) * 12);
      this.callbacks.onInfantryEvent?.({ type: "casualty", squad, casualties: squad.casualties });
    }
    for (const soldier of squad.soldiers) {
      soldier.wounded = soldier.health > 0 && soldier.health < 50;
    }
    squad.morale = classifyMorale(squad);
    if (isDefensivePositionActive(squad)) {
      if (!squad.readinessStartAt) squad.readinessStartAt = performance.now();
      // A squad that is holding its ground remains "in position" even while
      // engaged. Time continues to accumulate, though heavy suppression slows
      // the work of improving the position.
      const readinessRate = squad.state === "suppressed" ? 0.35 : squad.state === "engaged" || squad.state === "contact" ? 0.65 : 1;
      squad.readiness = (squad.readiness ?? 0) + dt * readinessRate;
      squad.readinessState = readinessKeyForSeconds(squad.readiness);
      syncPositionStrengthToReadiness(squad);
      if (squad.missionStatus !== "contact") {
        squad.missionStatus = squad.missionType === "ambush" && squad.readinessState === "establishing" ? "hidden" : squad.readinessState;
      }
    } else if (squad.state === "moving" || squad.state === "falling_back" || squad.state === "retreating") {
      resetReadiness(squad);
    }
    if (squad.morale === "broken" && squad.state !== "retreating") {
      if (isDefensivePositionActive(squad) && !squad.positionBroken) {
        applyPositionPressure(squad, 18);
        this.setSquadState(squad, "suppressed", "position under heavy pressure");
      } else {
        this.setSquadState(squad, "retreating", "combat ineffective - falling back");
      }
    }
    squad.suppression = Math.max(0, squad.suppression - dt * 3.5);
  }

  assignBuildingOrderPositions(squad) {
    const order = squad.activeOrder;
    if (!order?.targetPosition) {
      this.assignSecurityPositions(squad, null);
      return;
    }

    const building = order.targetPosition;
    const center = squad.destination ?? squad.center;
    const outward = center.clone().sub(building);
    outward.y = 0;
    if (outward.lengthSq() < 0.001) outward.set(0, 0, 1);
    outward.normalize();
    const right = new THREE.Vector3(outward.z, 0, -outward.x);
    const heading = Math.atan2(outward.x, outward.z);

    for (let i = 0; i < squad.soldiers.length; i++) {
      if (order.type === "occupy_building") {
        const angle = (i / squad.soldiers.length) * Math.PI * 2;
        const ring = Math.max(3, order.targetRadius * 0.38);
        const jitter = new THREE.Vector3(Math.cos(angle) * ring, 0, Math.sin(angle) * ring);
        squad.soldiers[i].targetPosition = this.placeOnGround(building.clone().add(jitter));
        squad.soldiers[i].stance = "crouched";
        squad.soldiers[i].coverScore = 0.95;
      } else {
        const row = Math.floor(i / 5);
        const column = (i % 5) - 2;
        const spacing = 5.2;
        const depth = row * 4.5;
        const position = center.clone()
          .add(right.clone().multiplyScalar(column * spacing))
          .add(outward.clone().multiplyScalar(depth));
        squad.soldiers[i].targetPosition = this.placeOnGround(position);
        squad.soldiers[i].stance = "crouched";
        squad.soldiers[i].coverScore = 0.72;
      }
    }

    this.clearCoverMarkers(squad);
    // Occupying a building should not add a floating/hover marker over the building.
    // Keep the defensive line markers for "use building as cover" orders.
    if (squad.id === this.selectedSquadId && order.type !== "occupy_building") {
      for (let i = 0; i < 5; i++) {
        const base = center.clone().add(right.clone().multiplyScalar((i - 2) * 6));
        const marker = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.1, 18), this.coverMaterial);
        marker.rotateX(-Math.PI / 2);
        marker.position.set(base.x, this.getMarkerY(base.x, base.z, 0.22), base.z);
        marker.userData.feature = "unit-cover-marker";
        this.group.add(marker);
        squad.coverMarkers.push(marker);
      }
    }
  }

  assignSecurityPositions(squad, destruction) {
    const candidates = this.findAreaCoverCandidates(squad.destination ?? squad.center, destruction, squad.objectiveRadius);
    for (let i = 0; i < squad.soldiers.length; i++) {
      const angle = (i / squad.soldiers.length) * Math.PI * 2;
      const fallback = new THREE.Vector3(
        (squad.destination ?? squad.center).x + Math.cos(angle) * (squad.objectiveRadius * 0.42),
        this.getSoldierCenterY((squad.destination ?? squad.center).x + Math.cos(angle) * (squad.objectiveRadius * 0.42), (squad.destination ?? squad.center).z + Math.sin(angle) * (squad.objectiveRadius * 0.42)),
        (squad.destination ?? squad.center).z + Math.sin(angle) * (squad.objectiveRadius * 0.42)
      );
      const candidate = candidates[i % candidates.length];
      squad.soldiers[i].targetPosition = candidate ? this.placeOnGround(candidate.position) : fallback;
      squad.soldiers[i].stance = candidate?.coverScore > 0.45 ? "crouched" : "standing";
      squad.soldiers[i].coverScore = candidate?.coverScore ?? 0.05;
    }
    this.updateCoverMarkers(squad, candidates.slice(0, 8));
  }

  findAreaCoverCandidates(center, destruction, radius) {
    const candidates = [];
    for (const feature of destruction?.features?.values?.() ?? []) {
      const coverScore = strongestCoverScore(feature);
      if (coverScore < 0.18) continue;
      const distance = distance2D(center, feature.position);
      if (distance > radius + 55) continue;
      const angle = (stableHash(feature.id ?? `${feature.position.x}:${feature.position.z}`) % 628) / 100;
      const offset = Math.max(4, feature.bounds?.radius ?? 6);
      const position = feature.position.clone().add(new THREE.Vector3(Math.cos(angle) * offset, 0, Math.sin(angle) * offset));
      this.clampVectorToGround(position);
      candidates.push({ position, coverScore, distance });
    }
    candidates.sort((a, b) => (b.coverScore - a.coverScore) || (a.distance - b.distance));
    return candidates.slice(0, 16);
  }

  resolveFireExchange(attacker, target) {
    if (!target || squadAliveCount(attacker) <= 0 || squadAliveCount(target) <= 0) return;
    if (attacker.fireMode === "hold" && attacker.side === "friendly") return;

    const range = distance2D(attacker.center, target.center);
    const engagementRange = SQUAD_TEMPLATES[attacker.template].engagementRange;
    if (range > engagementRange) return;

    const targetCover = averageCover(target);
    const attackerMoralePenalty = attacker.morale === "broken" ? 0.15 : attacker.morale === "shaken" ? 0.45 : attacker.morale === "concerned" ? 0.7 : 1;
    const rangePenalty = THREE.MathUtils.clamp(1 - range / (engagementRange * 1.3), 0.25, 1);
    const accuracy = Math.max(0.015, 0.2 * (1 - targetCover) * (1 - attacker.suppression / 160) * attackerMoralePenalty * rangePenalty);
    const shooters = attacker.soldiers.filter((soldier) => soldier.health > 0).length;
    let hits = Math.round(shooters * accuracy * (0.5 + Math.random() * 0.8));
    attacker.shotsFired = (attacker.shotsFired ?? 0) + Math.round(shooters * (attacker.state === "suppressed" ? 1.2 : 2.4));

    if (isDefensivePositionActive(target) && (target.positionStrength ?? 0) > 0) {
      // Persistent engagements should erode a prepared position over time, not
      // instantly knock it out on first contact. Keep damage intentionally slow
      // so overlapping influence/frontlines can persist and be read by the player.
      const readinessMitigation = target.readinessState === "fortified" ? 0.55 : target.readinessState === "entrenched" ? 0.7 : target.readinessState === "prepared" ? 0.85 : 1;
      const positionDamage = (1.6 + shooters * 0.22 + hits * 2.1 + (attacker.state === "suppressed" ? 0 : 0.9)) * readinessMitigation;
      applyPositionPressure(target, positionDamage);
      // Prepared positions absorb the first part of contact. Soldiers can still be
      // wounded, but the position has to be reduced before contact forces a collapse.
      const absorption = target.positionBroken ? 0.35 : 0.72;
      hits = Math.max(0, Math.floor(hits * (1 - absorption)));
    }

    for (let i = 0; i < hits; i++) {
      const living = target.soldiers.filter((soldier) => soldier.health > 0);
      if (!living.length) break;
      const victim = living[Math.floor(Math.random() * living.length)];
      const wasHealthy = victim.health >= 50;
      victim.health = Math.max(0, victim.health - (7 + Math.random() * 18));
      target.hitsTaken = (target.hitsTaken ?? 0) + 1;
      if (wasHealthy && victim.health > 0 && victim.health < 50) {
        this.callbacks.onInfantryEvent?.({ type: "wounded", squad: target });
      }
    }

    target.suppression = Math.min(100, target.suppression + 6 + shooters * 0.32 + hits * 3.2);
    target.lastKnownEnemyPosition = attacker.center.clone();
    target.lastContactAt = performance.now();
    target.contactBearing = bearingLabel(target.center, attacker.center);
    target.contactRange = Math.round(range);
    target.contactConfidence = 100;

    const alive = squadAliveCount(target);
    if (alive === 0) {
      this.setSquadState(target, "idle", "combat ineffective");
      target.targetEnemyId = null;
      this.callbacks.onInfantryEvent?.({ type: "neutralized", squad: target });
    } else if (target.state !== "engaged" && target.state !== "suppressed") {
      target.targetEnemyId = attacker.id;
      const defendingPosition = isDefensivePositionActive(target);
      const positionStillHolding = defendingPosition && !target.positionBroken;
      const brokenLongEnough = target.positionBrokenAt && performance.now() - target.positionBrokenAt > ENGAGEMENT_MIN_RETREAT_MS;
      const positionCollapsed = defendingPosition && target.positionBroken && brokenLongEnough && (target.suppression > 82 || target.morale === "shaken" || target.morale === "broken");
      const shouldFallBack = !positionStillHolding && (positionCollapsed || ((target.state === "moving" || target.state === "securing") && target.pathHistory?.length > 1));
      const didFallback = shouldFallBack && this.initiateFallbackFromContact(target, attacker.center, positionCollapsed ? "defensive position broken under fire" : "receiving fire while advancing");
      if (!didFallback) {
        if (!positionStillHolding) this.assignCoverPositions(target, null, attacker.center);
        this.setSquadState(target, target.suppression > 82 ? "suppressed" : "engaged", positionStillHolding ? "holding prepared position" : "returning fire");
      }
    }
  }

  updateSquadVisuals(squad) {
    for (let i = 0; i < squad.soldiers.length; i++) {
      const soldier = squad.soldiers[i];
      DUMMY.position.copy(soldier.position);
      const scale = soldier.health <= 0
        ? new THREE.Vector3(1.2, 0.12, 1.2)
        : soldier.stance === "prone"
          ? new THREE.Vector3(1.35, 0.25, 1.35)
          : soldier.stance === "crouched"
            ? new THREE.Vector3(1, 0.72, 1)
            : soldier.wounded
              ? new THREE.Vector3(0.86, 0.86, 0.86)
              : new THREE.Vector3(1, 1, 1);
      DUMMY.scale.copy(scale);
      DUMMY.rotation.set(0, 0, soldier.health <= 0 ? Math.PI / 2 : 0);
      DUMMY.updateMatrix();
      squad.mesh.setMatrixAt(i, DUMMY.matrix);
    }
    squad.mesh.instanceMatrix.needsUpdate = true;

    this.ensureSoldierSelectionRings(squad);
    if (squad.soldierSelectionMesh) {
      for (let i = 0; i < squad.soldiers.length; i++) {
        const soldier = squad.soldiers[i];
        DUMMY.position.set(soldier.position.x, this.getMarkerY(soldier.position.x, soldier.position.z, 0.08), soldier.position.z);
        DUMMY.rotation.set(-Math.PI / 2, 0, 0);
        DUMMY.scale.setScalar(soldier.health <= 0 ? 0.75 : 1);
        DUMMY.updateMatrix();
        squad.soldierSelectionMesh.setMatrixAt(i, DUMMY.matrix);
      }
      squad.soldierSelectionMesh.instanceMatrix.needsUpdate = true;
      squad.soldierSelectionMesh.visible = this.visible && squad.id === this.selectedSquadId;
    }

    if (squad.selectionRing) {
      squad.selectionRing.visible = false;
    }
  }

  setEnemyVisibility(visibleEnemyIds = null) {
    // Null means fog-of-war is not controlling enemy visibility. In that case,
    // enemy squads should remain visible for dev/testing instead of being hidden
    // by a stale fog update. A Set means fog is active and only those ids render.
    this.visibleEnemyIds = visibleEnemyIds instanceof Set ? new Set(visibleEnemyIds) : null;
    this.applyVisibility();
  }

  getSelectedSquad() {
    return this.squads.get(this.selectedSquadId) ?? null;
  }

  getStats() {
    const squads = [...this.squads.values()];
    const selected = this.getSelectedSquad();
    return {
      totalSquads: squads.length,
      friendlySquads: squads.filter((squad) => squad.side === "friendly").length,
      enemySquads: squads.filter((squad) => squad.side === "enemy").length,
      soldiers: squads.reduce((sum, squad) => sum + squad.soldiers.length, 0),
      alive: squads.reduce((sum, squad) => sum + squad.soldiers.filter((soldier) => soldier.health > 0).length, 0),
      selectedSquadId: selected?.id ?? null,
      selectedSide: selected?.side ?? "None",
      selectedLabel: selected?.label ?? "None",
      selectedState: selected ? STATE_LABEL[selected.state] ?? selected.state : "None",
      selectedMission: selected?.mission ?? "None",
      selectedMissionType: selected ? (MISSION_LABEL[selected.missionType] ?? selected.missionType ?? "None") : "None",
      selectedMissionStatus: selected ? (MISSION_STATUS_LABEL[selected.missionStatus] ?? selected.missionStatus ?? "None") : "None",
      selectedReadiness: selected ? (READINESS_LABEL[selected.readinessState] ?? selected.readinessState ?? "None") : "None",
      selectedReadinessSeconds: Math.round(selected?.readiness ?? 0),
      selectedReadinessTime: selected ? formatDuration(selected.readiness ?? 0) : "0:00",
      selectedMissionProfile: selected ? (MISSION_LABEL[selected.missionProfile] ?? selected.missionProfile ?? "None") : "None",
      selectedOrderType: selected?.activeOrder?.type ?? null,
      selectedOrderTargetId: selected?.activeOrder?.targetId ?? null,
      selectedSuppression: Math.round(selected?.suppression ?? 0),
      selectedSoldiers: selected?.soldiers?.length ?? 0,
      selectedAlive: squadAliveCount(selected),
      selectedStrengthPct: selected ? squadStrengthPct(selected) : 0,
      selectedPositionStrength: selected ? positionStrengthLabel(selected) : "n/a",
      selectedPositionBroken: Boolean(selected?.positionBroken),
      selectedConfidence: confidenceLabel(selected),
      selectedPositionLabel: positionLabel(selected),
      selectedFallbackLabel: fallbackLabel(selected),
      selectedMorale: selected ? MORALE_LABEL[selected.morale] ?? selected.morale : "n/a",
      selectedROE: selected ? ROE_LABEL[selected.fireMode] ?? selected.fireMode : "n/a",
      selectedContactBearing: selected?.contactBearing ?? "n/a",
      selectedContactRange: selected?.contactRange ?? 0,
      selectedContactConfidence: selected?.contactConfidence ?? 0,
      selectedCover: Math.round(averageCover(selected) * 100),
      selectedWounded: squadWoundedCount(selected),
      selectedCasualties: selected?.casualties ?? 0,
      selectedShotsFired: selected?.shotsFired ?? 0,
      selectedPathWaypoints: selected?.path?.length ?? 0,
      selectedPathIndex: selected?.pathIndex ?? 0,
      selectedPathHistory: selected?.pathHistory?.length ?? 0,
      selectedKnownThreats: selected?.knownThreatLocations?.length ?? 0,
      selectedRallyPoint: Boolean(selected?.activeOrder?.rallyPoint),
      selectedReinforcementPolicy: selected?.activeOrder?.reinforcementPolicy ?? "none",
      squads: squads.map((squad) => ({
        id: squad.id,
        side: squad.side,
        label: squad.label,
        state: STATE_LABEL[squad.state] ?? squad.state,
        mission: squad.mission ?? "awaiting orders",
        missionType: MISSION_LABEL[squad.missionType] ?? squad.missionType ?? "None",
        missionStatus: MISSION_STATUS_LABEL[squad.missionStatus] ?? squad.missionStatus ?? "None",
        morale: MORALE_LABEL[squad.morale] ?? squad.morale ?? "n/a",
        soldiers: squad.soldiers?.length ?? 0,
        alive: squadAliveCount(squad),
        wounded: squadWoundedCount(squad),
        casualties: squad.casualties ?? 0,
        strengthPct: squadStrengthPct(squad),
        suppression: Math.round(squad.suppression ?? 0),
        x: Math.round(squad.center?.x ?? 0),
        z: Math.round(squad.center?.z ?? 0)
      }))
    };
  }

  emitStats() {
    this.callbacks.onInfantryStats?.(this.getStats());
  }
}
