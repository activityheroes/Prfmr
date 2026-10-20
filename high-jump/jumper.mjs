import { getRunnerPose, STRIDE_METERS } from "../sprint/runner.mjs";
import { blendPose, ease, reactionAge, reactionPose } from "../sprint/finish.mjs";
import { approachPoint } from "./course.mjs";

const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
function runningPose(race, origin, heading, standing = false, ground = 0.06) {
  let raw = getRunnerPose(race.distance / (STRIDE_METERS * 0.78), 0, standing);
  if (race.presentation) raw = reactionPose(raw, Math.max(0, reactionAge(race) - 0.6), race.presentation.success);
  const at = (p, depth = 0) => ({ x: origin.x + p.x * 0.125 * Math.cos(heading) - depth * Math.sin(heading),
    y: ground - p.y * 0.125, z: origin.z + p.x * 0.125 * Math.sin(heading) + depth * Math.cos(heading) });
  return { hip: at(raw.hip), shoulder: at(raw.shoulder), head: at(raw.head),
    limbs: raw.limbs.map((l, i) => {
      const depth = i ? -0.08 : 0.08;
      return { knee: at(l.knee, depth), ankle: at(l.foot.ankle, depth), heel: at(l.foot.heel, depth), toe: at(l.foot.toe, depth), elbow: at(l.elbow, depth), hand: at(l.hand, depth) };
    }) };
}
export function getHighJumperPose(race) {
  const origin = approachPoint(race.distance);
  if (!race.launch) return runningPose(race, origin, origin.heading, race.phase === "ready" || race.terminal);
  const { heading, startPose } = race.launch, hip = { ...race.athlete };
  const age = race.flightTime, arch = ease((age - 0.07) / 0.25), kick = ease((age - 0.52) / 0.24);
  const at = (u, y, depth = 0) => ({ x: hip.x + u * Math.cos(heading) - depth * Math.sin(heading),
    y: hip.y + y, z: hip.z + u * Math.sin(heading) + depth * Math.cos(heading) });
  // The head leads over the bar, the back arches, then the heels kick clear last.
  const shoulder = at(0.38, -0.18), head = at(0.76, -0.35);
  const limbs = [0, 1].map(i => {
    const depth = i ? -0.14 : 0.14;
    const ankle = at(-0.85 + 0.1 * kick, -0.54 + 0.85 * kick, depth);
    return { knee: at(-0.43, -0.12 + 0.2 * kick, depth), ankle,
      heel: at(-0.9 + 0.1 * kick, -0.56 + 0.85 * kick, depth), toe: at(-0.7 + 0.1 * kick, -0.53 + 0.85 * kick, depth),
      elbow: at(0.18, -0.1, depth * 2.3), hand: at(0.43, 0.12, depth * 2.7) };
  });
  const takeoff = structuredClone(startPose);
  for (const point of [takeoff.hip, takeoff.shoulder, takeoff.head, ...takeoff.limbs.flatMap(l => Object.values(l))]) {
    point.x += hip.x - race.launch.x; point.y += hip.y - race.launch.y; point.z += hip.z - race.launch.z;
  }
  let pose = blendPose(takeoff, { hip, shoulder, head, limbs }, arch);
  if (race.phase === "landing" || race.presentation) {
    const settle = ease(race.landTime / 0.55), landed = structuredClone(pose);
    landed.shoulder = at(0.4, -0.05); landed.head = at(0.78, 0.02);
    landed.limbs.forEach((l, i) => {
      const d = i ? -0.12 : 0.12;
      l.knee = at(-0.4, 0.25, d); l.ankle = at(-0.82, 0.08, d);
      l.heel = at(-0.9, 0.06, d); l.toe = at(-0.7, 0.1, d);
      l.elbow = at(0.25, 0.08, d * 2); l.hand = at(0.62, 0.14, d * 2.5);
    });
    pose = blendPose(pose, landed, settle);
    if (race.presentation) pose = blendPose(pose, runningPose(race, hip, heading, true, 0.7), ease(reactionAge(race) / 0.9));
  }
  return pose;
}
export function clearancePoints(race) {
  const p = getHighJumperPose(race);
  const points = [{ ...p.head, radius: 0.16 }, { ...p.hip, radius: 0.09 }, { ...p.shoulder, radius: 0.1 }];
  for (const [a, b] of [[p.hip, p.shoulder], ...p.limbs.flatMap(l => [[p.hip, l.knee], [l.knee, l.ankle], [l.heel, l.toe], [p.shoulder, l.elbow], [l.elbow, l.hand]])])
    for (const t of [0, 0.5, 1]) points.push({ ...mix(a, b, t), radius: 0.04 });
  return points;
}
export function jumperDots(race) {
  const p = getHighJumperPose(race), dots = [], heading = race.launch?.heading ?? approachPoint(race.distance).heading;
  const dot = (point, color, radius = 0.035) => dots.push({ ...point, color, radius });
  const bone = (a, b, color, radius = 0.035) => {
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.09));
    for (let i = 0; i <= n; i++) dot(mix(a, b, i / n), color, radius);
  };
  const limb = (l, color, shoe) => {
    bone(p.hip, l.knee, color); bone(l.knee, l.ankle, color); bone(l.heel, l.toe, shoe, 0.04);
    bone(p.shoulder, l.elbow, color); bone(l.elbow, l.hand, color);
  };
  limb(p.limbs[1], "#447f72", "#a78650");
  for (let row = 0; row <= 7; row++) for (let col = -1; col <= 1; col++) {
    const pt = mix(p.hip, p.shoulder, row / 7);
    pt.x -= Math.sin(heading) * col * 0.065; pt.z += Math.cos(heading) * col * 0.065;
    dot(pt, col === 1 ? "#e7ffd3" : "#b7fa76");
  }
  bone(p.shoulder, p.head, "#e7ffd3");
  for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) if (row * row + col * col <= 6)
    dot({ x: p.head.x + col * 0.075 * Math.cos(heading), y: p.head.y + row * 0.075,
      z: p.head.z + col * 0.075 * Math.sin(heading) }, row > 1 ? "#ff7f86" : "#f0f5f1", 0.036);
  limb(p.limbs[0], "#b7fa76", "#ffd473");
  return dots;
}
