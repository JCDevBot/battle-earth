import { buildWorldEnginePlan } from "../world/WorldEngine";
const LEVEL_CHILD_LABEL = {
  world: "countries",
  continent: "countries",
  country: "regions",
  region: "cities",
  city: "districts"
};

const CHILD_LEVEL_LABEL = {
  continent: "continents",
  country: "countries",
  region: "regions",
  city: "cities",
  district: "districts"
};

const UNIT_SCALE_BY_LEVEL = {
  world: "army group",
  continent: "field army",
  country: "corps",
  region: "brigade",
  city: "battalion",
  neighborhood: "company"
};

const MODE_LABELS = {
  risk: "Risk-style",
  control: "Control",
  rush: "Rush",
  sandbox: "Sandbox",
  freeplay: "Freeplay"
};

const FACTION_COLORS = ["sky", "rose", "amber", "emerald", "violet", "cyan", "orange"];

function seededNumber(seedText = "seed") {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function curatedChildrenForCampaign(root, rawChildren = []) {
  const rootName = `${root.name ?? ""}`.toLowerCase();
  // Gameplay theater definitions are intentionally curated.
  // North America is Canada, United States, and Mexico.
  // Central America and Caribbean campaigns will become separate theater roots.
  if (root.level === "continent" && rootName === "north america") {
    const northAmericaNames = new Set(["canada", "united states", "united states of america", "mexico"]);
    return rawChildren.filter((child) => northAmericaNames.has(`${child.name ?? child.id ?? ""}`.toLowerCase()));
  }
  return rawChildren;
}

export function normalizeStrategicEntity(entity = {}) {
  return {
    id: entity.id ?? entity.name ?? "unknown-entity",
    name: entity.name ?? "Unknown",
    level: entity.level ?? entity.type ?? "region",
    hierarchy: entity.hierarchy ?? [entity.name ?? "Unknown"],
    lat: entity.lat ?? 0,
    lon: entity.lon ?? 0,
    bbox: entity.bbox ?? null,
    geometry: entity.geometry ?? null,
    source: entity.source ?? "campaign-request"
  };
}

export function createCampaignEvent(type, message, entityId = null, importance = "normal") {
  return {
    id: `event-${type}-${Date.now()}-${Math.round(Math.random() * 99999)}`,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    type,
    message,
    entityId,
    importance
  };
}

function createArmy({ faction, region, campaign, index = 1, strength = 8 }) {
  const unitScale = campaign.unitScale ?? "army";
  const label = faction.type === "human" ? "I" : `${index}`;
  return {
    id: `army-${faction.id}-${region.id}-${index}-${Date.now()}`,
    name: faction.type === "human" ? `${label} ${unitScale}` : `${faction.name} ${unitScale}`,
    type: unitScale,
    factionId: faction.id,
    regionId: region.id,
    strength,
    morale: faction.type === "human" ? 72 : 64,
    supply: 100,
    order: "Hold",
    status: "ready",
    influenceRadius: Math.max(1, Math.round(strength / 3)),
    path: [],
    progress: 1,
    lastRegionId: region.id
  };
}

export function createCampaignFromBattleRequest(battleRequest = {}) {
  const root = normalizeStrategicEntity(battleRequest.strategicEntity ?? {
    id: battleRequest.selectedName ?? "campaign-root",
    name: battleRequest.selectedName ?? "Campaign",
    level: battleRequest.selectionType ?? "continent",
    hierarchy: battleRequest.adminContext?.hierarchy ?? [battleRequest.selectedName ?? "Campaign"],
    lat: battleRequest.lat,
    lon: battleRequest.lon,
    bbox: battleRequest.boundaryBbox
  });

  const rawChildren = curatedChildrenForCampaign(root, Array.isArray(battleRequest.childEntities) ? battleRequest.childEntities : []);
  const rng = seededNumber(`${root.id}-${battleRequest.gameMode}-${rawChildren.length}`);
  const regions = rawChildren.map((child, index) => {
    const entity = normalizeStrategicEntity(child);
    const strategicValue = Math.max(1, Math.round(2 + rng() * 8));
    const income = Math.max(1, Math.round(strategicValue / 3));
    return {
      id: entity.id,
      entity,
      name: entity.name,
      level: entity.level,
      ownerId: null,
      armyStrength: Math.max(1, Math.round(2 + rng() * 8)),
      income,
      strategicValue,
      poiCount: Math.max(1, Math.round(1 + rng() * 5)),
      neighbors: [],
      influence: { neutral: 100 },
      controlPercent: 0,
      contested: false,
      supplyConnected: false
    };
  });

  regions.forEach((region, index) => {
    if (regions[index - 1]) region.neighbors.push(regions[index - 1].id);
    if (regions[index + 1]) region.neighbors.push(regions[index + 1].id);
    if (regions[index + 3]) region.neighbors.push(regions[index + 3].id);
  });

  const mode = battleRequest.gameMode ?? "risk";
  const playerMode = battleRequest.playerMode ?? "sandbox";
  return {
    id: `campaign-${root.id}-${Date.now()}`,
    root,
    mode,
    modeLabel: MODE_LABELS[mode] ?? mode,
    playerMode,
    timeModel: battleRequest.timeModel ?? "fluid",
    playableChildLevel: battleRequest.childLevel ?? null,
    navigationChildLevel: battleRequest.navigationChildLevel ?? null,
    playableScaleRule: battleRequest.playableScaleRule ?? `${root.level}/${mode} → ${battleRequest.childLevel ?? "children"}`,
    worldEnginePlan: battleRequest.worldEnginePlan ?? buildWorldEnginePlan({
      entity: root,
      gameMode: mode,
      playableChildLevel: battleRequest.childLevel,
      childCount: rawChildren.length,
      density: battleRequest.regionDensity ?? "recommended"
    }),
    regionDensity: battleRequest.regionDensity ?? "recommended",
    childLayer: CHILD_LEVEL_LABEL[battleRequest.childLevel] ?? LEVEL_CHILD_LABEL[root.level] ?? "regions",
    unitScale: UNIT_SCALE_BY_LEVEL[root.level] ?? "army",
    status: "setup",
    tick: 0,
    regions,
    factions: [],
    armies: [],
    events: [createCampaignEvent("system", `Campaign shell created for ${root.name}.`, root.id, "low")],
    selectedHomeRegionId: regions[0]?.id ?? null,
    aiOpponentCount: Math.min(Math.max(1, Math.min(3, regions.length - 1)), Math.max(0, regions.length - 1)),
    victoryCondition: mode === "risk" ? "Control all regions" : "Control strategic objectives",
    conflicts: [],
    influenceClaims: [],
    movementTrails: []
  };
}

export function recomputeInfluence(campaign) {
  const regions = campaign.regions.map((region) => ({
    ...region,
    influence: {},
    controlPercent: 0,
    contested: false,
    supplyConnected: false
  }));

  const byId = new Map(regions.map((region) => [region.id, region]));

  for (const region of regions) {
    if (region.ownerId) {
      region.influence[region.ownerId] = (region.influence[region.ownerId] ?? 0) + 45;
    } else {
      region.influence.neutral = (region.influence.neutral ?? 0) + 35;
    }
  }

  for (const army of campaign.armies ?? []) {
    const region = byId.get(army.regionId);
    if (!region) continue;
    region.influence[army.factionId] = (region.influence[army.factionId] ?? 0) + army.strength * 7;
    region.supplyConnected = true;
    for (const neighborId of region.neighbors ?? []) {
      const neighbor = byId.get(neighborId);
      if (!neighbor) continue;
      neighbor.influence[army.factionId] = (neighbor.influence[army.factionId] ?? 0) + army.strength * 1.8;
    }
  }

  for (const claim of campaign.influenceClaims ?? []) {
    const region = byId.get(claim.regionId);
    if (!region || !claim.factionId) continue;
    const strength = Math.max(1, Number(claim.strength ?? 1));
    region.influence[claim.factionId] = (region.influence[claim.factionId] ?? 0) + strength * 2.9;
  }

  for (const region of regions) {
    const entries = Object.entries(region.influence);
    const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
    const normalized = Object.fromEntries(entries.map(([key, value]) => [key, Math.round((value / total) * 100)]));
    const sorted = Object.entries(normalized).sort((a, b) => b[1] - a[1]);
    const [leaderId, leaderValue] = sorted[0] ?? [region.ownerId ?? "neutral", 0];
    const secondValue = sorted[1]?.[1] ?? 0;
    region.influence = normalized;
    region.contested = leaderId !== "neutral" && secondValue >= 25;
    region.controlPercent = leaderId === "neutral" ? 0 : leaderValue;
    if (!region.ownerId && leaderId !== "neutral" && leaderValue >= 65) {
      region.ownerId = leaderId;
    }
  }

  return { ...campaign, regions };
}

export function initializeCampaignFactions(campaign, { homeRegionId, aiOpponentCount = 1 } = {}) {
  let regions = campaign.regions.map((region) => ({ ...region, ownerId: null, influence: { neutral: 100 } }));
  const home = regions.find((region) => region.id === homeRegionId) ?? regions[0];
  const available = regions.filter((region) => region.id !== home?.id);
  const aiCount = Math.min(Math.max(0, aiOpponentCount), available.length);
  const factions = [
    { id: "player", name: "Player", type: "human", color: "sky", homeRegionId: home?.id, resources: 5 },
    ...available.slice(0, aiCount).map((region, index) => ({
      id: `ai-${index + 1}`,
      name: `AI ${index + 1}`,
      type: "ai",
      color: FACTION_COLORS[(index + 1) % FACTION_COLORS.length],
      homeRegionId: region.id,
      resources: 4
    }))
  ];

  for (const faction of factions) {
    const region = regions.find((item) => item.id === faction.homeRegionId);
    if (region) {
      region.ownerId = faction.id;
      region.armyStrength = faction.type === "human" ? 10 : 8;
    }
  }

  const campaignWithFactions = {
    ...campaign,
    factions,
    regions,
    armies: factions.map((faction, index) => {
      const region = regions.find((item) => item.id === faction.homeRegionId);
      return createArmy({ faction, region, campaign, index: index + 1, strength: faction.type === "human" ? 10 : 8 });
    }).filter(Boolean),
    influenceClaims: [],
    movementTrails: [],
    selectedHomeRegionId: home?.id,
    aiOpponentCount: aiCount,
    status: "active",
    events: [
      createCampaignEvent("campaign", `${campaign.root.name} campaign is live.`, campaign.root.id, "high"),
      createCampaignEvent("deployment", `${home?.name ?? "Home region"} selected as home region.`, home?.id, "normal"),
      ...campaign.events
    ].slice(0, 60)
  };

  return recomputeInfluence(campaignWithFactions);
}

export function deployArmyToRegion(campaign, regionId, factionId = "player") {
  const faction = campaign.factions.find((item) => item.id === factionId);
  const region = campaign.regions.find((item) => item.id === regionId);
  if (!faction || !region) return campaign;
  const count = campaign.armies.filter((army) => army.factionId === factionId).length + 1;
  const army = createArmy({ faction, region, campaign, index: count, strength: 4 });
  const next = {
    ...campaign,
    armies: [...campaign.armies, army],
    events: [createCampaignEvent("deployment", `${army.name} deployed in ${region.name}.`, region.id, "normal"), ...campaign.events].slice(0, 80)
  };
  return recomputeInfluence(next);
}

export function moveArmyToRegion(campaign, armyId, targetRegionId) {
  const army = campaign.armies.find((item) => item.id === armyId);
  const target = campaign.regions.find((item) => item.id === targetRegionId);
  const source = campaign.regions.find((item) => item.id === army?.regionId);
  if (!army || !target || !source || source.id === target.id) return campaign;

  const hostileTarget = target.ownerId && target.ownerId !== army.factionId;
  const order = hostileTarget ? "Attack" : target.ownerId === army.factionId ? "Redeploy" : "Expand";
  const trail = {
    id: `trail-${army.id}-${source.id}-${target.id}-${Date.now()}`,
    armyId: army.id,
    factionId: army.factionId,
    fromRegionId: source.id,
    toRegionId: target.id,
    strength: army.strength,
    order,
    createdTick: campaign.tick ?? 0
  };
  const claims = [
    ...(campaign.influenceClaims ?? []),
    { regionId: source.id, factionId: army.factionId, strength: Math.max(1, army.strength * 0.45), sourceArmyId: army.id },
    { regionId: target.id, factionId: army.factionId, strength: Math.max(1, army.strength * 1.3), sourceArmyId: army.id }
  ].slice(-80);

  const nextArmies = campaign.armies.map((item) => item.id === armyId ? {
    ...item,
    lastRegionId: source.id,
    regionId: target.id,
    order,
    status: hostileTarget ? "engaging" : "advancing",
    progress: 0,
    path: [source.id, target.id]
  } : item);
  const movedArmy = nextArmies.find((item) => item.id === armyId);
  const nextBase = {
    ...campaign,
    armies: nextArmies,
    influenceClaims: claims,
    movementTrails: [trail, ...(campaign.movementTrails ?? [])].slice(0, 28),
    events: [
      createCampaignEvent("movement", `${army.name} is expanding influence from ${source.name} into ${target.name}.`, target.id, "normal"),
      createCampaignEvent("influence", `${target.name}: ${army.factionId === "player" ? "your" : "enemy"} influence is spreading behind ${army.name}.`, target.id, "normal"),
      ...campaign.events
    ].slice(0, 80)
  };

  let next = recomputeInfluence(nextBase);
  const updatedTarget = next.regions.find((item) => item.id === target.id);
  if ((hostileTarget || updatedTarget?.contested) && updatedTarget) {
    next = {
      ...next,
      conflicts: [...next.conflicts, createConflict({ army: movedArmy, toRegion: updatedTarget, campaign: next })],
      events: [createCampaignEvent("conflict", `Frontline contact forming in ${updatedTarget.name}.`, updatedTarget.id, "high"), ...next.events].slice(0, 80)
    };
  }
  return next;
}

export function createConflict({ army, toRegion, campaign }) {
  const attacker = campaign.factions.find((faction) => faction.id === army.factionId);
  const defender = campaign.factions.find((faction) => faction.id === toRegion.ownerId);
  const defendingArmies = campaign.armies.filter((item) => item.regionId === toRegion.id && item.factionId === toRegion.ownerId);
  const defenderStrength = Math.max(toRegion.armyStrength, defendingArmies.reduce((sum, item) => sum + item.strength, 0));
  const total = Math.max(1, army.strength + defenderStrength);
  return {
    id: `conflict-${army.id}-${toRegion.id}-${Date.now()}`,
    name: `${army.name} at ${toRegion.name}`,
    attackerId: attacker?.id ?? "neutral",
    defenderId: defender?.id ?? "neutral",
    armyId: army.id,
    fromRegionId: army.regionId,
    toRegionId: toRegion.id,
    attackerStrength: army.strength,
    defenderStrength,
    estimatedAttackerWin: Math.round((army.strength / total) * 100),
    status: "pending",
    intensity: clamp(Math.round((army.strength + defenderStrength) * 5), 10, 100)
  };
}

export function autoResolveConflict(campaign, conflictId) {
  const conflict = campaign.conflicts.find((item) => item.id === conflictId);
  if (!conflict) return campaign;
  const attackerWins = conflict.estimatedAttackerWin >= 50;
  const regions = campaign.regions.map((region) => ({ ...region }));
  const armies = campaign.armies.map((army) => ({ ...army }));
  const target = regions.find((region) => region.id === conflict.toRegionId);
  const army = armies.find((item) => item.id === conflict.armyId);
  if (target && attackerWins) {
    target.ownerId = conflict.attackerId;
    target.armyStrength = Math.max(1, Math.round(conflict.attackerStrength * 0.55));
    if (army) {
      army.strength = target.armyStrength;
      army.status = "ready";
      army.order = "Hold";
    }
  } else if (target) {
    target.armyStrength = Math.max(1, Math.round(conflict.defenderStrength * 0.65));
    if (army) {
      army.strength = Math.max(1, Math.round(army.strength * 0.35));
      army.status = "retreating";
    }
  }
  const outcome = attackerWins ? `${target?.name ?? "Target"} captured.` : `${target?.name ?? "Target"} held by defenders.`;
  return recomputeInfluence({
    ...campaign,
    regions,
    armies,
    conflicts: campaign.conflicts.map((item) => item.id === conflictId ? { ...item, status: attackerWins ? "attacker-won" : "defender-held" } : item),
    events: [createCampaignEvent("battle", outcome, target?.id, attackerWins ? "high" : "normal"), ...campaign.events].slice(0, 80)
  });
}

export function simulateCampaignPulse(campaign) {
  if (campaign.status !== "active") return campaign;
  const factions = campaign.factions.map((faction) => ({ ...faction, resources: (faction.resources ?? 0) + 1 }));
  const nextTick = (campaign.tick ?? 0) + 1;
  const armies = (campaign.armies ?? []).map((army) => {
    if (!["advancing", "engaging"].includes(army.status)) return army;
    const progress = clamp((army.progress ?? 0) + 0.34, 0, 1);
    return { ...army, progress, status: progress >= 1 ? "ready" : army.status, order: progress >= 1 ? (army.order === "Attack" ? "Hold Front" : "Hold") : army.order };
  });
  const next = {
    ...campaign,
    tick: nextTick,
    factions,
    armies,
    events: [createCampaignEvent("pulse", `Campaign pulse ${nextTick}: resources, orders, and influence updated.`, campaign.root.id, "low"), ...campaign.events].slice(0, 80)
  };
  return recomputeInfluence(next);
}
