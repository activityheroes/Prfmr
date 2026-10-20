# Dot Athletics: 100m Rhythm Sprint

A buildless HTML/CSS/JavaScript sprint game using the original procedural dot-matrix runner on a Three.js track. Serve the repository root and open `/sprint/`. Three.js 0.180.0 and its MIT license are bundled in `vendor/`; no install, CDN, or account is needed to play. WebGL is required.

The event tabs also open the 200m cycling game at `/cycling/`. It shares the rhythm engine and controls but has its own course, animation, equipment, and saved records. See `../cycling/README.md` for cycling details.

The 50m freestyle event is at `/swimming/`, using the motion lab's front crawl and the same timing mechanic. See `../swimming/README.md`.

## Race Loop

1. Tap Start Race once. The runner accelerates automatically to an 8.0 m/s baseline and keeps running without input.
2. Press as the runner's ground marker reaches the beginning of a blue strip.
3. Hold while the runner travels through the strip, then release at its far edge.
4. Run automatically between zones. Successful timing builds momentum for the next section.

The six zones occupy 15-20m, 30-35m, 45-50m, 60-65m, 75-80m, and 90-93m. They are fixed to world distances on the track, scrolling past the camera-followed runner. They are not a charging bar or an independent pace target. The control button and runner marker stay stationary on screen. The final zone is shorter with tighter edge tolerance.

Mouse, touch, and Space support the same press/hold/release input. Each zone can be scored only once. Holding from the start, mashing, or continuing a hold into another zone cannot automatically earn boosts. A missed zone never stops baseline running.

At 98.5m the button becomes DIP. Tap, or swipe upward during an existing hold, to lean into the finish. The dip peaks after 90ms and extends the physics collision plane by up to 0.34m. The timer is stopped at the interpolated crossing, not by subtracting an arbitrary bonus.

## Timing Score

Entry and release accuracy compare the player's input position against the actual zone boundaries. Hold accuracy is the fraction of the zone covered while holding. Early and late input are already penalized by the two edge scores, so holding slightly beyond a boundary no longer incurs a second hold penalty. Very short holds, continuous holding from the start, cancellations and missed zones still fail.

```
Timing score = entry accuracy * 30 + hold accuracy * 30 + release accuracy * 40
```

Timing windows now scale with approach speed. The first blue zone has a minimum edge allowance of 240ms and full edge accuracy within 70ms; those floors gradually tighten to 180ms and 45ms on the final zone. Existing distance allowances remain minimums. Gear widens both bands. Each attempt freezes its windows on press, so changing speed cannot retroactively change a grade. Perfect additionally requires at least 90% accuracy at both boundaries; hold coverage still matters.

GET READY appears 650ms ahead. PRESS and RELEASE cues lead the boundary by 120ms, with short optional tones respecting the Sound toggle. A fixed guide near the button displays the athlete's approach to stationary entry/exit bands; its marker advances automatically, not in response to charging input. The same full-accuracy bands are projected on the track. Long jump's final release gets 200ms of warning because the physical foul board has no late grace. The track boundaries and all speed rewards are unchanged.

| Outcome | Score / condition | Speed multiplier | Momentum change |
| --- | --- | --- | --- |
| Perfect | At least 92, with both edge accuracies at least 90% | +15% | +0.8 m/s |
| Great | At least 80 | +10% | +0.5 m/s |
| Good | At least 65 | +6% | +0.25 m/s |
| Early | Below 65 with an early release | +2% | None |
| Late | Excessive exit error or timed-out hold | No boost; slight slowdown | -0.4 m/s |
| Miss | No input, invalid entry, less than 25% overlap, or cancellation | No boost | -0.4 m/s |

Late release beyond 85% of the edge-error window overrides successful score tiers. A hold extending past the full window times out once and requires release before another press. Canceling a touch, dragging off the button, or pausing invalidates the active attempt. Cancellation scores zero rather than granting a valid release.

## Momentum And Physics

Target running speed is `baseSpeed + momentum + temporaryBoost`, limited by equipped spikes and final-10m fatigue. Momentum decays slowly at 0.1 m/s per second; temporary boost decays at 0.65 m/s per second. Race kits reduce both decay rates.

A reward multiplies current speed by its tier percentage, subject to the speed cap. Its persistent portion is represented by the momentum increment; any remaining portion becomes temporary boost, avoiding double-counting. A perfect first zone raises 8.0 to 9.2 m/s, retaining momentum after the temporary portion wears off. Misses reduce existing momentum but never subtract it below zero.

The engine uses steps no larger than 1/240s. Holding by itself does not accelerate the runner; boosts are awarded only when a zone resolves. Results report average weighted timing, all six zone grades and component scores, longest successful streak, peak speed, and finish dip. Above-runner feedback and sparks show the latest result. Momentum is internal, with no meter on the HUD.

## Equipment And Records

- Timing bands widen edge tolerance by 15/30%, without moving the zone boundaries.
- Starting blocks raise launch acceleration by 10/20%.
- Spikes alone raise maximum speed from 11.2 to 11.8/12.4 m/s.
- Race kits retain momentum and reduce final-10m fatigue.

Gear and the personal best use the `dot-sprint-zones-v4` localStorage key. Equipment migrates from older demos; their records remain untouched and are not compared against this different mechanic. This is a client-side demo, not a verified competitive leaderboard.

Restart resets the race. Switching tabs or losing focus pauses it; resume explicitly. An active hold canceled by pausing earns no boost.

## Files And Tests

- `engine.mjs`: zones, weighted scoring, automatic running, momentum, equipment, and finish collision.
- `track-scene.mjs`: world-space blue strips, runner marker, animated dot texture, and spark feedback.
- `runner.mjs`: procedural crouch, running gait, launch blend, and dip.
- `game.mjs`: pointer/keyboard input, audio, UI, persistence, pause, and result breakdown.
- `index.html`, `sprint.css`: responsive interface.

```sh
node --test sprint/*.test.mjs
```
