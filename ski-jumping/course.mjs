import { clamp, longZones } from "../sprint/engine.mjs?v=rivals-1";
import { ease } from "../sprint/finish.mjs?v=rivals-1";

export const SKI_COURSE = {
  id: "ski-jumping", distance: 140, finishAt: 122, fatigueAt: 145, finishMove: false,
  baseSpeed: 17.5, acceleration: 7, maxSpeeds: [23, 24.5, 26], momentumScale: 1.5,
  zones: longZones([[20, 46], [76, 103]], 17.5)
};
export const TAKEOFF_ZONE = { start: 125, end: 138, edgeWindow: 3.5, perfectEdge: 0.6, releaseLead: 0.2 };
export const HILL = { lip: 140, gravity: 9.81, contact: 0.06, kPoint: 90, runwayWidth: 3.6 };
const SAMPLE = 0.25;
const pitch = s => (-32 + 22 * ease((s - 95) / 40)) * Math.PI / 180;
const ramp = [{ x: 0, y: 0 }];
for (let s = SAMPLE; s <= HILL.lip; s += SAMPLE) {
  const a = pitch(s - SAMPLE / 2), p = ramp.at(-1);
  ramp.push({ x: p.x + Math.cos(a) * SAMPLE, y: p.y + Math.sin(a) * SAMPLE });
}
const lip = ramp.at(-1);
export function inrunPoint(distance) {
  const s = clamp(distance, 0, HILL.lip), i = Math.min(ramp.length - 2, Math.floor(s / SAMPLE)), t = s / SAMPLE - i;
  const a = ramp[i], b = ramp[i + 1];
  return { x: a.x + (b.x - a.x) * t - lip.x, y: a.y + (b.y - a.y) * t - lip.y, angle: pitch(s) };
}
const slopeAt = x => (-0.08 - 0.5 * ease(x / 100)) * (1 - ease((x - 115) / 65));
const slope = [{ y: -3, distance: 0 }];
for (let x = SAMPLE; x <= 260; x += SAMPLE) {
  const a = slopeAt(x - SAMPLE / 2), p = slope.at(-1);
  slope.push({ y: p.y + a * SAMPLE, distance: p.distance + Math.hypot(1, a) * SAMPLE });
}
export function landingPoint(x) {
  const at = clamp(x, 0, 260), i = Math.min(slope.length - 2, Math.floor(at / SAMPLE)), t = at / SAMPLE - i;
  const a = slope[i], b = slope[i + 1];
  return { y: a.y + (b.y - a.y) * t, distance: a.distance + (b.distance - a.distance) * t, angle: Math.atan(slopeAt(at)) };
}
export function distancePoint(distance) {
  let low = 0, high = 260;
  for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (landingPoint(mid).distance < distance) low = mid; else high = mid; }
  const x = (low + high) / 2; return { x, ...landingPoint(x) };
}
