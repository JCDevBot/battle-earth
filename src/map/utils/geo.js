export const METERS_PER_DEGREE_LAT = 111139;

export function boundsFromCenter(lat, lon, sizeMeters, widthMeters = sizeMeters, depthMeters = sizeMeters) {
  const mapWidth = Number(widthMeters) || Number(sizeMeters) || 1000;
  const mapDepth = Number(depthMeters) || Number(sizeMeters) || mapWidth;
  const halfLat = (mapDepth / 2) / METERS_PER_DEGREE_LAT;
  const halfLon = (mapWidth / 2) / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));

  return {
    south: lat - halfLat,
    west: lon - halfLon,
    north: lat + halfLat,
    east: lon + halfLon
  };
}
