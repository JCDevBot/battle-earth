export const APP_STAGES = Object.freeze({
  GLOBE: "globe",
  CAMPAIGN: "campaign",
  TACTICAL: "tactical",
});

export function getStageForLocation(location) {
  if (!location) return APP_STAGES.GLOBE;

  return location.battleRequest?.launchType === APP_STAGES.CAMPAIGN
    ? APP_STAGES.CAMPAIGN
    : APP_STAGES.TACTICAL;
}

export function canRenderStage(stage, location) {
  if (stage === APP_STAGES.CAMPAIGN) {
    return Boolean(location?.battleRequest);
  }

  if (stage === APP_STAGES.TACTICAL) {
    return Boolean(location);
  }

  return stage === APP_STAGES.GLOBE;
}
