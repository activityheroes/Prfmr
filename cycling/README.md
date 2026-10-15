# Dot Athletics: 200m Cycling

The dot-matrix cycling animation from `dot-matrix-demo.html`, now playable with the sprint game's automatic movement, six timing zones, and carryover momentum. Open `/cycling/` using the same static server as `/sprint/`. The event tabs also open the 50m freestyle game at `/swimming/`. No additional install, build, or external assets are required.

## Controls And Course

Tap Start Race once, then the cyclist pedals automatically toward a 12 m/s baseline (43.2 km/h). Press on entering a blue zone, hold while riding through it, and release at the exit. Touch, mouse, and Space use the same input logic. The front edge of the front tire aligns with the ground marker that determines zone entry and exit.

Six zones start at 30, 60, 90, 120, 150, and 180 meters. Normal zones are 7.5m long; the last is 4.5m with tighter timing. These lengths preserve the sprint's baseline hold duration at cycling speed. Boundaries stay fixed on the track and scroll past the cyclist. The control stays fixed on screen.

Entry / held overlap / release contribute 30% / 30% / 40% of the score. Perfect, great, good, and early releases reward +15%, +10%, +6%, and +2% speed respectively, subject to the equipped speed cap. Perfect, great, and good also add 0.8, 0.5, and 0.25 m/s of hidden momentum. Misses and late releases reduce momentum by 0.4 m/s. The shared sprint engine handles gradual decay, one attempt per zone, cancellation, and missed-zone penalties.

The final straight begins at 197m. Riding continues automatically until the front tire reaches the 200m plane. There is no running dip action in this event. Pause, resume, restart, race results, and per-zone scoring work as in the sprint game.

## Animation

`cyclist.mjs` ports the motion lab's helmet, drop bars, diamond frame, chain, spokes, opposed pedals, and two-joint limb poses. Wheels rotate according to distance divided by their rendered radius; pedal cadence follows the same fixed gear ratio. Feet remain attached to pedals and hands to handlebars. Pausing freezes distance and therefore also the pedal and wheel phases.

The dot texture is placed on a vertical Three.js plane aligned with the road, so both wheels contact the same track plane. Its leading tire edge is anchored to the timing cursor. The camera frames the complete bike on mobile and desktop.

## Equipment And Storage

- Bike computer: wider edge timing tolerance.
- Crankset: stronger launch acceleration.
- Wheelset: raises maximum speed from 60.5 to 64.8 or 69.1 km/h.
- Cycling kit: slower momentum decay and less late-race fatigue.

Cycling equipment and personal best use `dot-cycling-zones-v1`, independently of sprint records. This is a local client-side demo, not a verified competitive leaderboard.

## Shared Files And Verification

`cycling/engine.mjs` supplies the cycling course to `RhythmRace` in `sprint/engine.mjs`. Both games share input handling, results, UI styling, and the Three.js track renderer. The existing `SprintRace` export preserves the 100m sprint behavior. Three.js remains bundled in `sprint/vendor/` under its included MIT license.

From the repository root:

```sh
node --test sprint/engine.test.mjs cycling/engine.test.mjs
```

Cycling tests cover the course, scoring parity, baseline riding, boosts, momentum, missed holds, equipment, finish collision, frame-rate consistency, wheel rotation, pedal constraints, and texture bounds.
