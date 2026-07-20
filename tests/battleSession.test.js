import { describe, expect, it } from "vitest";
import {
  BATTLE_SESSION_PHASES,
  BATTLE_SESSION_SCHEMA,
  BATTLE_SESSION_VERSION,
  FIDELITY_CLASSES,
  createBattleSession,
  createBattleSessionMacroSummary,
  createDevelopmentBattleSession,
  recordBattleOutcome,
  restoreBattleSession,
  serializeBattleSession,
  transitionBattleSession,
  validateBattleSession,
} from "../src/domain/BattleSession.js";

function advanceToActive(session) {
  return ["replica-ready", "hq-placed", "deployed", "active"].reduce(
    (current, phase) => transitionBattleSession(current, phase),
    session,
  );
}

describe("BattleSession", () => {
  it("creates a deterministic development session", () => {
    const first = createDevelopmentBattleSession();
    const second = createDevelopmentBattleSession();

    expect(first).toEqual(second);
    expect(first.id).toMatch(/^battle-session-/);
    expect(first.schema).toBe(BATTLE_SESSION_SCHEMA);
    expect(first.version).toBe(BATTLE_SESSION_VERSION);
    expect(first.friendlyForce.units).toHaveLength(2);
    expect(first.renderedContextBounds.minX).toBeLessThan(
      first.playableBounds.minX,
    );
    expect(validateBattleSession(first)).toEqual(first);
  });

  it("serializes and restores without losing supported state", () => {
    const session = createDevelopmentBattleSession();
    const serialized = serializeBattleSession(session);
    const restored = restoreBattleSession(serialized);

    expect(restored).toEqual(session);
    expect(serializeBattleSession(restored)).toBe(serialized);
  });

  it("preserves deterministic identity for equivalent input regardless of object key order", () => {
    const base = createDevelopmentBattleSession();
    const reordered = {
      ...base,
      id: undefined,
      playerProfile: {
        ...base.playerProfile,
        resources: {
          reinforcementPoints: base.playerProfile.resources.reinforcementPoints,
          supply: base.playerProfile.resources.supply,
        },
        upgrades: {
          medical: base.playerProfile.upgrades.medical,
          command: base.playerProfile.upgrades.command,
        },
      },
    };

    expect(createBattleSession({ ...base, id: undefined }).id).toBe(
      createBattleSession(reordered).id,
    );
  });

  it("keeps identity stable as lifecycle, HQ, objective, and outcome state change", () => {
    const initial = createDevelopmentBattleSession();
    const active = advanceToActive({
      ...initial,
      hqPlan: {
        ...initial.hqPlan,
        status: "placed",
        placement: { x: 220, z: 0 },
        entryRouteId: "route-west",
      },
      objective: { ...initial.objective, status: "contested" },
    });
    const resolved = recordBattleOutcome(active, {
      result: "victory",
      casualties: { friendly: 3, enemy: 8 },
      resourcesSpent: { supply: 12 },
      objectiveStatus: "secured",
      objectiveControl: "player",
      elapsedSeconds: 420,
    });

    expect(active.id).toBe(initial.id);
    expect(resolved.id).toBe(initial.id);
  });

  it("rejects a supplied identity that does not match normalized setup", () => {
    const session = createDevelopmentBattleSession();

    expect(() =>
      createBattleSession({
        ...session,
        id: "battle-session-stale",
      }),
    ).toThrow("BattleSession id does not match normalized setup");
  });

  it("validates geographic coordinates", () => {
    const session = createDevelopmentBattleSession();

    expect(() =>
      createBattleSession({
        ...session,
        id: undefined,
        geographicContext: {
          ...session.geographicContext,
          location: { lat: 91, lon: -93.09 },
        },
      }),
    ).toThrow("latitude must be between -90 and 90");
  });

  it("requires rendered context bounds to contain playable bounds", () => {
    const session = createDevelopmentBattleSession();

    expect(() =>
      createBattleSession({
        ...session,
        id: undefined,
        renderedContextBounds: {
          minX: -100,
          maxX: 100,
          minZ: -100,
          maxZ: 100,
        },
      }),
    ).toThrow("renderedContextBounds must contain playableBounds");
  });

  it("requires HQ placement to remain inside rendered context", () => {
    const session = createDevelopmentBattleSession();

    expect(() =>
      createBattleSession({
        ...session,
        hqPlan: {
          ...session.hqPlan,
          status: "placed",
          placement: { x: 300, z: 0 },
        },
      }),
    ).toThrow("hqPlan.placement must be inside renderedContextBounds");
  });

  it("allows HQ staging outside playable bounds but inside rendered context", () => {
    const session = createDevelopmentBattleSession();
    const placed = createBattleSession({
      ...session,
      hqPlan: {
        ...session.hqPlan,
        status: "placed",
        placement: { x: 220, z: 0 },
      },
    });

    expect(placed.hqPlan.placement).toEqual({ x: 220, z: 0 });
    expect(placed.id).toBe(session.id);
  });

  it("requires tactical objectives to remain inside playable bounds", () => {
    const session = createDevelopmentBattleSession();

    expect(() =>
      createBattleSession({
        ...session,
        id: undefined,
        objective: {
          ...session.objective,
          position: { x: 200, z: 0 },
        },
      }),
    ).toThrow("objective.position must be inside playableBounds");
  });

  it("rejects unsupported schema versions", () => {
    const session = createDevelopmentBattleSession();

    expect(() => createBattleSession({ ...session, version: 99 })).toThrow(
      "unsupported BattleSession version: 99",
    );
  });

  it("requires explicit provenance classes", () => {
    const session = createDevelopmentBattleSession();

    expect(session.replica.provenance[0].fidelityClass).toBe(
      FIDELITY_CLASSES.SOURCE_EXACT,
    );
    expect(() =>
      createBattleSession({
        ...session,
        id: undefined,
        replica: {
          ...session.replica,
          provenance: [
            {
              featureType: "trees",
              source: "unknown",
              fidelityClass: "probably-correct",
            },
          ],
        },
      }),
    ).toThrow("invalid fidelityClass");
  });

  it("allows only the next lifecycle transition", () => {
    const session = createDevelopmentBattleSession();
    const replicaReady = transitionBattleSession(session, "replica-ready");

    expect(BATTLE_SESSION_PHASES).toContain(replicaReady.battleState.phase);
    expect(replicaReady.battleState.phase).toBe("replica-ready");
    expect(replicaReady.revision).toBe(1);
    expect(replicaReady.id).toBe(session.id);

    expect(() => transitionBattleSession(replicaReady, "active")).toThrow(
      "invalid BattleSession transition: replica-ready -> active",
    );
    expect(() => transitionBattleSession(replicaReady, "setup")).toThrow(
      "invalid BattleSession transition: replica-ready -> setup",
    );
  });

  it("records an outcome while preserving profile and force allocation context", () => {
    const active = advanceToActive(createDevelopmentBattleSession());
    const resolved = recordBattleOutcome(active, {
      result: "victory",
      casualties: { friendly: 3, enemy: 8 },
      resourcesSpent: { supply: 12 },
      objectiveStatus: "secured",
      objectiveControl: "player",
      hqStatus: "operational",
      elapsedSeconds: 420,
    });

    expect(resolved.battleState.phase).toBe("resolved");
    expect(resolved.battleState.elapsedSeconds).toBe(420);
    expect(resolved.outcome.result).toBe("victory");
    expect(resolved.objective.status).toBe("secured");
    expect(resolved.macroState.remainingForceStrength).toBe(15);
    expect(resolved.playerProfile).toEqual(active.playerProfile);
    expect(resolved.friendlyForce).toEqual(active.friendlyForce);
    expect(resolved.id).toBe(active.id);
  });

  it("rejects outcome recording before active battle", () => {
    expect(() =>
      recordBattleOutcome(createDevelopmentBattleSession(), {
        result: "victory",
      }),
    ).toThrow("outcome can only be recorded from the active phase");
  });

  it("produces a compact macro summary", () => {
    const active = advanceToActive(createDevelopmentBattleSession());
    const resolved = recordBattleOutcome(active, {
      result: "defeat",
      casualties: { friendly: 18, enemy: 4 },
      resourcesSpent: { supply: 30 },
      remainingForceStrength: 0,
      objectiveControl: "enemy",
      hqStatus: "damaged",
    });
    const summary = createBattleSessionMacroSummary(resolved);

    expect(summary).toMatchObject({
      sessionId: resolved.id,
      phase: "resolved",
      result: "defeat",
      remainingForceStrength: 0,
      objectiveControl: "enemy",
      hqStatus: "damaged",
    });
    expect(summary.location.name).toBe("St. Paul / Harriet Island");
    expect(summary.resources).toEqual(active.playerProfile.resources);
    expect(summary.resourcesSpent).toEqual({ supply: 30 });
  });

  it("rejects malformed serialized data", () => {
    expect(() => restoreBattleSession("not json")).toThrow(
      "serialized BattleSession must contain valid JSON",
    );
  });
});
