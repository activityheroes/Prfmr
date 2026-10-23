import { readEventSave, writeEventSave } from "../sprint/save.mjs?v=rivals-1";
import { PoleVaultRace, VAULT_COURSE, PLANT_ZONE, VAULT, normalizeBar } from "./engine.mjs?v=rivals-1";
import { getStats, GEAR, clamp } from "../sprint/engine.mjs?v=rivals-1";
import { VaultScene } from "./scene.mjs?v=rivals-1";
import { createTimingGuide } from "../sprint/timing-guide.mjs?v=rivals-1";
import { beginFinish, advanceFinish, canShowResult, renderFinish } from "../sprint/finish.mjs?v=rivals-1";

const $ = id => document.getElementById(id), trigger = $("trigger"), dialog = $("result-dialog"), canvas = $("track");
const storageKey = "dot-pole-vault-zones-v1";
const colors = { Perfect: "#81f6b6", Great: "#ffd473", Good: "#ffd473", Early: "#ed667d", Late: "#ff7f86", Miss: "#ed667d" };
const saved = readEventSave(storageKey);
const loadout = Object.fromEntries(Object.keys(GEAR).map(key => [key, clamp(Math.floor(Number(saved.loadout?.[key]) || 0), 0, 2)]));
let best = Number.isFinite(saved.best) && saved.best >= VAULT.minBar && saved.best <= VAULT.maxBar ? saved.best : null;
let barHeight = normalizeBar(saved.barHeight), scene, race, paused = false, lastTime = performance.now(), resultShown = false, attempt = 1, audioContext;
try { scene = new VaultScene(canvas); } catch (error) { $("scene-error").hidden = false; console.error(error); }
const input = { kind: null, id: null };
const markers = VAULT_COURSE.zones.map(z => {
  const el = document.createElement("i"); el.className = "zone-marker"; el.style.left = z.start / 45 * 100 + "%";
  el.style.width = (z.end - z.start) / 45 * 100 + "%"; document.querySelector(".timeline").append(el); return el;
});
const persist = () => writeEventSave(storageKey, { best, barHeight, loadout });
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
  race = new PoleVaultRace(loadout, barHeight).setWeather(seed); race.previousBest = best; lastTime = performance.now();
  const stats = getStats(loadout, VAULT_COURSE);
  $("stat-band").textContent = stats.timingTolerance.toFixed(2) + "x edge tolerance";
  $("stat-blocks").textContent = stats.acceleration.toFixed(2) + " m/s2";
  $("stat-spikes").textContent = stats.maxSpeed.toFixed(1) + " m/s maximum"; $("stat-kit").textContent = stats.endurance.toFixed(2) + "x endurance";
  $("kit-label").textContent = Object.values(loadout).some(Boolean) ? "CUSTOM LOADOUT" : "CLUB LOADOUT";
  $("bar-height").value = String(barHeight); $("bar-value").textContent = barHeight.toFixed(2);
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
    if (event === "start") { tone(550); document.querySelector(".equipment").open = false; announce("Automatic approach. Hold through each blue zone and release at its end."); }
    if (event.type === "zone") { tone(event.result.grade === "Perfect" ? 990 : 660); announce("Zone " + event.result.zoneId + ": " + event.result.grade); }
    if (event === "line") { clearInput(); tone(1100); announce("Gold plant zone. Hold at entry, then release at the white line to plant the pole."); }
    if (event === "plant") { clearInput(); tone(1350, 0.2); announce(race.plant.timing.grade + " plant. Vaulting."); }
    if (event === "bar-hit") { tone(180, 0.2); announce("Crossbar knocked off."); }
    if (event === "clear") { tone(1200, 0.18); announce("Over the bar."); }
    if (event === "finish") {
      clearInput();
      const finish = beginFinish(race, best, matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (finish.personalBest) { best = finish.value; persist(); }
      tone(finish.success ? 880 : 150, 0.2);
      announce(finish.success ? "Landed on the mat. Bar cleared!" : race.result.reason + ". No clearance.");
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
$("restart").addEventListener("click", reset);
$("again").addEventListener("click", () => { if (race.result?.cleared) barHeight = Math.min(VAULT.maxBar, barHeight + 0.25); attempt++; persist(); reset(); });
$("retry").addEventListener("click", () => { attempt++; reset(); });
dialog.addEventListener("cancel", e => { e.preventDefault(); attempt++; reset(); });
$("bar-height").addEventListener("input", e => { if (race.phase !== "ready") return; barHeight = normalizeBar(e.target.value); persist(); race = new PoleVaultRace(loadout, barHeight).setWeather(race.weather.seed); race.previousBest = best; $("bar-value").textContent = barHeight.toFixed(2); render(); });
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
  if (resultShown) return; resultShown = true; const r = race.result;
  const improved = race.presentation?.personalBest ?? (r.cleared && (best === null || r.mark > best)); if (improved) { best = r.mark; persist(); }
  $("result-tag").textContent = improved ? "PERSONAL BEST" : r.cleared ? "VALID CLEARANCE" : "NO CLEARANCE";
  $("result-title").textContent = r.cleared ? "Bar cleared" : "No clearance";
  $("result-mark").textContent = r.cleared ? r.mark.toFixed(2) : "MISS"; $("result-unit").hidden = !r.cleared;
  $("result-detail").textContent = r.cleared ? "Clear over " + r.barHeight.toFixed(2) + " m. Landed on the mat." : r.reason + " at " + r.barHeight.toFixed(2) + " m.";
  $("result-stats").replaceChildren();
  for (const [name, value] of [["Plant timing", r.plantGrade], ["Takeoff speed", r.approachSpeed.toFixed(1) + " m/s"],
    ["Peak body height", r.peakHeight.toFixed(2) + " m"], ["Run-up timing", Math.round(r.rhythmScore) + " / 100"], ["Best zone streak", String(r.bestCombo)]]) {
    const row = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = name; dd.textContent = value; row.append(dt, dd); $("result-stats").append(row);
  }
  $("zone-results").replaceChildren();
  for (const z of r.zones) { const li = document.createElement("li"); li.textContent = "ZONE " + z.zoneId + " / " + z.grade.toUpperCase() + " / " + Math.round(z.score); li.style.color = colors[z.grade]; $("zone-results").append(li); }
  $("again").textContent = r.cleared && barHeight < VAULT.maxBar ? "Raise to " + (barHeight + 0.25).toFixed(2) + " m" : "Vault again";
  $("retry").hidden = !r.cleared;
  announce(r.cleared ? "Cleared " + r.mark.toFixed(2) + " meters." : r.reason + ". No clearance.");
  tone(r.cleared ? 880 : 150, 0.25); dialog.showModal();
}
const timingGuide = createTimingGuide({ trigger, tone, finishZone: PLANT_ZONE, holdKey: "plantStart" });
function render() {
  if (!race) return; scene?.render(race);
  const p = race.phase, planted = !!race.plant, planting = p === "line", cue = race.cue, z = race.nextZone;
  const recent = race.lastAttempt && race.time - race.lastAttempt.time < 0.8, grade = recent ? race.lastAttempt.grade : null;
  const feedback = grade === "Early" ? "TOO EARLY" : grade === "Late" ? "TOO LATE" : grade === "Miss" ? "MISSED ZONE" : grade ? grade.toUpperCase() + "!" : "";
  $("speed-label").textContent = planted ? "BODY HEIGHT" : "SPEED"; $("speed-unit").textContent = planted ? "m" : "m/s";
  $("speed").textContent = (planted ? race.athlete.y : race.speed).toFixed(1); $("best").textContent = best === null ? "--.--" : best.toFixed(2);
  $("distance").textContent = race.distance.toFixed(1) + " M"; $("progress").style.width = clamp(race.distance / 45 * 100, 0, 100) + "%";
  document.querySelector(".timeline").setAttribute("aria-valuenow", String(Math.round(race.distance)));
  $("zone-count").textContent = "ZONES " + race.attempts + " / 2"; $("meet-label").textContent = planted ? barHeight.toFixed(2) + " M CROSSBAR" : race.combo ? "STREAK " + race.combo : "RHYTHM VAULT";
  markers.forEach((m, i) => { m.style.background = colors[race.zones[i].result?.grade] ?? "#65c9ff"; });
  $("gear").disabled = $("bar-height").disabled = p !== "ready";
  trigger.disabled = !scene || planted || race.terminal; trigger.classList.toggle("is-held", race.holding && !paused);
  trigger.dataset.mode = planting || planted ? "line" : "zone"; trigger.dataset.tier = grade?.toLowerCase() ?? cue; trigger.style.setProperty("--charge", "100%");
  $("trigger-main").textContent = p === "ready" ? "START\nRUN" : race.terminal ? "DONE" : p === "vault" ? "POLE\nBEND" : p === "flight" ? "OVER\nTHE BAR" : p === "landing" ? "LANDED" : planting ? "HOLD &\nPLANT" : "TAP &\nHOLD";
  $("trigger-top").textContent = p === "ready" ? "READY" : planted ? race.barFailed ? "BAR MISSED" : race.barPassed ? "CLEARED" : race.plant.timing.grade.toUpperCase()
    : planting ? cue === "release" ? "RELEASE!" : race.holding ? "LOWER POLE" : cue === "press" ? "PRESS" : "GET READY"
      : ({ run: "RUNNING", press: "PRESS", hold: "HOLD", release: "RELEASE", lift: "LET GO" })[cue] ?? "FINISHED";
  $("trigger-bottom").textContent = planting ? "GOLD PLANT ZONE" : planted ? barHeight.toFixed(2) + " M CROSSBAR" : race.terminal ? "ATTEMPT COMPLETE" : z ? "ZONE " + z.id + " / 2" : "2 BOOST ZONES";
  trigger.setAttribute("aria-label", p === "ready" ? "Start approach" : planting ? "Hold through the gold zone and release at the white line to plant the pole" : "Hold through each blue zone and release at its end. Space also controls the athlete.");
  const active = planting || planted || race.terminal ? "line" : race.activeHold || cue === "press" ? "zone" : "run";
  document.querySelectorAll(".phases li").forEach(li => li.classList.toggle("active", li.dataset.phase === active));
  $("race-call").textContent = planted ? "" : p === "ready" ? "READY" : race.terminal ? "MISSED PLANT" : planting ? cue === "release" ? "RELEASE!" : race.holding ? "LOWER POLE" : cue === "press" ? "PRESS" : "PLANT ZONE" : recent ? feedback : cue === "press" ? "PRESS" : cue === "release" ? "RELEASE" : "";
  $("race-call").style.color = planting ? "#ffd473" : colors[grade] ?? "#f0f5f1";
  $("race-call").className = "race-call" + (grade === "Perfect" ? " flash" : "");
  if (scene) { const foot = scene.project(0), scale = scene.height / (scene.camera.top - scene.camera.bottom); $("race-call").style.left = clamp(foot.x, 78, scene.width - 78) + "px"; $("race-call").style.top = Math.max(42, foot.y - 3 * scale - 30) + "px"; }
  const distance = planting ? (race.holding ? PLANT_ZONE.end : PLANT_ZONE.start) - race.distance : z ? (race.activeHold ? z.end : z.start) - race.distance : 0;
  $("left-label").textContent = planted ? "PEAK HEIGHT" : planting ? race.holding ? "PLANT IN" : "PLANT ZONE" : race.activeHold ? "EXIT IN" : "NEXT ZONE";
  $("left-value").innerHTML = (planted ? race.peakHeight : Math.max(0, distance)).toFixed(1) + "<span>M</span>";
  $("right-label").textContent = planted ? "PLANT SCORE" : "TIMING SCORE";
  $("right-value").innerHTML = Math.round(planted ? race.plant.timing.score : race.rhythmScore) + "<span>/ 100</span>";
  $("phase-note").textContent = planting ? "GOLD ZONE / 39.5 - 42 M" : planted ? "CROSSBAR / " + barHeight.toFixed(2) + " M" : "45 M RUNWAY";
  $("feedback").style.color = race.barFailed ? "#ff7f86" : planting || planted ? "#ffd473" : colors[grade] ?? "#65c9ff";
  $("feedback").textContent = race.terminal ? race.result.cleared ? "VALID CLEARANCE" : race.result.reason.toUpperCase() : planted ? race.barHit ? "BAR KNOCKED OFF" : race.barPassed ? race.barFailed ? "BELOW THE BAR" : "BAR CLEARED" : p === "vault" ? "POLE BEND / RISE" : "CROSSBAR APPROACH"
    : planting ? race.holding ? "PLANT HOLD ACTIVE" : "GOLD PLANT ZONE" : p === "ready" ? "ON YOUR MARKS" : recent ? feedback + (race.lastAttempt.boost ? " / +" + Math.round(race.lastAttempt.boost * 100) + "%" : "") : race.activeHold ? "ZONE " + z.id + " / HOLD ACTIVE" : "AUTOMATIC RUN-UP";
  timingGuide(race, paused);
  renderFinish(race, scene, trigger);
}
function fit() { const r = canvas.getBoundingClientRect(); scene?.resize(r.width, r.height); }
new ResizeObserver(() => { fit(); render(); }).observe(canvas); fit(); reset();
function frame(now) { sync(now); render(); requestAnimationFrame(frame); } requestAnimationFrame(frame);
