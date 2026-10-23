# Dot Athletics: Javelin

Open `/javelin/` on the same local static server as sprint, cycling and swimming. This buildless HTML/CSS/JavaScript event uses the existing rhythm engine for an automatic approach, followed by a hold-and-release javelin throw. There are no runtime CDN requests or installation steps.

## Controls

1. Start the approach with a tap or Space. The athlete accelerates automatically.
2. Press at each HOLD marker, hold through the blue strip and release at the colored exit bands. Two long strips occupy 6-14m and 24-33m. Red/yellow/green mark bad, Good/Great and Perfect timing. Successful timing adds speed and persistent momentum; misses do not stop the athlete.
3. At the gold strip, press at 40m and release at the white 43.5m boundary. The red foul line is at 45m. Holding past it, or never throwing, records a foul with no mark.
4. Watch the flight and measured landing. Higher distances improve your personal best. Throw again starts a fresh attempt.

The button stays fixed on screen. Blue and gold strips are fixed runway distances, scrolling with the athlete-following camera. Mouse, touch and keyboard use the same timing. Dragging off the button, canceled touches and loss of focus invalidate a hold rather than launching the javelin. Pausing during flight freezes the simulation; resume explicitly.

## Scoring And Flight

The approach preserves the existing 30% entry / 30% overlap / 40% release scoring, boost tiers and hidden momentum. It begins at a 6.5m/s baseline; equipped spikes set a 9, 9.5 or 10m/s speed cap. The second blue strip has slightly tighter timing.

The gold strip uses the same timing score. Release timing changes the launch angle (22-52 degrees, with 38 at the ideal line). Approach speed and timing quality determine launch speed. The final mark is the landing tip's horizontal distance from the foul line, not the distance from where the athlete released it.

Flight uses [cannon-es](https://github.com/pmndrs/cannon-es), vendored as version 0.20.0 with its MIT license in `CANNON-LICENSE`. A point-like body follows gravity, with ground crossing interpolated within physics steps of at most 1/240 second. The visible dotted shaft follows the velocity angle and plants tip-first. This is arcade ballistics: no aerodynamic lift, wind, lateral aiming, competition foul-arc geometry or multi-round meet rules are simulated.

## Art And Storage

The procedural athlete reuses the established running gait, adds an overhead javelin carry, draw-back and planted follow-through, and releases a separate dot-matrix projectile. Three.js renders the runway, distance-marked landing sector, trajectory and follow camera. The other three events retain their original behavior.

Grip tape widens timing tolerance; insoles improve approach acceleration; spikes raise maximum speed; throwing kits retain momentum. These are arcade gear modifiers. `dot-javelin-zones-v1-long-zones-v1` stores only this event's equipment and highest valid mark. Fouls and shorter throws cannot overwrite it. Records are local, not a verified leaderboard.

## Tests

```sh
node --test sprint/engine.test.mjs cycling/engine.test.mjs swimming/engine.test.mjs javelin/engine.test.mjs
```

Javelin tests cover automatic movement, rhythm boosts, release quality, physics and ground crossing, fouls, input cancellation, speed caps, frame-rate consistency and texture bounds. Browser QA covers keyboard/mouse/touch, complete throws, mobile framing, nonblank canvases, pause, replay, saved marks and navigation to the other events.
