export const HIGH_JUMP_COURSE = {
  id: "high-jump", distance: 38, finishAt: 33, fatigueAt: 35, finishMove: false,
  baseSpeed: 6, acceleration: 6, maxSpeeds: [7.8, 8.3, 8.8],
  zones: [5, 10, 15, 20, 25, 30].map((start, i) => ({ id: i + 1, start,
    end: start + (i === 5 ? 1.4 : 2.2), edgeWindow: i === 5 ? 0.45 : 0.75, perfectEdge: i === 5 ? 0.07 : 0.12 }))
};
export const TAKEOFF_ZONE = { start: 34, end: 36.6, edgeWindow: 1.05, perfectEdge: 0.15 };
export const HIGH_JUMP = {
  gravity: 9.81, barX: 33.8, barZ: 4, barWidth: 4.8,
  matX: 33.8, matZ: 6.5, matWidth: 6.4, matDepth: 5.6, landingY: 0.93,
  minBar: 1.2, maxBar: 2.5, defaultBar: 1.65, barStep: 0.05
};
export const normalizeBar = value => {
  const n = Number(value);
  return Math.max(HIGH_JUMP.minBar, Math.min(HIGH_JUMP.maxBar,
    Math.round((Number.isFinite(n) && n > 0 ? n : HIGH_JUMP.defaultBar) * 20) / 20));
};
export function approachPoint(distance) {
  if (distance <= 24) return { x: distance, z: -6, heading: 0 };
  const heading = (distance - 24) / 9;
  return { x: 24 + 9 * Math.sin(heading), z: -6 + 9 * (1 - Math.cos(heading)), heading };
}
