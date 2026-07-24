import * as THREE from "three";

/*
  Phase 3.1 road pass:
  - Widths below are HALF widths in world meters. renderStrip expands both sides.
  - Intersections are compact convex patches made from actual road approach directions.
  - Markings are trimmed at segment ends so dashed lines do not run through junctions.
*/
export const ROAD_STYLE_BY_TYPE = {
  motorway: {
    halfWidth: 8.5,
    shoulder: 1.8,
    centerline: false,
    edgeLines: true,
    sidewalks: false,
    lanes: 4,
    markingTrim: 18,
  },
  trunk: {
    halfWidth: 7.5,
    shoulder: 1.6,
    centerline: false,
    edgeLines: true,
    sidewalks: false,
    lanes: 4,
    markingTrim: 16,
  },
  primary: {
    halfWidth: 6.2,
    shoulder: 1.1,
    centerline: false,
    edgeLines: true,
    sidewalks: true,
    lanes: 2,
    markingTrim: 14,
  },
  secondary: {
    halfWidth: 5.2,
    shoulder: 0.9,
    centerline: false,
    edgeLines: true,
    sidewalks: true,
    lanes: 2,
    markingTrim: 12,
  },
  tertiary: {
    halfWidth: 4.4,
    shoulder: 0.7,
    centerline: false,
    edgeLines: true,
    sidewalks: true,
    lanes: 2,
    markingTrim: 10,
  },
  residential: {
    halfWidth: 3.2,
    shoulder: 0.35,
    centerline: false,
    edgeLines: false,
    sidewalks: true,
    lanes: 1,
    markingTrim: 7,
  },
  living_street: {
    halfWidth: 2.8,
    shoulder: 0.25,
    centerline: false,
    edgeLines: false,
    sidewalks: true,
    lanes: 1,
    markingTrim: 6,
  },
  service: {
    halfWidth: 2.1,
    shoulder: 0.2,
    centerline: false,
    edgeLines: false,
    sidewalks: false,
    lanes: 1,
    markingTrim: 5,
  },
  footway: {
    halfWidth: 0.85,
    shoulder: 0,
    centerline: false,
    edgeLines: false,
    sidewalks: false,
    lanes: 0,
    markingTrim: 2,
  },
  path: {
    halfWidth: 0.85,
    shoulder: 0,
    centerline: false,
    edgeLines: false,
    sidewalks: false,
    lanes: 0,
    markingTrim: 2,
  },
  cycleway: {
    halfWidth: 1.1,
    shoulder: 0,
    centerline: false,
    edgeLines: false,
    sidewalks: false,
    lanes: 0,
    markingTrim: 2,
  },
  default: {
    halfWidth: 3,
    shoulder: 0.35,
    centerline: false,
    edgeLines: false,
    sidewalks: false,
    lanes: 1,
    markingTrim: 6,
  },
};

