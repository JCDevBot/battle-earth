export const APP_STAGES = Object.freeze({
  GLOBE: "globe",
  CAMPAIGN: "campaign",
  TACTICAL: "tactical",
});

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
