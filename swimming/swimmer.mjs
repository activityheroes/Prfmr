import { clamp } from "../sprint/engine.mjs?v=sports-1";
import { blendPose, reactionAge } from "../sprint/finish.mjs?v=sports-1";

const TAU = Math.PI * 2;
const wrap = n => ((n % 1) + 1) % 1;
const ease = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
export const SWIM = { metersPerStroke: 3.1, underwater: 0.6, reach: 7.1 };
export const getSwimCycle = distance => wrap(distance / SWIM.metersPerStroke);

// The motion-lab crawl: opposed arms, high-elbow recovery and a six-beat kick.
export function getSwimPose(cycle, finish = 0) {
  const bob = Math.sin(cycle * TAU * 2) * 0.06;
  const hip = { x: -1.9, y: 0.7 + bob }, shoulder = { x: 2.4, y: 0.22 + bob };
  const breath = Math.sin(Math.PI * clamp((wrap(cycle) - 0.62) / 0.34, 0, 1)) ** 2;
  const head = { x: 4.05, y: -0.25 + bob - breath * 0.22, angle: 0.6 - breath * 0.65 };
  const arms = [0, 1].map(side => {
    const phase = wrap(cycle + side * 0.5), recovering = phase >= SWIM.underwater;
    const u = recovering ? (phase - SWIM.underwater) / (1 - SWIM.underwater) : phase / SWIM.underwater;
    const angle = recovering ? Math.PI + 0.075 + (Math.PI - 0.155) * ease(u) : -0.08 + (Math.PI + 0.155) * ease(u);
    const bend = recovering ? -2.05 * Math.sin(Math.PI * u) : 1.1 * Math.sin(Math.PI * u) ** 1.6;
    const elbow = { x: shoulder.x + Math.cos(angle) * 2.35, y: shoulder.y + Math.sin(angle) * 2.35 };
    const hand = { x: elbow.x + Math.cos(angle + bend) * 2.2, y: elbow.y + Math.sin(angle + bend) * 2.2 };
    if (side === 0 && finish > 0) {
      const t = ease(finish);
      elbow.x += (4.75 - elbow.x) * t; elbow.y += (0.25 - elbow.y) * t;
      hand.x += (SWIM.reach - hand.x) * t; hand.y += (0.12 - hand.y) * t;
    }
    return { phase, recovering, elbow, hand };
  });
  const legs = [0, 1].map(side => {
    const kick = cycle * TAU * 3 + side * Math.PI;
    const thighAngle = Math.PI - 0.04 + Math.sin(kick) * 0.13;
    const shinAngle = thighAngle + 0.08 + 0.14 * (0.5 + 0.5 * Math.sin(kick - 0.5));
    const knee = { x: hip.x + Math.cos(thighAngle) * 4.25, y: hip.y + Math.sin(thighAngle) * 4.25 };
    const ankle = { x: knee.x + Math.cos(shinAngle) * 4.1, y: knee.y + Math.sin(shinAngle) * 4.1 };
    const toe = { x: ankle.x + Math.cos(shinAngle - 0.16), y: ankle.y + Math.sin(shinAngle - 0.16) };
    return { knee, ankle, toe };
  });
  return { hip, shoulder, head, arms, legs };
}

