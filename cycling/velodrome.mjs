import { Vector3 } from "../sprint/vendor/three.module.min.js";
import { BIKE, METERS_PER_UNIT } from "./cyclist.mjs?v=track-3";

export const VELODROME = { length: 250, straight: 45, radius: 80 / Math.PI, start: 70,
  inner: -0.4, outer: 6.5, apron: -1.7, straightBank: 12, bendBank: 42 };
const wrap = (s, length) => ((s % length) + length) % length;
export function ovalPoint(distance) {
  const s = wrap(distance + VELODROME.start, VELODROME.length), r = VELODROME.radius, l = VELODROME.straight;
  if (s < l) return { x: s, z: 0, heading: 0 };
  if (s < 125) { const a = (s - l) / r; return { x: l + r * Math.sin(a), z: r * (1 - Math.cos(a)), heading: a }; }
  if (s < 125 + l) return { x: l - (s - 125), z: r * 2, heading: Math.PI };
  const a = (s - 125 - l) / r;
  return { x: -r * Math.sin(a), z: r * (1 + Math.cos(a)), heading: Math.PI + a };
}
export function bankAngle(distance) {
  const s = wrap(distance + VELODROME.start, 125), l = VELODROME.straight;
  const edge = s < l ? -Math.min(l - s, s) : Math.min(s - l, 125 - s);
  const t = Math.max(0, Math.min(1, (edge + 5) / 10)), bend = t * t * (3 - 2 * t);
  return (VELODROME.straightBank + (VELODROME.bendBank - VELODROME.straightBank) * bend) * Math.PI / 180;
}
export function trackPoint(distance, offset = 0, lift = 0) {
  const p = ovalPoint(distance), bank = bankAngle(distance);
  return { x: p.x + Math.sin(p.heading) * offset, y: Math.max(0, offset - VELODROME.inner) * Math.tan(bank) + lift,
    z: p.z - Math.cos(p.heading) * offset, heading: p.heading, bank };
}

// Fit the bike between its two tire contacts, including changes in banking.
export function bikeFrame(distance, scale = 1) {
  const frontOffset = BIKE.wheelRadius * METERS_PER_UNIT * scale;
  const wheelbase = (BIKE.front.x - BIKE.rear.x) * METERS_PER_UNIT * scale;
  const at = s => { const p = trackPoint(s); return new Vector3(p.x, p.y, p.z); };
  const front = at(distance - frontOffset), rear = at(distance - frontOffset - wheelbase);
  const forward = front.clone().sub(rear), stretch = forward.length() / wheelbase; forward.normalize();
  const mid = trackPoint(distance - frontOffset - wheelbase / 2);
  const normal = new Vector3(-Math.sin(mid.heading) * Math.sin(mid.bank), Math.cos(mid.bank), Math.cos(mid.heading) * Math.sin(mid.bank));
  const side = forward.clone().cross(normal).normalize(), up = side.clone().cross(forward).normalize();
  const origin = front.clone().addScaledVector(forward, frontOffset * stretch).addScaledVector(up, 0.04);
  return { origin, forward, up, side, stretch, front, rear };
}
