import * as THREE from "three";

const DEFAULT_CELL_SIZE = 18;
const BLOCKED_COST = Infinity;

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function stateFactor(state) {
  if (state === "destroyed") return 0.15;
  if (state === "critical") return 0.35;
  if (state === "heavy") return 0.55;
  if (state === "damaged") return 0.78;
  return 1;
}

function featureNavigationProfile(feature) {
  const state = feature?.state ?? "intact";
  const tags = feature?.tags ?? {};

  if (feature.category === "building") {
    return state === "destroyed"
      ? { blocked: false, cost: 7.5, label: "rubble" }
      : { blocked: true, cost: BLOCKED_COST, label: "building" };
  }

  if (feature.category === "bridge") {
    return state === "destroyed"
      ? { blocked: true, cost: BLOCKED_COST, label: "destroyed bridge" }
      : { blocked: false, cost: 0.85, label: "bridge" };
  }

  if (feature.category === "road") {
    return state === "destroyed"
      ? { blocked: false, cost: 4.2, label: "cratered road" }
      : { blocked: false, cost: 0.65, label: "road" };
  }

  if (feature.category === "tree") {
    return state === "destroyed"
      ? { blocked: false, cost: 2.4, label: "fallen trees" }
      : { blocked: false, cost: 3.6 * stateFactor(state), label: "vegetation" };
  }

  if (feature.category === "prop") {
    const propType = tags.propType ?? "prop";
    if (propType === "driveway" || propType === "parking") return { blocked: false, cost: 0.8, label: "paved" };
    if (propType === "fence") return state === "destroyed"
      ? { blocked: false, cost: 1.8, label: "broken fence" }
      : { blocked: false, cost: 3.5, label: "fence" };
    return state === "destroyed"
      ? { blocked: false, cost: 2.0, label: "debris" }
      : { blocked: false, cost: 1.5, label: "prop" };
  }

  return { blocked: false, cost: 1.8, label: "ground" };
}

class PriorityQueue {
  constructor() {
    this.items = [];
  }

