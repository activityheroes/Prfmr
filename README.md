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

Biathlon adds rolling hills and a five-target shooting stop at 200m. Hold to steady the sight and release inside the cyan circle. Misses add a forgiving two-second penalty, then skiing resumes after the fifth shot.

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
