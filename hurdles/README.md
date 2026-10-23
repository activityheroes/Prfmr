# Dot Athletics - 100m Hurdles

Serve the repository root and open `/hurdles/`. This is an arcade event using the same dot-matrix artwork, automatic running, equipment, and press/hold/release rhythm mechanics as the other games.

## Race Loop

Each hurdle has a fixed blue approach zone. Press at its entry, hold through it, then release at the white exit line to jump. Accurate timing earns the existing speed and momentum rewards. The tenth zone is narrower. Advance cues and speed-adjusted tolerance match the other events, so precise timing wins without requiring instant reactions.

Unlike the other events' two long boost zones, Hurdles keeps all ten manually timed jumps. It shares the marked HOLD entries and red/yellow/green release bands, and the updated one-success Flow / two-Perfect Flame rules. The original short-zone timing windows and momentum increments remain unchanged.

The athlete extends the lead leg, folds the trail leg out to the side, and resumes a running stride on landing. Mistimed, canceled or missed holds can clip a hurdle. Contact tips the hurdle forward, cuts current speed by 20%, removes 0.6 momentum, and resets the streak. The race continues; incidental contact is not treated as a disqualification.

The course has ten 0.838 m barriers, with 13 m to the first, 8.5 m between barriers and 10.5 m after the last. Layout reference: [World Athletics 100 metres hurdles](https://worldathletics.org/disciplines/hurdles/100-metres-hurdles). Race speeds and jump rewards are tuned for this arcade game, not an official competition simulation.

## Implementation

- `engine.mjs`: shared rhythm engine plus Cannon gravity, swept body-point clearance checks, contact penalties and immutable results.
- `hurdler.mjs`: run, lead-leg/trail-leg, stumble and finish poses rendered as instanced dots.
- `scene.mjs`: stationary track barriers, falling hurdle frames and responsive camera.
- `event.mjs`: event-specific feedback and results, loaded only by the hurdles page.
- `index.html`: existing shared race controls, equipment and local personal best.

No new dependencies or backend are required. The shared controller dynamically loads the event; other games do not download its physics or artwork. Touch, mouse and Space all work. Dragging away or pausing cancels the hold. Results follow the finish celebration, with restart and a skippable result screen.

## Tests

```sh
node --test hurdles/engine.test.mjs sprint/timing.test.mjs sprint/finish.test.mjs
```

Tests cover all ten clean jumps, missed and canceled holds, momentum penalties, gravity, clearance geometry, equipment, frame-rate consistency, restart and result preservation.