  push(value, priority) {
    this.items.push({ value, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  pop() {
    return this.items.shift()?.value ?? null;
  }

  get size() {
    return this.items.length;
  }
}

export class NavigationManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.sizeMeters = 1000;
    this.cellSize = DEFAULT_CELL_SIZE;
    this.cellsPerSide = 0;
    this.origin = 0;
    this.cells = [];
    this.pathRequests = 0;
    this.pathSuccess = 0;
    this.pathFailed = 0;
    this.lastPathLength = 0;
    this.lastExpanded = 0;
  }

  build(sizeMeters = 1000, destructionManager = null, getGroundHeight = null) {
    this.sizeMeters = sizeMeters;
    this.cellSize = sizeMeters > 1400 ? 24 : DEFAULT_CELL_SIZE;
    this.cellsPerSide = Math.max(16, Math.ceil(sizeMeters / this.cellSize));
    this.origin = -this.cellsPerSide * this.cellSize * 0.5;
    this.cells = new Array(this.cellsPerSide * this.cellsPerSide);

    for (let z = 0; z < this.cellsPerSide; z++) {
      for (let x = 0; x < this.cellsPerSide; x++) {
        const world = this.cellToWorld(x, z);
        this.cells[this.index(x, z)] = {
          x,
          z,
          worldX: world.x,
          worldZ: world.z,
          worldY: getGroundHeight?.(world.x, world.z) ?? 0,
          blocked: false,
          cost: 1.6,
          cover: 0,
          label: "ground"
        };
      }
    }

    this.updateFromDestruction(destructionManager, false);
    this.emitStats();
  }

  updateFromDestruction(destructionManager, emit = true) {
    if (!this.cells.length) return;

    for (const cell of this.cells) {
      cell.blocked = false;
      cell.cost = 1.6;
      cell.cover = 0;
      cell.label = "ground";
    }

    for (const feature of destructionManager?.features?.values?.() ?? []) {
      const profile = featureNavigationProfile(feature);
      const radius = Math.max(3, feature.bounds?.radius ?? 6);
      const influenceRadius = Math.min(140, radius + (feature.category === "building" ? 2 : 6));
      const min = this.worldToCell(feature.position.x - influenceRadius, feature.position.z - influenceRadius);
      const max = this.worldToCell(feature.position.x + influenceRadius, feature.position.z + influenceRadius);

      for (let z = min.z; z <= max.z; z++) {
        for (let x = min.x; x <= max.x; x++) {
          const cell = this.getCell(x, z);
          if (!cell) continue;
          const dist = Math.hypot(cell.worldX - feature.position.x, cell.worldZ - feature.position.z);
          if (dist > influenceRadius) continue;
          const edgeFalloff = Math.max(0.25, 1 - Math.max(0, dist - radius) / Math.max(1, influenceRadius - radius));
          if (profile.blocked && dist <= radius + this.cellSize * 0.35) {
            cell.blocked = true;
            cell.cost = BLOCKED_COST;
            cell.label = profile.label;
            continue;
          }

          if (!cell.blocked) {
            const candidateCost = 1 + (profile.cost - 1) * edgeFalloff;
            if (profile.cost < 1) {
              cell.cost = Math.min(cell.cost, Math.max(0.55, candidateCost));
            } else {
              cell.cost = Math.max(cell.cost, candidateCost);
            }
            if (profile.label !== "ground") cell.label = profile.label;
          }

          if (feature.category === "building") cell.cover = Math.max(cell.cover, feature.state === "destroyed" ? 0.35 : 0.9);
          if (feature.category === "tree") cell.cover = Math.max(cell.cover, feature.state === "destroyed" ? 0.1 : 0.42);
          if (feature.category === "prop") cell.cover = Math.max(cell.cover, 0.24);
        }
      }
    }

    if (emit) this.emitStats();
  }

  index(x, z) {
    return z * this.cellsPerSide + x;
  }

  getCell(x, z) {
    if (x < 0 || z < 0 || x >= this.cellsPerSide || z >= this.cellsPerSide) return null;
    return this.cells[this.index(x, z)];
  }

  cellToWorld(x, z) {
    return {
      x: this.origin + (x + 0.5) * this.cellSize,
      z: this.origin + (z + 0.5) * this.cellSize
    };
  }

  worldToCell(x, z) {
    return {
      x: Math.max(0, Math.min(this.cellsPerSide - 1, Math.floor((x - this.origin) / this.cellSize))),
      z: Math.max(0, Math.min(this.cellsPerSide - 1, Math.floor((z - this.origin) / this.cellSize)))
    };
  }

  nearestTraversable(cellCoord, maxRadius = 7) {
    const start = this.getCell(cellCoord.x, cellCoord.z);
    if (start && !start.blocked) return start;

    for (let radius = 1; radius <= maxRadius; radius++) {
      let best = null;
      let bestDist = Infinity;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
          const cell = this.getCell(cellCoord.x + dx, cellCoord.z + dz);
          if (!cell || cell.blocked) continue;
          const d = Math.hypot(dx, dz);
          if (d < bestDist) {
            best = cell;
            bestDist = d;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  findPath(start, end) {
    this.pathRequests += 1;
    if (!this.cells.length) {
      this.pathFailed += 1;
      this.emitStats();
      return [start.clone(), end.clone()];
    }

    const startCell = this.nearestTraversable(this.worldToCell(start.x, start.z));
    const endCell = this.nearestTraversable(this.worldToCell(end.x, end.z));
    if (!startCell || !endCell) {
      this.pathFailed += 1;
      this.emitStats();
      return null;
    }

    const startKey = this.index(startCell.x, startCell.z);
    const endKey = this.index(endCell.x, endCell.z);
    const frontier = new PriorityQueue();
    frontier.push(startKey, 0);

    const cameFrom = new Map([[startKey, null]]);
    const costSoFar = new Map([[startKey, 0]]);
    let expanded = 0;
    const neighbors = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
    ];

    while (frontier.size) {
      const currentKey = frontier.pop();
      expanded += 1;
      if (currentKey === endKey) break;
      const current = this.cells[currentKey];

      for (const [dx, dz, stepDistance] of neighbors) {
        const next = this.getCell(current.x + dx, current.z + dz);
        if (!next || next.blocked) continue;

        // Prevent clipping corners through buildings.
        if (dx !== 0 && dz !== 0) {
          const sideA = this.getCell(current.x + dx, current.z);
          const sideB = this.getCell(current.x, current.z + dz);
          if (sideA?.blocked || sideB?.blocked) continue;
        }

        const nextKey = this.index(next.x, next.z);
        const moveCost = stepDistance * this.cellSize * Math.max(0.55, next.cost);
        const newCost = (costSoFar.get(currentKey) ?? Infinity) + moveCost;
        if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
          costSoFar.set(nextKey, newCost);
          const heuristic = Math.hypot(endCell.x - next.x, endCell.z - next.z) * this.cellSize;
          frontier.push(nextKey, newCost + heuristic);
          cameFrom.set(nextKey, currentKey);
        }
      }

      if (expanded > 9000) break;
    }

    this.lastExpanded = expanded;

    if (!cameFrom.has(endKey)) {
      this.pathFailed += 1;
      this.lastPathLength = 0;
      this.emitStats();
      return null;
    }

    const cells = [];
    let current = endKey;
    while (current !== null) {
      cells.push(this.cells[current]);
      current = cameFrom.get(current);
    }
    cells.reverse();

    const points = this.smoothPath(cells.map((cell) => new THREE.Vector3(cell.worldX, cell.worldY, cell.worldZ)));
    points[0] = start.clone();
    points[points.length - 1] = end.clone();

    this.pathSuccess += 1;
    this.lastPathLength = Math.max(0, points.length - 1);
    this.emitStats();
    return points;
  }

  hasLineOfTravel(a, b) {
    const distance = distance2D(a, b);
    const steps = Math.max(2, Math.ceil(distance / (this.cellSize * 0.5)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = THREE.MathUtils.lerp(a.x, b.x, t);
      const z = THREE.MathUtils.lerp(a.z, b.z, t);
      const cell = this.getCell(this.worldToCell(x, z).x, this.worldToCell(x, z).z);
      if (!cell || cell.blocked) return false;
    }
    return true;
  }

  smoothPath(points) {
    if (points.length <= 2) return points;
    const result = [points[0]];
    let anchorIndex = 0;

    while (anchorIndex < points.length - 1) {
      let nextIndex = points.length - 1;
      for (; nextIndex > anchorIndex + 1; nextIndex--) {
        if (this.hasLineOfTravel(points[anchorIndex], points[nextIndex])) break;
      }
      result.push(points[nextIndex]);
      anchorIndex = nextIndex;
    }

    return result;
  }

  getStats() {
    const total = this.cells.length;
    const blocked = this.cells.reduce((sum, cell) => sum + (cell.blocked ? 1 : 0), 0);
    const highCost = this.cells.reduce((sum, cell) => sum + (!cell.blocked && cell.cost >= 3 ? 1 : 0), 0);
    return {
      enabled: Boolean(total),
      cells: total,
      cellSize: this.cellSize,
      blocked,
      highCost,
      pathRequests: this.pathRequests,
      pathSuccess: this.pathSuccess,
      pathFailed: this.pathFailed,
      lastPathLength: this.lastPathLength,
      lastExpanded: this.lastExpanded
    };
  }

  emitStats() {
    this.callbacks.onNavigationStats?.(this.getStats());
  }
}
