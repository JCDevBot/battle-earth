import * as THREE from "three";

const BANDS = [
  { id: "N", label: "Enemy Rear", role: "enemy-rear" },
  { id: "NO", label: "Enemy Operations", role: "enemy-mid" },
  { id: "C", label: "Contested Zone", role: "contested" },
  { id: "SO", label: "Friendly Operations", role: "friendly-mid" },
  { id: "S", label: "Friendly Rear", role: "friendly-rear" }
];

const COLUMNS = [
  { id: "W", label: "West" },
  { id: "C", label: "Center" },
  { id: "E", label: "East" }
];

const ROLE_COLORS = {
  "enemy-rear": 0xfb7185,
  "enemy-mid": 0xfda4af,
  contested: 0xf59e0b,
  "friendly-mid": 0x7dd3fc,
  "friendly-rear": 0x38bdf8
};

function makeLabelTexture(text, subtext = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
  ctx.strokeStyle = "rgba(226, 232, 240, 0.58)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(16, 22, 480, 112, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 46px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 256, 72);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText(subtext, 256, 110);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function ownerFromRole(role) {
  if (role.startsWith("friendly")) return "friendly";
  if (role.startsWith("enemy")) return "enemy";
  return "neutral";
}

export class BattlefieldGridManager {
  constructor(scene, { onBattlefieldGridStats } = {}) {
    this.scene = scene;
    this.callbacks = { onBattlefieldGridStats };
    this.group = new THREE.Group();
    this.group.name = "battlefield-grid";
    this.scene.add(this.group);
    this.visible = true;
    this.sectors = [];
    this.selectedSectorId = null;
    this.highlightMesh = null;
    this.sizeMeters = 1000;
    this.materials = [];
    this.geometries = [];
    this.textures = [];
  }

  clear() {
    this.group.clear();
    for (const material of this.materials) material.dispose?.();
    for (const geometry of this.geometries) geometry.dispose?.();
    for (const texture of this.textures) texture.dispose?.();
    this.materials = [];
    this.geometries = [];
    this.textures = [];
    this.sectors = [];
    this.highlightMesh = null;
    this.selectedSectorId = null;
    this.emitStats();
  }

  dispose() {
    this.clear();
    this.scene?.remove?.(this.group);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.group.visible = this.visible;
    this.emitStats();
  }

  build({ sizeMeters, terrain, pois = [], territoryCells = [] }) {
    this.clear();
    this.sizeMeters = sizeMeters ?? 1000;
    const half = this.sizeMeters * 0.5;
    const bandHeight = this.sizeMeters / BANDS.length;
    const colWidth = this.sizeMeters / COLUMNS.length;

    for (let row = 0; row < BANDS.length; row += 1) {
      const band = BANDS[row];
      const zMin = -half + row * bandHeight;
      const zMax = zMin + bandHeight;
      for (let col = 0; col < COLUMNS.length; col += 1) {
        const column = COLUMNS[col];
        const xMin = -half + col * colWidth;
        const xMax = xMin + colWidth;
        const center = new THREE.Vector2((xMin + xMax) / 2, (zMin + zMax) / 2);
        this.sectors.push({
          id: `${band.id}-${column.id}`,
          label: `${band.id}-${column.id}`,
          bandId: band.id,
          bandLabel: band.label,
          columnId: column.id,
          columnLabel: column.label,
          role: band.role,
          ownerHint: ownerFromRole(band.role),
          xMin,
          xMax,
          zMin,
          zMax,
          center,
          poiIds: [],
          pois: [],
          resourceValue: 0,
          strategicValue: 0,
          threatScore: 0,
          owner: ownerFromRole(band.role),
          territory: { friendly: 0, enemy: 0, contested: 0, neutral: 0 }
        });
      }
    }

    this.assignPoisToSectors(pois);
    this.assignTerritoryToSectors(territoryCells);
    this.scoreSectors();
    this.render(terrain);
    this.emitStats();
  }

  assignPoisToSectors(pois) {
    for (const poi of pois ?? []) {
      const sector = this.getSectorAt(poi.position?.x ?? poi.x ?? 0, poi.position?.y ?? poi.z ?? 0);
      if (!sector) continue;
      sector.poiIds.push(poi.id);
      sector.pois.push(poi);
      poi.sectorId = sector.id;
      poi.bandId = sector.bandId;
      poi.bandRole = sector.role;
    }
  }


  assignTerritoryToSectors(cells = []) {
    for (const cell of cells ?? []) {
      const sector = this.getSectorAt(cell.x, cell.z);
      if (!sector) continue;
      const owner = cell.owner ?? "neutral";
      sector.territory[owner] = (sector.territory[owner] ?? 0) + 1;
    }
  }

  scoreSectors() {
    for (const sector of this.sectors) {
      const territoryEntries = Object.entries(sector.territory ?? {});
      const dominant = territoryEntries.sort((a, b) => b[1] - a[1])[0];
      sector.owner = dominant?.[1] > 0 ? dominant[0] : sector.ownerHint;
      sector.resourceValue = Math.round(sector.pois.reduce((sum, poi) => sum + ((poi.resourceBonus ?? 0) * 30) + (poi.ownership === "friendly" || poi.ownership === "enemy" ? 8 : 0), 0));
      sector.strategicValue = Math.round(sector.pois.reduce((sum, poi) => sum + (poi.strategicValue ?? poi.priority ?? 0), 0));
      const enemyPois = sector.pois.filter((poi) => poi.ownership === "enemy" || poi.archetype === "hq").length;
      const crossingBonus = sector.pois.filter((poi) => poi.archetype === "strategic_crossing").length * 55;
      const majorBonus = sector.pois.filter((poi) => poi.tier === "major" || poi.tier === "hq").length * 24;
      const enemyInfluence = (sector.territory?.enemy ?? 0) * 2;
      const contestedBonus = (sector.territory?.contested ?? 0) * 3;
      sector.threatScore = Math.round(enemyPois * 42 + crossingBonus + majorBonus + enemyInfluence + contestedBonus + sector.strategicValue * 0.25);
    }
  }

