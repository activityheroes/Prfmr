import { getRunnerPose, STRIDE_METERS } from "../sprint/runner.mjs?v=meets-1";
import { clamp } from "../sprint/engine.mjs?v=meets-1";
import { blendPose, reactionAge, reactionPose } from "../sprint/finish.mjs?v=meets-1";

const ease = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export function worldStandingPose(race, x, ground = 0.08) {
  const raw = reactionPose(getRunnerPose(0, 0, true), Math.max(0, reactionAge(race) - 0.65), race.presentation.success);
  const at = p => ({ x: x + p.x * 0.16, y: ground - p.y * 0.16 });
  return { hip: at(raw.hip), shoulder: at(raw.shoulder), head: at(raw.head), grip: at(raw.limbs[0].hand),
    limbs: raw.limbs.map(l => ({ knee: at(l.knee), ankle: at(l.foot.ankle), toe: at(l.foot.toe), heel: at(l.foot.heel), elbow: at(l.elbow), hand: at(l.hand) })) };
}
export function getVaulterPose(race) {
  if (!race.plant) {
    if (race.presentation) return worldStandingPose(race, race.distance - 0.48);
    const raw = getRunnerPose(race.distance / STRIDE_METERS, 0, race.phase === "ready" || race.terminal);
    const point = p => ({ x: race.distance + (p.x - 3) * 0.16, y: 0.08 - p.y * 0.16 });
    const hip = point(raw.hip), shoulder = point(raw.shoulder), head = point(raw.head);
    const grip = { x: race.distance + 0.05, y: 1.85 };
    const limbs = raw.limbs.map((l, side) => ({ knee: point(l.knee), ankle: point(l.foot.ankle), toe: point(l.foot.toe),
      heel: point(l.foot.heel), elbow: { x: shoulder.x - 0.22 + side * 0.08, y: shoulder.y - 0.4 },
      hand: { x: grip.x + side * 0.22, y: grip.y - side * 0.08 } }));
    return { hip, shoulder, head, limbs, grip };
  }
  const hip = { ...race.athlete }, pole = race.phase === "vault", u = race.vaultTime;
  if (race.phase === "landing") hip.y -= Math.sin(Math.min(1, race.landTime / 0.55) * Math.PI) * 0.15;
  const turn = pole ? ease(u / 0.85) * Math.PI : Math.PI + ease(race.flightTime / 0.18) * Math.PI / 2;
  const point = (x, y) => ({ x: hip.x + x * Math.cos(turn) - y * Math.sin(turn), y: hip.y + x * Math.sin(turn) + y * Math.cos(turn) });
  const shoulder = point(0.08, 0.58), head = point(0.1, 1.04);
  const grip = mix({ x: hip.x + 0.53, y: hip.y + 0.5 }, { x: hip.x - 0.2, y: hip.y - 0.85 }, ease(u));
  const tuck = pole ? 0 : ease(race.flightTime / 0.18);
  const limbs = [0, 1].map(side => {
    const s = side ? -1 : 1;
    const knee = point(s * (0.16 + tuck * 0.06), pole ? -0.62 : -0.48);
    const ankle = point(s * 0.08, pole ? -1.22 : -0.84);
    const hand = pole ? { x: grip.x + side * 0.15, y: grip.y + side * 0.08 }
      : mix({ x: hip.x - 0.2, y: hip.y - 0.85 }, point(s * 0.15, 0.4), tuck);
    const elbow = mix(shoulder, hand, 0.5); elbow.x -= pole ? 0.17 : 0;
    return { knee, ankle, toe: { x: ankle.x + 0.14, y: ankle.y + 0.02 }, heel: { x: ankle.x - 0.1, y: ankle.y }, hand, elbow };
  });
  const pose = { hip, shoulder, head, limbs, grip };
  return race.presentation ? blendPose(pose, worldStandingPose(race, hip.x + 0.2, 0.68), ease(reactionAge(race) / 0.85)) : pose;
}
export function clearancePoints(race) {
  const p = getVaulterPose(race);
  const points = [{ ...p.head, radius: 0.19 }, { ...p.hip, radius: 0.1 }, { ...p.shoulder, radius: 0.13 }];
  for (const [a, b] of [[p.hip, p.shoulder], ...p.limbs.flatMap(l => [[p.hip, l.knee], [l.knee, l.ankle], [p.shoulder, l.elbow], [l.elbow, l.hand]])]) {
    for (const t of [0, 0.5, 1]) points.push({ ...mix(a, b, t), radius: 0.05 });
  }
  return points;
}
export function vaulterDots(race) {
  return poseDots(getVaulterPose(race));
}
export function poseDots(p) {
  const dots = [];
  const dot = (p, color, radius = 0.04) => dots.push({ ...p, color, radius });
  const bone = (a, b, color, radius = 0.04) => {
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 0.105));
    for (let i = 0; i <= n; i++) dot(mix(a, b, i / n), color, radius);
  };
  const limb = (l, color, shoe) => {
    bone(p.hip, l.knee, color); bone(l.knee, l.ankle, color); bone(l.heel, l.toe, shoe, 0.046);
    bone(p.shoulder, l.elbow, color); bone(l.elbow, l.hand, color);
  };
  limb(p.limbs[1], "#447f72", "#a78650");
  const dx = p.shoulder.x - p.hip.x, dy = p.shoulder.y - p.hip.y, length = Math.hypot(dx, dy);
  for (let row = 0; row <= 7; row++) for (let col = -1; col <= 1; col++) {
    const point = mix(p.hip, p.shoulder, row / 7);
    point.x += dy / length * col * 0.075; point.y -= dx / length * col * 0.075;
    dot(point, col === 1 ? "#e7ffd3" : "#b7fa76");
  }
  bone(p.shoulder, p.head, "#e7ffd3");
  for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) {
    if (row * row + col * col <= 6) dot({ x: p.head.x + col * 0.09, y: p.head.y + row * 0.09 }, row > 1 ? "#ff7f86" : "#f0f5f1", 0.042);
  }
  dot({ x: p.head.x + 0.17, y: p.head.y + 0.025 }, "#65c9ff", 0.05);
  limb(p.limbs[0], "#b7fa76", "#ffd473");
  return dots;
}

export function poleCurve(race) {
  const p = getVaulterPose(race);
  if (!race.plant && race.presentation) return { start: { x: race.distance - 1.8, y: 0.06 }, control: { x: race.distance + 0.4, y: 0.06 }, end: { x: race.distance + 2.6, y: 0.06 } };
  if (!race.plant) {
    const t = ease((race.distance - 39) / 3), angle = 0.16 * (1 - t) + Math.atan2(-p.grip.y, 45 - p.grip.x) * t;
    const at = d => ({ x: p.grip.x + Math.cos(angle) * d, y: p.grip.y + Math.sin(angle) * d });
    return { start: at(-1.2), control: at(1.2), end: at(3.6) };
  }
  if (race.phase === "vault") {
    const bend = Math.sin(Math.PI * race.vaultTime) * 1.5;
    return { start: { x: 45, y: 0.04 }, control: { x: (45 + p.grip.x) / 2 - bend, y: p.grip.y * 0.5 }, end: p.grip };
  }
  const fall = ease(race.flightTime / 1.3), angle = Math.PI / 2 + fall * Math.PI * 0.47;
  return { start: { x: 45, y: 0.05 }, control: { x: 45 + Math.cos(angle) * 2.2, y: 0.05 + Math.sin(angle) * 2.2 },
    end: { x: 45 + Math.cos(angle) * 4.4, y: 0.05 + Math.sin(angle) * 4.4 } };
}
