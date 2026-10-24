export function createSportActionUI() {
  const panel = document.createElement("div"); panel.className = "sport-action"; panel.hidden = true;
  panel.innerHTML = '<div class="sport-action-heading"><strong></strong><span></span></div><div class="sport-action-meter" aria-hidden="true"><i class="action-good"></i><i class="action-perfect"></i><b></b></div>';
  document.querySelector(".phases").after(panel);
  const title = panel.querySelector("strong"), status = panel.querySelector("span"), marker = panel.querySelector("b");
  return (race, paused) => {
    const action = race.specialAction; panel.hidden = !action;
    if (!action) return false;
    title.textContent = action.title; status.textContent = paused ? "PAUSED" : action.status;
    marker.style.left = Math.max(1, Math.min(99, action.progress * 100)) + "%";
    for (const name of ["good", "perfect"]) {
      const band = panel.querySelector(".action-" + name);
      band.style.left = action[name][0] * 100 + "%"; band.style.width = (action[name][1] - action[name][0]) * 100 + "%";
    }
    const $ = id => document.getElementById(id);
    $("trigger-main").textContent = action.main; $("trigger-top").textContent = action.title;
    $("trigger-bottom").textContent = paused ? "PAUSED" : "SPACE / TOUCH";
    $("trigger").setAttribute("aria-label", action.title + ". " + action.status);
    $("trigger").dataset.cue = "idle";
    $("feedback").textContent = action.status;
    $("race-call").textContent = paused ? "" : action.status;
    $("race-call").style.color = action.progress >= action.perfect[0] && action.progress <= action.perfect[1] ? "#81f6b6" : "#ffd473";
    return true;
  };
}
