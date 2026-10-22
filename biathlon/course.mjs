import { clamp } from "../sprint/engine.mjs";

export const BIATHLON_COURSE = {
  id: "biathlon", distance: 400, finishAt: 395, fatigueAt: 370, finishMove: false,
  baseSpeed: 9.5, acceleration: 5.5, maxSpeeds: [13, 14, 15], momentumScale: 0.8,
  zones: [28, 84, 140, 230, 290, 352].map((start, i) => ({ id: i + 1, start,
    end: start + (i === 5 ? 7.5 : 10), edgeWindow: i === 5 ? 2.2 : 2.8, perfectEdge: i === 5 ? 0.65 : 0.9 }))
};
export const RANGE = { distance: 200, targets: 5, penalty: 2, settle: 0.8, minimumHold: 0.25, reload: 0.6, depart: 1.2, radius: 0.4 };
export const HILLS = [{ start: 10, end: 76, height: 5.5 }, { start: 90, end: 176, height: 7 },
  { start: 214, end: 282, height: 6 }, { start: 298, end: 382, height: 7.5 }];
export function trailHeight(distance) {
  return HILLS.reduce((height, hill) => {
    const t = clamp((distance - hill.start) / (hill.end - hill.start), 0, 1);
    return height + hill.height * Math.sin(Math.PI * t) ** 4;
  }, 0);
}
export function trailGrade(distance) { return (trailHeight(distance + 0.02) - trailHeight(distance - 0.02)) / 0.04; }
export function terrainFactor(distance) { return clamp(1 - trailGrade(distance) * 0.8, 0.76, 1.25); }
export function aimAt(age, heldFor, tolerance = 1) {
  const amplitude = 0.82 - 0.28 * (1 - Math.exp(-heldFor * 1.6));
  const angle = age * Math.PI * 2 / 2.2;
  const x = Math.cos(angle) * amplitude, y = Math.sin(angle * 2) * 0.12;
  const radius = RANGE.radius * Math.min(1.18, tolerance);
  return { x, y, radius, centered: Math.hypot(x, y) <= radius, error: Math.hypot(x, y) };
}
