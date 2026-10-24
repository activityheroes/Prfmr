import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs?v=meets-1";
import { VAULT_COURSE, VAULT, PLANT_ZONE } from "./engine.mjs?v=meets-1";
import { vaulterDots, poleCurve, getVaulterPose } from "./vaulter.mjs?v=meets-1";
import { ease } from "../sprint/finish.mjs?v=meets-1";

const EMPTY_ART = { width: 2, height: 2, x: 0, ground: 0, unit: 1, scaleX: 1, scaleY: 1,
  anchorX: 0, anchorY: 0, headHeight: 3, feedbackX: 0, shadowStart: -1, shadowLength: 1.5, planar: true, draw() {} };
const environment = {
  create(track) {
    track.box(100, 0.1, 120, 25, -0.12, 0, "#284c39");
    const runway = track.plate(-45, 45, 2.6, 0, "#65434b", 1);
    const edges = [-1.3, 1.3].map(z => track.plate(-45, 45, 0.04, z, "#d4cebf", 1));
    const target = new THREE.Group(); track.scene.add(target);
    const length = PLANT_ZONE.end - PLANT_ZONE.start;
    track.plate(0, length, 1.2, 0, "#d8aa40", 0.6, target, 0.04);
    for (const x of [0, length]) track.plate(x - 0.035, 0.07, 1.35, 0, "#fff3c4", 1, target, 0.05);
    track.marks = Array.from({ length: 13 }, () => track.plate(0, 0.03, 2.6, 0, "#dec6bf", 0.18));
    for (let i = 0; i < 18; i++) track.box(0.8, 0.35, 0.65, i * 3 - 12, 0.1, -6, i % 3 ? "#426950" : "#91786b");
    return race => {
      const end = VAULT.boxX - race.distance;
      runway.position.x = end - 22.5; edges.forEach(edge => { edge.position.x = end - 22.5; });
      target.position.x = PLANT_ZONE.start - race.distance;
    };
  },
  finish(track, parent) {
    const add = (w, h, d, x, y, z, color) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
      mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    };
    add(0.6, 0.05, 0.55, 0, 0.02, 0, "#c1c9ba");
    add(0.3, 0.04, 0.28, 0.08, 0.06, 0, "#171f1c");
    for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) add(1.95, 0.65, 2.35, 2 + x * 2, 0.325, -1.2 + z * 2.4, (x + z) % 2 ? "#b95969" : "#ce7180");
    for (const z of [-1.85, 1.85]) {
      add(0.11, 7.2, 0.11, 1.6, 3.6, z, "#bacabd");
      add(0.8, 0.12, 0.6, 1.6, 0.08, z, "#4b6257");
    }
    track.bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.8, 10), new THREE.MeshBasicMaterial({ color: "#ffd473" }));
    track.bar.rotation.x = Math.PI / 2; parent.add(track.bar);
    track.barSupports = [-1.85, 1.85].map(z => add(0.3, 0.08, 0.12, 1.6, 3.5, z, "#f0f5f1"));
  }
};

export class VaultScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: VAULT_COURSE, athlete: EMPTY_ART, environment });
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.vaulter = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), 260);
    this.pole = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), 70);
    this.vaulter.frustumCulled = this.pole.frustumCulled = false;
    this.scene.add(this.vaulter, this.pole); this.visibleDots = [];
  }
  resize(w, h) { super.resize(w, h); this.frameCamera(null); }
  frameCamera(race) {
    const small = this.width < 650, planted = !!race?.plant;
    const t = planted ? Math.min(1, race.vaultTime / 0.8) : 0;
    let x = (small ? 1.4 : 2.8) * (1 - t) + (race ? VAULT.barX - race.distance + 0.8 : 4.5) * t;
    const extraHeight = Math.max(0, (race?.plant?.launchY ?? 5.2) - 5.2);
    let y = 1.45 * (1 - t) + (3.2 + extraHeight * 0.55) * t;
    const base = (small ? 9 : 17.2) * (1 - t) + (small ? 13 : 22) * t;
    let span = Math.max(base, this.width / this.height * (6.2 + (3 + extraHeight) * t));
    if (race?.presentation && planted) {
      const settle = race.presentation.reducedMotion ? 1 : ease((race.presentation.age - 0.6) / 1.1);
      x += (race.athlete.x - race.distance - x) * settle;
      y += (1.7 - y) * settle;
      span += (Math.max(small ? 11 : 18, this.width / this.height * 6.5) - span) * settle;
    }
    // Scale the view together so the grip, pole, bar and landing contacts still agree.
    span *= 1.3;
    const half = span / (this.width / this.height) / 2;
    this.camera.position.set(x + 7, y + 7, 22); this.camera.lookAt(x, y, 0);
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = half; this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }
  instances(mesh, dots, distance) {
    mesh.count = dots.length;
    for (let i = 0; i < dots.length; i++) {
      const p = dots[i]; this.dummy.position.set(p.x - distance, p.y, 0);
      this.dummy.scale.setScalar(p.radius); this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
      mesh.setColorAt(i, this.color.set(p.color));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
  bestPoint(mark, race) { return { x: VAULT.barX - race.distance, y: mark, width: 4.5 }; }
  render(race) {
    this.frameCamera(race);
    this.visibleDots = vaulterDots(race); this.instances(this.vaulter, this.visibleDots, race.distance);
    const head = getVaulterPose(race).head;
    this.finishFocus = { x: head.x - race.distance, y: head.y + 0.2 };
    const curve = poleCurve(race), dots = [];
    for (let i = 0; i < 70; i++) {
      const t = i / 69, k = 1 - t;
      dots.push({ x: k * k * curve.start.x + 2 * k * t * curve.control.x + t * t * curve.end.x,
        y: k * k * curve.start.y + 2 * k * t * curve.control.y + t * t * curve.end.y,
        color: i % 14 < 7 ? "#8cecff" : "#e3fff3", radius: 0.025 });
    }
    this.instances(this.pole, dots, race.distance);
    this.cursor.visible = !race.plant; this.shadow.visible = !race.plant;
    const age = race.barHitAt === null ? 0 : Math.min(1.2, Math.max(0, race.time + (race.presentation?.age ?? 0) - race.barHitAt));
    this.bar.position.set(1.6 + age * 0.1, Math.max(0.72, race.barHeight - 4.9 * age * age), 0);
    const settling = 1 - ease(age / 1.2);
    this.bar.rotation.set(Math.PI / 2 + Math.sin(age * 7) * 0.25 * settling, age * 0.25, 0);
    this.bar.material.color.set(race.barHit ? "#ff7f86" : "#ffd473");
    this.barSupports.forEach(support => { support.position.y = race.barHeight; });
    super.render(race);
  }
}
