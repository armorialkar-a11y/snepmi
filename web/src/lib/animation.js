export const clamp01 = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => { const t = clamp01(value); return t * t * (3 - 2 * t); };

/** One reversible timeline: open hinge, then lift paper; reverse on close. */
export function envelopeFrame(progress, paperHeight, stageHeight) {
  const p = clamp01(progress);
  const angle = -180 + 180 * ease(p / 0.4);
  const hidden = paperHeight + 4;
  const lift = -stageHeight * 0.54;
  return {
    angle,
    layer: angle < -90 ? 3 : 1,
    paperY: hidden + (lift - hidden) * ease((p - 0.4) / 0.6),
    clearance: Math.max(24, paperHeight - stageHeight * 0.42 + 28),
  };
}

export function sceneProgress(sectionTop, sectionHeight, stageHeight, stickyTop) {
  const travel = sectionHeight - stageHeight;
  return travel > 0 ? clamp01((stickyTop - sectionTop) / travel) : 0;
}

export const HERO_INITIAL_SCALE = 1.1;

/** Original scene geometry: enlarge the dolls and lift them over the logo. */
export function heroGeometry({ stageWidth, stageHeight, artWidth, artHeight, artTop, logoHeight, mobile }) {
  const endScale = Math.max(HERO_INITIAL_SCALE, Math.min(
    1.3, (stageWidth - 40) / Math.max(1, artWidth), (stageHeight - 90) / Math.max(1, artHeight),
  ));
  const endHeight = artHeight * endScale;
  const desiredLift = -logoHeight * (mobile ? 0.45 : 0.6) - (endHeight - artHeight) / 2;
  const minY = 42 - artTop;
  const maxY = stageHeight - 48 - artTop - endHeight;
  return { endScale, lift: Math.max(minY, Math.min(maxY, desiredLift)) };
}

export function heroFrame(progress, geometry) {
  const p = clamp01(progress);
  return { scale: HERO_INITIAL_SCALE + (geometry.endScale - HERO_INITIAL_SCALE) * p, y: p === 0 ? 0 : geometry.lift * p };
}

/** Exact critically damped spring; position AND velocity survive target changes. */
export function dampedSpring(state, target, seconds, frequency = 12) {
  const dt = Math.max(0, Math.min(0.032, seconds));
  const displacement = state.value - target;
  const coefficient = state.velocity + frequency * displacement;
  const decay = Math.exp(-frequency * dt);
  return {
    value: target + (displacement + coefficient * dt) * decay,
    velocity: (state.velocity - frequency * coefficient * dt) * decay,
  };
}
