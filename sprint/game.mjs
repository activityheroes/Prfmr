import { SprintRace, SPRINT_COURSE, getStats, GEAR, clamp } from "./engine.mjs";
import { TrackScene } from "./track-scene.mjs";
import { SwimmingRace, SWIMMING_COURSE } from "../swimming/engine.mjs";
import { SWIMMER_ART } from "../swimming/swimmer.mjs";
import { createTimingGuide } from "./timing-guide.mjs";
import { beginFinish, advanceFinish, canShowResult, renderFinish } from "./finish.mjs";

const $ = id => document.getElementById(id);
const sports = {
  sprint: { course: SPRINT_COURSE, Race: SprintRace, athlete: undefined, noun: "runner", event: "SPRINT", action: "RUN", status: "RUNNING", finish: "DIP", storageKey: "dot-sprint-zones-v4" },
  swimming: { course: SWIMMING_COURSE, Race: SwimmingRace, athlete: SWIMMER_ART, noun: "swimmer", event: "SWIM", action: "SWIM", status: "SWIMMING", finish: "THE WALL", storageKey: "dot-swimming-zones-v1" }
};
const eventModules = { cycling: "../cycling/event.mjs?v=track-3", hurdles: "../hurdles/event.mjs", "speed-skating": "../speed-skating/event.mjs", biathlon: "../biathlon/event.mjs?v=2" };
const sport = eventModules[document.body.dataset.sport]
  ? (await import(eventModules[document.body.dataset.sport])).default
  : sports[document.body.dataset.sport] ?? sports.sprint;
