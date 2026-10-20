import { clamp, DIP } from "./engine.mjs";
import { blendPose, reactionAge, reactionPose } from "./finish.mjs";

const TAU = Math.PI * 2;
const gait = { stance: 0.3, stride: 3.2, lift: 5, arm: 1.12, elbow: 1.6, lean: 1.6 };
const ease = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
export const METERS_PER_UNIT = 1 / 6;
export const STRIDE_METERS = 2 * gait.stride / gait.stance * METERS_PER_UNIT;
export const TORSO_FRONT = gait.lean + 0.55 + 0.255;

function joint(start, end, upper = 4.25, lower = 4.1, bend = 1) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const reach = Math.max(0.001, Math.hypot(dx, dy));
  const distance = clamp(reach, 0.001, upper + lower - 0.0001);
  const along = (upper ** 2 - lower ** 2 + distance ** 2) / (2 * distance);
  const offset = Math.sqrt(Math.max(0, upper ** 2 - along ** 2)) * bend;
  return { x: start.x + dx / reach * along + dy / reach * offset, y: start.y + dy / reach * along - dx / reach * offset };
}
function footAt(phase) {
  const t = ((phase % 1) + 1) % 1;
  let x, y, angle;
  if (t < gait.stance) {
    const u = t / gait.stance;
    x = gait.stride * (1 - 2 * u);
    y = 0;
    angle = 0.08 * (1 - ease(u / 0.16)) + 1.05 * ease((u - 0.52) / 0.48);
  } else {
    const u = (t - gait.stance) / (1 - gait.stance);
    const tangent = -2 * gait.stride * (1 - gait.stance) / gait.stance;
    x = -gait.stride + 2 * gait.stride * ease(u) + tangent * u * (1 - u) * (1 - 2 * u);
    const liftPhase = u < 0.4 ? 0.5 * Math.sin(u / 0.4 * Math.PI / 2) : 0.5 + 0.5 * ease((u - 0.4) / 0.6);
    y = -gait.lift * Math.pow(Math.sin(Math.PI * liftPhase), 1.25);
    angle = 1.05 * (1 - ease(u / 0.55)) + 0.08 * ease((u - 0.55) / 0.45);
  }
  x -= 1.15;
  const pivot = angle > 0 ? 0.85 : -0.55;
  const point = (px, py) => ({ x: x + pivot + (px - pivot) * Math.cos(angle) - py * Math.sin(angle), y: y + (px - pivot) * Math.sin(angle) + py * Math.cos(angle) });
  return { heel: point(-0.55, 0), toe: point(0.85, 0), ankle: point(-0.08, -0.5) };
}
export function getRunnerPose(cycle, lean = 0, idle = false) {
  const step = ((cycle * 2) % 1 + 1) % 1 / 2;
  const support = step / gait.stance;
  const flight = (step - gait.stance) / (0.5 - gait.stance);
  const hip = { x: 0, y: idle ? -8.6 : step < gait.stance
    ? -8.1 + 0.5 * Math.sin(Math.PI * support) - 0.4 * ease((support - 0.45) / 0.55)
    : -8.5 + 0.4 * ease(flight) - 0.35 * Math.sin(Math.PI * flight) };
  const chestX = gait.lean + lean * DIP.reach / METERS_PER_UNIT;
  const chestY = -Math.sqrt(4.35 ** 2 + gait.lean ** 2 - chestX ** 2);
  const shoulder = { x: chestX, y: hip.y + chestY };
  const rotation = Math.atan2(chestX, -chestY) - Math.atan2(gait.lean, 4.35);
  const head = { x: shoulder.x + 0.71 * Math.cos(rotation) + 2.7 * Math.sin(rotation),
    y: shoulder.y + 0.71 * Math.sin(rotation) - 2.7 * Math.cos(rotation) };
  const limbs = [0, 1].map(side => {
    const phase = cycle + side * 0.5;
    const foot = idle ? { ankle: { x: side ? -0.8 : 0.8, y: -0.5 }, heel: { x: side ? -1.35 : 0.25, y: 0 }, toe: { x: side ? 0.05 : 1.65, y: 0 } } : footAt(phase);
    const swing = idle ? 0 : -Math.cos(phase * TAU);
    const angle = (swing * gait.arm - 0.08) * (1 - lean) - lean * 1.1;
    const bend = (gait.elbow + swing * 0.15) * (1 - lean) + lean * 0.25;
    const elbow = { x: shoulder.x + Math.sin(angle) * 2.35, y: shoulder.y + Math.cos(angle) * 2.35 };
    const hand = { x: elbow.x + Math.sin(angle + bend) * 2.2, y: elbow.y + Math.cos(angle + bend) * 2.2 };
    return { foot, knee: joint(hip, foot.ankle), elbow, hand };
  });
  return { hip, shoulder, head, limbs };
}
function crouchPose() {
  const hip = { x: -2, y: -5.1 }, shoulder = { x: 1.2, y: -4.25 }, head = { x: 2.4, y: -6.1 };
  const limbs = [0, 1].map(side => {
    const x = side ? -5.3 : -1.8;
    const foot = { ankle: { x, y: -0.5 }, heel: { x: x - 0.5, y: 0 }, toe: { x: x + 0.75, y: 0 } };
    const hand = { x: 2.65 + side * 0.3, y: -0.1 };
    return { foot, knee: joint(hip, foot.ankle), hand, elbow: joint(shoulder, hand, 2.35, 2.2, -1) };
  });
  return { hip, shoulder, head, limbs };
}
function blend(a, b, t) {
  if (typeof a === "number") return a + (b - a) * t;
  if (Array.isArray(a)) return a.map((v, i) => blend(v, b[i], t));
  return Object.fromEntries(Object.keys(a).map(key => [key, blend(a[key], b[key], t)]));
}
export function drawRunner(ctx, x, ground, unit, race) {
  const cycle = race.distance / STRIDE_METERS;
  let pose = getRunnerPose(cycle, race.dipAmount, race.phase === "ready");
  if (race.phase === "ready") pose = crouchPose();
  else if (race.releaseAt !== null && race.time - race.releaseAt < 0.25) pose = blend(crouchPose(), pose, ease((race.time - race.releaseAt) / 0.25));
  if (race.presentation) {
    const idle = getRunnerPose(0, 0, true);
    pose = blendPose(pose, reactionPose(idle, reactionAge(race), race.presentation.success), ease((race.presentation.age - 0.35) / 0.65));
  }
  ctx.save(); ctx.translate(x, ground); ctx.scale(unit, unit);
  const dot = (x, y, color, radius = 0.255) => { ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x, y, radius, 0, TAU); ctx.fill(); };
  const bone = (a, b, color, radius = 0.255) => {
    const count = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 0.68));
    for (let i = 0; i <= count; i++) dot(a.x + (b.x - a.x) * i / count, a.y + (b.y - a.y) * i / count, color, radius);
  };
  const arm = (l, color) => { bone(pose.shoulder, l.elbow, color); bone(l.elbow, l.hand, color); };
  const leg = (l, color, shoe) => { bone(pose.hip, l.knee, color); bone(l.knee, l.foot.ankle, color); bone(l.foot.heel, l.foot.toe, shoe, 0.29); };
  arm(pose.limbs[1], "#447f72"); leg(pose.limbs[1], "#447f72", "#ae874b");
  for (let row = 0; row <= 6; row++) {
    const t = row / 6;
    const cx = pose.shoulder.x * (1 - t) + pose.hip.x * t;
    const y = pose.shoulder.y * (1 - t) + pose.hip.y * t;
    for (let col = -1; col <= 1; col++) dot(cx + col * (0.55 - t * 0.1), y, col === 1 ? "#e7ffd3" : "#b7fa76");
  }
  bone(pose.shoulder, { x: pose.head.x, y: pose.head.y + 1.1 }, "#e7ffd3");
  for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) {
    if (row * row + col * col <= 6) dot(pose.head.x + col * 0.61, pose.head.y + row * 0.61, "#f0f5f1", 0.27);
  }
  dot(pose.head.x + 0.66, pose.head.y - 0.3, "#65c9ff", 0.3);
  dot(pose.head.x + 1.27, pose.head.y - 0.3, "#65c9ff", 0.3);
  dot(pose.head.x + 1.65, pose.head.y + 0.25, "#f0f5f1");
  leg(pose.limbs[0], "#b7fa76", "#ffd473"); arm(pose.limbs[0], "#e7ffd3");
  ctx.restore();
}
