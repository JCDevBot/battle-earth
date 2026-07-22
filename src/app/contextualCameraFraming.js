function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function createContextualCameraFrame(plan) {
  const camera = plan?.camera;
  if (!camera) return null;

  const sizeMeters = finitePositive(camera.sizeMeters, 1000);
  const widthMeters = finitePositive(camera.mapWidthMeters, sizeMeters);
  const depthMeters = finitePositive(camera.mapDepthMeters, sizeMeters);
  const maxDimension = Math.max(sizeMeters, widthMeters, depthMeters);

  if (maxDimension > 500) return null;

  return Object.freeze({
    x: 0,
    y: Math.max(150, maxDimension * 0.42),
    z: Math.max(220, depthMeters * 0.58),
    targetX: 0,
    targetY: 0,
    targetZ: 0,
  });
}

export function applyContextualCameraFrame(engine, plan) {
  const frame = createContextualCameraFrame(plan);
  if (!frame || !engine?.camera || !engine?.controls) return false;

  engine.camera.position.set(frame.x, frame.y, frame.z);
  engine.camera.lookAt(frame.targetX, frame.targetY, frame.targetZ);
  engine.controls.target.set(frame.targetX, frame.targetY, frame.targetZ);
  engine.controls.update();
  return true;
}