const { course, Race, storageKey } = sport;
const speedFactor = sport.speedFactor ?? (course.id === "cycling" ? 3.6 : 1);
const speedUnit = speedFactor === 3.6 ? "km/h" : "m/s";
const displaySpeed = speed => (speed * speedFactor).toFixed(1);
const canvas = $("track"), trigger = $("trigger"), dialog = $("result-dialog");
let scene;
try { scene = new (sport.Scene ?? TrackScene)(canvas, { course, athlete: sport.athlete }); }
catch (error) { $("scene-error").hidden = false; console.error("3D track could not start", error); }
const input = { kind: null, id: null, y: 0, originY: 0 };
const colors = { Perfect: "#d9fbff", Great: "#81f6b6", Good: "#ffd473", Early: "#e8aa62", Late: "#ff7f86", Miss: "#9eabb0" };
const readSave = key => { try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; } };
const saved = readSave(storageKey);
const previousGear = saved.loadout ?? (course.id !== "sprint" ? {} : readSave("dot-sprint-charge-v3").loadout ?? readSave("dot-sprint-pace-v2").loadout ?? readSave("dot-sprint-v1").loadout);
const loadout = Object.fromEntries(Object.keys(GEAR).map(key => [key, clamp(Math.floor(Number(previousGear?.[key]) || 0), 0, 2)]));
let best = Number.isFinite(saved.best) && saved.best > 0 ? saved.best : null;
let race, paused = false, lastTime = performance.now(), resultShown = false;
const zoneMarkers = course.zones.map(zone => {
  const marker = document.createElement("i"); marker.className = "zone-marker";
  marker.style.left = zone.start / course.distance * 100 + "%"; marker.style.width = (zone.end - zone.start) / course.distance * 100 + "%";
  marker.title = "Boost " + zone.id + ": " + zone.start + "-" + zone.end + " m";
  document.querySelector(".timeline").append(marker); return marker;
});
document.querySelector(".marker.finish").style.left = course.finishAt / course.distance * 100 + "%";
const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify({ best, loadout })); } catch {} };
const audio = {
  context: null,
  unlock() {
    if (!$("sound").checked) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      this.context ||= new Audio();
      if (this.context.state === "suspended") this.context.resume().catch(() => {});
    } catch {}
  },
  tone(frequency, duration = 0.12) {
    if (!$("sound").checked || !this.context) return;
    const c = this.context, oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.04, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    oscillator.connect(gain); gain.connect(c.destination); oscillator.start(); oscillator.stop(c.currentTime + duration);
  }
};
function announce(text) { $("announcer").textContent = text; }
const timingGuide = createTimingGuide({ trigger, tone: (frequency, duration) => audio.tone(frequency, duration) });
function sync(now = performance.now()) {
  const dt = Math.max(0, (now - lastTime) / 1000); lastTime = Math.max(lastTime, now);
  if (!paused) {
    if (race.presentation && !resultShown) { if (advanceFinish(race, dt)) showResult(); }
    else race.advance(dt);
  }
  handleEvents();
}
function clearInput() {
  const id = input.id; input.kind = null; input.id = null;
  if (id !== null && trigger.hasPointerCapture?.(id)) trigger.releasePointerCapture(id);
}
function reset() {
  clearInput(); paused = false; $("pause-panel").hidden = true;
  if (dialog.open) dialog.close();
  race = new Race(loadout); lastTime = performance.now(); resultShown = false;
  updateStats(); render(); trigger.focus({ preventScroll: true });
}
function updateStats() {
  const stats = getStats(loadout, course);
  $("stat-band").textContent = stats.timingTolerance.toFixed(2) + "x edge tolerance";
  $("stat-blocks").textContent = stats.acceleration.toFixed(2) + " m/s2";
  $("stat-spikes").textContent = displaySpeed(stats.maxSpeed) + " " + speedUnit + " maximum";
  $("stat-kit").textContent = stats.endurance.toFixed(2) + "x endurance";
  $("kit-label").textContent = Object.values(loadout).some(Boolean) ? "CUSTOM LOADOUT" : "CLUB LOADOUT";
  $("best").textContent = best === null ? "--.---" : best.toFixed(3);
}
function handleEvents() {
  for (const event of race.events.splice(0)) {
    sport.handleEvent?.(event, { clearInput, tone: (frequency, duration) => audio.tone(frequency, duration), announce });
    if (event === "start") {
      audio.unlock(); audio.tone(550); document.querySelector(".equipment").open = false;
      announce("Race started. The " + sport.noun + " moves automatically. Press at each blue zone's entry, hold through it, and release at its exit.");
    }
    if (event.type === "zone") {
      const attempt = event.result;
      audio.tone(attempt.grade === "Perfect" ? 990 : attempt.grade === "Great" ? 820 : attempt.grade === "Good" ? 660 : 160);
      announce("Zone " + attempt.zoneId + ": " + (attempt.canceled ? "canceled" : attempt.grade) + ". Timing score " + Math.round(attempt.score) + ".");
    }
    if (event === "line") {
      input.originY = input.y; audio.tone(1200, 0.08);
      if (!course.finishMove) { race.release(); clearInput(); }
      announce(course.finishMove ? "Finish line. Tap or swipe up to dip." : "Final meters. " + (course.id === "swimming" ? "Reach for the wall." : "Keep going through the line."));
    }
    if (event.type === "hurdle-hit") { audio.tone(150, 0.15); announce("Hurdle " + event.id + " clipped. Momentum lost."); }
    if (event.type === "hurdle-clear") { audio.tone(1040, 0.06); announce("Hurdle " + event.id + " cleared."); }
    if (event === "finish") {
      clearInput();
      const finish = beginFinish(race, best, matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (finish.personalBest) { best = finish.value; persist(); updateStats(); }
      audio.tone(880, 0.2); announce("Finished in " + race.result.time.toFixed(3) + " seconds. " + (finish.personalBest ? "Personal best!" : "Well done!"));
    }
  }
}
function activate(kind) {
  if (race.terminal) { if (!paused && canShowResult(race)) showResult(); return false; }
  if (!scene || paused || race.terminal || input.kind) return false;
  if (!race.press()) return false;
  input.kind = kind;
  handleEvents(); render(); return true;
}
function release(kind, canceled = false) {
  if (input.kind !== kind) return;
  sync();
  if (canceled) race.cancelInput(); else race.release();
  clearInput(); handleEvents(); render();
}
function within(x, y) {
  const rect = trigger.getBoundingClientRect();
  return Math.hypot(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2) <= rect.width / 2;
}
trigger.addEventListener("pointerdown", event => {
  if (event.button !== 0 || !event.isPrimary || !within(event.clientX, event.clientY)) return;
  event.preventDefault(); sync();
  if (!activate("pointer")) return;
  input.id = event.pointerId; input.originY = input.y = event.clientY;
  trigger.setPointerCapture(event.pointerId);
});
trigger.addEventListener("pointermove", event => {
  if (input.kind !== "pointer" || input.id !== event.pointerId) return;
  sync(); input.y = event.clientY;
  if (race.phase === "line") {
    if (input.originY - event.clientY >= 22) race.dip();
  } else if (!within(event.clientX, event.clientY)) { release("pointer", true); return; }
  handleEvents(); render();
});
trigger.addEventListener("pointerup", event => {
  if (event.pointerId === input.id) release("pointer", !within(event.clientX, event.clientY) && race.phase !== "line");
});
trigger.addEventListener("pointercancel", event => { if (event.pointerId === input.id) release("pointer", true); });
trigger.addEventListener("lostpointercapture", () => { if (input.kind === "pointer") release("pointer", true); });
trigger.addEventListener("contextmenu", event => event.preventDefault());
trigger.addEventListener("click", event => { if (event.detail === 0 && race.terminal) activate("keyboard"); });
document.addEventListener("keydown", event => {
  if (event.code !== "Space" || event.repeat || event.target.closest("select,input,summary,button:not(#trigger)")) return;
  event.preventDefault(); sync(); activate("keyboard");
});
document.addEventListener("keyup", event => {
  if (event.code === "Space" && input.kind === "keyboard") { event.preventDefault(); release("keyboard"); }
});
$("restart").addEventListener("click", reset); $("again").addEventListener("click", reset);
dialog.addEventListener("cancel", event => { event.preventDefault(); reset(); });
$("sound").addEventListener("change", () => { if ($("sound").checked) audio.unlock(); });
for (const key of Object.keys(GEAR)) {
  $("gear-" + key).value = String(loadout[key]);
  $("gear-" + key).addEventListener("change", event => {
    if (race.phase !== "ready") return;
    loadout[key] = Number(event.target.value); persist(); reset();
  });
}
function pause() {
  if (paused || !race.racing && (!race.presentation || resultShown)) return;
  sync(); if (!race.racing && (!race.presentation || resultShown)) return;
  race.cancelInput(); clearInput(); paused = true;
  $("pause-panel").hidden = false; handleEvents(); render();
}
window.addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
$("resume").addEventListener("click", () => {
  paused = false; lastTime = performance.now(); $("pause-panel").hidden = true; trigger.focus({ preventScroll: true });
});
function showResult() {
  if (resultShown) return;
  resultShown = true;
  const result = race.result, oldBest = race.presentation ? race.presentation.previousBest : best;
  $("result-title").textContent = "Finish"; $("result-time").textContent = result.time.toFixed(3);
  $("result-tag").textContent = "OFFICIAL RESULT";
  if (race.presentation?.personalBest ?? (best === null || result.time < best)) {
    best = result.time; persist(); updateStats(); $("result-tag").textContent = "PERSONAL BEST";
  }
  $("result-detail").textContent = oldBest === null ? "Your first " + course.zones.length + "-zone " + sport.event.toLowerCase() + "."
    : result.time <= oldBest ? (oldBest - result.time).toFixed(3) + " s faster than your previous best."
      : (result.time - oldBest).toFixed(3) + " s from your personal best.";
  $("result-stats").replaceChildren();
  for (const [name, value] of [
    ["Timing score", Math.round(result.rhythmScore) + " / 100"],
    ["Perfect / great / good", result.counts.Perfect + " / " + result.counts.Great + " / " + result.counts.Good],
    ["Early / late / missed", result.counts.Early + " / " + result.counts.Late + " / " + result.counts.Miss],
    ["Best zone streak", String(result.bestCombo)],
    ["Peak speed", displaySpeed(result.peakSpeed) + " " + speedUnit],
    ...(course.finishMove ? [["Finish dip", result.dip]] : []),
    ...(sport.resultStats?.(result) ?? [])
  ]) {
    const div = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = name; dd.textContent = value; div.append(dt, dd); $("result-stats").append(div);
  }
  $("zone-results").replaceChildren();
  for (const zone of result.zones) {
    const row = document.createElement("li"), heading = document.createElement("div"), detail = document.createElement("small");
    heading.textContent = "ZONE " + zone.zoneId + " / " + zone.grade.toUpperCase() + " / " + Math.round(zone.score);
    heading.style.color = colors[zone.grade];
    detail.textContent = zone.canceled ? "HOLD CANCELED" : "ENTRY " + Math.round(zone.entry * 100) + "%   HOLD " + Math.round(zone.hold * 100) + "%   RELEASE " + Math.round(zone.release * 100) + "%";
    row.append(heading, detail); $("zone-results").append(row);
  }
  audio.tone(880, 0.25); announce("Finished in " + result.time.toFixed(3) + " seconds."); dialog.showModal();
}
function fit() {
  const rect = canvas.getBoundingClientRect(); scene?.resize(rect.width, rect.height);
}
function render() {
  if (!race) return;
  scene?.render(race);
  const phase = race.phase, cue = race.cue, zone = race.nextZone;
  const recent = race.lastAttempt && race.time - race.lastAttempt.time < 1;
  const grade = recent ? race.lastAttempt.grade : null;
  $("clock").textContent = race.elapsed.toFixed(3).padStart(6, "0"); $("speed").textContent = displaySpeed(race.speed);
  $("distance").textContent = (race.terminal ? course.distance : Math.min(course.distance, race.distance)).toFixed(1) + " M";
  $("progress").style.width = (race.terminal ? 100 : clamp(race.distance / course.distance * 100, 0, 100)) + "%";
  document.querySelector(".timeline").setAttribute("aria-valuenow", String(Math.round(race.terminal ? course.distance : race.distance)));
  $("zone-count").textContent = "ZONES " + race.attempts + " / " + course.zones.length;
  $("meet-label").textContent = race.combo ? "STREAK " + race.combo : "RHYTHM " + sport.event;
  zoneMarkers.forEach((marker, i) => { marker.style.background = colors[race.zones[i].result?.grade] ?? "#65c9ff"; });
  $("gear").disabled = phase !== "ready";
  trigger.classList.toggle("is-held", race.holding && !paused);
  trigger.dataset.mode = phase === "line" ? "line" : "zone";
  trigger.dataset.tier = grade?.toLowerCase() ?? cue; trigger.style.setProperty("--charge", "100%");
  trigger.disabled = !scene || race.terminal || phase === "line" && (!course.finishMove || race.dipAt !== null);
  $("trigger-main").textContent = phase === "ready" ? "START\nRACE" : phase === "line" ? sport.finish : race.terminal ? course.distance + " M" : "TAP &\nHOLD";
  $("trigger-top").textContent = phase === "ready" ? "READY" : phase === "line" ? "THE LINE" : race.terminal ? "FINISHED"
    : ({ release: "RELEASE", hold: "HOLD", press: "PRESS", lift: "LET GO", run: sport.status })[cue];
  $("trigger-bottom").textContent = phase === "ready" ? course.distance + " METERS" : phase === "line" ? course.finishMove ? "TAP / SWIPE UP" : "FINAL METERS"
    : race.terminal ? "RACE COMPLETE" : zone ? "ZONE " + zone.id + " / " + course.zones.length : "HOME STRAIGHT";
  trigger.setAttribute("aria-label", phase === "ready" ? "Start race" : phase === "line" ? course.finishMove ? "Tap or swipe up to dip" : sport.status.toLowerCase() + " to the finish" : "Press on zone entry, hold through the blue zone, and release on exit. Space also controls the race.");
  const group = phase === "line" || race.terminal ? "line" : race.activeHold || cue === "press" ? "zone" : "run";
  document.querySelectorAll(".phases li").forEach(li => li.classList.toggle("active", li.dataset.phase === group));
  const feedbackText = grade === "Early" ? "TOO EARLY" : grade === "Late" ? "TOO LATE" : grade === "Miss" ? "MISSED ZONE" : grade ? grade.toUpperCase() + "!" : "";
  $("race-call").className = "race-call" + (grade === "Perfect" ? " flash" : "");
  $("race-call").style.color = colors[grade] ?? "#f0f5f1";
  $("race-call").textContent = phase === "ready" ? "READY" : phase === "line" ? sport.finish : race.terminal ? "FINISH"
    : recent ? feedbackText : race.time - race.offZoneAt < 0.65 ? "OUTSIDE ZONE" : cue === "press" ? "PRESS" : cue === "release" ? "RELEASE" : "";
  if (scene) {
    const foot = scene.project(scene.art.feedbackX), scale = scene.height / (scene.camera.top - scene.camera.bottom);
    $("race-call").style.left = clamp(foot.x, 78, scene.width - 78) + "px";
    $("race-call").style.top = Math.max(8, foot.y - scene.art.headHeight * scale - 30) + "px";
  }
  $("left-label").textContent = race.activeHold ? "EXIT IN" : "NEXT ZONE";
  $("left-value").innerHTML = zone ? Math.max(0, (race.activeHold ? zone.end : zone.start) - race.distance).toFixed(1) + "<span>M</span>" : "--<span>M</span>";
  $("right-label").textContent = "TIMING SCORE";
  $("right-value").innerHTML = Math.round(race.rhythmScore) + "<span>/ 100</span>";
  $("phase-note").textContent = phase === "line" ? course.finishMove ? "98.5 M - 100 M / DIP" : course.distance + " M / " + sport.finish : zone?.id === course.zones.length ? "FINAL BOOST" : course.zones.length + " BOOST ZONES";
  $("feedback").style.color = colors[grade] ?? "#65c9ff";
  $("feedback").textContent = phase === "ready" ? "ON YOUR MARKS" : phase === "line" ? "FINISH LINE" : race.terminal ? "RACE COMPLETE"
    : recent ? race.lastAttempt.canceled ? "ZONE CANCELED" : feedbackText + (race.lastAttempt.boost ? " / +" + Math.round(race.lastAttempt.boost * 100) + "%" : "")
      : race.activeHold ? "ZONE " + zone.id + " / HOLD ACTIVE" : "AUTOMATIC " + sport.action;
  timingGuide(race, paused);
  sport.render?.(race, scene, paused);
  renderFinish(race, scene, trigger);
}
new ResizeObserver(() => { fit(); render(); }).observe(canvas);
fit(); reset();
function frame(now) { sync(now); render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
