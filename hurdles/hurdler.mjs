import { getRunnerPose, STRIDE_METERS } from "../sprint/runner.mjs?v=starts-1";
import { blendPose, ease, finishTravel, reactionAge, reactionPose } from "../sprint/finish.mjs?v=starts-1";

function runningPose(race, idle = false) {
  let raw = getRunnerPose((race.distance + finishTravel(race)) / (STRIDE_METERS * 0.75), 0, idle);
  if (race.presentation && idle) raw = reactionPose(raw, reactionAge(race), true);
  const at = (p, z = 0) => ({ x: p.x * 0.125, y: 0.06 - p.y * 0.125, z });
  return { hip: at(raw.hip), shoulder: at(raw.shoulder), head: at(raw.head), limbs: raw.limbs.map((l, i) => {
    const z = i ? -0.09 : 0.09;
    return { knee: at(l.knee, z), ankle: at(l.foot.ankle, z), heel: at(l.foot.heel, z), toe: at(l.foot.toe, z), elbow: at(l.elbow, z), hand: at(l.hand, z) };
  }) };
}
export function getHurdlerPose(race) {
  let pose = runningPose(race, race.phase === "ready");
  if (race.presentation) return blendPose(pose, runningPose(race, true), ease((race.presentation.age - 0.35) / 0.65));
  if (race.jump) {
    const t = race.jump.age, lift = race.lift;
    const hip = { x: 0, y: 1.07 + lift, z: 0 };
    const at = (x, y, z = 0) => ({ x, y: hip.y + y, z });
    const target = { hip, shoulder: at(0.41, 0.35), head: at(0.65, 0.62), limbs: [
      { knee: at(0.51, -0.02, 0.09), ankle: at(1.02, -0.14, 0.09), heel: at(0.97, -0.17, 0.09), toe: at(1.14, -0.1, 0.09),
        elbow: at(0.81, 0.21, 0.12), hand: at(1.02, 0.4, 0.12) },
      { knee: at(-0.35, -0.05, -0.42), ankle: at(-0.86, -0.12, -0.18), heel: at(-0.96, -0.15, -0.17), toe: at(-0.81, -0.08, -0.17),
        elbow: at(-0.14, 0.3, -0.15), hand: at(0.05, 0.49, -0.15) }
    ] };
    // Reach with the lead leg, fold the trail leg sideways, then return to a running stride.
    const recovery = ease((t / race.jump.duration - 0.68) / 0.32);
    const landing = runningPose(race);
    for (const p of [landing.hip, landing.shoulder, landing.head, ...landing.limbs.flatMap(l => Object.values(l))]) p.y += lift;
    pose = blendPose(race.jump.startPose, target, ease(t / 0.13));
    pose = blendPose(pose, landing, recovery);
  } else if (race.stumbleAt !== null && race.time - race.stumbleAt < 0.55) {
    const stumble = Math.sin(Math.PI * (race.time - race.stumbleAt) / 0.55);
    pose.shoulder.x += stumble * 0.2; pose.head.x += stumble * 0.3; pose.head.y -= stumble * 0.14;
  }
  return pose;
}
export function collisionPoints(race) {
  const p = getHurdlerPose(race), points = [{ ...p.head, radius: 0.16 }];
  for (const [a, b] of [[p.hip, p.shoulder], ...p.limbs.flatMap(l => [[p.hip, l.knee], [l.knee, l.ankle], [l.heel, l.toe]])]) {
    for (const t of [0, 0.5, 1]) points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, radius: 0.04 });
  }
  return points.map(p => ({ ...p, x: p.x + race.distance }));
}
export function hurdlerDots(race) {
  const p = getHurdlerPose(race), dots = [];
  const dot = (point, color, radius = 0.035) => dots.push({ ...point, color, radius });
  const bone = (a, b, color) => {
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.08));
    for (let i = 0; i <= n; i++) dot({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n, z: a.z + (b.z - a.z) * i / n }, color);
  };
  const limb = (l, color, shoe) => {
    bone(p.hip, l.knee, color); bone(l.knee, l.ankle, color); bone(l.heel, l.toe, shoe);
    bone(p.shoulder, l.elbow, color); bone(l.elbow, l.hand, color);
  };
  limb(p.limbs[1], "#447f72", "#a78650");
  for (let row = 0; row <= 7; row++) for (let col = -1; col <= 1; col++)
    dot({ x: p.hip.x + (p.shoulder.x - p.hip.x) * row / 7 + col * 0.055, y: p.hip.y + (p.shoulder.y - p.hip.y) * row / 7, z: 0.02 }, col === 1 ? "#e7ffd3" : "#b7fa76");
  bone(p.shoulder, p.head, "#e7ffd3");
  for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) if (row * row + col * col <= 6)
    dot({ x: p.head.x + col * 0.07, y: p.head.y + row * 0.07, z: 0.02 }, row > 1 ? "#ff7f86" : "#f0f5f1");
  limb(p.limbs[0], "#b7fa76", "#ffd473");
  return dots;
}