  getSectorAt(x, z) {
    return this.sectors.find((sector) => x >= sector.xMin && x <= sector.xMax && z >= sector.zMin && z <= sector.zMax) ?? null;
  }

  selectSectorAtPoint(point) {
    const sector = this.getSectorAt(point.x, point.z);
    if (!sector) return null;
    this.selectedSectorId = sector.id;
    this.updateHighlight(sector);
    this.emitStats();
    return sector;
  }

  getSelectedSector() {
    return this.sectors.find((sector) => sector.id === this.selectedSectorId) ?? null;
  }

  updateHighlight(sector) {
    if (!this.highlightMesh) return;
    this.highlightMesh.position.set(sector.center.x, 1.2, sector.center.y);
    this.highlightMesh.scale.set(sector.xMax - sector.xMin, sector.zMax - sector.zMin, 1);
    this.highlightMesh.visible = true;
  }

  render(terrain) {
    const half = this.sizeMeters * 0.5;
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.38, depthWrite: false });
    this.materials.push(lineMaterial);

    const makeLine = (points) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.geometries.push(geometry);
      const line = new THREE.Line(geometry, lineMaterial);
      line.renderOrder = 12;
      this.group.add(line);
    };

    for (let i = 0; i <= COLUMNS.length; i += 1) {
      const x = -half + i * (this.sizeMeters / COLUMNS.length);
      makeLine([new THREE.Vector3(x, 1.1, -half), new THREE.Vector3(x, 1.1, half)]);
    }
    for (let i = 0; i <= BANDS.length; i += 1) {
      const z = -half + i * (this.sizeMeters / BANDS.length);
      makeLine([new THREE.Vector3(-half, 1.1, z), new THREE.Vector3(half, 1.1, z)]);
    }

    for (const sector of this.sectors) {
      const width = sector.xMax - sector.xMin;
      const height = sector.zMax - sector.zMin;
      const geometry = new THREE.PlaneGeometry(width, height);
      this.geometries.push(geometry);
      const material = new THREE.MeshBasicMaterial({
        color: ROLE_COLORS[sector.role] ?? 0x94a3b8,
        transparent: true,
        opacity: sector.role === "contested" ? 0.055 : 0.035,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      this.materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(sector.center.x, 0.9, sector.center.y);
      mesh.renderOrder = 7;
      mesh.userData = { feature: "battlefield-grid-sector", sectorId: sector.id };
      this.group.add(mesh);

      const labelTexture = makeLabelTexture(sector.label, sector.bandLabel);
      this.textures.push(labelTexture);
      const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false, depthTest: false });
      this.materials.push(labelMaterial);
      const sprite = new THREE.Sprite(labelMaterial);
      const y = (terrain?.getWorldHeight?.(sector.center.x, sector.center.y) ?? 0) + 18;
      sprite.position.set(sector.center.x, y, sector.center.y);
      sprite.scale.set(72, 25, 1);
      sprite.renderOrder = 50;
      this.group.add(sprite);
    }

    const highlightGeometry = new THREE.PlaneGeometry(1, 1);
    this.geometries.push(highlightGeometry);
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
    this.materials.push(highlightMaterial);
    this.highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
    this.highlightMesh.rotation.x = -Math.PI / 2;
    this.highlightMesh.visible = false;
    this.highlightMesh.renderOrder = 20;
    this.group.add(this.highlightMesh);
  }

  getStats() {
    const selected = this.getSelectedSector();
    const byRole = this.sectors.reduce((acc, sector) => {
      acc[sector.role] = (acc[sector.role] ?? 0) + 1;
      return acc;
    }, {});
    const occupiedSectors = this.sectors.filter((sector) => sector.poiIds.length > 0).length;
    const rankedTargets = [...this.sectors].sort((a, b) => b.threatScore - a.threatScore).slice(0, 5).map((sector) => ({ id: sector.id, owner: sector.owner, threatScore: sector.threatScore, strategicValue: sector.strategicValue, resourceValue: sector.resourceValue, poiCount: sector.poiIds.length }));
    return {
      enabled: this.visible,
      rows: BANDS.length,
      columns: COLUMNS.length,
      total: this.sectors.length,
      occupiedSectors,
      byRole,
      selected: selected ? {
        id: selected.id,
        band: selected.bandLabel,
        column: selected.columnLabel,
        role: selected.role,
        ownerHint: selected.ownerHint,
        owner: selected.owner,
        poiCount: selected.poiIds.length,
        poiIds: selected.poiIds,
        resourceValue: selected.resourceValue,
        strategicValue: selected.strategicValue,
        threatScore: selected.threatScore,
        pois: selected.pois.map((poi) => ({ id: poi.id, label: poi.label, archetype: poi.archetype, tier: poi.tier, ownership: poi.ownership, strategicValue: Math.round(poi.strategicValue ?? 0) }))
      } : null,
      rankedTargets
    };
  }

  emitStats() {
    this.callbacks.onBattlefieldGridStats?.(this.getStats());
  }
}
