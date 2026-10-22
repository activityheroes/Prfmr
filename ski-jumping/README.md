# Dot Athletics - Ski Jumping

Serve the repository root and open `/ski-jumping/`. The second winter event shares the automatic movement, equipment and press/hold/release timing of the other games.

## Attempt Loop

The skier automatically descends a 140-meter inrun. Six fixed blue zones begin at 20, 38, 56, 74, 92 and 110 meters. Press at entry, hold through the strip and release at its white end line. The first five strips are 8 meters long; the final strip is 6.5 meters with tighter timing.

Entry, hold and release contribute 30%, 30% and 40% to the score. Perfect, Great and Good earn 15%, 10% and 6% temporary boosts, plus carried momentum. Speed-adjusted timing windows and advance cues match the other events.

The gold takeoff strip runs from 125 to 138 meters. Hold through it and release at its end to set the takeoff. The skier extends through the final two meters and leaves the physical lip at 140 meters, not wherever the button was released. Takeoff timing and approach speed determine launch and lift. Missing the gold strip, holding past the lip or canceling without completing another hold produces a weak jump and no recorded mark. A completed takeoff remains set if the game is subsequently paused.

Flight is automatic. The camera follows the skier to actual contact with the landing hill, then shows the ski runout and a success or failed-attempt reaction before results. The landing line stays visible. Distance is measured along the hill from the takeoff edge and rounded down to half-meter marks. Personal bests use the greatest valid distance.

## Animation and Physics

The procedural dot athlete transitions from a compact downhill tuck through leg extension into V-style flight with arms trailing at the hips. The skis spread through flight, close for landing and follow the slope on contact. Strong takeoffs finish with a staggered telemark stance; lower-quality attempts land with parallel skis. The reference poses supplied for this game and [USA Ski Jumping's four phases](https://usaskijumping.com/four-phases-of-a-ski-jump/) informed the sequence.

Cannon integrates gravity, speed-dependent lift and drag in fixed substeps. The engine interpolates the first crossing of the landing surface so frame rate does not determine the measured distance. The snow geometry, distance markers, ski poses and physics share the same continuous hill profile. Presentation uses its own clock and cannot alter the official mark.

The hill, lift parameters, equipment effects, K90 marker and no-mark conditions are arcade choices. This is not an official FIS scoring, wind-compensation or judging simulation.

- Timing band widens entry and release tolerance.
- Ski wax improves inrun acceleration.
- Jump skis increase maximum approach speed.
- Flight suit improves endurance and reduces flight drag.

Touch, mouse and Space use the same input path. Dragging outside the button cancels a hold. Switching away pauses the attempt; restart clears it. Results can be skipped after the landing beat. Equipment and personal best persist in localStorage under `dot-ski-jump-zones-v1`. Reduced motion suppresses celebration particles and uses a settled reaction pose.

## Files and Tests

- `course.mjs`: inrun, landing hill, fixed zones and distance conversion.
- `engine.mjs`: rhythm input, takeoff, Cannon flight, landing and result.
- `skier.mjs`: 3D dot poses, skis, telemark and reactions.
- `scene.mjs`: snow hill, course markers, camera and instanced dots.
- `game.mjs`: controls, audio, pause, equipment, scores and finish UI.
- `index.html` / `jump.css`: event page with shared controls and styling.

No new libraries, external image assets, runtime CDN requests or build step are required. Existing Three.js and Cannon copies are reused; other events do not load the ski-jumping scene.

```sh
node --test ski-jumping/engine.test.mjs sprint/timing.test.mjs sprint/finish.test.mjs
```

Tests cover takeoff timing, cancellation, carried speed, gear, real terrain contact, no-input attempts, frame-rate consistency, pose transitions, ski separation, finite dot geometry and immutable finish results.
