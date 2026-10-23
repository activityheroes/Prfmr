# Dot Athletics: 50m Freestyle

The motion lab's dot-matrix front crawl, playable with the same automatic movement, press/hold/release zones and carry-over momentum as sprint and cycling. Serve the repository root and open `/swimming/`. No additional install or external assets are required; Three.js is already bundled under `sprint/vendor/`.

## Race Loop

Start once, then the swimmer accelerates automatically to a 1.9 m/s baseline. Press when the white timing cursor enters a blue strip, hold across it and release at the exit. Touch, mouse and Space share the same controls. The circular button stays fixed on screen; the strips occupy fixed pool distances and scroll with the following camera.

Two long strips occupy 7.5-14m and 30-37m. HOLD marks entry and red/yellow/green release bands show bad, Good/Great and Perfect timing. Entry accuracy, held overlap and release accuracy contribute 30%, 30% and 40% of each score. Rewards remain +15% / +10% / +6% / +2% for perfect / great / good / early releases, subject to the speed cap.

The shared engine's optional `momentumScale` is 1.9 / 8 for swimming. This scales momentum rewards, losses and decay to swimming speed without changing percentage boosts or the existing sprint/cycling behavior. Perfect timing adds 0.57 m/s of momentum; misses remove 0.095 m/s, never below zero. Successful zones carry speed into the next section. Holding from the start, staying held between zones or repeated presses cannot farm rewards.

The last meter blends into a forward reach. Contact with the 50m plane ends the timer automatically; no running dip or extra tap is required. The result includes both zone grades, score components, streak, peak speed and a local personal best. Losing focus pauses the race and invalidates an active hold; resume explicitly.

## Animation And Pool

`swimmer.mjs` ports the original alternating crawl arms, bent-elbow recovery, breathing turn, six-beat flutter kick, entry splashes and wake dots. Cadence follows traveled distance (3.1m per complete two-arm cycle), so boosts increase the stroke rate and pause freezes it. The side-view texture is aligned with the pool's X axis, with submerged dots tinted and the finishing hand anchored to the wall plane.

`pool.mjs` supplies the tiled floor, lane ropes, surface ripples and finish touchpad to the shared Three.js scene. Floats use instanced geometry. The swimmer and fixed control are framed on both desktop and mobile.

## Equipment And Records

- Goggles widen timing tolerance.
- Starting blocks improve initial acceleration.
- Suits raise the maximum speed from 2.65 to 2.8 or 2.95 m/s.
- Caps retain momentum and limit late-race fatigue.

These are arcade equipment modifiers, not a physical simulation of equipment benefits. Gear and best time use `dot-swimming-zones-v1-long-zones-v1`; sprint and cycling saves remain separate. Records are client-side, not a verified leaderboard.

## Verification

```sh
node --test sprint/engine.test.mjs cycling/engine.test.mjs swimming/engine.test.mjs
```

Swimming tests cover automatic movement, scoring parity, scaled momentum, missed/canceled holds, equipment, the wall finish, frame-rate consistency, stroke phases, limb lengths and texture bounds. Browser checks cover mouse/keyboard/touch controls, stationary button and world-space zones, complete races, pause/resume, saved records, cross-event navigation and nonblank desktop/mobile rendering.
