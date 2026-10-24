import { prepareMeet } from "../sprint/championship.mjs?v=sports-1";
import { installTutorial } from "../sprint/tutorial.mjs?v=sports-1";
import { readEventSave, writeEventSave } from "../sprint/save.mjs?v=sports-1";
import { SkiJumpRace, SKI_COURSE, TAKEOFF_ZONE, HILL } from "./engine.mjs?v=sports-1";
import { landingPoint } from "./course.mjs?v=sports-1";
import { getStats, GEAR, clamp } from "../sprint/engine.mjs?v=sports-1";
import { SkiJumpScene } from "./scene.mjs?v=sports-1";
import { createTimingGuide } from "../sprint/timing-guide.mjs?v=sports-1";
import { beginFinish, advanceFinish, canShowResult, renderFinish } from "../sprint/finish.mjs?v=sports-1";

const $ = id => document.getElementById(id), trigger = $("trigger"), dialog = $("result-dialog"), canvas = $("track");
const storageKey = "dot-ski-jump-zones-v1";
const colors = { Perfect: "#81f6b6", Great: "#ffd473", Good: "#ffd473", Early: "#ed667d", Late: "#ff7f86", Miss: "#ed667d" };
const saved = readEventSave(storageKey);
const loadout = Object.fromEntries(Object.keys(GEAR).map(key => [key, clamp(Math.floor(Number(saved.loadout?.[key]) || 0), 0, 2)]));
let best = Number.isFinite(saved.best) && saved.best > 0 ? saved.best : null;
let scene, race, paused = false, lastTime = performance.now(), resultShown = false, attempt = 1, audioContext;
try { scene = new SkiJumpScene(canvas); } catch (error) { $("scene-error").hidden = false; console.error(error); }
const input = { kind: null, id: null };
const markers = SKI_COURSE.zones.map(z => {
  const el = document.createElement("i"); el.className = "zone-marker"; el.style.left = z.start / HILL.lip * 100 + "%";
  el.style.width = (z.end - z.start) / HILL.lip * 100 + "%"; document.querySelector(".timeline").append(el); return el;
});
const persist = () => writeEventSave(storageKey, { best, loadout });
const announce = text => { $("announcer").textContent = text; };
function tone(frequency, duration = 0.12) {
  if (!$("sound").checked) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(() => {});
    const o = audioContext.createOscillator(), g = audioContext.createGain(); o.frequency.value = frequency;
    g.gain.setValueAtTime(0.04, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    o.connect(g); g.connect(audioContext.destination); o.start(); o.stop(audioContext.currentTime + duration);
  } catch {}
}
function clearInput() {
  const id = input.id; input.kind = null; input.id = null;
  if (id !== null && trigger.hasPointerCapture?.(id)) trigger.releasePointerCapture(id);
}
function reset(keepWeather = false) {
  const seed = keepWeather === true ? race?.weather.seed : undefined;
  clearInput(); paused = false; resultShown = false; $("pause-panel").hidden = true; if (dialog.open) dialog.close();
  race = new SkiJumpRace(loadout).setWeather(seed); prepareMeet(race); race.previousBest = best; lastTime = performance.now();
  const stats = getStats(loadout, SKI_COURSE);
  $("stat-band").textContent = stats.timingTolerance.toFixed(2) + "x edge tolerance";
  $("stat-blocks").textContent = stats.acceleration.toFixed(2) + " m/s2";
  $("stat-spikes").textContent = (stats.maxSpeed * 3.6).toFixed(1) + " km/h maximum"; $("stat-kit").textContent = stats.endurance.toFixed(2) + "x endurance";
  $("kit-label").textContent = Object.values(loadout).some(Boolean) ? "CUSTOM LOADOUT" : "CLUB LOADOUT";
  $("attempt").textContent = String(attempt).padStart(2, "0"); render(); trigger.focus({ preventScroll: true });
}
function sync(now = performance.now()) {
  const dt = Math.max(0, (now - lastTime) / 1000); lastTime = Math.max(lastTime, now);
  if (!paused) {
    if (race.presentation && !resultShown) { if (advanceFinish(race, dt)) showResult(); }
    else race.advance(dt);
  }
  events();
}
function events() {
  for (const event of race.events.splice(0)) {
    if (event === "start") { tone(550); document.querySelector(".equipment").open = false; announce("Automatic downhill glide. Hold through each blue zone and release at its end."); }
    if (event.type === "zone") { tone(event.result.grade === "Perfect" ? 990 : 660); announce("Zone " + event.result.zoneId + ": " + event.result.grade); }
    if (event === "line") { clearInput(); tone(1100); announce("Gold takeoff zone. Hold at entry, then release at the white line to set your takeoff."); }
    if (event === "takeoff-set") { clearInput(); tone(1000); announce("Takeoff set. Approaching the lip."); }
    if (event === "takeoff") { clearInput(); tone(1350, 0.2); announce(race.launch.timing.grade + " takeoff. In flight."); }
    if (event === "landing-prep") { tone(race.landingPrep.grade === "Perfect" ? 1200 : 600); announce(race.landingPrep.grade + " landing preparation."); }
    if (event === "land") { tone(400, 0.1); announce("Skis down. Landing distance "+race.landing.mark.toFixed(1)+" meters."); }
    if (event === "finish") {
      clearInput();
      const finish = beginFinish(race, best, matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (finish.personalBest) { best = finish.value; persist(); }
      tone(finish.success ? 880 : 150, 0.2);
      announce(finish.success ? "Landed. " + race.result.mark.toFixed(2) + " meters." : race.result.reason + ". No mark.");
    }
  }
}
function activate(kind) {
  if (race.terminal) { if (!paused && canShowResult(race)) showResult(); return false; }
  if (!scene || paused || race.terminal || input.kind || !race.press()) return false;
  input.kind = kind; events(); render(); return true;
}
function release(kind, canceled = false) {
  if (input.kind !== kind) return; sync(); if (canceled) race.cancelInput(); else race.release();
  clearInput(); events(); render();
}
function inside(x, y) { const r = trigger.getBoundingClientRect(); return Math.hypot(x - r.left - r.width / 2, y - r.top - r.height / 2) <= r.width / 2; }
trigger.addEventListener("pointerdown", e => {
  if (e.button !== 0 || !e.isPrimary || !inside(e.clientX, e.clientY)) return;
  e.preventDefault(); sync(); if (activate("pointer")) { input.id = e.pointerId; trigger.setPointerCapture(e.pointerId); }
});
trigger.addEventListener("pointermove", e => { if (input.kind === "pointer" && input.id === e.pointerId && !inside(e.clientX, e.clientY)) release("pointer", true); });
trigger.addEventListener("pointerup", e => { if (input.id === e.pointerId) release("pointer", !inside(e.clientX, e.clientY)); });
trigger.addEventListener("pointercancel", e => { if (input.id === e.pointerId) release("pointer", true); });
trigger.addEventListener("lostpointercapture", () => { if (input.kind === "pointer") release("pointer", true); });
trigger.addEventListener("contextmenu", e => e.preventDefault());
trigger.addEventListener("click", e => { if (e.detail === 0 && race.terminal) activate("keyboard"); });
document.addEventListener("keydown", e => {
  if (e.code !== "Space" || e.repeat || e.target.closest("select,input,summary,button:not(#trigger)")) return;
  e.preventDefault(); sync(); activate("keyboard");
});
document.addEventListener("keyup", e => { if (e.code === "Space" && input.kind === "keyboard") { e.preventDefault(); release("keyboard"); } });
$("restart").addEventListener("click", reset); $("again").addEventListener("click", () => { attempt++; reset(); });
dialog.addEventListener("cancel", e => { e.preventDefault(); attempt++; reset(); });
for (const key of Object.keys(GEAR)) {
  $("gear-" + key).value = String(loadout[key]);
  $("gear-" + key).addEventListener("change", e => { if (race.phase !== "ready") return; loadout[key] = Number(e.target.value); persist(); reset(true); });
}
function pause() {
  if (paused || !race.racing && (!race.presentation || resultShown)) return;
  sync(); if (!race.racing && (!race.presentation || resultShown)) return;
  race.cancelInput(); clearInput(); paused = true; $("pause-panel").hidden = false; events(); render();
}
window.addEventListener("blur", pause); document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
$("resume").addEventListener("click", () => { paused = false; lastTime = performance.now(); $("pause-panel").hidden = true; trigger.focus({ preventScroll: true }); });
function showResult() {
  if (resultShown) return; resultShown = true; const r = race.result, old = race.presentation ? race.presentation.previousBest : best;
  const improved = race.presentation?.personalBest ?? (!r.foul && (best === null || r.mark > best)); if (improved) { best = r.mark; persist(); }
  $("result-tag").textContent = r.foul ? "NO MARK" : improved ? "PERSONAL BEST" : "OFFICIAL MARK";
  $("result-title").textContent = r.foul ? "No jump" : "Ski jumping";
  $("result-mark").textContent = r.foul ? "--" : r.mark.toFixed(1); $("result-unit").hidden = r.foul;
  $("result-detail").textContent = r.foul ? r.reason + ". No distance recorded." : old === null ? "Your first measured jump." : improved ? (r.mark - old).toFixed(2) + " m beyond your previous best." : (old - r.mark).toFixed(2) + " m short of your personal best.";
  $("result-stats").replaceChildren();
  for (const [name, value] of [["Takeoff timing", r.takeoffGrade], ["Landing", r.landingStyle], ["Landing timing", r.landingGrade], ["Style points", r.stylePoints + " / 20"],
    ["Takeoff speed", (r.runupSpeed * 3.6).toFixed(1) + " km/h"], ["Air time", r.flightTime.toFixed(2) + " s"], ["Inrun timing", Math.round(r.rhythmScore) + " / 100"], ["Best zone streak", String(r.bestCombo)]]) {
    const row = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = name; dd.textContent = value; row.append(dt, dd); $("result-stats").append(row);
  }
  $("zone-results").replaceChildren();
  for (const z of r.zones) { const li = document.createElement("li"); li.textContent = "ZONE " + z.zoneId + " / " + z.grade.toUpperCase() + " / " + Math.round(z.score); li.style.color = colors[z.grade]; $("zone-results").append(li); }
  announce(r.foul ? r.reason + ". No mark." : "Jump distance " + r.mark.toFixed(2) + " meters.");
  tone(r.foul ? 150 : 880, 0.25); dialog.showModal();
}
const timingGuide = createTimingGuide({ trigger, tone, finishZone: TAKEOFF_ZONE, holdKey: "takeoffStart" });
function render() {
  if (!race) return; scene?.render(race);
  const p = race.phase, flying = !!race.launch, takeoff = p === "line", cue = race.cue, z = race.nextZone;
  const recent = race.lastAttempt && race.time - race.lastAttempt.time < 0.8, grade = recent ? race.lastAttempt.grade : null;
  const feedback = grade === "Early" ? "TOO EARLY" : grade === "Late" ? "TOO LATE" : grade === "Miss" ? "MISSED ZONE" : grade ? grade.toUpperCase() + "!" : "";
  $("main-label").textContent = flying ? race.landing ? "JUMP DISTANCE" : "IN FLIGHT" : "INRUN TIME";
  $("main-unit").textContent = flying ? "m" : "s";
  $("clock").textContent = flying ? (race.landing?.mark ?? landingPoint(race.athlete.x).distance).toFixed(2) : race.elapsed.toFixed(3).padStart(6, "0");
  $("speed-label").textContent = flying ? "HEIGHT" : "SPEED"; $("speed-unit").textContent = flying ? "m" : "km/h";
  $("speed").textContent = (flying ? Math.max(0, race.athlete.y - landingPoint(race.athlete.x).y) : race.speed * 3.6).toFixed(1); $("best").textContent = best === null ? "--.--" : best.toFixed(2);
  $("distance").textContent = race.distance.toFixed(1) + " M"; $("progress").style.width = clamp(race.distance / HILL.lip * 100, 0, 100) + "%";
  document.querySelector(".timeline").setAttribute("aria-valuenow", String(Math.round(race.distance)));
  $("zone-count").textContent = "ZONES " + race.attempts + " / 2";
  $("meet-label").textContent = flying ? race.landing ? "LANDED" : "IN FLIGHT" : race.combo ? "STREAK " + race.combo : "WINTER / K90";
  markers.forEach((m, i) => { m.style.background = colors[race.zones[i].result?.grade] ?? "#65c9ff"; }); $("gear").disabled = p !== "ready";
  trigger.disabled = !scene || race.terminal || p === "landing" || p === "flight" && !!race.landingPrep || !flying && !!race.takeoffTiming; trigger.classList.toggle("is-held", race.holding && !paused);
  trigger.dataset.mode = takeoff || flying ? "line" : "zone"; trigger.dataset.tier = grade?.toLowerCase() ?? cue; trigger.style.setProperty("--charge", "100%");
  $("trigger-main").textContent = p === "ready" ? "START\nRUN" : race.terminal ? "DONE" : p === "landing" ? "LANDED" : flying ? "IN\nFLIGHT" : takeoff ? race.takeoffTiming ? "TAKEOFF\nSET" : "HOLD &\nJUMP" : "TAP &\nHOLD";
  $("trigger-top").textContent = p === "ready" ? "READY" : flying ? race.launch.timing.grade.toUpperCase()
    : takeoff ? race.takeoffTiming ? "TAKEOFF SET" : cue === "release" ? "RELEASE!" : race.holding ? "SET TAKEOFF" : cue === "press" ? "PRESS" : "GET READY"
      : ({ run: "GLIDING", press: "PRESS", hold: "HOLD", release: "RELEASE", lift: "LET GO" })[cue] ?? "FINISHED";
  $("trigger-bottom").textContent = takeoff ? "GOLD TAKEOFF ZONE" : flying ? race.launch.angle.toFixed(1) + " DEG" : race.terminal ? "ATTEMPT COMPLETE" : z ? "ZONE " + z.id + " / 2" : "2 BOOST ZONES";
  trigger.setAttribute("aria-label", p === "ready" ? "Start approach" : takeoff ? "Hold at the gold zone entry and release at the white line to jump before the lip" : "Hold through each blue zone and release at its end. Space also controls the athlete.");
  const active = takeoff || flying || race.terminal ? "line" : race.activeHold || cue === "press" ? "zone" : "run";
  document.querySelectorAll(".phases li").forEach(li => li.classList.toggle("active", li.dataset.phase === active));
  document.querySelector('.phases [data-phase="line"] b').textContent = race.landing ? "LANDING" : flying ? "FLIGHT" : "TAKEOFF";
  $("race-call").textContent = flying ? "" : p === "ready" ? "READY" : race.terminal ? "NO JUMP" : takeoff ? cue === "release" ? "RELEASE!" : race.holding ? "SET TAKEOFF" : cue === "press" ? "PRESS" : "TAKEOFF ZONE" : recent ? feedback : cue === "press" ? "PRESS" : cue === "release" ? "RELEASE" : "";
  $("race-call").style.color = takeoff ? "#ffd473" : colors[grade] ?? "#f0f5f1"; $("race-call").className = "race-call" + (grade === "Perfect" ? " flash" : "");
  const distance = takeoff ? (race.holding ? TAKEOFF_ZONE.end : TAKEOFF_ZONE.start) - race.distance : z ? (race.activeHold ? z.end : z.start) - race.distance : 0;
  $("left-label").textContent = flying ? "AIR TIME" : takeoff ? race.holding ? "TAKEOFF IN" : "TAKEOFF ZONE" : race.activeHold ? "EXIT IN" : "NEXT ZONE";
  $("left-value").innerHTML = (flying ? race.flightTime : Math.max(0, distance)).toFixed(1) + "<span>" + (flying ? "S" : "M") + "</span>";
  $("right-label").textContent = flying ? "TAKEOFF SCORE" : "TIMING SCORE";
  $("right-value").innerHTML = Math.round(flying ? race.launch.timing.score : race.rhythmScore) + "<span>/ 100</span>";
  $("phase-note").textContent = takeoff ? "GOLD ZONE / 125 - 138 M" : flying ? "TAKEOFF / " + race.launch.angle.toFixed(1) + " DEG" : "140 M INRUN";
  $("feedback").style.color = race.result?.foul ? "#ff7f86" : takeoff || flying ? "#ffd473" : colors[grade] ?? "#65c9ff";
  $("feedback").textContent = race.terminal ? race.result.foul ? "NO JUMP / NO MARK" : "VALID JUMP" : flying ? race.landing ? "LANDING / " + race.landing.mark.toFixed(2) + " M" : race.launch.timing.grade.toUpperCase() + " TAKEOFF"
    : takeoff ? race.holding ? "TAKEOFF HOLD ACTIVE" : "GOLD TAKEOFF ZONE" : p === "ready" ? "ON YOUR MARKS" : recent ? feedback + (race.lastAttempt.boost ? " / +" + Math.round(race.lastAttempt.boost * 100) + "%" : "") : race.activeHold ? "ZONE " + z.id + " / HOLD ACTIVE" : "AUTOMATIC GLIDE";
  timingGuide(race, paused);
  if (race.takeoffTiming && takeoff && !paused) { document.querySelector(".timing-label").textContent = "TAKEOFF SET"; document.querySelector(".timing-countdown").textContent = Math.max(0, (HILL.lip - race.distance) / Math.max(1, race.speed)).toFixed(1) + "s"; }
  renderFinish(race, scene, trigger);
  if (scene) { $("race-call").style.left = clamp(scene.callout.x, 78, scene.width - 78) + "px"; $("race-call").style.top = Math.max(34, scene.callout.y) + "px"; }
}
function fit() { const r = canvas.getBoundingClientRect(); scene?.resize(r.width, r.height); }
const tutorial = installTutorial({ getRace: () => race, isPaused: () => paused, sync, render, makeRace: () => new SkiJumpRace(), makeScene: canvas => new SkiJumpScene(canvas) });
new ResizeObserver(() => { fit(); render(); }).observe(canvas); fit(); reset();
function frame(now) { sync(now); if (!tutorial.dialog.open) render(); tutorial.update(); requestAnimationFrame(frame); } requestAnimationFrame(frame);
