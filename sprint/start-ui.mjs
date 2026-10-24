export function createStartUI(tone) {
  const panel = document.createElement("div"); panel.className = "start-guide"; panel.hidden = true;
  panel.innerHTML = '<span></span><div aria-hidden="true"><i></i><i></i><i></i></div><strong></strong>';
  document.querySelector(".phases").after(panel);
  let previousRace, previousCue;
  return (race, paused) => {
    const $ = id => document.getElementById(id);
    panel.hidden = !race.starting;
    if (previousRace !== race) { previousRace = race; previousCue = null; }
    if (race.result?.reaction && $("result-stats").children.length && !$("result-stats").querySelector(".reaction-stat")) {
      const row = document.createElement("div"), label = document.createElement("dt"), value = document.createElement("dd");
      row.className = "reaction-stat"; label.textContent = "Start reaction";
      value.textContent = Math.round(race.result.reaction.seconds * 1000) + " ms / " + race.result.reaction.grade;
      row.append(label, value); $("result-stats").append(row);
    }
    $("race-call").classList.toggle("start-call", race.starting);
    if (!race.starting) {
      if (race.reaction && !race.presentation && race.time - race.releaseAt < 1.6) $("feedback").textContent = race.reaction.grade.toUpperCase() + " START / " + Math.round(race.reaction.seconds * 1000) + " MS";
      return false;
    }
    const cue = race.startCue, go = cue === "GO!", ready = cue === "READY", fault = cue === "FALSE START";
    panel.dataset.state = go ? "go" : fault ? "fault" : "set";
    panel.querySelector("span").textContent = paused ? "PAUSED" : ready ? "HOLD TO SET" : fault ? "RELEASED TOO EARLY" : go ? "RELEASE NOW" : "KEEP HOLDING";
    panel.querySelector("strong").textContent = ready ? "REACTION START" : cue;
    panel.querySelectorAll("i").forEach((light, i) => { light.dataset.lit = String(!ready && !fault && (go || cue === "SET" || i < 4 - Number(cue))); });
    $("trigger").disabled = paused || !$("scene-error").hidden; $("trigger").dataset.cue = "idle";
    $("trigger-main").textContent = ready || fault ? "HOLD TO\nSTART" : go ? "RELEASE!" : "HOLD";
    $("trigger-top").textContent = cue; $("trigger-bottom").textContent = "RELEASE ON GO";
    $("trigger").setAttribute("aria-label", ready || fault ? "Hold to start countdown. Release on Go." : go ? "Go. Release now." : cue + ". Keep holding.");
    $("race-call").textContent = paused ? "PAUSED" : cue;
    $("race-call").style.color = go ? "#81f6b6" : fault ? "#ff7f86" : "#ffd473";
    $("feedback").textContent = fault ? "FALSE START / HOLD TO TRY AGAIN" : go ? "GO / RELEASE TO START" : "HOLD THROUGH COUNTDOWN / RELEASE ON GO";
    if (cue !== previousCue && !paused) {
      if (!ready) tone(go ? 1400 : fault ? 150 : 600, go ? 0.2 : 0.09);
      $("announcer").textContent = ready ? "Hold to start the countdown. Release on Go." : cue + (go ? " Release now." : fault ? ". Hold to retry." : ". Keep holding.");
      previousCue = cue;
    }
    return true;
  };
}
