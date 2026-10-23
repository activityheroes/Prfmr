# Dot Athletics: 200m Track Cycling

The dot-matrix cycling animation from `dot-matrix-demo.html`, now on a banked oval velodrome with automatic movement, two long timing zones, and carryover momentum. Open `/cycling/` using the same static server as `/sprint/`. No additional install, build, or external assets are required. Opening `index.html` directly through `file://` will not load the JavaScript modules; run `python3 -m http.server 8082 --bind 127.0.0.1` from the repository root and visit `http://127.0.0.1:8082/cycling/` instead.

## Controls And Course

Tap Start Race once for a rolling 10 m/s start, then the cyclist pedals automatically toward a 15 m/s baseline (54 km/h). Press on entering a blue zone, hold while riding through it, and release at the exit. Touch, mouse, and Space use the same input logic. The front edge of the front tire aligns with the ground marker that determines zone entry and exit.

Two long zones occupy 30-70m and 120-164m. Both stay fixed on the oval and visible in Track view while the cyclist rides around it. Marked HOLD entries and red/yellow/green release bands agree with the weighted scoring. The control stays fixed on screen.

Entry / held overlap / release contribute 30% / 30% / 40% of the score. Perfect, great, good, and early releases reward +15%, +10%, +6%, and +2% speed respectively, subject to the equipped speed cap. Perfect, great, and good also add 2.4, 1.5, and 0.75 m/s of hidden momentum. Misses and late releases reduce momentum by 0.4 m/s. The shared sprint engine handles gradual decay, one attempt per zone, cancellation, and missed-zone penalties.

The finish phase begins at 197m, on the home straight. Riding continues automatically until the front tire reaches the 200m line. There is no running dip action in this event. The cyclist coasts and celebrates before results. Pause, resume, restart, race results, and per-zone scoring work as in the sprint game.

One successful zone activates Flow; two consecutive Perfects ignite six seconds of Flame Mode with a visible dot trail and increased speed ceiling. See the root README for shared mode rules. Burst feedback shows the actual speed increase, and the speed readout changes color with the active mode.

## Velodrome

Ride view follows the cyclist from a lower side angle so the body, wheels and cadence are readable through the bends. The Ride / Track selector switches to a fixed overview of the entire 250m oval, including its blue apron, black measurement line, red sprinter line, blue stayer line, pursuit markings, 100m marker, and white/black finish line. This is an arcade rolling start, not an official flying-start simulation. The banked wood surface is inspired by [UCI's introduction to track cycling](https://www.uci.org/article/what-is-track-cycling/6yFQsdYGiuw1bIWiLS6Hxq), with steeper bends and gentler straights.

## Animation

`cyclist.mjs` ports the motion lab's helmet, drop bars, diamond frame, chain, spokes, opposed pedals, and two-joint limb poses. Wheels rotate according to distance divided by their rendered radius; the game uses a 1.45x cadence multiplier for an energetic track-racing pedal stroke. Feet remain attached to pedals and hands to handlebars. Pausing freezes distance and therefore also the pedal and wheel phases. Low-poly instanced dots, cached colors and skipping the unused canvas athlete keep rendering lightweight.

`dot-bike.mjs` uses those same limb poses in an instanced 3D dot model, keeping the rider visible from both sides and through each bend. The bike is small in the full-track view, with slightly exaggerated proportions on narrow screens for legibility. `velodrome.mjs` fits both wheel contacts to the banking, and wheel rotation accounts for the visual scale. The timing cursor remains anchored at the bike's leading edge. The original canvas artwork remains available to the motion lab.

## Equipment And Storage

- Bike computer: wider edge timing tolerance.
- Crankset: stronger launch acceleration.
- Wheelset: raises normal maximum speed from 75.6 to 81 or 86.4 km/h, before mode bonuses.
- Cycling kit: slower momentum decay and less late-race fatigue.

Cycling equipment and personal best use `dot-cycling-zones-v1-long-zones-v1`, independently of sprint records. This is a local client-side demo, not a verified competitive leaderboard.

## Shared Files And Verification

`cycling/engine.mjs` supplies the cycling course to `RhythmRace` in `sprint/engine.mjs`. Both games share input handling, results, and UI styling. `cycling/event.mjs` connects the cycling-specific `CyclingScene` to the shared controller without changing sprint physics. Three.js remains bundled in `sprint/vendor/` under its included MIT license.

From the repository root:

```sh
node --test sprint/engine.test.mjs cycling/engine.test.mjs
```

Cycling tests cover the course, scoring parity, baseline riding, boosts, momentum, missed holds, equipment, finish collision, frame-rate consistency, wheel rotation, pedal constraints, texture bounds, closed-oval geometry, bank transitions, scaled tire contacts, and the animated instanced model.
