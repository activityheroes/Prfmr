const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
export const WEATHER = {
  clear: { label: "CLEAR", wind: 0, rain: 0, snow: 0, shade: 0 },
  headwind: { label: "HEADWIND", wind: -2.4, rain: 0, snow: 0, shade: 0.02 },
  tailwind: { label: "TAILWIND", wind: 2.4, rain: 0, snow: 0, shade: 0 },
  rain: { label: "HEAVY RAIN", wind: -0.7, rain: 0.8, snow: 0, shade: 0.08 },
  storm: { label: "STORM", wind: -3.2, rain: 1, snow: 0, shade: 0.15 },
  snow: { label: "SNOW", wind: -0.8, rain: 0, snow: 0.65, shade: 0.04 },
  blizzard: { label: "BLIZZARD", wind: -2.7, rain: 0, snow: 1, shade: 0.1 },
  indoor: { label: "INDOOR", wind: 0, rain: 0, snow: 0, shade: 0 }
};
export const isWinter = id => ["speed-skating", "ski-jumping", "biathlon"].includes(id);
export const isIndoor = id => ["cycling", "swimming"].includes(id);
export function randomWeatherSeed() {
  return globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 4294967296);
}
function seeded(seed) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
export function createWeather(course, seed = 0, kind = "clear") {
  const random = seeded(seed), indoor = isIndoor(course.id);
  const options = isWinter(course.id) ? ["clear", "headwind", "tailwind", "snow", "blizzard"]
    : ["clear", "headwind", "tailwind", "rain", "storm"];
  const base = indoor ? "indoor" : kind === "random" ? options[Math.floor(random() * options.length)] : options.includes(kind) ? kind : "clear";
  const candidates = options.filter(value => value !== base);
  const front = !indoor && kind === "random" ? candidates[Math.floor(random() * candidates.length)] : null;
  const estimate = course.distance / course.baseSpeed + 1;
  return Object.freeze({ seed: seed >>> 0, base, front, frontAt: Math.max(3, estimate * (0.32 + random() * 0.15)),
    duration: 5 + random() * 3, warning: 1.6, transition: 1.2, winter: isWinter(course.id), indoor });
}
export function weatherAt(weather, time = 0) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0), age = t - weather.frontAt;
  const changing = !!weather.front && age >= 0 && age < weather.duration + weather.transition;
  const weight = weather.front ? smooth(age / weather.transition) * (1 - smooth((age - weather.duration) / weather.transition)) : 0;
  const a = WEATHER[weather.base], b = WEATHER[weather.front ?? weather.base];
  const key = weight >= 0.5 ? weather.front : weather.base;
  const gust = 1 + 0.13 * Math.sin(t * 1.1 + weather.seed % 17);
  const wind = mix(a.wind, b.wind, weight) * gust, rain = mix(a.rain, b.rain, weight), snow = mix(a.snow, b.snow, weight);
  const upcoming = weather.front && age < 0 && age >= -weather.warning ? weather.front : null;
  return { key, label: WEATHER[key].label, wind, rain, snow, shade: mix(a.shade, b.shade, weight),
    pace: clamp(1 + wind * 0.018 - rain * 0.025 - snow * 0.035, 0.88, 1.06),
    grip: 1 - rain * 0.12 - snow * 0.08, changing, upcoming,
    countdown: upcoming ? -age : 0, indoor: weather.indoor, winter: weather.winter };
}
export function weatherSummary(weather) {
  return WEATHER[weather.base].label + (weather.front ? " / " + WEATHER[weather.front].label : "");
}
