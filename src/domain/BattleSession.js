export const BATTLE_SESSION_SCHEMA = "battle-earth/session";
export const BATTLE_SESSION_VERSION = 1;

export const FIDELITY_CLASSES = Object.freeze({
  SOURCE_EXACT: "source-exact",
  HIGH_CONFIDENCE_DERIVED: "high-confidence-derived",
  LOW_CONFIDENCE_INFERRED: "low-confidence-inferred",
  PROCEDURAL_FALLBACK: "procedural-fallback",
});

export const BATTLE_SESSION_PHASES = Object.freeze([
  "setup",
  "replica-ready",
  "hq-placed",
  "deployed",
  "active",
  "resolved",
  "summarized",
]);

const FIDELITY_VALUES = new Set(Object.values(FIDELITY_CLASSES));
const PHASE_INDEX = new Map(
  BATTLE_SESSION_PHASES.map((phase, index) => [phase, index]),
);

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finiteNumber(value, label) {
  const number = Number(value);
  assert(Number.isFinite(number), `${label} must be a finite number`);
  return number;
}

function normalizeCoordinates(location = {}) {
  const lat = finiteNumber(location.lat, "geographicContext.location.lat");
  const lon = finiteNumber(location.lon, "geographicContext.location.lon");
  assert(lat >= -90 && lat <= 90, "latitude must be between -90 and 90");
  assert(lon >= -180 && lon <= 180, "longitude must be between -180 and 180");
  return { lat, lon };
}

function normalizeBounds(bounds = {}, label) {
  const minX = finiteNumber(bounds.minX, `${label}.minX`);
  const maxX = finiteNumber(bounds.maxX, `${label}.maxX`);
  const minZ = finiteNumber(bounds.minZ, `${label}.minZ`);
  const maxZ = finiteNumber(bounds.maxZ, `${label}.maxZ`);
  assert(maxX > minX, `${label}.maxX must be greater than minX`);
  assert(maxZ > minZ, `${label}.maxZ must be greater than minZ`);
  return { minX, maxX, minZ, maxZ };
}

function normalizePoint(point, label) {
  assert(point && typeof point === "object", `${label} must be an object`);
  return {
    x: finiteNumber(point.x, `${label}.x`),
    z: finiteNumber(point.z, `${label}.z`),
  };
}

function containsBounds(outer, inner) {
  return (
    outer.minX <= inner.minX &&
    outer.maxX >= inner.maxX &&
    outer.minZ <= inner.minZ &&
    outer.maxZ >= inner.maxZ
  );
}

function containsPoint(bounds, point) {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.z >= bounds.minZ &&
    point.z <= bounds.maxZ
  );
}

function normalizeProvenance(entries = []) {
  assert(Array.isArray(entries), "replica.provenance must be an array");
  return entries.map((entry, index) => {
    assert(
      entry && typeof entry === "object",
      `provenance entry ${index} must be an object`,
    );
    assert(
      typeof entry.featureType === "string" && entry.featureType,
      `provenance entry ${index} requires featureType`,
    );
    assert(
      typeof entry.source === "string" && entry.source,
      `provenance entry ${index} requires source`,
    );
    assert(
      FIDELITY_VALUES.has(entry.fidelityClass),
      `provenance entry ${index} has an invalid fidelityClass`,
    );
    return {
      featureType: entry.featureType,
      source: entry.source,
      fidelityClass: entry.fidelityClass,
      count: Math.max(0, Math.trunc(Number(entry.count) || 0)),
      note: entry.note ?? null,
    };
  });
}

function normalizeForcePackage(force = {}, label) {
  assert(typeof force.id === "string" && force.id, `${label}.id is required`);
  assert(Array.isArray(force.units), `${label}.units must be an array`);
  return {
    id: force.id,
    name: force.name ?? force.id,
    units: force.units.map((unit, index) => ({
      id: unit.id ?? `${force.id}-unit-${index + 1}`,
      type: unit.type ?? "infantry-squad",
      strength: Math.max(0, Math.trunc(Number(unit.strength) || 0)),
      status: unit.status ?? "available",
    })),
  };
}

function normalizePhase(phase = "setup") {
  assert(PHASE_INDEX.has(phase), `unsupported BattleSession phase: ${phase}`);
  return phase;
}

function stableHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function identityPayload(session) {
  return stableStringify({
    schema: session.schema,
    version: session.version,
    seed: session.seed,
    geographicContext: session.geographicContext,
    playableBounds: session.playableBounds,
    renderedContextBounds: session.renderedContextBounds,
    playerProfile: session.playerProfile,
    hqAssetId: session.hqPlan.assetId,
    friendlyForce: session.friendlyForce,
    enemyForce: session.enemyForce,
    objective: {
      id: session.objective.id,
      type: session.objective.type,
      name: session.objective.name,
      position: session.objective.position,
    },
    environment: session.environment,
  });
}

function totalForceStrength(force) {
  return force.units.reduce((sum, unit) => sum + unit.strength, 0);
}

