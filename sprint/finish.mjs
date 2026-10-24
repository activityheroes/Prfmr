import { submitMeet } from "./championship.mjs?v=meets-1";
export const ease = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
export function blendPose(a, b, t) {
  if (b === undefined) return a;
  if (typeof a === "number") return a + (b - a) * t;
  if (a === null || typeof a !== "object") return t < 0.5 ? a : b;
  if (Array.isArray(a)) return a.map((value, i) => blendPose(value, b[i], t));
  return Object.fromEntries(Object.keys(a).map(key => [key, blendPose(a[key], b[key], t)]));
}

// Presentation has its own clock. Official time, collisions and marks stay frozen.
export function beginFinish(race, previousBest = null, reducedMotion = false) {
  if (race.presentation || !race.terminal || !race.result) return race.presentation;
  submitMeet(race);
  const id = race.course.id, result = race.result;
  const success = !result.foul && result.cleared !== false;
  const field = ["javelin", "long-jump", "pole-vault", "high-jump", "ski-jumping"].includes(id);
  const value = field ? result.mark : result.time;
  const personalBest = success && (previousBest === null || (field ? value > previousBest : value < previousBest));
  const landedSpear = id === "javelin" && !!race.launch;
  race.presentation = {
    age: 0, success, personalBest, previousBest, value, reducedMotion,
    duration: landedSpear ? 5.8 : field && (race.launch || race.plant) ? 4.2 : 3.4,
    reactionAt: landedSpear ? 3.15 : field && (race.launch || race.plant) ? 0.55 : 0.8,
    skipAt: field && (race.launch || race.plant) ? 1.8 : 1.1
  };
  return race.presentation;
}
export function advanceFinish(race, seconds) {
  const p = race.presentation;
  if (!p || !Number.isFinite(seconds) || seconds <= 0) return false;
  p.age = Math.min(p.duration, p.age + seconds);
  return p.age >= p.duration;
}
export const canShowResult = race => !!race.presentation && race.presentation.age >= race.presentation.skipAt;
export const reactionAge = race => race.presentation
  ? race.presentation.reducedMotion ? 1.4 : Math.max(0, race.presentation.age - race.presentation.reactionAt)
  : 0;
export function finishTravel(race) {
  const p = race.presentation;
  if (!p || !["sprint", "cycling", "hurdles", "speed-skating", "biathlon"].includes(race.course.id)) return 0;
  const t = Math.min(1, p.age / 1.1);
  return Math.min(race.speed, 22) * 0.4 * 1.1 * (t - t * t / 2);
}

// Local runner coordinates: feet remain planted while shoulders and arms react.
export function reactionPose(base, age, success) {
  const target = structuredClone(base), pulse = Math.sin(age * 5) * 0.22;
  target.shoulder = { x: success ? 0.3 : 1.5, y: base.hip.y - (success ? 4.55 : 3.8) };
  target.head = { x: target.shoulder.x + 0.45 + (success ? 0 : Math.sin(age * 4) * 0.3), y: target.shoulder.y - (success ? 2.65 : 1.8) };
  target.limbs.forEach((limb, side) => {
    const sign = side ? -1 : 1, s = target.shoulder;
    limb.elbow = { x: s.x + sign * 2.05, y: s.y + (success ? -1.3 + pulse : 2.1) };
    limb.hand = { x: s.x + sign * (success ? 2.7 : 1.1), y: s.y + (success ? -3.7 + pulse * 2 : 3.9) };
  });
  return blendPose(base, target, ease(age / 0.65));
}

export function renderFinish(race, scene, trigger) {
  const p = race.presentation;
  if (!p) return;
  const $ = id => document.getElementById(id), id = race.course.id;
  const clearance = ["pole-vault", "high-jump"].includes(id);
  const mark = clearance ? (p.success ? race.result.mark.toFixed(2) + " M CLEARED" : "NO CLEARANCE")
    : p.success && ["long-jump", "javelin", "ski-jumping"].includes(id) ? race.result.mark.toFixed(2) + " M"
      : p.success ? race.result.time.toFixed(3) + " S" : id === "ski-jumping" ? "NO MARK" : "FOUL";
  const watchingLanding = id === "javelin" && race.launch && p.age < 2.2;
  const message = watchingLanding ? mark : p.personalBest ? "PERSONAL BEST!" : p.success ? clearance ? "BAR CLEARED!" : "WELL DONE!" : clearance ? "NO CLEARANCE" : id === "ski-jumping" ? "NO JUMP" : "FOUL";
  trigger.disabled = !canShowResult(race);
  trigger.dataset.mode = "finish"; trigger.dataset.tier = p.success ? "success" : "failed";
  $("trigger-main").textContent = canShowResult(race) ? "RESULTS" : p.success ? "FINISH" : "NO MARK";
  $("trigger-top").textContent = p.personalBest ? "PERSONAL BEST" : p.success ? "COMPLETE" : "ATTEMPT OVER";
  $("trigger-bottom").textContent = mark;
  trigger.setAttribute("aria-label", canShowResult(race) ? "Show results" : message);
  $("meet-label").textContent = p.success ? "FINISHED" : "NO MARK";
  $("feedback").textContent = p.success ? mark : (race.result.reason ?? "Foul / no mark").toUpperCase();
  $("feedback").style.color = p.success ? "#b7fa76" : "#ff7f86";
  const call = $("race-call"); call.textContent = message; call.className = "race-call";
  call.style.color = p.success ? "#e7ffd3" : "#ff7f86";
  if (scene) {
    const focus = scene.finishFocus;
    const point = focus ? scene.project(focus.x, focus.y, focus.z ?? 0) : scene.project(scene.art.feedbackX);
    if (!focus) point.y -= scene.art.headHeight * scene.height / (scene.camera.top - scene.camera.bottom);
    call.style.left = Math.max(80, Math.min(scene.width - 80, point.x)) + "px";
    call.style.top = Math.max(8, Math.min(scene.height - 66, point.y - 34)) + "px";
  }
  if (document.querySelector(".timing-guide").dataset.state !== "paused")
    document.querySelector(".timing-label").textContent = p.success ? "COMPLETE" : "NO MARK";
  document.querySelector(".timing-countdown").textContent = "--";
}
