function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

export function validateContextualVisualContract(scenario, diagnostics = {}) {
  const errors = [];
  const playableWidth = numberOrNull(diagnostics.playableWidthMeters);
  const playableDepth = numberOrNull(diagnostics.playableDepthMeters);
  const renderWidth = numberOrNull(diagnostics.renderWidthMeters);
  const renderDepth = numberOrNull(diagnostics.renderDepthMeters);

  if (diagnostics.contextualGeneration !== "ready") {
    errors.push("contextual generation did not report ready");
  }
  if (
    [playableWidth, playableDepth, renderWidth, renderDepth].includes(null)
  ) {
    errors.push("one or more map dimensions were unavailable");
    return errors;
  }

  if (scenario === "replica-battle-no-context") {
    if (renderWidth !== playableWidth || renderDepth !== playableDepth) {
      errors.push("no-context control unexpectedly expanded render dimensions");
    }
    if (diagnostics.outerSkirtVisible !== "true") {
      errors.push("no-context control did not retain the legacy outer skirt");
    }
    return errors;
  }

  if (renderWidth <= playableWidth || renderDepth <= playableDepth) {
    errors.push("contextual route did not expand both render dimensions");
  }
  if (diagnostics.outerSkirtVisible !== "false") {
    errors.push("contextual route still reports the legacy outer skirt");
  }

  const inspected = numberOrNull(diagnostics.waterFeaturesInspected);
  const invalid = numberOrNull(diagnostics.waterFeaturesInvalid);
  const quarantined = numberOrNull(diagnostics.waterFeaturesQuarantined);

  if ([inspected, invalid, quarantined].includes(null)) {
    errors.push("water geometry diagnostics were unavailable");
    return errors;
  }
  if (![inspected, invalid, quarantined].every(isNonNegativeInteger)) {
    errors.push("water geometry counts must be non-negative integers");
    return errors;
  }
  if (invalid > inspected) {
    errors.push("invalid water feature count exceeded inspected count");
  }
  if (quarantined > invalid) {
    errors.push("quarantined water feature count exceeded invalid count");
  }
  if (quarantined < invalid) {
    errors.push("invalid water geometry remained unquarantined");
  }
  if (diagnostics.suspiciousGeometry === "true" && invalid === 0) {
    errors.push("suspicious water flag was set without invalid geometry");
  }
  if (diagnostics.suspiciousGeometry === "false" && invalid > 0) {
    errors.push("invalid water geometry was reported without a suspicious flag");
  }
  if (!["true", "false"].includes(diagnostics.suspiciousGeometry)) {
    errors.push("suspicious water geometry flag was unavailable");
  }

  return errors;
}
