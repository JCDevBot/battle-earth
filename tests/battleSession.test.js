import { describe, expect, it } from "vitest";
import {
  BATTLE_SESSION_SCHEMA,
  BATTLE_SESSION_VERSION,
  FIDELITY_CLASSES,
  createBattleSession,
  createDevelopmentBattleSession,
  restoreBattleSession,
  serializeBattleSession,
} from "../src/domain/BattleSession.js";

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

  it("rejects malformed serialized data", () => {
    expect(() => restoreBattleSession("not json")).toThrow(
      "serialized BattleSession must contain valid JSON",
    );
  });
});
