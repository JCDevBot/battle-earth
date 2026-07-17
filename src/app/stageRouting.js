export const APP_STAGES = Object.freeze({
  GLOBE: "globe",
  CAMPAIGN: "campaign",
  TACTICAL: "tactical",
});

export const DEFAULT_TACTICAL_SIZE_METERS = 350;
const MIN_TACTICAL_SIZE_METERS = 100;
const MAX_TACTICAL_SIZE_METERS = 5000;

export function hasValidLocationCoordinates(location) {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function normalizeSelectedLocation(location) {
  if (!hasValidLocationCoordinates(location)) return null;

  const requestedSize = Number(location?.sizeMeters);
  const sizeMeters =
    Number.isFinite(requestedSize) &&
    requestedSize >= MIN_TACTICAL_SIZE_METERS &&
    requestedSize <= MAX_TACTICAL_SIZE_METERS
      ? requestedSize
      : DEFAULT_TACTICAL_SIZE_METERS;

  return {
    ...location,
    lat: Number(location.lat),
    lon: Number(location.lon),
    sizeMeters,
  };
}

export function getStageForLocation(location) {
  if (!hasValidLocationCoordinates(location)) return APP_STAGES.GLOBE;

  return location.battleRequest?.launchType === APP_STAGES.CAMPAIGN
    ? APP_STAGES.CAMPAIGN
    : APP_STAGES.TACTICAL;
}

export function canRenderStage(stage, location) {
  if (stage === APP_STAGES.CAMPAIGN) {
    return Boolean(
      hasValidLocationCoordinates(location) && location?.battleRequest,
    );
  }

  if (stage === APP_STAGES.TACTICAL) {
    return hasValidLocationCoordinates(location);
  }

  return stage === APP_STAGES.GLOBE;
}
