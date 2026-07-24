const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const DAMAGE_STATE_FACTOR = {
  intact: 1,
  damaged: 0.72,
  heavy: 0.48,
  critical: 0.3,
  destroyed: 0.18
};

const BASE_METADATA = {
  material: "generic",
  cover: 0,
  concealment: 0,
  losBlock: 0,
  movementBlock: 0,
  movementPenalty: 0,
  flammability: 0,
  durability: 0.25,
  destructible: false,
  occupiable: false,
  tacticalClass: "neutral",
  label: "neutral"
};

function stateScale(value, state, destroyedValue = 0) {
  if (state === "destroyed") return destroyedValue;
  return value * (DAMAGE_STATE_FACTOR[state] ?? 1);
}

function classifyProp(tags = {}) {
  const propType = tags.propType ?? "prop";
  if (propType === "fence") {
    return {
      material: "wood/metal",
      cover: 0.25,
      concealment: 0.12,
      losBlock: 0.12,
      movementBlock: 0.32,
      movementPenalty: 0.3,
      flammability: 0.25,
      durability: 0.35,
      destructible: true,
      tacticalClass: "linear obstacle",
      label: "fence"
    };
  }
  if (propType === "parking" || propType === "parked-car") {
    return {
      material: "vehicle/metal",
      cover: 0.45,
      concealment: 0.25,
      losBlock: 0.18,
      movementBlock: 0.2,
      movementPenalty: 0.18,
      flammability: 0.35,
      durability: 0.45,
      destructible: true,
      tacticalClass: "vehicle cover",
      label: "vehicle"
    };
  }
  if (propType === "driveway") {
    return {
      material: "pavement",
      cover: 0,
      concealment: 0,
      losBlock: 0,
      movementBlock: 0,
      movementPenalty: -0.08,
      flammability: 0,
      durability: 0.6,
      destructible: false,
      tacticalClass: "movement surface",
      label: "paved access"
    };
  }
  if (propType === "streetlight" || propType === "utility-pole") {
    return {
      material: "metal/wood pole",
      cover: 0.1,
      concealment: 0.04,
      losBlock: 0.06,
      movementBlock: 0.05,
      movementPenalty: 0.02,
      flammability: propType === "utility-pole" ? 0.35 : 0.05,
      durability: 0.35,
      destructible: true,
      tacticalClass: "light prop",
      label: propType
    };
  }
  if (propType === "rock" || propType === "boulder") {
    return {
      material: "stone",
      cover: 0.72,
      concealment: 0.2,
      losBlock: 0.35,
      movementBlock: 0.45,
      movementPenalty: 0.35,
      flammability: 0,
      durability: 0.9,
      destructible: false,
      tacticalClass: "hard cover",
      label: "rock cover"
    };
  }
  return {
    material: "prop",
    cover: 0.15,
    concealment: 0.1,
    losBlock: 0.08,
    movementBlock: 0.15,
    movementPenalty: 0.12,
    flammability: 0.2,
    durability: 0.25,
    destructible: true,
    tacticalClass: "minor prop",
    label: "minor prop"
  };
}

export function tacticalMetadataForFeature(feature = {}) {
  const category = feature.category ?? "unknown";
  const tags = feature.tags ?? {};
  const state = feature.state ?? "intact";
  let meta = { ...BASE_METADATA };

  if (category === "building") {
    meta = {
      material: "structure",
      cover: 0.95,
      concealment: 0.9,
      losBlock: 1,
      movementBlock: 1,
      movementPenalty: 1,
      flammability: tags.building === "garage" ? 0.35 : 0.25,
      durability: 0.85,
      destructible: true,
      occupiable: state !== "destroyed",
      tacticalClass: "hard cover",
      label: "building"
    };
  } else if (category === "bridge") {
    meta = {
      material: "bridge",
      cover: 0.25,
      concealment: 0.08,
      losBlock: 0.08,
      movementBlock: 0,
      movementPenalty: 0.05,
      flammability: 0.05,
      durability: 0.8,
      destructible: true,
      tacticalClass: "route",
      label: "bridge"
    };
  } else if (category === "road") {
    meta = {
      material: "pavement",
      cover: 0.02,
      concealment: 0,
      losBlock: 0,
      movementBlock: 0,
      movementPenalty: 0,
      flammability: 0,
      durability: 0.55,
      destructible: true,
      tacticalClass: tags.generated === "intersection" ? "junction" : "route",
      label: tags.generated === "intersection" ? "junction" : "road"
    };
  } else if (category === "tree") {
    meta = {
      material: "living wood",
      cover: 0.24,
      concealment: 0.72,
      losBlock: 0.42,
      movementBlock: 0.04,
      movementPenalty: 0.34,
      flammability: 0.65,
      durability: 0.35,
      destructible: true,
      tacticalClass: "concealment",
      label: "tree canopy"
    };
  } else if (category === "prop") {
    meta = classifyProp(tags);
  }

  const stateFactor = DAMAGE_STATE_FACTOR[state] ?? 1;
  const destroyed = state === "destroyed";
  return {
    ...BASE_METADATA,
    ...meta,
    cover: clamp01(stateScale(meta.cover, state, category === "building" ? 0.42 : 0.06)),
    concealment: clamp01(stateScale(meta.concealment, state, category === "tree" ? 0.12 : 0.03)),
    losBlock: clamp01(stateScale(meta.losBlock, state, category === "building" ? 0.22 : 0.03)),
    movementBlock: clamp01(destroyed ? (category === "bridge" ? 1 : Math.min(0.35, meta.movementBlock)) : meta.movementBlock),
    movementPenalty: clamp01(destroyed ? Math.max(0.18, meta.movementPenalty * 0.75) : meta.movementPenalty),
    durability: clamp01(meta.durability * stateFactor),
    destructible: Boolean(meta.destructible),
    occupiable: Boolean(meta.occupiable && !destroyed),
    state
  };
}
