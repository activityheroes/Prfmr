import { blendPose, ease, finishTravel, reactionAge } from "../sprint/finish.mjs?v=boost-1";
import { bendAmount } from "./course.mjs";

export const SKATE_CYCLE_METERS = 18;
export const GLIDE = 0.42;
export const CONTACT = 0.6;
export const LEG = { thigh: 0.59, shin: 0.61 };
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
function knee(hip, ankle) {
  const dx = ankle.x - hip.x, dy = ankle.y - hip.y, dz = ankle.z - hip.z, reach = Math.max(0.001, Math.hypot(dx, dy, dz));
  const d = Math.min(reach, LEG.thigh + LEG.shin - 0.001), ux = dx / reach, uy = dy / reach, uz = dz / reach;
  const along = (LEG.thigh ** 2 - LEG.shin ** 2 + d * d) / (2 * d), height = Math.sqrt(Math.max(0, LEG.thigh ** 2 - along * along));
  const bx = 1 - ux * ux, by = -ux * uy, bz = -ux * uz, n = Math.max(0.001, Math.hypot(bx, by, bz));
  return { x: hip.x + ux * along + bx / n * height, y: hip.y + uy * along + by / n * height, z: hip.z + uz * along + bz / n * height };
}
function skate(phase, side, turn, idle) {
  const t = ((phase % 1) + 1) % 1, contact = idle || t < CONTACT;
  const sign = side ? -1 : 1, startZ = side ? -0.11 + turn * 0.23 : 0.11 - turn * 0.14;
  const glideZ = startZ + sign * 0.11, endZ = sign * (0.67 - turn * (side ? 0 : 0.15));
  let x, z, lift = 0, angle = 0;
  // Keep most of the stance under the body; extend sideways only at push-off.
  if (idle) { x = side ? -0.05 : 0.05; z = sign * 0.18; }
  else if (t < GLIDE) {
    const u = ease(t / GLIDE); x = 0.12 - 0.14 * u; z = startZ + (glideZ - startZ) * u; angle = sign * 0.045 * u;
  } else if (contact) {
    const u = ease((t - GLIDE) / (CONTACT - GLIDE));
    x = -0.02 - 0.2 * u; z = glideZ + (endZ - glideZ) * u; angle = sign * (0.045 + 0.175 * u);
  } else {
    const u = (t - CONTACT) / (1 - CONTACT);
    x = -0.22 + 0.34 * ease(u) - 0.18 * Math.sin(Math.PI * u);
    z = endZ + (startZ - endZ) * ease(u / 0.8);
    lift = Math.sin(Math.PI * u) ** 2 * (0.075 + turn * 0.045);
    angle = sign * 0.22 * (1 - ease(u));
  }
  const at = (forward, y) => ({ x: x + forward * Math.cos(angle), y: y + lift, z: z + forward * Math.sin(angle) });
  return { contact, phase: idle ? "ready" : t < GLIDE ? "glide" : contact ? "push" : "recovery",
    ankle: at(0, 0.15), heel: at(-0.14, 0.1), toe: at(0.2, 0.1), bladeBack: at(-0.34, 0.025), bladeFront: at(0.43, 0.025) };
}
export function getSkaterPose(race) {
  const distance = race.distance + finishTravel(race), cycle = distance / SKATE_CYCLE_METERS;
  const idle = race.phase === "ready", turn = idle ? 0 : bendAmount(distance);
  const sway = idle ? 0 : Math.sin(cycle * Math.PI * 2) * 0.19;
  const hip = { x: 0, y: 0.96 + (idle ? 0 : Math.cos(cycle * Math.PI * 4) * 0.008), z: sway + turn * 0.07 };
  const shoulder = { x: 0.65, y: hip.y + 0.12, z: hip.z + sway * 0.2 + turn * 0.24 };
  const head = { x: 0.91, y: hip.y + 0.31, z: shoulder.z + turn * 0.04 };
  let pose = { hip, shoulder, head, turn, limbs: [0, 1].map(side => {
    const foot = skate(cycle + side * 0.5, side, turn, idle), sign = side ? -1 : 1;
    const hipJoint = { ...hip, z: hip.z + sign * 0.1 }, shoulderJoint = { ...shoulder, z: shoulder.z + sign * 0.15 };
    const elbow = { x: 0.16, y: hip.y - 0.08, z: hip.z + sign * 0.24 };
    const hand = { x: -0.1, y: hip.y + 0.08, z: hip.z + sign * 0.035 };
    return { ...foot, hipJoint, shoulderJoint, knee: knee(hipJoint, foot.ankle), elbow, hand };
  }) };
  if (race.presentation) {
    const target = structuredClone(pose), age = reactionAge(race);
    target.hip = { x: 0, y: 1.04, z: 0 }; target.shoulder = { x: 0.08, y: 1.56, z: 0 }; target.head = { x: 0.16, y: 1.85, z: 0 };
    target.limbs.forEach((l, i) => {
      const foot = skate(0, i, 0, true), sign = i ? -1 : 1;
      Object.assign(l, foot); l.hipJoint = { ...target.hip, z: sign * 0.1 }; l.shoulderJoint = { ...target.shoulder, z: sign * 0.15 };
      l.knee = knee(l.hipJoint, foot.ankle);
      l.elbow = { x: 0.08, y: 1.8, z: sign * 0.4 };
      l.hand = { x: 0.12, y: 2.2 + Math.sin(age * 4) * 0.025, z: sign * 0.55 };
    });
    pose = blendPose(pose, target, ease((race.presentation.age - 0.2) / 1));
  }
  return pose;
}
export function skaterDots(race) {
  const p = getSkaterPose(race), dots = [];
  const dot = (point, color, radius = 0.038) => dots.push({ ...point, color, radius });
  const bone = (a, b, color, radius = 0.038) => {
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.075));
    for (let i = 0; i <= n; i++) dot(mix(a, b, i / n), color, radius);
  };
  const limb = (l, color) => {
    bone(l.hipJoint, l.knee, color); bone(l.knee, l.ankle, color);
    bone(l.shoulderJoint, l.elbow, color); bone(l.elbow, l.hand, color); dot(l.hand, "#f0f5f1", 0.045);
    bone(l.heel, l.toe, "#263d40", 0.06); bone(l.bladeBack, l.bladeFront, "#ffffff", 0.027);
    bone(l.ankle, mix(l.bladeBack, l.bladeFront, 0.5), "#82b5c7", 0.025);
  };
  limb(p.limbs[1], "#448778");
  const dx = p.shoulder.x - p.hip.x, dy = p.shoulder.y - p.hip.y, spine = Math.hypot(dx, dy);
  for (let row = 0; row <= 9; row++) for (let col = 0; col < 6; col++) {
    const at = mix(p.hip, p.shoulder, row / 9), angle = col * Math.PI / 3, depth = Math.cos(angle) * 0.055;
    at.x -= dy / spine * depth; at.y += dx / spine * depth; at.z += Math.sin(angle) * (0.12 + row / 9 * 0.03);
    dot(at, col === 0 ? "#e7ffd3" : "#b7fa76");
  }
  bone(p.shoulder, p.head, "#e7ffd3");
  for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) if (row * row + col * col <= 6)
    dot({ x: p.head.x + col * 0.065, y: p.head.y + row * 0.065, z: p.head.z }, row >= 0 ? "#ff7f86" : "#f0f5f1", 0.037);
  dot({ x: p.head.x + 0.14, y: p.head.y - 0.035, z: p.head.z + 0.02 }, "#254854", 0.05);
  limb(p.limbs[0], "#b7fa76");
  return dots;
}
