import { BiathlonRace, BIATHLON_COURSE, RANGE } from "./engine.mjs?v=zones-2";
import { BiathlonScene } from "./scene.mjs?v=zones-2";
import { trailGrade } from "./course.mjs?v=zones-2";

export default { course: BIATHLON_COURSE, Race: BiathlonRace, Scene: BiathlonScene, speedFactor: 3.6,
  noun: "skier", event: "BIATHLON", action: "SKI", status: "SKIING", finish: "FINISH", storageKey: "dot-biathlon-v1",
  resultStats: result => [["Targets hit", result.hits + " / 5"], ["Time penalty", "+" + result.penalty.toFixed(1) + " s"], ["Course + range time", result.courseTime.toFixed(3) + " s"]],
  handleEvent(event, { clearInput, tone, announce }) {
    if (event.type === "range-enter") { clearInput(); tone(440, 0.18); announce("Shooting range. Five targets. Hold to steady the sight, then release when it turns cyan. Each miss adds two seconds."); }
    if (event.type === "range-exit") { clearInput(); tone(740); announce("Range complete. Skiing resumes automatically."); }
    if (event.type === "shot") { tone(event.shot.hit ? 1040 : 180); announce("Target " + event.shot.id + (event.shot.hit ? " hit." : " missed. Two seconds added.")); }
    if (event.type === "steady") announce("Hold a little longer to steady your aim. No shot used.");
  },
  render(race, scene, paused) {
    const $ = id => document.getElementById(id), shooting = race.phase === "shooting", grade = trailGrade(race.distance);
    document.body.dataset.stage = shooting ? "shooting" : "skiing";
    $("range-panel").hidden = !shooting;
    if (race.terminal) return;
    $("meet-label").textContent = race.rangeVisited ? "TARGETS " + race.hits + " / 5" : "WINTER / 400 M";
    $("phase-note").textContent = shooting ? "STANDING / FIVE TARGETS" : grade > 0.04 ? "UPHILL / POWER" : grade < -0.04 ? "DOWNHILL / GLIDE" : race.distance > 210 ? "HOME TRAIL" : "ROLLING TRAIL";
    document.querySelectorAll(".phases li").forEach(li => li.classList.toggle("active", li.dataset.phase === (shooting ? "shoot" : race.phase === "line" ? "line" : "run")));
    if (scene?.finishFocus) {
      const p = scene.project(scene.finishFocus.x, scene.finishFocus.y, scene.finishFocus.z);
      $("race-call").style.left = Math.max(78, Math.min(scene.width - 78, p.x)) + "px";
      $("race-call").style.top = Math.max(36, p.y - 30) + "px";
    }
    if (!shooting) return;
    const done = race.shots.length === RANGE.targets, settling = race.rangeAge < RANGE.settle, reloading = race.time < race.reloadUntil;
    const cue = paused ? "PAUSED" : done ? "RANGE CLEAR" : settling ? "SETTLING" : reloading ? "RELOADING" : race.canHit ? "RELEASE" : race.holding ? "STEADY" : "HOLD TO AIM";
    $("range-title").textContent = done ? "RANGE COMPLETE" : "TARGET " + (race.shots.length + 1) + " / 5";
    $("sight").style.left = (50 + race.aim.x * 40) + "%"; $("sight").style.top = (50 + race.aim.y * 40) + "%";
    $("scope").style.setProperty("--radius", race.aim.radius); $("scope").dataset.hit = String(race.canHit); $("scope").hidden = done;
    $("range-score").textContent = done ? race.hits + " / 5 HITS" : cue;
    document.querySelectorAll(".target-light").forEach((target, i) => {
      const shot = race.shots[i]; target.dataset.state = shot ? shot.hit ? "hit" : "miss" : i === race.shots.length ? "active" : "pending";
      target.setAttribute("aria-label", "Target " + (i + 1) + ": " + (shot ? shot.hit ? "hit" : "missed" : "pending"));
    });
    const trigger = $("trigger"); trigger.dataset.mode = "shoot"; trigger.dataset.cue = race.canHit ? "release" : "idle";
    trigger.disabled = !scene || paused || !race.canAim && !race.holding;
    trigger.setAttribute("aria-label", cue + ". Hold to steady, release while the sight is cyan.");
    $("trigger-top").textContent = "SHOOTING RANGE";
    $("trigger-main").textContent = done ? "SKI ON" : settling ? "SETTLE" : reloading ? "RELOAD" : race.canHit ? "RELEASE" : race.holding ? "STEADY" : "HOLD TO\nAIM";
    $("trigger-bottom").textContent = done ? "FINAL 200 M" : "TARGET " + Math.min(5, race.shots.length + 1) + " / 5";
    $("left-label").textContent = "TARGETS HIT"; $("left-value").innerHTML = race.hits + "<span>/ 5</span>";
    $("right-label").textContent = "PENALTY"; $("right-value").innerHTML = "+" + race.penalty + "<span>SEC</span>";
    $("zone-count").textContent = "SHOTS " + race.shots.length + " / 5";
    const recent = race.lastShot && race.time - race.lastShot.time < 0.75;
    $("race-call").textContent = recent ? race.lastShot.hit ? "HIT!" : "MISS / +2 S" : settling ? "RANGE" : "";
    $("race-call").style.color = recent && !race.lastShot.hit ? "#ff7f86" : "#234c46";
    $("feedback").textContent = recent ? race.lastShot.hit ? "TARGET HIT" : "MISSED / +2 SECONDS" : cue;
    document.querySelector(".timing-label").textContent = "RANGE"; document.querySelector(".timing-countdown").textContent = race.hits + "/5";
  }
};
