import { clamp } from "../sprint/engine.mjs?v=starts-1";
import { blendPose, ease, reactionAge } from "../sprint/finish.mjs?v=starts-1";

const TAU = Math.PI * 2;
export const BIKE = {
  wheelRadius: 3.65, crankRadius: 1.45, gearRatio: 2.2,
  rear: { x: -6.1, y: -3.65 }, front: { x: 6.35, y: -3.65 },
  crank: { x: -0.65, y: -4.15 }, seatTube: { x: -2.45, y: -8.7 },
  headTube: { x: 4.6, y: -8.9 }, fork: { x: 4.95, y: -7.45 },
  saddle: { x: -2.8, y: -10.5 }, grip: { x: 5.55, y: -9.6 }
};
export const METERS_PER_UNIT = 0.16;
export function getBikeMotion(distance) {
  const wheelAngle = distance / (BIKE.wheelRadius * METERS_PER_UNIT);
  return { wheelAngle: wheelAngle % TAU, cycle: (wheelAngle / (TAU * BIKE.gearRatio)) % 1 };
}
function joint(start, end, upper = 4.25, lower = 4.1, bend = 1) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const reach = Math.max(0.001, Math.hypot(dx, dy));
  const distance = clamp(reach, 0.001, upper + lower - 0.0001);
  const along = (upper ** 2 - lower ** 2 + distance ** 2) / (2 * distance);
  const offset = Math.sqrt(Math.max(0, upper ** 2 - along ** 2)) * bend;
  return { x: start.x + dx / reach * along + dy / reach * offset,
    y: start.y + dy / reach * along - dx / reach * offset };
}
export function getBikePose(cycle) {
  const hip = { x: -2.8, y: -10.95 }, breath = Math.sin(cycle * TAU * 2) * 0.045;
  const shoulder = { x: 2.8, y: -12.95 + breath }, head = { x: 4.05, y: -14.9 + breath };
  const limbs = [0, 1].map(side => {
    const angle = (cycle + side * 0.5) * TAU;
    const pedal = { x: BIKE.crank.x + Math.sin(angle) * BIKE.crankRadius,
      y: BIKE.crank.y - Math.cos(angle) * BIKE.crankRadius };
    const tilt = 0.08 + 0.16 * Math.sin(angle);
    const point = (x, y) => ({ x: pedal.x + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: pedal.y + x * Math.sin(tilt) + y * Math.cos(tilt) });
    const foot = { ankle: point(-0.3, -0.5), heel: point(-0.85, -0.12), toe: point(0.75, -0.12) };
    const hand = { x: BIKE.grip.x - side * 0.22, y: BIKE.grip.y - side * 0.14 };
    return { pedal, foot, hand, elbow: joint(shoulder, hand, 2.35, 2.2, -1), knee: joint(hip, foot.ankle) };
  });
  return { hip, shoulder, head, limbs };
}

export function getCyclistPose(race) {
  let pose = getBikePose(getBikeMotion(race.distance * (race.cadenceMultiplier ?? 1)).cycle);
  if (race.presentation) {
    const target = structuredClone(pose), age = reactionAge(race);
    target.shoulder = { x: 0.3, y: -14.4 }; target.head = { x: 1.5, y: -16.6 };
    target.limbs[0].elbow = { x: 2.2, y: -15.4 };
    target.limbs[0].hand = { x: 2.6, y: -17.5 + Math.sin(age * 5) * 0.3 };
    target.limbs[1].elbow = joint(target.shoulder, target.limbs[1].hand, 2.35, 2.2, -1);
    pose = blendPose(pose, target, ease(age / 0.6));
  }
  return pose;
}

