export function finishDelta(p, field) {
  if (!p.success) return "NEXT ATTEMPT";
  if (p.previousBest === null) return "FIRST PERSONAL BEST";
  const gain = field ? p.value - p.previousBest : p.previousBest - p.value;
  return Math.abs(gain).toFixed(field ? 2 : 3) + (field ? " M " : " S ")
    + (Math.abs(gain) < 0.0005 ? "LEVEL WITH BEST" : gain > 0 ? "BETTER THAN BEST" : "FROM BEST");
}

export function createRaceFeedback(tone) {
  const status = document.createElement("span"); status.className = "rival-status";
  const timeline = document.querySelector(".timeline-head"); timeline.insertBefore(status, timeline.lastElementChild);
  const banner = document.createElement("div"); banner.className = "finish-banner"; banner.hidden = true;
  const headline = document.createElement("strong"), detail = document.createElement("span"); banner.append(headline, detail);
  document.querySelector(".track").append(banner);
  const speed = document.getElementById("speed"), reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let previous, notes = 0;
  return (race, paused) => {
    if (previous !== race) { previous = race; notes = 0; }
    const field = !!race.finishZone, ghost = race.rival?.ghost, p = race.presentation;
    const gap = ghost ? race.distance - ghost.distance : 0;
    status.dataset.ahead = String(gap >= 0);
    status.textContent = ghost ? race.phase === "ready" ? "PB GHOST READY" : Math.abs(gap).toFixed(1) + " M " + (gap >= 0 ? "AHEAD" : "BEHIND")
      : field && race.previousBest ? "PB " + race.previousBest.toFixed(2) + " M" : "SET YOUR BEST";
    status.title = ghost ? "Personal-best replay using its original equipment and weather" : "Personal best for this course";
    const burst = race.lastAttempt?.speedGain > 0 && !race.terminal ? Math.max(0, 1 - (race.time - race.lastAttempt.time) / 0.5) : 0;
    speed.style.transform = reduced.matches ? "none" : "scaleY(" + (1 + burst * 0.16) + ")";
    banner.hidden = !p || p.age < p.reactionAt || document.getElementById("result-dialog").open;
    if (!p) return;
    banner.dataset.best = String(p.personalBest); banner.dataset.success = String(p.success);
    headline.textContent = p.success ? p.value.toFixed(field ? 2 : 3) + (field ? " M" : " S") : "NO MARK";
    detail.textContent = finishDelta(p, field);
    status.textContent = p.personalBest ? "NEW PERSONAL BEST" : p.success ? "FINISHED" : "NO MARK";
    if (!paused && p.age >= p.reactionAt + notes * 0.18 && notes < 3) {
      tone(p.success ? (p.personalBest ? [880, 1108, 1320] : [660, 784, 880])[notes] : 180, 0.14);
      notes = p.success ? notes + 1 : 3;
    }
  };
}
