import { getRunnerPose, STRIDE_METERS } from "../sprint/runner.mjs?v=starts-1";
import { clamp } from "../sprint/engine.mjs?v=starts-1";
import { poseDots, worldStandingPose } from "../pole-vault/vaulter.mjs?v=starts-1";
import { blendPose, reactionAge } from "../sprint/finish.mjs?v=starts-1";

const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export function getJumperPose(race) {
  if (!race.launch) {
    if (race.presentation) return worldStandingPose(race, race.distance - 0.48);
    const raw = getRunnerPose(race.distance / STRIDE_METERS, 0, race.phase === "ready" || race.terminal);
    const at = p => ({ x: race.distance + (p.x - 3) * 0.16, y: 0.08 - p.y * 0.16 });
    return { hip: at(raw.hip), shoulder: at(raw.shoulder), head: at(raw.head),
      limbs: raw.limbs.map(l => ({ knee: at(l.knee), ankle: at(l.foot.ankle), toe: at(l.foot.toe), heel: at(l.foot.heel), elbow: at(l.elbow), hand: at(l.hand) })) };
  }
  const t = clamp(race.flightTime / race.launch.duration, 0, 1), gather = ease((t - 0.3) / 0.6);
  const settle = ease(race.landTime / 0.55), hip = { x: race.athlete.x + settle * 1.45, y: race.athlete.y - settle * 0.14 };
  const at = (x, y) => ({ x: hip.x + x, y: hip.y + y });
  const blend = (a, b) => at(a[0] + (b[0] - a[0]) * gather, a[1] + (b[1] - a[1]) * gather);
  const shoulder = blend([0.04, 0.62], [0.36, 0.55]), head = blend([0.08, 1.04], [0.54, 0.96]);
  const limbs = [0, 1].map(side => {
    const s = side ? -1 : 1;
    const knee = blend(side ? [-0.34, -0.45] : [0.55, -0.03], [0.53 + side * 0.08, -0.12]);
    const ankle = blend(side ? [-0.58, -0.89] : [0.44, -0.61], [1.02 + side * 0.09, -0.51]);
    ankle.y += settle * 0.14;
    const heel = { x: ankle.x - 0.06, y: ankle.y - 0.04 }, toe = { x: ankle.x + 0.2, y: ankle.y + 0.02 };
    const hand = blend([s * 0.42, 1.14], [0.92 + side * 0.1, 0.22]);
    const elbow = mix(shoulder, hand, 0.5); elbow.x -= 0.13;
    return { knee, ankle, heel, toe, elbow, hand };
  });
  const pose = { hip, shoulder, head, limbs };
  return race.presentation ? blendPose(pose, worldStandingPose(race, race.athlete.x + 2.45), ease(reactionAge(race) / 0.85)) : pose;
}
export const jumperDots = race => poseDots(getJumperPose(race));
export const landingHeels = race => getJumperPose(race).limbs.map(limb => limb.heel);
