# Prfmr - Dot Athletics

Eleven browser-based athletics games with procedural dot-matrix athletes and press, hold, release timing mechanics. The project uses HTML, CSS, JavaScript, Three.js and Cannon. It has no build step or backend requirement.

## Play Locally

Serve the repository root, rather than an individual game folder:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open <http://127.0.0.1:8080/>. The root page opens Sprint, and the event navigation switches between games.

| Event | Path |
| --- | --- |
| 100m sprint | `sprint/` |
| 200m track cycling | `cycling/` |
| 50m swimming | `swimming/` |
| Javelin | `javelin/` |
| Pole vault | `pole-vault/` |
| Long jump | `long-jump/` |
| High jump | `high-jump/` |
| 100m hurdles | `hurdles/` |
| 500m speed skating | `speed-skating/` |
| Ski jumping | `ski-jumping/` |
| 400m biathlon | `biathlon/` |
| Animation motion lab | `dot-matrix-demo.html` |

Use the on-screen control or Space to press, hold and release. Timed zones build momentum; field events add their own takeoff or release. Each event's README describes its mechanics and equipment.

Races now use two longer boost zones, with a marked HOLD entry and RELEASE exit. Red bands indicate poor releases, yellow covers Good/Great, and green covers Perfect. Both the track and HUD use the actual scoring function, including entry accuracy and equipped timing tolerance. Hurdles retains ten individually timed jumps. Final throws, takeoffs and Biathlon shooting remain separate actions.

Long-zone records use each event's existing storage key with `-long-zones-v1` appended. Equipment and selected bar heights migrate, but older records remain untouched and are not compared with the new course layout.

### Weather

Outdoor attempts draw a fresh, seeded forecast on restart: clear skies, headwind, tailwind, heavy rain or storms. Winter sports substitute snow and blizzards for rain. Cycling's velodrome and Swimming's pool stay sheltered. The track header shows conditions and signed wind speed relative to travel; dotted rain, snow and wind trails stay behind the timing labels.

Each outdoor forecast includes a passing weather front, announced 1.6 seconds before its effects ramp in over 1.2 seconds. Target pace stays within -12% to +6%; precipitation modestly reduces acceleration. Boosts, equipment caps, fixed zone boundaries and scoring windows frozen on press remain intact. There are no random slips or forced fouls. These are arcade modifiers, not a competition weather simulation.

Wind also affects javelin and long-jump horizontal flight, ski-jump flight/lift, and the visible Biathlon aim drift. Default-height field attempts and all hurdles remain achievable with accurate timing in adverse conditions. Pause freezes weather, and reduced-motion mode uses stationary precipitation without flashing lightning. Results include conditions; local personal bests remain arcade records across all weather, not wind-certified marks.

`sprint/weather.mjs` owns deterministic forecasts and bounded modifiers; `weather-ui.mjs` renders the shared HUD and a lightweight, capped particle overlay. Engines default to calm for reproducible tests, and browser controllers call `setWeather()` for random conditions. `setWeather(seed, kind)` supports seeded QA only before starting. No weather API, image download or additional dependency is required.

Biathlon adds rolling hills and a five-target shooting stop at 200m. Hold to steady the sight and release inside the cyan circle. Misses add a forgiving two-second penalty, then skiing resumes after the fifth shot.

## Boost Modes

- Good, Great and Perfect release bursts add 6%, 10% and 15% speed, up to the active speed limit. The temporary component is held for 1.25 seconds before gradually fading; momentum carries into later zones.
- One successful zone activates cyan Flow, adding 5% of baseline speed to the target pace.
- Two consecutive Perfects ignite Flame Mode for six seconds. A dot-flame trail, ignition tone, two-segment charge indicator and fuel timer accompany a real acceleration burst. Another two Perfects refill the timer; early, late, missed and canceled zones break the streak and extinguish Flame.
- Longer holds award three times the usual positive momentum increment, within the existing equipment cap, so fewer zones still produce noticeable acceleration. Penalties are unchanged.
- Flame adds 20% of baseline speed to target pace. Racing events also gain 20% speed-limit headroom (Flow grants 5%). Technical events keep their original safe approach-speed ceiling so hurdles, takeoff collisions and landing areas remain playable.
- The boost display reports the actual awarded burst percentage and current pace above baseline, not just the nominal reward. Pauses freeze physics and fuel. The biathlon range suspends fuel consumption. Restart clears all mode state. Reduced motion retains the HUD and a static, sparse dot trail without animated flames.

Cycling now starts rolling at 36 km/h and settles at 54 km/h. Ride view follows the rider from a readable side angle; Track view retains the full banked oval.

A WebGL-capable browser is required for the games. Personal bests and equipment are stored in the current browser's localStorage. There is no shared leaderboard, account system or multiplayer server.

## Finish Sequences

Every event keeps the scene visible before opening results. Runners coast into a raised-arm celebration, cyclists lift a hand while coasting, and swimmers celebrate at the wall. Speed skaters coast onto both blades and raise their arms. Field athletes recover after landing, then celebrate a valid attempt or react to a foul or missed clearance.

Javelin holds the landing camera on the planted spear and its measured mark before returning to the thrower. Long jump retains the landing line and heel marks in the sand; pole vault and high jump show the mat landing and any fallen crossbar. Ski jumping follows the full flight, ski contact and runout, keeping the measured landing line visible during the reaction. Sequences last 3.4-5.8 seconds after the official result is determined. The main control becomes Results after the initial landing beat, so it can be skipped with touch, click, or Space.

The presentation clock is separate from race physics: official times, marks, and collisions do not change during reactions. Bests are saved immediately, even if the player restarts early. Switching away pauses the sequence; restarting cancels it. Reduced-motion settings suppress celebration particles and the long javelin camera sweep.

## Tests

With a recent Node.js installation:

```sh
node --test sprint/*.test.mjs cycling/engine.test.mjs swimming/engine.test.mjs javelin/engine.test.mjs pole-vault/engine.test.mjs long-jump/engine.test.mjs high-jump/engine.test.mjs hurdles/engine.test.mjs speed-skating/engine.test.mjs ski-jumping/engine.test.mjs biathlon/engine.test.mjs
```

## Static Hosting

Upload the repository contents to a static host, preserving the folder structure. No build command or environment variables are required. Serve JavaScript modules with a JavaScript MIME type. The games share modules, styles and vendored libraries across directories, so keep all eleven event folders together.

Three.js and its license are in `sprint/vendor/`. Cannon and its license are in `javelin/`. No runtime CDN requests or library installation are needed.

Shot put is not included.
