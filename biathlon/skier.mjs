import { blendPose, ease, finishTravel, reactionAge } from "../sprint/finish.mjs?v=biathlon-1";
import { trailGrade, RANGE } from "./course.mjs";

export const STRIDE = 7.5;
export const SKIER_SCALE = 1.35;
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
function joint(a, b, upper, lower, bend = 1) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, reach = Math.max(0.001, Math.hypot(dx, dy, dz));
  const d = Math.min(reach, upper + lower - 0.0001), ux = dx / reach, uy = dy / reach, uz = dz / reach;
  const along = (upper * upper - lower * lower + d * d) / (2 * d), height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const bx = 1 - ux * ux, by = -ux * uy, bz = -ux * uz, n = Math.max(0.001, Math.hypot(bx, by, bz));
  return { x: a.x + ux * along + bx / n * height * bend, y: a.y + uy * along + by / n * height * bend,
    z: a.z + uz * along + bz / n * height * bend };
}
function posture(distance, mode = "ski") {
  const cycle = distance / STRIDE, still = mode !== "ski", tuck = mode === "tuck", shooting = mode === "shoot";
  const hip = { x: 0, y: tuck ? 0.86 : 1.02, z: still ? 0 : Math.sin(cycle * Math.PI * 2) * 0.12 };
  const shoulder = { x: tuck ? 0.57 : shooting ? 0.08 : 0.3, y: tuck ? 1.12 : 1.55, z: hip.z };
  const head = { x: shoulder.x + 0.17, y: shoulder.y + 0.27, z: hip.z };
  const limbs = [0, 1].map(side => {
    const sign = side ? -1 : 1, t = (cycle + side * 0.5) % 1, contact = still || t < 0.62;
    let x = 0, z = sign * 0.19, lift = 0, angle = 0;
    if (!still && contact) { const u = ease(t / 0.62); x = 0.22 - 0.62 * u; z = sign * (0.13 + 0.47 * u); angle = sign * 0.2 * u; }
    if (!still && !contact) { const u = (t - 0.62) / 0.38; x = -0.4 + 0.62 * ease(u); z = sign * (0.6 - 0.47 * ease(u)); lift = Math.sin(u * Math.PI) ** 2 * 0.11; angle = sign * 0.2 * (1 - ease(u)); }
    const at = (forward, y) => ({ x: x + Math.cos(angle) * forward, y: y + lift, z: z + Math.sin(angle) * forward });
    const ankle = at(0, 0.14), hipJoint = { ...hip, z: hip.z + sign * 0.12 }, shoulderJoint = { ...shoulder, z: shoulder.z + sign * 0.16 };
    const polePhase = (cycle * 2) % 1, planted = !still && polePhase < 0.3;
    let hand, poleTip;
    if (planted) {
      const u = polePhase / 0.3;
      hand = { x: 0.5 - u * 0.75, y: 1.12 - u * 0.06, z: hip.z + sign * 0.33 };
      // The tip stays at one world position during each pole plant.
      poleTip = { x: 0.65 - polePhase * STRIDE / 2, y: 0.02, z: sign * 0.52 };
    } else {
      const u = still ? 0 : ease((polePhase - 0.3) / 0.7);
      hand = { x: -0.25 + u * 0.75, y: 1.06 + Math.sin(u * Math.PI) * 0.22, z: hip.z + sign * 0.33 };
      poleTip = { x: -0.475 + u * 1.125, y: 0.02 + Math.sin(u * Math.PI) * 0.45, z: sign * 0.52 };
    }
    if (tuck) { hand = { x: 0.15, y: 0.96, z: sign * 0.28 }; poleTip = { x: -1.1, y: 0.42, z: sign * 0.42 }; }
    if (shooting) { hand = { x: side ? 0.83 : 0.45, y: 1.47, z: side ? 0 : 0.09 }; poleTip = { x: -0.8, y: 0.03, z: sign * 0.4 }; }
    return { hipJoint, shoulderJoint, ankle, knee: joint(hipJoint, ankle, 0.54, 0.57), heel: at(-0.12, 0.1), toe: at(0.2, 0.1),
      skiBack: at(-0.7, 0.025), skiFront: at(1.03, 0.04), skiTip: at(1.16, 0.13),
      hand, elbow: joint(shoulderJoint, hand, 0.38, 0.4, -1), poleTip, contact, planted };
  });
  const rifle = shooting ? [{ x: 0.08, y: 1.52, z: 0.05 }, { x: 1.35, y: 1.51, z: 0.05 }]
    : [{ x: -0.2, y: 1.02, z: -0.04 }, { x: shoulder.x - 0.25, y: shoulder.y + 0.54, z: -0.04 }];
  return { hip, shoulder, head, limbs, rifle, shooting: shooting ? 1 : 0 };
}
export function getSkierPose(race) {
  const distance = race.distance + finishTravel(race), motion = distance / SKIER_SCALE, downhill = ease((-trailGrade(distance) - 0.03) / 0.12);
  let pose = race.phase === "ready" ? posture(motion, "ready") : blendPose(posture(motion), posture(motion, "tuck"), downhill);
  if (race.phase === "shooting") pose = blendPose(pose, posture(motion, "shoot"), ease(race.rangeAge / RANGE.settle));
  else if (race.rangeDoneAt !== null && race.rangeDoneAt !== undefined) pose = blendPose(posture(motion, "shoot"), pose, ease((race.time - race.rangeDoneAt - RANGE.depart) / 0.7));
  if (race.presentation) {
    const target = posture(motion, "ready"), age = reactionAge(race);
    target.limbs.forEach((l, i) => {
      const sign = i ? -1 : 1; l.hand = { x: 0.22, y: 2.1 + Math.sin(age * 4) * 0.03, z: sign * 0.5 };
      l.elbow = { x: 0.2, y: 1.8, z: sign * 0.4 }; l.poleTip = { x: -0.1, y: 0.75, z: sign * 0.8 };
    });
    pose = blendPose(pose, target, ease(age / 0.65));
  }
  return pose;
}
export function skierDots(race) {
  const p = getSkierPose(race), dots = [];
  const dot = (point, color, radius = 0.038) => dots.push({ ...point, color, radius });
  const bone = (a, b, color, radius = 0.038, spacing = 0.075) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / spacing));
    for (let i = 0; i <= n; i++) dot(mix(a, b, i / n), color, radius);
  };
  p.limbs.forEach((l, side) => {
    const suit = side ? "#36877d" : "#b7fa76";
    bone(l.hipJoint, l.knee, suit, 0.045); bone(l.knee, l.ankle, suit, 0.043);
    bone(l.heel, l.toe, "#254342", 0.06); bone(l.skiBack, l.skiFront, "#f47880", 0.032); bone(l.skiFront, l.skiTip, "#f47880", 0.032);
    bone(l.shoulderJoint, l.elbow, suit); bone(l.elbow, l.hand, "#e8f7dc"); dot(l.hand, "#234244", 0.055);
    if (p.shooting < 0.5) bone(l.hand, l.poleTip, "#31595d", 0.018, 0.055);
    else bone({ x: -1.5, y: 0.04, z: side ? -0.5 : -0.35 }, { x: -0.1, y: 0.04, z: side ? -0.5 : -0.35 }, "#31595d", 0.02);
  });
  for (let row = 0; row <= 9; row++) for (let col = 0; col < 6; col++) {
    const a = mix(p.hip, p.shoulder, row / 9), angle = col * Math.PI / 3;
    a.x += Math.cos(angle) * 0.075; a.z += Math.sin(angle) * 0.15; dot(a, col < 3 ? "#b7fa76" : "#438b7c", 0.04);
  }
  bone(p.shoulder, p.head, "#e8f7dc");
  for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) if (row * row + col * col <= 6)
    dot({ x: p.head.x + col * 0.06, y: p.head.y + row * 0.06, z: p.head.z }, row > 0 ? "#ff7f86" : "#f0f5f1");
  dot({ x: p.head.x + 0.12, y: p.head.y + 0.01, z: p.head.z + 0.02 }, "#254854", 0.05);
  bone(p.rifle[0], p.rifle[1], "#183b42", 0.025, 0.045);
  bone(p.rifle[0], mix(p.rifle[0], p.rifle[1], 0.36), "#d0ac75", 0.045);
  return dots;
}
