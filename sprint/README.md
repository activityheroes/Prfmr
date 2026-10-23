# Dot Athletics: 100m Rhythm Sprint

A buildless HTML/CSS/JavaScript sprint game using the original procedural dot-matrix runner on a Three.js track. Serve the repository root and open `/sprint/`. Three.js 0.180.0 and its MIT license are bundled in `vendor/`; no install, CDN, or account is needed to play. WebGL is required.

The event tabs also open the 200m cycling game at `/cycling/`. It shares the rhythm engine and controls but has its own course, animation, equipment, and saved records. See `../cycling/README.md` for cycling details.

The 50m freestyle event is at `/swimming/`, using the motion lab's front crawl and the same timing mechanic. See `../swimming/README.md`.

## Race Loop

1. Tap Start Race once. The runner accelerates automatically to an 8.0 m/s baseline and keeps running without input.
2. Press as the runner's ground marker reaches the beginning of a blue strip.
3. Hold while the runner travels through the strip, then release at its far edge.
4. Run automatically between zones. Successful timing builds momentum for the next section.

The two long zones occupy 15-31m and 60-78m. They are fixed world distances, scrolling past the camera-followed runner, not a charging bar or moving pace target. HOLD marks the entry; RELEASE marks the exit. Red, yellow and green bands show bad, Good/Great and Perfect release positions. The bands account for entry quality, gear and the same weighted scoring used by the engine. The second zone has slightly tighter timing.

Mouse, touch, and Space support the same press/hold/release input. Each zone can be scored only once. Holding from the start, mashing, or continuing a hold into another zone cannot automatically earn boosts. A missed zone never stops baseline running.

At 98.5m the button becomes DIP. Tap, or swipe upward during an existing hold, to lean into the finish. The dip peaks after 90ms and extends the physics collision plane by up to 0.34m. The timer is stopped at the interpolated crossing, not by subtracting an arbitrary bonus.

## Timing Score

Entry and release accuracy compare the player's input position against the actual zone boundaries. Hold accuracy is the fraction of the zone covered while holding. Early and late input are already penalized by the two edge scores, so holding slightly beyond a boundary no longer incurs a second hold penalty. Very short holds, continuous holding from the start, cancellations and missed zones still fail.

```
Timing score = entry accuracy * 30 + hold accuracy * 30 + release accuracy * 40
```

Long-hold timing windows scale with approach speed: the first zone allows 480ms at each edge and full edge accuracy within 140ms, tightening to 420ms and 110ms in the second. Existing distance allowances remain minimums. Gear widens both bands. Each attempt freezes its windows on press, so changing speed cannot retroactively change a grade. Perfect additionally requires at least 90% accuracy at both boundaries; hold coverage still matters. Hurdles and final field actions retain their original shorter windows.

GET READY appears 650ms ahead. PRESS and RELEASE cues lead the boundary by 120ms, with short optional tones respecting the Sound toggle. A fixed guide near the button displays the athlete's approach to stationary entry/exit bands; its marker advances automatically, not in response to charging input. The same full-accuracy bands are projected on the track. Long jump's final release gets 200ms of warning because the physical foul board has no late grace. The track boundaries and all speed rewards are unchanged.

| Outcome | Score / condition | Speed multiplier | Momentum change |
| --- | --- | --- | --- |
| Perfect | At least 92, with both edge accuracies at least 90% | +15% | +2.4 m/s |
| Great | At least 80 | +10% | +1.5 m/s |
| Good | At least 65 | +6% | +0.75 m/s |
| Early | Below 65 with an early release | +2% | None |
| Late | Excessive exit error or timed-out hold | No boost; slight slowdown | -0.4 m/s |
| Miss | No input, invalid entry, less than 25% overlap, or cancellation | No boost | -0.4 m/s |

Late release beyond 85% of the edge-error window overrides successful score tiers. A hold extending past the full window times out once and requires release before another press. Canceling a touch, dragging off the button, or pausing invalidates the active attempt. Cancellation scores zero rather than granting a valid release.

## Momentum And Physics

Target running speed is `baseSpeed * (1 + modeGain) + momentum + temporaryBoost`, limited by the active speed ceiling and final-10m fatigue. Momentum decays slowly at 0.1 m/s per second; temporary boost holds for 1.25 seconds, then decays at 0.32 m/s per second. Race kits reduce both decay rates. One successful zone activates Flow (+5% baseline target pace and ceiling); two consecutive Perfects ignite six seconds of Flame (+20%). Misses, early/late releases and canceled holds end the mode. Another two Perfects refill Flame fuel.

A reward multiplies current speed by its tier percentage, subject to the speed cap. Its persistent portion is represented by the momentum increment; any remaining portion becomes temporary boost, avoiding double-counting. A perfect first zone raises 8.0 to 9.2 m/s, retaining momentum after the temporary portion wears off. Misses reduce existing momentum but never subtract it below zero.

The engine uses steps no larger than 1/240s. Holding by itself does not accelerate the runner; boosts are awarded only when a zone resolves. Results report average weighted timing, both zone grades and component scores, longest successful streak, peak speed, and finish dip. Above-runner feedback and dot trails show the latest result. The shared mode HUD shows Perfect charge, Flame fuel, actual awarded burst and pace above baseline; raw momentum remains internal.

## Equipment And Records

- Timing bands widen edge tolerance by 15/30%, without moving the zone boundaries.
- Starting blocks raise launch acceleration by 10/20%.
- Spikes alone raise maximum speed from 11.2 to 11.8/12.4 m/s.
- Race kits retain momentum and reduce final-10m fatigue.

Gear and the personal best use the `dot-sprint-zones-v4-long-zones-v1` localStorage key. Equipment migrates from older demos; their records remain untouched and are not compared against this different mechanic. This is a client-side demo, not a verified competitive leaderboard.

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
