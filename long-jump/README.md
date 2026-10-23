# Dot Long Jump

A browser-local long jump event in the shared dot-matrix athletics style.

## Play

Open `/long-jump/` on the same static server as the other events. Use the circular button or Space.

1. Start the automatic 45-meter approach.
2. Press at each blue strip's entry, hold across it, and release at the exit. Two long zones (6-14m and 24-33m) build momentum using the shared 30% entry, 30% hold-overlap and 40% release score.
3. Hold at the gold strip's 40-meter entry and release at its white end, 44.75 meters, to take off. The red foul line is fixed at 45 meters.
4. The athlete flies, extends both legs, and lands in the sand. Distance is measured from the board to the rearmost heel imprint and rounded down to centimeters.

Earlier takeoffs leave a larger board gap and reduce launch quality. Holding or running through the board without jumping is a foul, even with upgraded timing equipment. A canceled hold cannot trigger a takeoff or earn a boost.

Timing bands, run-up insoles, jump spikes and jump kits affect timing tolerance, acceleration, maximum speed and endurance. The best valid mark and equipped gear persist independently under `dot-long-jump-zones-v1-long-zones-v1`. Fouls and shorter jumps cannot replace the best mark.

## Implementation

- `engine.mjs`: rhythm run-up, takeoff scoring, Cannon free flight, landing and foul decisions.
- `jumper.mjs`: running, takeoff/flight, leg extension and forward landing poses.
- `scene.mjs`: instanced dot athlete, fixed runway strips, takeoff board, sand pit, footprints and sand particles.
- `game.mjs`: responsive controls, pointer cancellation, keyboard input, pause and result UI.
- `engine.test.mjs`: deterministic scoring, equipment, takeoff boundaries, animation and landing tests.

This is an arcade model, not a full competition simulator: flight uses a single body under gravity, while an articulated pose animates around it. Landing is a forward recovery without a backward hand or seat contact. The measured heel imprint stays fixed during the subsequent recovery animation.

The event reuses the existing Three.js files, Cannon from `javelin/`, and the shared dot-pose painter from `pole-vault/`. No additional library download is needed; keep these shared folders when serving the game. Leaving the tab pauses the attempt and cancels any active hold.

## Verify

```sh
node --test long-jump/engine.test.mjs
node --test sprint/engine.test.mjs cycling/engine.test.mjs swimming/engine.test.mjs javelin/engine.test.mjs pole-vault/engine.test.mjs long-jump/engine.test.mjs
```
