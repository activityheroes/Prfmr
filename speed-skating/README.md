# Dot Athletics - 500m Speed Skating

Serve the repository root and open `/speed-skating/`. This first winter event uses the same automatic movement, equipment, and press/hold/release mechanics as the existing games.

## Race Loop

The skater accelerates into a baseline glide automatically. Six fixed blue strips start at 55, 125, 205, 280, 355 and 445 meters. Press on entry, hold through the zone, then release at the white exit line. The first five strips are 12 meters long; the final strip is 8 meters long with tighter timing.

Entry, hold and release accuracy contribute 30%, 30% and 40% to the timing score. Perfect, Great and Good award the existing 15%, 10% and 6% speed boosts. Momentum carries between strips and gradually decays; misses and late holds cost momentum. Advance cues and speed-adjusted timing windows match the other events.

The 500m race travels one and a quarter laps of a 400m oval. The oval format is inspired by [ISU's speed skating overview](https://beta.isu-skating.com/en/speed-skating/news/speed-skating-everything-you-need-to-know/). Speeds, rewards, lane layout and solo play are arcade choices, not an official competition simulation. There are no lane changes or opponent collisions.

## Skating and Equipment

Each leg cycles through a long supported glide, a shorter sideways push and a low recovery under the hips. The torso stays in a forward aerodynamic tuck with hands together behind the back. Separate hip joints and fixed-length thigh/shin geometry prevent stretching; at least one blade stays on the ice. Bends add inward lean and crossover steps; contact traces follow the blades around the oval. After crossing the finish, the skater coasts onto both blades and celebrates before results appear. Official race time stays frozen during this sequence.

- Timing band widens the timing tolerance.
- Skate boots improve acceleration.
- Race blades raise maximum speed.
- Skinsuit reduces late-race fatigue.

Touch, mouse and Space share the same input path. Dragging outside the button or switching away cancels the hold; resume, restart, results skip and reduced-motion handling use the shared controller. Equipment and personal best are saved locally under an event-specific key.

## Implementation

- `course.mjs`: fixed zones, course tuning and continuous oval geometry.
- `engine.mjs`: existing rhythm race engine configured for skating.
- `skater.mjs`: procedural 3D dot poses, blade contact and finish reaction.
- `scene.mjs`: Three.js ice oval, curved timing strips, blade traces and following camera.
- `event.mjs`: dynamically loaded event configuration and feedback.
- `index.html` / `skating.css`: shared controls with ice-specific contrast.

No additional libraries, external assets, CDN requests, build step or backend are needed. Other event pages do not load the skating artwork or scene.

## Tests

```sh
node --test speed-skating/engine.test.mjs sprint/timing.test.mjs sprint/finish.test.mjs
```

Coverage includes complete races, zone scoring, carried momentum, missed and canceled input, equipment, frame-rate consistency, oval continuity, alternating blade contact, crossover lean, dot budgets and immutable finish results.
