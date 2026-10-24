import { createDemo, advanceDemo, demoCue, LESSONS } from "./tutorial-demo.mjs?v=sports-1";
import { EVENTS } from "./championship.mjs?v=sports-1";

export function installTutorial({ getRace, makeRace, makeScene, sync, render, isPaused }) {
  const id = makeRace().course.id, key = "dot-tutorial-" + (["cycling", "swimming", "ski-jumping"].includes(id) ? "v2-" : "v1-") + id;
  const button = document.createElement("button"); button.type = "button"; button.className = "nav-command"; button.textContent = "How to Play";
  document.querySelector(".event-nav").append(button);
  const dialog = document.createElement("dialog"); dialog.className = "tutorial-dialog"; dialog.setAttribute("aria-labelledby", "tutorial-title");
  dialog.innerHTML = '<div class="meet-heading"><span class="eyebrow">HOW TO PLAY</span><button type="button" class="text-button" data-close>Skip</button></div><h2 id="tutorial-title"></h2><div class="tutorial-tabs" role="tablist" aria-label="Lessons"></div><div class="tutorial-stage"><canvas aria-label="Animated sport demonstration"></canvas><strong class="tutorial-cue"></strong><span class="tutorial-touch" aria-hidden="true"></span></div><p class="tutorial-copy"></p><div class="tutorial-actions"><button type="button" class="text-button" data-motion>Pause animation</button><button type="button" class="text-button" data-next>Next</button><button type="button" class="primary-button" data-play>Play</button></div>';
  document.body.append(dialog); dialog.querySelector("h2").textContent = EVENTS[id].name;
  let scene, demo, index = 0, frameId = null, last = 0, stopped = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const cue = dialog.querySelector(".tutorial-cue"), touch = dialog.querySelector(".tutorial-touch"), motion = dialog.querySelector("[data-motion]");
  const sight = document.createElement("div"), dot = document.createElement("i"); sight.className = "tutorial-aim"; sight.append(dot); sight.hidden = true;
  dialog.querySelector(".tutorial-stage").append(sight);
  const sportMeter = document.createElement("div"); sportMeter.className = "sport-action-meter tutorial-sport-meter"; sportMeter.hidden = true;
  sportMeter.innerHTML = '<i class="action-good"></i><i class="action-perfect"></i><b></b>'; dialog.querySelector(".tutorial-stage").append(sportMeter);
  const tabs = ["Timing", "Flame", ({ cycling: "Drafting", swimming: "Turn", "ski-jumping": "Landing", biathlon: "Shooting", hurdles: "Hurdles" })[id] ?? "Finish"].map((label, i) => {
    const tab = document.createElement("button"); tab.type = "button"; tab.role = "tab"; tab.textContent = label;
    tab.addEventListener("click", () => select(i)); dialog.querySelector(".tutorial-tabs").append(tab); return tab;
  });
  function draw() {
    if (!scene || !demo) return;
    const canvas = dialog.querySelector("canvas"), rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height && (scene.width !== rect.width || scene.height !== rect.height)) scene.resize(rect.width, rect.height);
    scene.render(demo.race); cue.textContent = demoCue(demo);
    const action = demo.race.specialAction; sportMeter.hidden = !action;
    if (action) {
      sportMeter.querySelector("b").style.left = Math.max(1, Math.min(99, action.progress * 100)) + "%";
      for (const name of ["good", "perfect"]) { const band = sportMeter.querySelector(".action-" + name); band.style.left = action[name][0] * 100 + "%"; band.style.width = (action[name][1] - action[name][0]) * 100 + "%"; }
    }
    sight.hidden = demo.race.phase !== "shooting";
    if (!sight.hidden) { const aim = demo.race.aim; dot.style.left = (50 + aim.x * 35) + "%"; dot.style.top = (50 + aim.y * 35) + "%"; cue.textContent += " / " + demo.race.hits + " OF 5"; }
    touch.dataset.held = String(demo.race.holding || demo.lesson === 1 && demo.age >= 1);
    touch.textContent = demo.race.holding ? "HOLD" : demo.lesson === 1 ? "F" : action ? "TAP" : "PRESS";
    motion.textContent = stopped ? "Play animation" : "Pause animation";
  }
  function select(i) {
    index = i; demo = createDemo(makeRace, i);
    tabs.forEach((tab, n) => { tab.setAttribute("aria-selected", String(i === n)); tab.tabIndex = i === n ? 0 : -1; });
    dialog.querySelector(".tutorial-copy").textContent = i === 1 ? "Two consecutive Perfect releases store one Flame charge. Tap IGNITE or press F when you choose. The burst lasts six seconds. Flame is separate from your timing control." : (i === 0 ? "Touch the main control or use Space. " : "") + LESSONS[id][i === 0 ? 0 : 1];
    dialog.querySelector("[data-next]").disabled = i === 2; draw();
  }
  function frame(now) {
    if (!dialog.open) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!stopped && !document.hidden) {
      advanceDemo(demo, dt, reduced.matches);
      if (demo.completedAt !== null && demo.age - demo.completedAt > (index === 2 ? 6 : 1.2)) select(index);
    }
    draw(); frameId = requestAnimationFrame(frame);
  }
  function close() { dialog.close(); }
  function open() {
    if (getRace()?.phase !== "ready" || dialog.open) return;
    stopped = reduced.matches; dialog.showModal();
    try { scene = makeScene(dialog.querySelector("canvas")); select(0); last = performance.now(); frameId = requestAnimationFrame(frame); }
    catch { dialog.querySelector(".tutorial-copy").textContent = LESSONS[id].join(" "); cue.textContent = "PREVIEW UNAVAILABLE"; }
  }
  dialog.addEventListener("close", () => {
    cancelAnimationFrame(frameId);
    if (scene) {
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of o.material ? Array.isArray(o.material) ? o.material : [o.material] : []) { materials.add(m); for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); } });
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
      scene.renderer.dispose(); scene.renderer.forceContextLoss(); scene = null;
      const canvas = dialog.querySelector("canvas"); canvas.replaceWith(canvas.cloneNode());
    }
    try { localStorage.setItem(key, "seen"); } catch {}
    document.getElementById("trigger").focus({ preventScroll: true });
  });
  dialog.querySelector("[data-close]").addEventListener("click", close); dialog.querySelector("[data-play]").addEventListener("click", close);
  dialog.querySelector("[data-next]").addEventListener("click", () => select(Math.min(2, index + 1)));
  motion.addEventListener("click", () => { stopped = !stopped; draw(); }); button.addEventListener("click", open);
  dialog.querySelector(".tutorial-tabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    select(event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3);
    tabs[index].focus();
  });
  const ignite = () => {
    if (dialog.open || document.querySelector(".meet-dialog")?.open || isPaused()) return;
    sync(); if (getRace().activateFlame()) { render(); document.getElementById("trigger").focus({ preventScroll: true }); }
  };
  document.getElementById("trigger").addEventListener("ignite", ignite);
  document.addEventListener("keydown", event => {
    if (event.code !== "KeyF" || event.repeat || event.target.closest("input,select,textarea") || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault(); ignite();
  });
  // Modal keyboard events must never leak into the live game's Space handler.
  dialog.addEventListener("keydown", event => event.stopPropagation()); dialog.addEventListener("keyup", event => event.stopPropagation());
  queueMicrotask(() => { try { if (localStorage.getItem(key)) return; } catch {} open(); });
  return { update() { button.disabled = getRace()?.phase !== "ready"; }, dialog };
}
