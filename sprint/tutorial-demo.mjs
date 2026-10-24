import { beginFinish, advanceFinish } from "./finish.mjs?v=meets-1";
import { DIP } from "./engine.mjs?v=meets-1";

export const LESSONS = {
  sprint: ["Run automatically. Press at HOLD, keep holding across blue, then release in green. Yellow is good; red loses momentum.", "At 98.5m, tap once to dip. Aim for the lean to peak at the finish line."],
  cycling: ["The bike pedals automatically. Hold through the blue track strip and release in green to accelerate.", "Carry your momentum through the finish. No extra tap is needed. Ride and Track views use the same timing."],
  swimming: ["The swimmer moves automatically. Hold across blue and release in green for a faster stroke and carryover momentum.", "Keep your speed to the wall. The swimmer reaches automatically; no finish tap is needed."],
  hurdles: ["Each barrier has its own blue zone. Press at entry and release in green to jump. Keep timing every hurdle.", "Release triggers each jump. A late release clips the barrier and loses speed; the next hurdle is another chance."],
  "speed-skating": ["Glide automatically. Press at the blue entry, hold through the strip, and release in green for a stronger push.", "Build speed through the two zones, then glide through the finish. No extra finish input is needed."],
  biathlon: ["Ski automatically over the hills. Hold across blue and release in green to build momentum for the climb.", "At the range, hold to steady your aim. Release when the sight is centered. Hit five targets; misses add two seconds."],
  javelin: ["Run automatically. Hold through blue and release in green to build approach speed.", "At the gold strip, hold to draw back and release at the white exit to throw. Release before the foul line; watch the spear land."],
  "long-jump": ["Build run-up speed with a blue-zone hold and a green release.", "Hold in the gold takeoff zone and release at its white exit before the board. The jump and landing then play automatically."],
  "pole-vault": ["Build your approach with the two blue zones. Hold from entry and release in green.", "Hold in gold, then release at the white exit to plant the pole. Watch the clearance and mat landing. A knocked bar is no clearance."],
  "high-jump": ["Run the curved approach automatically. Hold across blue and release in green for speed.", "Hold through the gold takeoff strip and release at its white exit. The athlete jumps off one foot and lands on the mat."],
  "ski-jumping": ["Tuck down the hill automatically. Hold through blue and release in green to gain takeoff speed.", "Hold across the gold lip zone and release at its white exit. Flight, V-style skis, and landing follow automatically."]
};

export function driveDemo(r, seconds) {
  for (let remaining = seconds; remaining > 1e-9 && !r.terminal; remaining -= 1 / 240) {
    if (r.phase === "ready") { r.press(); r.release(); }
    const z = r.nextZone;
    if (r.phase === "sprint" && z) {
      if (!r.holding && r.distance >= z.start) r.press();
      if (r.holding && r.distance >= z.end) r.release();
    }
    if (r.phase === "line") {
      if (r.finishZone) {
        if (!r.holding && r.distance >= r.finishZone.start) r.press();
        if (r.holding && r.distance >= r.finishZone.end) r.release();
      } else if (r.course.finishMove && r.dipAt === null && r.distance >= r.course.distance - DIP.reach - r.speed * DIP.peak) r.dip();
    }
    if (r.phase === "shooting") {
      if (r.canAim && !r.holding) r.press();
      if (r.holding && r.heldFor >= 0.35 && r.aim.centered) r.release();
    }
    r.advance(Math.min(1 / 240, remaining)); r.events.length = 0;
  }
}

export function createDemo(factory, lesson) {
  const race = factory().setWeather(4, "clear"), id = race.course.id;
  const target = lesson === 0 ? race.zones[0].start - race.stats.baseSpeed
    : lesson === 1 ? race.zones[1].end + 0.1
      : id === "biathlon" ? 198 : id === "hurdles" ? race.zones[1].start - 2
        : (race.finishZone?.start ?? race.course.finishAt) - race.stats.baseSpeed;
  for (let i = 0; i < 20000 && race.distance < target && !race.terminal; i++) driveDemo(race, 1 / 60);
  return { race, lesson, age: 0, completedAt: null };
}
export function advanceDemo(demo, dt, reduced = false) {
  demo.age += dt;
  const r = demo.race;
  if (demo.lesson === 1 && demo.age < 1) return;
  if (demo.lesson === 1 && r.canActivateFlame) r.activateFlame();
  if (r.terminal) {
    beginFinish(r, null, reduced); advanceFinish(r, dt);
  } else driveDemo(r, dt * (demo.lesson === 2 && (r.launch || r.plant) ? 1 : 0.8));
  if (demo.completedAt === null && (demo.lesson === 0 && r.zones[0].result || demo.lesson === 1 && demo.age > 4 || r.terminal)) demo.completedAt = demo.age;
}
export function demoCue(demo) {
  const r = demo.race;
  if (demo.lesson === 1) return demo.age < 1 ? "FLAME READY" : "IGNITE / SIX SECONDS";
  if (r.terminal) return r.result.foul || r.result.cleared === false ? "NO MARK" : "FINISHED";
  if (r.phase === "shooting") return r.holding ? r.canHit ? "RELEASE / CENTERED" : "HOLD / STEADY" : "PRESS / AIM";
  if (r.launch || r.plant) return "WATCH THE LANDING";
  if (r.phase === "line" && r.course.finishMove) return "TAP / DIP";
  if (r.lastAttempt && r.time - r.lastAttempt.time < 0.5) return r.lastAttempt.grade.toUpperCase() + "!";
  return ({ run: "AUTOMATIC PACE", prepare: "GET READY", press: "PRESS & HOLD", hold: "HOLD", release: "RELEASE IN GREEN" })[r.cue] ?? "FINISH";
}