// Ported from the motion lab: feet stay on opposed pedals, hands stay on the drops.
export function drawCyclist(ctx, x, ground, unit, race) {
  const { wheelAngle } = getBikeMotion(race.distance), pose = getCyclistPose(race);
  ctx.save(); ctx.translate(x, ground); ctx.scale(unit, unit);
  const dot = (x, y, color, radius = 0.265) => { ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x, y, radius, 0, TAU); ctx.fill(); };
  const bone = (a, b, color, spacing = 0.7, radius = 0.265) => {
    const count = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / spacing));
    for (let i = 0; i <= count; i++) dot(a.x + (b.x - a.x) * i / count, a.y + (b.y - a.y) * i / count, color, radius);
  };
  const arc = (center, radius, start, end, color, dotRadius = 0.18, spacing = 0.52) => {
    const count = Math.ceil(Math.abs(end - start) * radius / spacing), closed = Math.abs(end - start) >= TAU;
    for (let i = 0; i < count + (closed ? 0 : 1); i++) {
      const angle = start + (end - start) * i / count;
      dot(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, color, dotRadius);
    }
  };
  for (const center of [BIKE.rear, BIKE.front]) {
    for (let i = 0; i < 6; i++) {
      const angle = wheelAngle + i * TAU / 6;
      bone(center, { x: center.x + Math.cos(angle) * 3.3, y: center.y + Math.sin(angle) * 3.3 }, i === 0 ? "#65d8ff" : "#356573", 0.6, 0.115);
    }
    arc(center, BIKE.wheelRadius, 0, TAU, "#65d8ff", 0.235);
    arc(center, BIKE.wheelRadius - 0.42, 0, TAU, "#328879", 0.12);
    dot(center.x, center.y, "#e8ffe5", 0.34);
  }
  const arm = (limb, color) => { bone(pose.shoulder, limb.elbow, color); bone(limb.elbow, limb.hand, color); };
  const leg = (limb, color, shoe) => {
    bone(pose.hip, limb.knee, color); bone(limb.knee, limb.foot.ankle, color);
    bone(BIKE.crank, limb.pedal, "#ad8141", 0.5, 0.15);
    bone({ x: limb.pedal.x - 0.48, y: limb.pedal.y + 0.15 }, { x: limb.pedal.x + 0.48, y: limb.pedal.y + 0.15 }, "#e8ffe5", 0.36, 0.15);
    bone(limb.foot.heel, limb.foot.toe, shoe, 0.5, 0.29);
  };
  arm(pose.limbs[1], "#328879"); leg(pose.limbs[1], "#328879", "#ad8141");
  for (const [from, to] of [[BIKE.rear, BIKE.seatTube], [BIKE.rear, BIKE.crank], [BIKE.seatTube, BIKE.crank],
    [BIKE.seatTube, BIKE.headTube], [BIKE.crank, BIKE.fork], [BIKE.headTube, BIKE.front], [BIKE.seatTube, BIKE.saddle]]) bone(from, to, "#65d8ff", 0.55, 0.23);
  bone({ x: -3.85, y: -10.5 }, { x: -1.65, y: -10.5 }, "#e8ffe5", 0.55, 0.28);
  bone(BIKE.headTube, { x: 4.75, y: -9.65 }, "#65d8ff", 0.5, 0.23);
  bone({ x: 4.75, y: -9.65 }, { x: 6.1, y: -9.65 }, "#e8ffe5", 0.5, 0.23);
  arc({ x: 6.1, y: -8.9 }, 0.75, -Math.PI / 2, Math.PI / 2, "#e8ffe5", 0.23, 0.45);
  bone({ x: 6.1, y: -8.15 }, { x: 5.45, y: -8.15 }, "#e8ffe5", 0.5, 0.23);
  for (const sign of [-1, 1]) bone({ x: BIKE.rear.x, y: BIKE.rear.y + sign * 0.4 }, { x: BIKE.crank.x, y: BIKE.crank.y + sign * 0.82 }, "#ad8141", 0.48, 0.12);
  arc(BIKE.crank, 0.82, 0, TAU, "#ffcf5a", 0.15, 0.42);
  const dx = pose.shoulder.x - pose.hip.x, dy = pose.shoulder.y - pose.hip.y, length = Math.hypot(dx, dy);
  for (let row = 0; row <= 9; row++) {
    const t = row / 9, cx = pose.shoulder.x * (1 - t) + pose.hip.x * t, y = pose.shoulder.y * (1 - t) + pose.hip.y * t;
    for (let col = -1; col <= 1; col++) {
      const offset = col * (0.55 - t * 0.1);
      dot(cx - dy / length * offset, y + dx / length * offset, col === 1 ? "#bcffc9" : "#79ff78");
    }
  }
  bone(pose.shoulder, { x: pose.head.x, y: pose.head.y + 1.1 }, "#bcffc9");
  for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) {
    if (row * row + col * col <= 6) dot(pose.head.x + col * 0.61, pose.head.y + row * 0.61, row < 0 ? "#65d8ff" : "#e8ffe5", 0.27);
  }
  dot(pose.head.x + 1.27, pose.head.y - 0.3, "#65d8ff", 0.3);
  dot(pose.head.x + 0.66, pose.head.y - 0.3, "#65d8ff", 0.3);
  dot(pose.head.x + 1.65, pose.head.y + 0.25, "#e8ffe5", 0.27);
  arc(pose.head, 1.65, Math.PI, TAU, "#65d8ff", 0.25, 0.62);
  bone({ x: pose.head.x - 0.8, y: pose.head.y }, { x: pose.head.x + 0.6, y: pose.head.y + 1.2 }, "#328879", 0.45, 0.13);
  leg(pose.limbs[0], "#79ff78", "#ffcf5a"); dot(BIKE.crank.x, BIKE.crank.y, "#e8ffe5", 0.23);
  arm(pose.limbs[0], "#bcffc9"); ctx.restore();
}

export const CYCLIST_ART = {
  width: 512, height: 320, x: 256, ground: 300, unit: 16,
  scaleX: 5.12, scaleY: 3.2, anchorX: (256 + (BIKE.front.x + BIKE.wheelRadius) * 16) / 512,
  anchorY: 20 / 320, headHeight: 2.7, feedbackX: -0.9,
  shadowStart: -3.1, shadowLength: 3.2, draw: drawCyclist
};
