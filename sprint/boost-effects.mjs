import * as THREE from "./vendor/three.module.min.js";
import { MODES } from "./engine.mjs?v=weather-1";

// One instanced draw for every sport, with no textures, lights, or post-processing.
export class BoostEffects extends THREE.InstancedMesh {
  constructor() {
    super(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ depthWrite: false }), 72);
    this.frustumCulled = false; this.renderOrder = 3;
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.seeds = Array.from({ length: 72 }, (_, i) => ((Math.sin(i * 127.1 + 7.4) * 43758.5453) % 1 + 1) % 1);
  }
  update(race, track) {
    const recent = race.lastAttempt?.speedGain > 0 && race.time - race.lastAttempt.time < MODES.burstDuration;
    this.visible = ["sprint", "line"].includes(race.phase) && (race.mode !== "normal" || recent) && !race.presentation;
    if (!this.visible) return;
    const flame = race.mode === "flame", flow = race.mode === "flow", reduced = this.reduced.matches;
    this.count = reduced ? 12 : flame ? 72 : flow ? 42 : 30;
    const palette = flame ? ["#ff694a", "#ffab4e", "#ffe78d", "#fff8d6"] : flow ? ["#41c5c7", "#8ef6e9", "#dcfffa"]
      : race.lastAttempt.grade === "Good" ? ["#e0a74c", "#ffd473", "#fff1c2"] : ["#40b2d1", "#8ee6ff", "#e6fcff"];
    for (let i = 0; i < this.count; i++) {
      const seed = this.seeds[i], u = reduced ? seed : (seed + race.time * (flame ? 1.45 : 1.1)) % 1;
      const length = reduced ? 1.1 : flame ? 3.2 : flow ? 2.5 : 2;
      const spread = (1 - u) * (flame ? 0.6 : 0.25), a = i * 2.399;
      const x = -0.4 - u * length, y = 0.55 + Math.sin(a) * spread + u * (flame ? 1.1 : 0.15), z = Math.cos(a) * spread;
      const p = track.boostPoint ? track.boostPoint(x, y, z) : { x: track.art.feedbackX + x, y, z };
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar((flame ? 0.12 : 0.085) * (1 - u * 0.7) * (track.boostScale ?? 1));
      this.dummy.updateMatrix(); this.setMatrixAt(i, this.dummy.matrix);
      this.setColorAt(i, this.color.set(palette[Math.min(palette.length - 1, Math.floor((1 - u) * palette.length))]));
    }
    this.instanceMatrix.needsUpdate = true; this.instanceColor.needsUpdate = true;
  }
}
