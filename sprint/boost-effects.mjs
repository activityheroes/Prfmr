import * as THREE from "./vendor/three.module.min.js";
import { MODES } from "./engine.mjs?v=rivals-1";

// One instanced draw for every sport, with no textures, lights, or post-processing.
export class BoostEffects extends THREE.InstancedMesh {
  constructor() {
    super(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ depthWrite: false }), 96);
    this.frustumCulled = false; this.renderOrder = 3;
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.seeds = Array.from({ length: 96 }, (_, i) => ((Math.sin(i * 127.1 + 7.4) * 43758.5453) % 1 + 1) % 1);
  }
  update(race, track) {
    const recent = race.lastAttempt?.speedGain > 0 && race.time - race.lastAttempt.time < MODES.burstDuration;
    this.visible = ["sprint", "line"].includes(race.phase) && (race.mode !== "normal" || recent) && !race.presentation;
    if (!this.visible) return;
    const flame = race.mode === "flame", flow = race.mode === "flow", reduced = this.reduced.matches;
    const particles = reduced ? 12 : flame ? 72 : flow ? 42 : 30;
    this.count = particles + (!reduced && (recent || flame) ? 24 : 0);
    const palette = flame ? ["#ff694a", "#ffab4e", "#ffe78d", "#fff8d6"] : flow ? ["#41c5c7", "#8ef6e9", "#dcfffa"]
      : race.lastAttempt.grade === "Good" ? ["#e0a74c", "#ffd473", "#fff1c2"] : ["#40b2d1", "#8ee6ff", "#e6fcff"];
    for (let i = 0; i < particles; i++) {
      const seed = this.seeds[i], u = reduced ? seed : (seed + race.time * (flame ? 1.45 : 1.1)) % 1;
      const length = reduced ? 1.1 : flame ? 3.2 : flow ? 2.5 : 2;
      const spread = (1 - u) * (flame ? 0.6 : 0.25), a = i * 2.399;
      const x = -0.4 - u * length, y = 0.55 + Math.sin(a) * spread + u * (flame ? 1.1 : 0.15), z = Math.cos(a) * spread;
      const p = track.boostPoint ? track.boostPoint(x, y, z) : { x: track.art.feedbackX + x, y, z };
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar((flame ? 0.12 : 0.085) * (1 - u * 0.7) * (track.boostScale ?? 1));
      this.dummy.updateMatrix(); this.setMatrixAt(i, this.dummy.matrix);
      this.setColorAt(i, this.color.set(palette[Math.min(palette.length - 1, Math.floor((1 - u) * palette.length))]));
    }
    // Short ground-level streaks make the surge readable without moving the camera.
    for (let i = particles; i < this.count; i++) {
      const u = (this.seeds[i] + race.time * 1.8) % 1, x = 2 - u * 8;
      const y = 0.12 + i % 3 * 0.09, z = (i % 2 ? 1 : -1) * (0.85 + this.seeds[i] * 0.8);
      const at = (dx) => track.boostPoint ? track.boostPoint(dx, y, z) : { x: track.art.feedbackX + dx, y, z };
      const a = at(x), b = at(x - 1);
      this.dummy.position.set(a.x, a.y, a.z); this.dummy.lookAt(b.x, b.y, b.z);
      this.dummy.scale.set(0.022, 0.022, 0.25 + u * 0.35); this.dummy.updateMatrix(); this.setMatrixAt(i, this.dummy.matrix);
      this.setColorAt(i, this.color.set(flame ? "#ffcf78" : "#b5f5ff"));
    }
    this.instanceMatrix.needsUpdate = true; this.instanceColor.needsUpdate = true;
  }
}
