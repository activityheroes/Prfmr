import { WEATHER, weatherSummary } from "./weather.mjs?v=meets-1";

const wrap = (n, length) => (n % length + length) % length;
const noise = n => { const value = Math.sin(n * 127.1 + 31.7) * 43758.5453; return value - Math.floor(value); };
export function createWeatherUI(tone) {
  const track = document.querySelector(".track"), canvas = document.createElement("canvas");
  canvas.className = "weather-effects"; canvas.setAttribute("aria-hidden", "true"); track.append(canvas);
  const context = canvas.getContext("2d"), reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const badge = document.createElement("span"); badge.className = "weather-status";
  document.querySelector(".track-top .live-label").append(badge);
  const alert = document.createElement("div"); alert.className = "weather-alert"; alert.hidden = true; track.append(alert);
  const announcer = document.createElement("span"); announcer.className = "sr-only"; announcer.setAttribute("aria-live", "polite"); track.after(announcer);
  document.body.dataset.weather = "true";
  let width = 0, height = 0, currentRace, previousNotice = "", drift = 0, lastTime = 0;
  const resize = () => {
    width = track.clientWidth; height = track.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  new ResizeObserver(resize).observe(track); resize();
  return (race, paused) => {
    const c = race.conditions;
    if (currentRace !== race) { currentRace = race; previousNotice = ""; drift = 0; lastTime = race.time; }
    drift += c.wind * Math.max(0, race.time - lastTime) * 22; lastTime = race.time;
    badge.textContent = c.label + (c.indoor ? " / CALM" : Math.abs(c.wind) > 0.2 ? " " + (c.wind > 0 ? "+" : "") + c.wind.toFixed(1) + " m/s" : " / CALM");
    badge.dataset.kind = c.key;
    badge.title = c.indoor ? "Sheltered venue" : "Wind relative to travel. " + Math.round((c.pace - 1) * 100) + "% target pace.";
    const live = race.startAt !== null && !race.terminal && !paused;
    alert.hidden = !live || !c.upcoming && !c.changing;
    alert.dataset.warning = String(!!c.upcoming);
    alert.textContent = c.upcoming ? WEATHER[c.upcoming].label + " IN " + c.countdown.toFixed(1) + "s"
      : c.label + " / " + (c.pace >= 1 ? "+" : "") + Math.round((c.pace - 1) * 100) + "% PACE";
    const notice = c.upcoming ? "Incoming " + WEATHER[c.upcoming].label.toLowerCase() : c.label.toLowerCase();
    if (notice !== previousNotice && !paused) {
      announcer.textContent = notice;
      if (c.upcoming && live) tone(240, 0.12);
      previousNotice = notice;
    }
    const dialog = document.getElementById("result-dialog");
    if (dialog.open && race.result && !dialog.querySelector(".weather-result")) {
      const row = document.createElement("div"), term = document.createElement("dt"), value = document.createElement("dd");
      row.className = "weather-result"; term.textContent = "Conditions"; value.textContent = weatherSummary(race.weather);
      row.append(term, value); document.getElementById("result-stats").append(row);
    }
    if (!context || !width || !height) return;
    const ctx = context, t = reduced.matches ? 0 : race.time, offset = reduced.matches ? 0 : drift, seed = race.weather.seed % 10000;
    ctx.clearRect(0, 0, width, height);
    canvas.hidden = c.indoor || c.key === "clear" && !c.changing;
    if (canvas.hidden) return;
    ctx.fillStyle = c.winter ? "#bbdae2" : "#152536";
    ctx.globalAlpha = c.shade; ctx.fillRect(0, 0, width, height);
    const precipitation = Math.max(c.rain, c.snow), count = Math.round((reduced.matches ? 28 : Math.min(170, width * 0.2)) * precipitation);
    const snow = c.snow > c.rain, area = Math.max(1, height - 80);
    ctx.fillStyle = snow ? "#f2ffff" : "#b9e3f5";
    ctx.globalAlpha = snow ? 0.75 : 0.5;
    for (let i = 0; i < count; i++) {
      const n = seed + i * 3.17, fall = snow ? 20 + noise(n + 1) * 22 : 190 + noise(n + 1) * 90;
      const x = wrap(noise(n) * width + offset + (snow ? Math.sin(t + i) * 7 : 0), width);
      const y = 42 + wrap(noise(n + 2) * area + t * fall, area);
      const radius = snow ? 1.2 + noise(n + 3) : 0.9;
      for (let dot = 0; dot < (snow ? 1 : 3); dot++) {
        ctx.beginPath(); ctx.arc(x - dot * c.wind * 0.35, y - dot * 3.3, radius, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (Math.abs(c.wind) > 0.4) {
      ctx.fillStyle = c.wind > 0 ? "#c6f6c0" : "#e3edf3"; ctx.globalAlpha = 0.3;
      for (let i = 0; i < 10; i++) {
        const x = wrap(noise(seed + i * 11) * width + offset * 48 / 22, width), y = 48 + noise(i * 7 + seed) * Math.max(1, height - 100);
        for (let dot = 0; dot < 4; dot++) { ctx.beginPath(); ctx.arc(x - dot * Math.sign(c.wind) * 5, y, 1, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;
  };
}
