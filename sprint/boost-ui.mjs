import { MODES } from "./engine.mjs?v=zones-2";

export function createBoostUI(tone) {
  const hud = document.createElement("div"); hud.className = "boost-hud";
  const mode = document.createElement("strong"), charge = document.createElement("span"), gain = document.createElement("output");
  gain.setAttribute("aria-live", "off");
  charge.className = "boost-charge";
  const caption = document.createElement("span"); charge.append(caption);
  const pips = Array.from({ length: MODES.perfectStreak }, () => { const pip = document.createElement("i"); pip.setAttribute("aria-hidden", "true"); charge.append(pip); return pip; });
  hud.append(mode, charge, gain); document.querySelector(".timeline-head").before(hud);
  const speed = document.getElementById("speed"), trigger = document.getElementById("trigger");
  let previousRace, ignitions = 0, lastMode = "normal";
  return (race, paused) => {
    if (previousRace !== race) { previousRace = race; ignitions = 0; lastMode = "normal"; }
    const moving = ["sprint", "line"].includes(race.phase), active = moving && !paused;
    const recent = active && race.lastAttempt?.speedGain > 0 && race.time - race.lastAttempt.time < MODES.burstDuration;
    const state = active ? race.mode === "normal" && recent ? "boost" : race.mode : "normal";
    hud.dataset.mode = state; trigger.dataset.boost = state; speed.dataset.boost = state;
    mode.textContent = paused ? "PAUSED" : state === "flame" ? "FLAME MODE" : state === "flow" ? "FLOW" : recent ? race.lastAttempt.grade.toUpperCase() : "MOMENTUM";
    const charged = race.mode === "flame" ? MODES.perfectStreak : race.perfectStreak % MODES.perfectStreak;
    caption.textContent = race.mode === "flame" && moving ? race.flameRemaining.toFixed(1) + "s" : "PERFECT " + charged + "/" + MODES.perfectStreak;
    charge.setAttribute("aria-label", race.mode === "flame" && moving ? "Flame mode: " + race.flameRemaining.toFixed(1) + " seconds remaining" : charged + " of " + MODES.perfectStreak + " consecutive perfect zones");
    pips.forEach((pip, i) => pip.classList.toggle("lit", i < charged));
    const pace = Math.max(0, race.speed / race.stats.baseSpeed - 1);
    const burst = recent ? Math.round(race.lastAttempt.speedGain / Math.max(0.01, race.lastAttempt.speedBefore) * 100) : 0;
    gain.textContent = recent ? "+" + burst + "% BURST"
      : active && pace > 0.005 ? "+" + Math.round(pace * 100) + "% PACE" : race.terminal ? "COMPLETE" : "+0% PACE";
    if (active && race.phase === "sprint" && ["Good", "Great", "Perfect"].includes(race.lastAttempt?.grade) && race.time - race.lastAttempt.time < 1) {
      document.getElementById("feedback").textContent = race.lastAttempt.grade.toUpperCase() + "! / " + (burst ? "+" + burst + "% SPEED" : "MAX PACE");
    }
    hud.style.setProperty("--fuel", (active && race.mode === "flame" ? race.flameRemaining / MODES.flameDuration : active && race.mode === "flow" ? 1 : recent ? race.burstRemaining / MODES.burstDuration : 0) * 100 + "%");
    if (active && race.flameCount > ignitions) {
      tone(1320, 0.28);
      document.getElementById("announcer").textContent = "Flame mode! Two consecutive perfect zones. Six second speed burst.";
    } else if (active && state === "flow" && lastMode !== "flow" && lastMode !== "flame") tone(1100, 0.18);
    ignitions = race.flameCount; lastMode = state;
  };
}
