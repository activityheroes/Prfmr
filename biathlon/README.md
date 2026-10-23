# Dot Athletics: Biathlon

A compact 400m arcade biathlon with four snowy hills, two long rhythm zones, and one standing five-target stop at 200m. This is deliberately shorter and more forgiving than an official competition. The skiing/shooting theme is informed by the [IBU rules overview](https://www.biathlonworld.com/fr/discover-biathlon/how-it-works/rules-overview); the distances, one-stop format and two-second penalties are game design choices, not official rules.

## Play

Serve the repository root and open `/biathlon/`; ES modules need HTTP, not `file://`. No new libraries, downloads, build step or backend are required.

Start once to ski automatically. Use touch, mouse or Space: press at the marked HOLD entry, hold through the blue zone, release in the colored exit bands. Two long zones occupy 30-65m and 270-310m, one on either side of the shooting stop. Red/yellow/green indicate bad, Good/Great and Perfect timing. The familiar 30% entry / 30% hold / 40% release scoring and carryover momentum are preserved, with broader edge windows. Perfect / Great / Good give 15% / 10% / 6% boosts.

Hills alter the target pace, not the controls: climb speed can drop to 76% of baseline and descents reach up to 125%. The athlete skate-skis and plants poles on climbs, then tucks with parallel skis downhill. The wide camera keeps the athlete small and shows approaching terrain. Terrain and boost strips share the same height function.

## Shooting

The skier stops precisely at 200m. The clock continues; after a short settling animation, the same button becomes the aiming control. Hold to reduce sway, then release when the moving sight is in the cyan center. A release uses one shot and advances to the next target. Five shots are required, followed by a short result beat and automatic skiing toward the finish.

- Hits add no penalty; misses add two seconds each. No disqualification or penalty loop.
- Holds shorter than 250ms use no shot, protecting against accidental taps.
- A 600ms reload prevents rapid-repeat shots.
- Canceling, dragging outside the button or switching away cancels the hold without firing.
- Holding indefinitely never fires automatically. The center remains a timing challenge after the sway settles.
- Total time includes skiing, range time and penalties; results show these separately.

## Equipment And Storage

Focus bands widen the ski timing and aim windows. Poles improve acceleration, skis raise the speed cap, and race suits preserve momentum. Equipment and personal best are isolated under `dot-biathlon-v1-long-zones-v1`. Blocked storage does not prevent playing. Finish celebrations use the shared presentation clock and cannot change the official time.

`engine.mjs` extends the shared `RhythmRace`; `course.mjs` owns hill profiles and aiming parameters. `skier.mjs` builds the 3D dot athlete, including opposed ski strokes, distance-locked pole plants, downhill tucks, a slung rifle and a standing shooting pose. `scene.mjs` uses bundled Three.js and instanced dots/trees. `event.mjs` supplies range feedback to the shared controller through an optional event hook; other sports keep their existing behavior.

## Checks

```sh
node --test biathlon/engine.test.mjs
```

Tests cover terrain continuity, range entry, accurate/missed/canceled shots, reloads, indefinite holds, all-miss finishes, scoring, equipment, frame-rate consistency, animation geometry, pole contacts and frozen results. Browser QA covers full races on desktop/mobile, painted and moving WebGL pixels, shooting overlay framing, touch input, cancellation, pause/resume, persistence and reduced-motion celebrations.
