import { describe, expect, it, vi } from "vitest";
import {
  createCampaignFromBattleRequest,
  initializeCampaignFactions,
  normalizeStrategicEntity,
  recomputeInfluence,
} from "../src/campaign/CampaignEngine.js";

const childEntities = [
  { id: "a", name: "Alpha", level: "region" },
  { id: "b", name: "Bravo", level: "region" },
  { id: "c", name: "Charlie", level: "region" },
];

describe("campaign setup", () => {
  it("normalizes incomplete strategic entities", () => {
    expect(
      normalizeStrategicEntity({ name: "Minnesota", type: "region" }),
    ).toMatchObject({
      id: "Minnesota",
      name: "Minnesota",
      level: "region",
      hierarchy: ["Minnesota"],
    });
  });

  it("creates deterministic region values for the same battle request", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const request = {
      strategicEntity: { id: "root", name: "Test Theater", level: "country" },
      childEntities,
      gameMode: "risk",
      childLevel: "region",
    };

    const first = createCampaignFromBattleRequest(request);
    const second = createCampaignFromBattleRequest(request);

    expect(first.regions).toEqual(second.regions);
    expect(first.childLayer).toBe("regions");
    expect(first.status).toBe("setup");
  });

  it("initializes player and AI forces in available regions", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const campaign = createCampaignFromBattleRequest({
      strategicEntity: { id: "root", name: "Test Theater", level: "country" },
      childEntities,
    });
    const active = initializeCampaignFactions(campaign, {
      homeRegionId: "b",
      aiOpponentCount: 1,
    });

    expect(active.status).toBe("active");
    expect(active.factions).toHaveLength(2);
    expect(active.armies).toHaveLength(2);
    expect(active.factions[0].homeRegionId).toBe("b");
  });

  it("spreads army influence into neighboring regions", () => {
    const campaign = {
      regions: [
        { id: "a", ownerId: "player", neighbors: ["b"] },
        { id: "b", ownerId: null, neighbors: ["a"] },
      ],
      armies: [{ regionId: "a", factionId: "player", strength: 10 }],
      influenceClaims: [],
    };

    const updated = recomputeInfluence(campaign);

    expect(updated.regions[0].influence.player).toBeGreaterThan(50);
    expect(updated.regions[1].influence.player).toBeGreaterThan(0);
  });
});
