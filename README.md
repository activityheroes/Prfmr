# Prfmr - Dot Athletics

Six browser-based athletics games with procedural dot-matrix athletes and press, hold, release timing mechanics. The project uses HTML, CSS, JavaScript, Three.js and Cannon. It has no build step or backend requirement.

## Play Locally

Serve the repository root, rather than an individual game folder:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open <http://127.0.0.1:8080/>. The root page opens Sprint, and the event navigation switches between games.

| Event | Path |
| --- | --- |
| 100m sprint | `sprint/` |
| 200m cycling | `cycling/` |
| 50m swimming | `swimming/` |
| Javelin | `javelin/` |
| Pole vault | `pole-vault/` |
| Long jump | `long-jump/` |
| Animation motion lab | `dot-matrix-demo.html` |

Use the on-screen control or Space to press, hold and release. Timed zones build momentum; field events add their own takeoff or release. Each event's README describes its mechanics and equipment.

A WebGL-capable browser is required for the games. Personal bests and equipment are stored in the current browser's localStorage. There is no shared leaderboard, account system or multiplayer server.

## Tests

With a recent Node.js installation:

```sh
node --test sprint/engine.test.mjs cycling/engine.test.mjs swimming/engine.test.mjs javelin/engine.test.mjs pole-vault/engine.test.mjs long-jump/engine.test.mjs
```

## Static Hosting

Upload the repository contents to a static host, preserving the folder structure. No build command or environment variables are required. Serve JavaScript modules with a JavaScript MIME type. The games share modules, styles and vendored libraries across directories, so keep all six event folders together.

Three.js and its license are in `sprint/vendor/`. Cannon and its license are in `javelin/`. No runtime CDN requests or library installation are needed.

Shot put is not included.