export function convexHull(points) {
  const unique = [];
  const seen = new Set();
  for (const point of points) {
    const key = `${point.x.toFixed(2)}:${point.y.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(point.clone());
    }
  }
  if (unique.length <= 3) return unique;

  unique.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (origin, a, b) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower = [];
  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export class RoadBuilder {
  constructor(owner) {
    this.owner = owner;
  }

  createRoad(way, nodes) {
    const host = this.owner;
    const points = host.getWayPoints(way, nodes);
    if (points.length < 2) return;

    const style =
      ROAD_STYLE_BY_TYPE[way.tags.highway] ?? ROAD_STYLE_BY_TYPE.default;
    const isBridge = way.tags.bridge === "yes";
    const roadMeshes = [];

    if (style.sidewalks && host.materials.sidewalk) {
      const sidewalkMesh = host.renderPath(
        points,
        host.materials.sidewalk,
        style.halfWidth + style.shoulder + 1.35,
        isBridge,
        0.37,
      );
      if (sidewalkMesh) roadMeshes.push(sidewalkMesh);
    }

    if (style.shoulder > 0 && host.materials.roadShoulder) {
      const shoulderMesh = host.renderPath(
        points,
        host.materials.roadShoulder,
        style.halfWidth + style.shoulder,
        isBridge,
        0.42,
      );
      if (shoulderMesh) roadMeshes.push(shoulderMesh);
    }

    const roadMesh = host.renderPath(
      points,
      host.materials.road,
      style.halfWidth,
      isBridge,
      0.5,
    );
    if (roadMesh) roadMeshes.push(roadMesh);

    if (style.edgeLines && host.materials.roadEdgeLine) {
      roadMeshes.push(
        ...this.renderOffsetDashedPath(
          points,
          host.materials.roadEdgeLine,
          0.09,
          Math.max(0.8, style.halfWidth - 0.45),
          isBridge,
          0.61,
          999,
          0,
        ),
      );
      roadMeshes.push(
        ...this.renderOffsetDashedPath(
          points,
          host.materials.roadEdgeLine,
          0.09,
          -Math.max(0.8, style.halfWidth - 0.45),
          isBridge,
          0.61,
          999,
          0,
        ),
      );
    }

    if (style.centerline && host.materials.roadCenterline) {
      roadMeshes.push(
        ...this.renderOffsetDashedPath(
          points,
          host.materials.roadCenterline,
          0.16,
          0,
          isBridge,
          0.63,
          14,
          9,
        ),
      );
    }

    if (roadMeshes.length > 0) {
      const center = points
        .reduce((sum, point) => sum.add(point), new THREE.Vector2())
        .divideScalar(points.length);
      const length = points.reduce(
        (total, point, index) =>
          index === 0 ? 0 : total + point.distanceTo(points[index - 1]),
        0,
      );
      host.destruction?.register({
        id: `road:${way.id}`,
        category: isBridge ? "bridge" : "road",
        meshes: roadMeshes.filter(Boolean),
        position: new THREE.Vector3(
          center.x,
          host.terrain.getHeight(
            center.x,
            center.y,
            host.centerLat,
            host.centerLon,
            host.scaleFactor,
          ) + 0.5,
          center.y,
        ),
        bounds: { radius: Math.max(8, Math.min(90, length / 2)) },
        maxHealth: isBridge
          ? 180
          : Math.max(
              70,
              Math.min(160, 45 + length * 0.18 + style.halfWidth * 7),
            ),
        tags: way.tags,
      });
    }

    for (let i = 0; i < points.length - 1; i += 1) {
      host.roadSegments.push({
        a: points[i],
        b: points[i + 1],
        width: style.halfWidth + style.shoulder + (style.sidewalks ? 1.35 : 0),
        highway: way.tags.highway,
        tags: way.tags,
      });
    }

    for (let i = 0; i < points.length; i += 1) {
      if (i > 0)
        this.registerRoadJunction(points[i], points[i - 1], style, isBridge);
      if (i < points.length - 1) {
        this.registerRoadJunction(points[i], points[i + 1], style, isBridge);
      }
    }
  }

  roadJunctionKey(point) {
    return `${Math.round(point.x / 3) * 3}:${Math.round(point.y / 3) * 3}`;
  }

  registerRoadJunction(point, neighbor, style, isBridge = false) {
    const host = this.owner;
    if (isBridge || !neighbor) return;
    const key = this.roadJunctionKey(point);
    const existing = host.roadJunctions.get(key) ?? {
      point: point.clone(),
      count: 0,
      width: 0,
      approaches: [],
      highways: new Set(),
    };

    const direction = new THREE.Vector2().subVectors(neighbor, point);
    if (direction.lengthSq() === 0) return;
    direction.normalize();

    const halfWidth =
      style.halfWidth + style.shoulder + (style.sidewalks ? 1.35 : 0);
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);
    const reach = Math.max(halfWidth * 1.05, 4.5);
    existing.approaches.push({
      dir: direction.clone(),
      halfWidth,
      left: point
        .clone()
        .addScaledVector(direction, reach)
        .addScaledVector(perpendicular, halfWidth),
      right: point
        .clone()
        .addScaledVector(direction, reach)
        .addScaledVector(perpendicular, -halfWidth),
    });
    existing.count += 1;
    existing.width = Math.max(existing.width, halfWidth);
    existing.highways.add(style.lanes >= 2 ? "major" : "minor");
    host.roadJunctions.set(key, existing);
  }

  createIntersectionPads() {
    const host = this.owner;
    let created = 0;
    for (const junction of host.roadJunctions.values()) {
      if (junction.count < 3 || junction.approaches.length < 2) continue;

      const patchPoints = [junction.point.clone()];
      for (const approach of junction.approaches) {
        patchPoints.push(approach.left, approach.right);
      }

      const hull = convexHull(patchPoints);
      if (hull.length < 3) continue;

      const radius = Math.max(
        ...hull.map((point) => point.distanceTo(junction.point)),
      );
      if (radius > 28) continue;

      const y =
        host.terrain.getHeight(
          junction.point.x,
          junction.point.y,
          host.centerLat,
          host.centerLon,
          host.scaleFactor,
        ) + 0.565;
      const geometry = new THREE.ShapeGeometry(new THREE.Shape(hull));
      const mesh = new THREE.Mesh(geometry, host.materials.road);
      mesh.rotateX(Math.PI / 2);
      mesh.position.y = y;
      mesh.userData = { feature: "road-intersection" };
      host.group.add(mesh);

      host.destruction?.register({
        id: `road-junction:${created}:${Math.round(junction.point.x)}:${Math.round(junction.point.y)}`,
        category: "road",
        meshes: [mesh],
        position: new THREE.Vector3(junction.point.x, y, junction.point.y),
        bounds: { radius },
        maxHealth: 95 + radius * 1.5,
        tags: { generated: "intersection" },
      });
      created += 1;
    }
  }

  renderOffsetDashedPath(
    points,
    material,
    width,
    offset,
    isBridge = false,
    yOffset = 0.62,
    dashLength = 12,
    gapLength = 8,
  ) {
    const meshes = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const segment = new THREE.Vector2().subVectors(b, a);
      const length = segment.length();
      if (length <= 0) continue;
      const direction = segment.clone().normalize();
      const perpendicular = new THREE.Vector2(
        -direction.y,
        direction.x,
      ).multiplyScalar(offset);
      const stride = dashLength + gapLength;
      const solidLength = gapLength === 0 ? length : dashLength;

      const trim = Math.min(
        length * 0.42,
        Math.max(3, Math.abs(offset) + width + 5),
      );
      for (let distance = trim; distance < length - trim; distance += stride) {
        const start = distance;
        const stop = Math.min(length - trim, distance + solidLength);
        if (stop - start < 0.8) continue;

        const p1 = new THREE.Vector2(
          a.x + direction.x * start + perpendicular.x,
          a.y + direction.y * start + perpendicular.y,
        );
        const p2 = new THREE.Vector2(
          a.x + direction.x * stop + perpendicular.x,
          a.y + direction.y * stop + perpendicular.y,
        );
        const mesh = this.owner.renderPath(
          [p1, p2],
          material,
          width,
          isBridge,
          yOffset,
        );
        if (mesh) meshes.push(mesh);
        if (gapLength === 0) break;
      }
    }
    return meshes;
  }
}