export function createBattleSession(spec = {}) {
  const schema = spec.schema ?? BATTLE_SESSION_SCHEMA;
  const version = Number(spec.version ?? BATTLE_SESSION_VERSION);
  assert(
    schema === BATTLE_SESSION_SCHEMA,
    `unsupported BattleSession schema: ${schema}`,
  );
  assert(
    version === BATTLE_SESSION_VERSION,
    `unsupported BattleSession version: ${version}`,
  );

  const geographicContext = {
    id: spec.geographicContext?.id ?? "custom-location",
    name: spec.geographicContext?.name ?? "Custom Location",
    hierarchy: Array.isArray(spec.geographicContext?.hierarchy)
      ? [...spec.geographicContext.hierarchy]
      : [spec.geographicContext?.name ?? "Custom Location"],
    location: normalizeCoordinates(spec.geographicContext?.location),
  };
  const playableBounds = normalizeBounds(
    spec.playableBounds,
    "playableBounds",
  );
  const renderedContextBounds = normalizeBounds(
    spec.renderedContextBounds,
    "renderedContextBounds",
  );
  assert(
    containsBounds(renderedContextBounds, playableBounds),
    "renderedContextBounds must contain playableBounds",
  );

  const hqPlacement = spec.hqPlan?.placement
    ? normalizePoint(spec.hqPlan.placement, "hqPlan.placement")
    : null;
  if (hqPlacement) {
    assert(
      containsPoint(renderedContextBounds, hqPlacement),
      "hqPlan.placement must be inside renderedContextBounds",
    );
  }

  const objectivePosition = spec.objective?.position
    ? normalizePoint(spec.objective.position, "objective.position")
    : null;
  if (objectivePosition) {
    assert(
      containsPoint(playableBounds, objectivePosition),
      "objective.position must be inside playableBounds",
    );
  }

  const friendlyForce = normalizeForcePackage(
    spec.friendlyForce,
    "friendlyForce",
  );
  const enemyForce = normalizeForcePackage(spec.enemyForce, "enemyForce");

  const session = {
    schema,
    version,
    seed: Math.trunc(finiteNumber(spec.seed ?? 1, "seed")),
    revision: Math.max(0, Math.trunc(Number(spec.revision) || 0)),
    geographicContext,
    playableBounds,
    renderedContextBounds,
    replica: {
      mode: spec.replica?.mode ?? "replica",
      provenance: normalizeProvenance(spec.replica?.provenance ?? []),
      warnings: Array.isArray(spec.replica?.warnings)
        ? [...spec.replica.warnings]
        : [],
    },
    playerProfile: {
      id: spec.playerProfile?.id ?? "development-player",
      hqAssetId: spec.playerProfile?.hqAssetId ?? "development-hq",
      resources: { ...(spec.playerProfile?.resources ?? {}) },
      upgrades: { ...(spec.playerProfile?.upgrades ?? {}) },
    },
    hqPlan: {
      status: spec.hqPlan?.status ?? "unplaced",
      assetId:
        spec.hqPlan?.assetId ??
        spec.playerProfile?.hqAssetId ??
        "development-hq",
      placement: hqPlacement,
      entryRouteId: spec.hqPlan?.entryRouteId ?? null,
    },
    friendlyForce,
    enemyForce,
    objective: {
      id: spec.objective?.id ?? "primary-objective",
      type: spec.objective?.type ?? "capture-and-hold",
      name: spec.objective?.name ?? "Primary Objective",
      status: spec.objective?.status ?? "pending",
      position: objectivePosition,
    },
    environment: {
      timeOfDay: spec.environment?.timeOfDay ?? "day",
      weather: spec.environment?.weather ?? "clear",
      terrainSource:
        spec.environment?.terrainSource ?? "deterministic-fixture",
    },
    battleState: {
      phase: normalizePhase(spec.battleState?.phase),
      elapsedSeconds: Math.max(
        0,
        Number(spec.battleState?.elapsedSeconds) || 0,
      ),
    },
    outcome: spec.outcome
      ? {
          result: spec.outcome.result ?? "unresolved",
          casualties: { ...(spec.outcome.casualties ?? {}) },
          resourcesSpent: { ...(spec.outcome.resourcesSpent ?? {}) },
        }
      : null,
    macroState: {
      status: spec.macroState?.status ?? "available",
      remainingForceStrength: Number(
        spec.macroState?.remainingForceStrength ??
          totalForceStrength(friendlyForce),
      ),
      objectiveControl: spec.macroState?.objectiveControl ?? "neutral",
      hqStatus:
        spec.macroState?.hqStatus ?? spec.hqPlan?.status ?? "unplaced",
    },
  };

  const id = `battle-session-${stableHash(identityPayload(session))}`;
  assert(
    spec.id == null || spec.id === id,
    "BattleSession id does not match normalized setup",
  );

  return { ...session, id };
}

export function validateBattleSession(session) {
  return createBattleSession(session);
}

export function serializeBattleSession(session) {
  return stableStringify(createBattleSession(session));
}