export function drawSwimmer(ctx, x, waterY, unit, race) {
  const cycle = getSwimCycle(race.distance);
  const finish = clamp(race.distance - 49, 0, 1);
  let pose = getSwimPose(cycle, finish);
  if (race.phase === "turn") {
    const tuck = structuredClone(pose);
    tuck.hip = { x: -4, y: 1 }; tuck.shoulder = { x: -1.6, y: 1 }; tuck.head = { x: -0.2, y: 0.7, angle: 0 };
    tuck.arms.forEach((arm, i) => { arm.elbow = { x: -2, y: 2 + i * 0.3 }; arm.hand = { x: -4.2, y: 2.6 }; });
    tuck.legs.forEach((leg, i) => { leg.knee = { x: -2.5, y: 3 + i * 0.3 }; leg.ankle = { x: -5.3, y: 3.4 }; leg.toe = { x: -6, y: 3.2 }; });
    pose = blendPose(pose, tuck, Math.sin(Math.PI * clamp(race.turnTime / 1.1, 0, 1)));
  }
  if (race.presentation) {
    const age = reactionAge(race), target = structuredClone(pose);
    target.hip = { x: 3.7, y: 3.6 }; target.shoulder = { x: 4.6, y: -0.15 };
    target.head = { x: 5, y: -2.15, angle: 0 };
    target.arms[0].elbow = { x: 5.6, y: 0.35 }; target.arms[0].hand = { x: SWIM.reach, y: 0.12 };
    target.arms[1].elbow = { x: 2.5, y: -1.1 }; target.arms[1].hand = { x: 2.9, y: -3.2 + Math.sin(age * 5) * 0.25 };
    target.legs.forEach((leg, i) => {
      leg.knee = { x: 2.4 + i * 0.65, y: 5.25 }; leg.ankle = { x: 3.2 + i * 0.5, y: 7.45 };
      leg.toe = { x: 4 + i * 0.5, y: 7.65 };
    });
    pose = blendPose(pose, target, ease(age / 0.8));
  }
  ctx.save(); ctx.translate(x, waterY); ctx.scale(unit, unit);
  if (race.phase === "turn") {
    ctx.translate(-4, 2); ctx.rotate(-TAU * ease(race.turnTime / 1.1)); ctx.translate(4, -2);
  }
  const dot = (x, y, color, radius = 0.265) => {
    ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x, y, radius, 0, TAU); ctx.fill();
  };
  const bone = (a, b, color, spacing = 0.7, radius = 0.265) => {
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / spacing));
    for (let i = 0; i <= n; i++) dot(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, color, radius);
  };
  const arm = (limb, color) => {
    bone(pose.shoulder, limb.elbow, color, 0.62); bone(limb.elbow, limb.hand, color, 0.62);
    dot(limb.hand.x, limb.hand.y, color, 0.3);
  };
  const leg = (limb, color) => {
    bone(pose.hip, limb.knee, color); bone(limb.knee, limb.ankle, color);
    bone(limb.ankle, limb.toe, color, 0.5, 0.23);
  };
  arm(pose.arms[1], "#397f8b"); leg(pose.legs[1], "#397f8b");
  for (let row = 0; row <= 7; row++) {
    const t = row / 7;
    for (let col = -1; col <= 1; col++) dot(pose.hip.x + (pose.shoulder.x - pose.hip.x) * t,
      pose.hip.y + (pose.shoulder.y - pose.hip.y) * t + col * (0.38 + t * 0.15), t < 0.22 ? "#ff6e9c" : "#79ff78");
  }
  bone(pose.shoulder, { x: pose.head.x - 1.05, y: pose.head.y + 0.3 }, "#bcffc9", 0.55);
  ctx.save(); ctx.translate(pose.head.x, pose.head.y); ctx.rotate(pose.head.angle);
  for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) {
    if (row * row + col * col <= 6) dot(col * 0.56, row * 0.56, col < 0 || row < -1 ? "#65d8ff" : "#e8ffe5", 0.26);
  }
  dot(0.65, -0.25, "#ff6e9c", 0.28); dot(1.2, -0.25, "#ff6e9c", 0.28);
  dot(1.52, 0.28, "#e8ffe5", 0.23); ctx.restore();
  leg(pose.legs[0], "#79ff78"); arm(pose.arms[0], "#bcffc9");
  // Tint only submerged dots; the high recovery elbow stays bright above the surface.
  ctx.save(); ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(14,100,113,0.24)"; ctx.fillRect(-15, 0, 25, 9); ctx.restore();
  if (race.distance > 0 && !race.terminal) {
    for (const limb of pose.arms) if (limb.phase < 0.1) {
      const age = limb.phase / 0.1;
      for (let i = 0; i < 4; i++) dot(pose.shoulder.x + 4.5 - age * (0.5 + i * 0.3),
        -Math.sin(age * Math.PI) * (0.5 + i * 0.4), "#a1fff5", 0.14 * (1 - age));
    }
    for (let i = 0; i < 7; i++) {
      const age = wrap(cycle * 3 + i / 7);
      dot(-10.5 - age * 2.7, 0.8 + Math.sin(i * 2.4) * 0.5 - age * 0.35, "#65d8ff", 0.12 * (1 - age));
    }
  }
  for (let i = 0; i <= 42; i++) {
    const px = -13.2 + i * 0.48;
    dot(px, Math.sin(px * 1.1 + cycle * TAU * 2) * 0.1, "#62e6da", 0.095);
  }
  ctx.restore();
}

export const SWIMMER_ART = {
  width: 512, height: 256, x: 256, ground: 104, unit: 18,
  scaleX: 512 / 18 * 0.14, scaleY: 256 / 18 * 0.14,
  anchorX: (256 + SWIM.reach * 18) / 512, anchorY: 1 - 104 / 256,
  headHeight: 0.9, feedbackX: -0.85, shadowStart: -2.65, shadowLength: 2.7, draw: drawSwimmer
};
