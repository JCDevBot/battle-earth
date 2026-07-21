export const BATTLE_SESSION_SCHEMA_VERSION = "battle-earth/battle-session-v1";
export const DEFAULT_WORLD_SNAPSHOT_SCHEMA_VERSION =
  "battle-earth/world-snapshot-v1";

function finiteNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }
  return number;
}

function positiveNumber(value, fieldName) {
  const number = finiteNumber(value, fieldName);
  if (number <= 0) {
    throw new RangeError(`${fieldName} must be greater than zero`);
  }
  return number;
}

function normalizeCoordinate(value, fieldName, min, max) {
  const number = finiteNumber(value, fieldName);
  if (number < min || number > max) {
    throw new RangeError(`${fieldName} must be between ${min} and ${max}`);
  }
  return number;
}

function cloneJson(value, fallback) {
  if (value === undefined) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function stableHash(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeBounds(bounds, fieldName, fallbackCenter) {
  const source = bounds ?? {};
  return {
    center: {
      lat: normalizeCoordinate(
        source.center?.lat ?? fallbackCenter.lat,
        `${fieldName}.center.lat`,
        -90,
        90,
      ),
      lon: normalizeCoordinate(
        source.center?.lon ?? fallbackCenter.lon,
        `${fieldName}.center.lon`,
        -180,
        180,
      ),
    },
    widthMeters: positiveNumber(
      source.widthMeters,
      `${fieldName}.widthMeters`,
    ),
    depthMeters: positiveNumber(
      source.depthMeters,
      `${fieldName}.depthMeters`,
    ),
  };
}

function normalizeWorldSnapshot(worldSnapshot = {}) {
  if (!worldSnapshot.id) {
    throw new TypeError("worldSnapshot.id is required");
  }
  return {
    id: String(worldSnapshot.id),
    schemaVersion:
      worldSnapshot.schemaVersion ?? DEFAULT_WORLD_SNAPSHOT_SCHEMA_VERSION,
    contentHash: worldSnapshot.contentHash ?? null,
    effectiveDate: worldSnapshot.effectiveDate ?? null,
  };
}

function normalizeRuntimeState(runtimeState = {}) {
  return {
    phase: runtimeState.phase ?? "setup",
    tick: Math.max(0, Math.floor(Number(runtimeState.tick) || 0)),
    objectiveState: cloneJson(runtimeState.objectiveState, {}),
    friendlyState: cloneJson(runtimeState.friendlyState, {}),
    enemyState: cloneJson(runtimeState.enemyState, {}),
    resourceChanges: cloneJson(runtimeState.resourceChanges, {}),
    casualties: cloneJson(runtimeState.casualties, []),
    hqState: cloneJson(runtimeState.hqState, {}),
  };
}

export function normalizeBattleSession(input = {}) {
  if (input.schemaVersion && input.schemaVersion !== BATTLE_SESSION_SCHEMA_VERSION) {
    throw new RangeError(
      `Unsupported BattleSession schema version: ${input.schemaVersion}`,
    );
  }

  const geographicContext = input.geographicContext ?? {};
  const selectedLocation = geographicContext.selectedLocation ?? input.location;
  if (!selectedLocation) {
    throw new TypeError("geographicContext.selectedLocation is required");
  }

  const location = {
    lat: normalizeCoordinate(selectedLocation.lat, "location.lat", -90, 90),
    lon: normalizeCoordinate(selectedLocation.lon, "location.lon", -180, 180),
    name: selectedLocation.name ?? selectedLocation.selectedName ?? "Custom Location",
    hierarchy: cloneJson(selectedLocation.hierarchy, []),
  };

  const playableBounds = normalizeBounds(
    input.playableBounds,
    "playableBounds",
    location,
  );
  const renderedContextBounds = normalizeBounds(
    input.renderedContextBounds,
    "renderedContextBounds",
    location,
  );

  if (
    renderedContextBounds.widthMeters < playableBounds.widthMeters ||
    renderedContextBounds.depthMeters < playableBounds.depthMeters
  ) {
    throw new RangeError(
      "renderedContextBounds must contain the playableBounds dimensions",
    );
  }

  const seed = Math.floor(finiteNumber(input.seed ?? 1, "seed"));
  const worldSnapshot = normalizeWorldSnapshot(input.worldSnapshot);
  const sessionId =
    input.id ??
    `battle-session-${stableHash(
      `${worldSnapshot.id}:${location.lat}:${location.lon}:${seed}`,
    )}`;

  return {
    schemaVersion: BATTLE_SESSION_SCHEMA_VERSION,
    id: String(sessionId),
    seed,
    worldSnapshot,
    geographicContext: {
      selectedLocation: location,
      administrative: cloneJson(geographicContext.administrative, []),
      natural: cloneJson(geographicContext.natural, []),
      urban: cloneJson(geographicContext.urban, []),
    },
    playableBounds,
    renderedContextBounds,
    replica: {
      mode: input.replica?.mode ?? "replica",
      sourceRefs: cloneJson(input.replica?.sourceRefs, []),
      fidelitySummary: cloneJson(input.replica?.fidelitySummary, {}),
    },
    setup: {
      playerProfileSnapshot: cloneJson(
        input.setup?.playerProfileSnapshot,
        null,
      ),
      hqPlan: cloneJson(input.setup?.hqPlan, null),
      friendlyForcePackage: cloneJson(
        input.setup?.friendlyForcePackage,
        [],
      ),
      enemyForcePackage: cloneJson(input.setup?.enemyForcePackage, []),
      objectivePlan: cloneJson(input.setup?.objectivePlan, []),
      environment: cloneJson(input.setup?.environment, {}),
      rules: cloneJson(input.setup?.rules, {}),
    },
    runtimeState: normalizeRuntimeState(input.runtimeState),
    outcome: cloneJson(input.outcome, null),
    persistence: {
      createdAt: input.persistence?.createdAt ?? null,
      updatedAt: input.persistence?.updatedAt ?? null,
      revision: Math.max(
        0,
        Math.floor(Number(input.persistence?.revision) || 0),
      ),
    },
  };
}

export function createBattleSession({
  location,
  worldSnapshot,
  seed = 1,
  playableWidthMeters,
  playableDepthMeters,
  contextBufferRatio = 0.15,
  ...overrides
}) {
  const widthMeters = positiveNumber(
    playableWidthMeters,
    "playableWidthMeters",
  );
  const depthMeters = positiveNumber(
    playableDepthMeters,
    "playableDepthMeters",
  );
  const bufferRatio = finiteNumber(contextBufferRatio, "contextBufferRatio");
  if (bufferRatio < 0) {
    throw new RangeError("contextBufferRatio cannot be negative");
  }

  return normalizeBattleSession({
    ...overrides,
    seed,
    worldSnapshot,
    geographicContext: {
      ...overrides.geographicContext,
      selectedLocation: location,
    },
    playableBounds: {
      center: location,
      widthMeters,
      depthMeters,
    },
    renderedContextBounds: {
      center: location,
      widthMeters: widthMeters * (1 + bufferRatio * 2),
      depthMeters: depthMeters * (1 + bufferRatio * 2),
    },
  });
}

export function serializeBattleSession(session) {
  return JSON.stringify(normalizeBattleSession(session));
}

export function restoreBattleSession(serializedSession) {
  if (typeof serializedSession !== "string") {
    throw new TypeError("serializedSession must be a JSON string");
  }
  return normalizeBattleSession(JSON.parse(serializedSession));
}
