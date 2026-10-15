# Dot Pole Vault

A local HTML/CSS/JavaScript arcade event using the shared athletics rhythm engine.

## Play

Open `/pole-vault/` on the same static server as the other events.

- Choose a crossbar height from 2.50 to 6.00 meters, in 0.25-meter steps.
- Start the automatic run-up with the circular button or Space.
- Hold while crossing each blue strip, then release at its exit. Six zones build momentum using the existing 30% entry, 30% overlap, 40% release scoring.
- Hold through the gold strip at 39.5 meters and release at 42 meters to plant the pole.
- Approach speed and plant accuracy determine the vault's available height. The bend, inversion, free flight and mat landing then play automatically.
- A clearance records the selected crossbar height. Raise the bar or retry the same height. A missed plant, bar knockdown or passage below the bar awards no mark.

Grip tape, run-up insoles, vault spikes and the vault suit use the existing timing, acceleration, speed-cap and endurance upgrades. Elite speed/endurance equipment and accurate timing can clear the maximum selectable height.

## Implementation

- `engine.mjs`: run-up, plant scoring, vault state machine and clearance checks.
- `vaulter.mjs`: articulated dot athlete, carried/bending/released pole and collision samples.
- `scene.mjs`: Three.js instanced dots, runway, crossbar, landing mat and responsive camera.
- `game.mjs`: keyboard/pointer/touch input, pause handling, equipment and result UI.
- `engine.test.mjs`: timing, cancellation, progression, collisions, frame-rate consistency and pose tests.

The pole-assisted rise is an arcade choreography scaled by approach energy and timing, not an elastic-rod simulation. After release, the existing Cannon engine applies gravity. A torso collider plus swept head/limb samples check the actual visible pose against the crossbar plane. The yellow bar falls when contacted; landing uses the padded mat height.

Three.js and Cannon are reused from the sprint and javelin folders. This event adds no new library downloads or external assets. Keep those shared folders when serving the game.

Personal best, selected height and equipment are stored locally under `dot-pole-vault-zones-v1`, independently of the other sports. Leaving the tab pauses the attempt and cancels any active hold.

## Tests

```sh
node --test pole-vault/engine.test.mjs
node --test sprint/engine.test.mjs cycling/engine.test.mjs swimming/engine.test.mjs javelin/engine.test.mjs pole-vault/engine.test.mjs
```