export function restoreBattleSession(serialized) {
  assert(
    typeof serialized === "string" && serialized,
    "serialized BattleSession must be a non-empty string",
  );
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new TypeError("serialized BattleSession must contain valid JSON");
  }
  return createBattleSession(parsed);
}

export function transitionBattleSession(session, nextPhase) {
  const current = createBattleSession(session);
  const currentIndex = PHASE_INDEX.get(current.battleState.phase);
  const nextIndex = PHASE_INDEX.get(nextPhase);
  assert(nextIndex != null, `unsupported BattleSession phase: ${nextPhase}`);
  assert(
    nextIndex === currentIndex + 1,
    `invalid BattleSession transition: ${current.battleState.phase} -> ${nextPhase}`,
  );

  return createBattleSession({
    ...current,
    revision: current.revision + 1,
    battleState: { ...current.battleState, phase: nextPhase },
  });
}

export function recordBattleOutcome(session, outcome = {}) {
  const current = createBattleSession(session);
  assert(
    current.battleState.phase === "active",
    "BattleSession outcome can only be recorded from the active phase",
  );
  assert(
    typeof outcome.result === "string" && outcome.result,
    "outcome.result is required",
  );

  const friendlyCasualties = Math.max(
    0,
    Math.trunc(Number(outcome.casualties?.friendly) || 0),
  );
  const initialStrength = totalForceStrength(current.friendlyForce);
  const remainingForceStrength = Math.max(
    0,
    Math.trunc(
      Number(outcome.remainingForceStrength) ||
        initialStrength - friendlyCasualties,
    ),
  );

  return createBattleSession({
    ...current,
    revision: current.revision + 1,
    battleState: {
      ...current.battleState,
      phase: "resolved",
      elapsedSeconds: Math.max(
        current.battleState.elapsedSeconds,
        Number(outcome.elapsedSeconds) || 0,
      ),
    },
    objective: {
      ...current.objective,
      status: outcome.objectiveStatus ?? current.objective.status,
    },
    outcome: {
      result: outcome.result,
      casualties: { ...(outcome.casualties ?? {}) },
      resourcesSpent: { ...(outcome.resourcesSpent ?? {}) },
    },
    macroState: {
      status: "battle-resolved",
      remainingForceStrength,
      objectiveControl:
        outcome.objectiveControl ?? current.macroState.objectiveControl,
      hqStatus: outcome.hqStatus ?? current.hqPlan.status,
    },
  });
}

export function createBattleSessionMacroSummary(session) {
  const current = createBattleSession(session);
  return {
    sessionId: current.id,
    revision: current.revision,
    location: {
      id: current.geographicContext.id,
      name: current.geographicContext.name,
      hierarchy: [...current.geographicContext.hierarchy],
      ...current.geographicContext.location,
    },
    phase: current.battleState.phase,
    result: current.outcome?.result ?? "unresolved",
    casualties: { ...(current.outcome?.casualties ?? {}) },
    remainingForceStrength: current.macroState.remainingForceStrength,
    resources: { ...current.playerProfile.resources },
    resourcesSpent: { ...(current.outcome?.resourcesSpent ?? {}) },
    objectiveControl: current.macroState.objectiveControl,
    hqStatus: current.macroState.hqStatus,
  };
}

export function createDevelopmentBattleSession() {
  return createBattleSession({
    seed: 1,
    geographicContext: {
      id: "st-paul-harriet-island",
      name: "St. Paul / Harriet Island",
      hierarchy: [
        "Earth",
        "North America",
        "United States",
        "Minnesota",
        "St. Paul",
        "Harriet Island",
      ],
      location: { lat: 44.9362, lon: -93.0977 },
    },
    playableBounds: { minX: -175, maxX: 175, minZ: -175, maxZ: 175 },
    renderedContextBounds: {
      minX: -245,
      maxX: 245,
      minZ: -245,
      maxZ: 245,
    },
    replica: {
      mode: "replica",
      provenance: [
        {
          featureType: "buildings",
          source: "deterministic-osm-fixture",
          fidelityClass: FIDELITY_CLASSES.SOURCE_EXACT,
          count: 0,
        },
      ],
    },
    playerProfile: {
      id: "vertical-slice-development-profile",
      hqAssetId: "development-hq-v1",
      resources: { supply: 100, reinforcementPoints: 2 },
      upgrades: { command: 1, medical: 1 },
    },
    hqPlan: { status: "unplaced", assetId: "development-hq-v1" },
    friendlyForce: {
      id: "player-force",
      name: "Player Platoon",
      units: [
        { id: "friendly-1", type: "infantry-squad", strength: 9 },
        { id: "friendly-2", type: "infantry-squad", strength: 9 },
      ],
    },
    enemyForce: {
      id: "enemy-force",
      name: "Opposing Force",
      units: [{ id: "enemy-1", type: "infantry-squad", strength: 8 }],
    },
    objective: {
      id: "harriet-primary",
      type: "capture-and-hold",
      name: "Secure the primary objective",
      status: "pending",
      position: { x: 0, z: 0 },
    },
  });
}
