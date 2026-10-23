# Dot Athletics - High Jump

Serve the repository root and open `/high-jump/`. This event shares the existing Three.js renderer, rhythm engine, timing guide, equipment and finish reactions. No extra libraries or downloads are needed.

## Attempt

The athlete runs automatically through a 38 m J-shaped approach. Two longer fixed blue zones occupy 4-12m and 19-28m. HOLD marks entry; red/yellow/green bands mark bad, Good/Great and Perfect releases. Timing windows scale with approach speed. The final takeoff remains separate.

Hold through the gold takeoff zone (34-36.6 m), then release at the white line. Run-up speed and timing quality determine the jump impulse. The athlete turns into a back-first flop, arches over the crossbar, kicks the trailing heels clear, and lands on the mat. Holding past the approach or missing the takeoff earns no mark.

The crossbar can be set from 1.20 to 2.50 m in 5 cm steps before an attempt. A successful jump offers the next height; a failed attempt retries the same height. Best clearance, height and equipment persist locally in the browser. Club gear will not clear the highest settings; faster run-up equipment and precise timing are needed.

## Physics and Presentation

The approach follows a constant-radius curve. Cannon integrates the jump with gravity, while swept head, torso and limb samples check the visible body against the bar plane. Clearance is awarded only after the trailing feet pass. Bar contact drops the crossbar; going below it or landing outside the mat also fails the attempt.

The mat landing and raised-arm or disappointed reaction play before results. The presentation clock does not change the official mark. Leaving the tab pauses play and cancels an active hold. Restarting resets the attempt. Reduced motion suppresses celebration particles.

Touch, mouse and Space all use the same press/hold/release control. Dragging outside the button cancels the hold.

## Tests

From the repository root:

```sh
node --test high-jump/engine.test.mjs sprint/timing.test.mjs sprint/finish.test.mjs
```
