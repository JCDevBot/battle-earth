export const BATTLE_SESSION_SCHEMA_VERSION = 1;

export const BATTLE_SESSION_STAGES = Object.freeze({
  SETUP: "setup",
  HQ_PLACEMENT: "hq-placement",
  DEPLOYMENT: "deployment",
  ACTIVE: "active",
  RESOLVED: "resolved",
  ARCHIVED: "archived",
});

const VALID_STAGES = new Set(Object.values(BATTLE_SESSION_STAGES));

function requireFiniteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be a finite number.`);
  return number;
}

function normalizeCoordinates(input = {}) {
  const lat = requireFiniteNumber(input.lat, "geographicContext.lat");
  const lon = requireFiniteNumber(input.lon, "geographicContext.lon");
  if (lat < -90 || lat > 90) throw new RangeError("geographicContext.lat must be between -90 and 90.");
  if (lon < -180 || lon > 180) throw new RangeError("geographicContext.lon must be between -180 and 180.");
  return { lat, lon };
}

function normalizeBounds(input = {}, label) {
  const widthMeters = requireFiniteNumber(input.widthMeters, `${label}.widthMeters`);
  const depthMeters = requireFiniteNumber(input.depthMeters, `${label}.depthMeters`);
  if (widthMeters <= 0 || depthMeters <= 0) throw new RangeError(`${label} dimensions must be greater than zero.`);
  return {
    centerX: Number(input.centerX) || 0,
    centerZ: Number(input.centerZ) || 0,
    widthMeters,
    depthMeters,
  };
}

function cloneJson(value, label = "value") {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new TypeError(`${label} must be JSON-serializable.`, { cause: error });
  }
}

function stableId({ id, geographicContext, seed }) {
  if (id) return String(id);
  const name = geographicContext.name ?? "location";
  return `battle-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${seed}`;
}

export function createBattleSession(input = {}) {
  const schemaVersion = Number(input.schemaVersion ?? BATTLE_SESSION_SCHEMA_VERSION);
  if (schemaVersion !== BATTLE_SESSION_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported BattleSession schema version: ${schemaVersion}.`);
  }

  const coordinates = normalizeCoordinates(input.geographicContext);
  const seed = Number.isInteger(Number(input.seed)) ? Number(input.seed) : 1;
  const stage = input.stage ?? BATTLE_SESSION_STAGES.SETUP;
  if (!VALID_STAGES.has(stage)) throw new RangeError(`Unsupported BattleSession stage: ${stage}.`);

  const playableBounds = normalizeBounds(input.playableBounds, "playableBounds");
  const renderedContextBounds = normalizeBounds(input.renderedContextBounds, "renderedContextBounds");
  if (
    renderedContextBounds.widthMeters < playableBounds.widthMeters ||
    renderedContextBounds.depthMeters < playableBounds.depthMeters
  ) {
    throw new RangeError("renderedContextBounds must contain the playable bounds.");
  }

  const now = input.updatedAt ?? input.createdAt ?? new Date(0).toISOString();
  const geographicContext = {
    id: input.geographicContext.id ?? input.geographicContext.name ?? "custom-location",
    name: input.geographicContext.name ?? "Custom Location",
    hierarchy: [...(input.geographicContext.hierarchy ?? [input.geographicContext.name ?? "Custom Location"])],
    ...coordinates,
  };

  return {
    schemaVersion,
    id: stableId({ id: input.id, geographicContext, seed }),
    seed,
    stage,
    geographicContext,
    playableBounds,
    renderedContextBounds,
    replica: cloneJson(input.replica ?? {
      mode: "replica",
      sources: [],
      fidelity: { sourceExact: 0, derived: 0, inferred: 0, procedural: 0, warnings: [] },
    }, "replica"),
    playerProfileSnapshot: cloneJson(input.playerProfileSnapshot ?? { id: "development-profile", resources: {} }, "playerProfileSnapshot"),
    hqPlan: cloneJson(input.hqPlan ?? { status: "unplaced", candidates: [], placement: null }, "hqPlan"),
    forces: cloneJson(input.forces ?? { friendly: [], enemy: [] }, "forces"),
    objectivePlan: cloneJson(input.objectivePlan ?? { objectives: [], activeObjectiveId: null }, "objectivePlan"),
    environment: cloneJson(input.environment ?? { era: "modern", timeOfDay: "day", weather: "clear" }, "environment"),
    tacticalState: cloneJson(input.tacticalState ?? { elapsedSeconds: 0, status: "not-started" }, "tacticalState"),
    outcome: cloneJson(input.outcome ?? null, "outcome"),
    macroConsequences: cloneJson(input.macroConsequences ?? { casualties: [], resourceChanges: {}, territoryChanges: [] }, "macroConsequences"),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function validateBattleSession(session) {
  createBattleSession(session);
  return true;
}

export function serializeBattleSession(session) {
  validateBattleSession(session);
  return JSON.stringify(session);
}

export function restoreBattleSession(serialized) {
  const parsed = typeof serialized === "string" ? JSON.parse(serialized) : cloneJson(serialized, "serialized BattleSession");
  return createBattleSession(parsed);
}

export function transitionBattleSession(session, stage, changes = {}) {
  if (!VALID_STAGES.has(stage)) throw new RangeError(`Unsupported BattleSession stage: ${stage}.`);
  return createBattleSession({
    ...session,
    ...changes,
    stage,
    updatedAt: changes.updatedAt ?? session.updatedAt,
  });
}
