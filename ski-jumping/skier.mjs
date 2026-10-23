import { blendPose, ease, reactionAge } from "../sprint/finish.mjs?v=weather-1";
import { inrunPoint, landingPoint } from "./course.mjs?v=weather-1";

export const SKIER_SCALE = 1.5;
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
function shape(mode, split = 0) {
  const flight = mode === "flight", tall = mode === "extension" || mode === "standing";
  const hip = flight ? { x: 0.48, y: 0.65, z: 0 } : { x: tall ? 0.08 : -0.12, y: tall ? 1.05 : 0.7, z: 0 };
  const shoulder = flight ? { x: 1.08, y: 0.83, z: 0 } : { x: tall ? 0.25 : 0.48, y: tall ? 1.58 : 0.85, z: 0 };
  const head = flight ? { x: 1.38, y: 0.92, z: 0 } : { x: tall ? 0.35 : 0.8, y: tall ? 1.87 : 1.05, z: 0 };
  return { hip, shoulder, head, limbs: [0, 1].map(i => {
    const sign = i ? -1 : 1, z = sign * (flight ? 0.35 : 0.18), x = sign * split;
    return { ankle: { x, y: 0.12, z }, knee: { x: x + (flight ? 0.24 : tall ? 0.2 : 0.42), y: flight ? 0.4 : tall ? 0.57 : 0.38, z: z * 0.7 },
      heel: { x: x - 0.13, y: 0.08, z }, toe: { x: x + 0.22, y: 0.08, z },
      elbow: { x: shoulder.x - 0.42, y: shoulder.y - 0.12, z: sign * 0.22 },
      hand: { x: hip.x - 0.12, y: hip.y + 0.06, z: sign * 0.13 },
      skiYaw: flight ? sign * 0.27 : 0, skiX: x, skiZ: z };
  }) };
}
export function getSkierPose(race) {
  const origin = race.launch ? race.athlete : inrunPoint(race.distance);
  const lipAngle = inrunPoint(140).angle;
  let angle = race.launch ? lipAngle + (0.12 - ease(race.flightTime / 5) * 0.06 - lipAngle) * ease(race.flightTime / 0.45) : origin.angle;
  let pose = shape("tuck");
  if (!race.launch) {
    const extend = race.takeoffTiming ? ease((race.distance - 138) / 2) : 0;
    pose = blendPose(pose, shape("extension"), extend);
  } else {
    const extension = shape(race.launch.valid ? "extension" : "tuck");
    pose = blendPose(extension, shape("flight"), ease(race.flightTime / 0.5));
    const clearance = race.athlete.y - landingPoint(race.athlete.x).y;
    const approach = race.flightTime > 0.5 && race.body.velocity.y < 0 ? ease((4 - clearance) / 3.7) : 0;
    const landing = shape("tuck", race.launch.valid ? 0.32 : 0);
    landing.hip.y = 0.8; landing.shoulder = { x: 0.28, y: 1.3, z: 0 }; landing.head = { x: 0.5, y: 1.57, z: 0 };
    landing.limbs.forEach((l, i) => { const sign = i ? -1 : 1; l.elbow = { x: 0.3, y: 1.15, z: sign * 0.42 }; l.hand = { x: 0.5, y: 1.15, z: sign * 0.7 }; });
    const landed = !!race.landing, settle = landed ? ease(race.landTime / 0.7) : 0;
    const landPose = blendPose(landing, shape("standing", 0.1), settle);
    pose = blendPose(pose, landPose, landed ? 1 : approach);
    angle = angle + (landingPoint(origin.x).angle - angle) * (landed ? 1 : approach);
    if (race.presentation) {
      const target = shape("standing", 0.1), happy = race.presentation.success, age = reactionAge(race);
      target.limbs.forEach((l, i) => {
        const sign = i ? -1 : 1;
        l.elbow = { x: 0.3, y: happy ? 1.85 : 1.15, z: sign * (happy ? 0.45 : 0.2) };
        l.hand = { x: 0.36, y: happy ? 2.25 + Math.sin(age * 4) * 0.02 : 0.9, z: sign * (happy ? 0.62 : 0.17) };
      });
      if (!happy) { target.shoulder.x += 0.18; target.head.x += 0.3; target.head.y -= 0.2; }
      pose = blendPose(pose, target, ease(age / 0.7));
    }
  }
  const c = Math.cos(angle), s = Math.sin(angle);
  const at = p => ({ x: origin.x + (p.x * c - p.y * s) * SKIER_SCALE, y: origin.y + (p.x * s + p.y * c) * SKIER_SCALE, z: p.z * SKIER_SCALE });
  const skis = pose.limbs.map(l => Array.from({ length: 37 }, (_, i) => {
    const u = -1.08 + i / 36 * 2.76, tip = ease((u - 1.38) / 0.3) * 0.13;
    return at({ x: l.skiX + u * Math.cos(l.skiYaw), y: 0.025 + tip, z: l.skiZ + u * Math.sin(l.skiYaw) });
  }));
  return { hip: at(pose.hip), shoulder: at(pose.shoulder), head: at(pose.head), skis, angle,
    limbs: pose.limbs.map(l => Object.fromEntries(["ankle", "knee", "heel", "toe", "elbow", "hand"].map(key => [key, at(l[key])])) ) };
}
export function skierDots(race) {
  const p = getSkierPose(race), dots = [];
  const detailScale = SKIER_SCALE / 1.9;
  const dot = (point, color, radius = 0.075) => dots.push({ ...point, color, radius: radius * detailScale });
  const bone = (a, b, color, radius = 0.075) => {
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (0.16 * detailScale)));
    for (let i = 0; i <= n; i++) dot(mix(a, b, i / n), color, radius);
  };
  p.skis.forEach(ski => ski.forEach((pt, i) => dot(pt, i > 30 ? "#ff7f86" : "#203a41", 0.065)));
  for (const i of [1, 0]) {
    const l = p.limbs[i], color = i ? "#3c8274" : "#b7fa76";
    bone(p.hip, l.knee, color); bone(l.knee, l.ankle, color);
    bone(l.heel, l.toe, "#dc6e7f", 0.1);
    bone(p.shoulder, l.elbow, color); bone(l.elbow, l.hand, color); dot(l.hand, "#f4fbef", 0.08);
  }
  const dx = p.shoulder.x - p.hip.x, dy = p.shoulder.y - p.hip.y, length = Math.hypot(dx, dy);
  for (let row = 0; row <= 9; row++) for (const col of [-1, 0, 1]) {
    const at = mix(p.hip, p.shoulder, row / 9); at.x += col * dy / length * 0.12 * detailScale; at.y -= col * dx / length * 0.12 * detailScale;
    dot(at, col === 1 ? "#e7ffd3" : "#b7fa76");
  }
  bone(p.shoulder, p.head, "#e7ffd3");
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 6)
    dot({ x: p.head.x + x * 0.12 * detailScale, y: p.head.y + y * 0.12 * detailScale, z: p.head.z }, y >= 0 ? "#ff7f86" : "#f0f5f1", 0.075);
  dot({ x: p.head.x + 0.24 * detailScale, y: p.head.y, z: p.head.z + 0.05 * detailScale }, "#21434d", 0.09);
  return dots;
}
