import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs";
import { LONG_JUMP_COURSE, TAKEOFF_ZONE, JUMP } from "./engine.mjs";
import { jumperDots } from "./jumper.mjs";

const EMPTY_ART = { width: 2, height: 2, x: 0, ground: 0, unit: 1, scaleX: 1, scaleY: 1, anchorX: 0, anchorY: 0,
  headHeight: 3, feedbackX: 0, shadowStart: -1, shadowLength: 1.5, planar: true, draw() {} };
const environment = {
  create(track) {
    track.box(110, 0.1, 36, 30, -0.12, 0, "#284c39");
    const runway = track.plate(-46, 46, 2.6, 0, "#65434b");
    const edges = [-1.3, 1.3].map(z => track.plate(-46, 46, 0.045, z, "#d4cebf"));
    track.marks = Array.from({ length: 13 }, () => track.plate(0, 0.03, 2.6, 0, "#dec6bf", 0.18));
    const target = new THREE.Group(); track.scene.add(target);
    const length = TAKEOFF_ZONE.end - TAKEOFF_ZONE.start;
    track.plate(0, length, 1.2, 0, "#d8aa40", 0.55, target, 0.04);
    for (const x of [0, length]) track.plate(x - 0.035, 0.07, 1.35, 0, "#fff3c4", 1, target, 0.05);
    for (let i = 0; i < 20; i++) track.box(0.8, 0.3, 0.65, i * 3 - 12, 0.1, -5, i % 3 ? "#426950" : "#91786b");
    return race => {
      const end = JUMP.pitStart - race.distance;
      runway.position.x = end - 23; edges.forEach(edge => { edge.position.x = end - 23; });
      target.position.x = TAKEOFF_ZONE.start - race.distance;
    };
  },
  finish(track, parent) {
    track.plate(-0.2, 0.2, 2.7, 0, "#f0f5f1", 1, parent, 0.065);
    track.plate(0, 0.065, 2.7, 0, "#ff7f86", 1, parent, 0.07);
    track.plate(2, 11, 3.8, 0, "#8f8a72", 1, parent, 0.03);
    track.plate(2.08, 10.84, 3.64, 0, "#d9c399", 1, parent, 0.045);
    for (let i = 0; i < 50; i++) track.plate(2.12 + i * 0.213, 0.015, 3.5, 0, "#a99b7d", 0.3, parent, 0.051);
    for (let m = 3; m <= 12; m++) {
      track.plate(m, 0.025, 0.32, 2, "#f0f5f1", 1, parent, 0.065);
      const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext("2d"); ctx.font = "bold 32px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#f0f5f1"; ctx.fillText(String(m), 32, 43);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
      label.scale.set(0.6, 0.6, 1); label.position.set(m, 0.15, 2.6); parent.add(label);
    }
  }
};
export class LongJumpScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: LONG_JUMP_COURSE, athlete: EMPTY_ART, environment });
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.jumper = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), 260);
    this.jumper.frustumCulled = false; this.scene.add(this.jumper); this.visibleDots = [];
    this.landingLine = this.plate(0, 0.045, 3.5, 0, "#b7fa76", 1, this.scene, 0.06);
    this.footprints = [-0.18, 0.18].map(z => this.plate(0, 0.32, 0.16, z, "#897253", 1, this.scene, 0.062));
    this.dust = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: "#f5dba5", transparent: true }), 28);
    this.dust.frustumCulled = false; this.scene.add(this.dust);
  }
  resize(w, h) { super.resize(w, h); this.frameCamera(null); }
  frameCamera(race) {
    const small = this.width < 650, t = race?.launch ? Math.min(1, race.flightTime / 0.25) : 0;
    const x = (small ? 1.3 : 3) * (1 - t) + (race?.athlete ? race.athlete.x - race.distance + 1.6 : 3) * t;
    const span = Math.max((small ? 9 : 17.2) + t * (small ? 1.5 : 2), this.width / this.height * 6.3);
    const half = span / (this.width / this.height) / 2;
    this.camera.position.set(x + 7, 8.5, 22); this.camera.lookAt(x, 1.5, 0);
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = half; this.camera.bottom = -half; this.camera.updateProjectionMatrix();
  }
  render(race) {
    this.frameCamera(race); this.visibleDots = jumperDots(race); this.jumper.count = this.visibleDots.length;
    this.visibleDots.forEach((p, i) => {
      this.dummy.position.set(p.x - race.distance, p.y, 0); this.dummy.scale.setScalar(p.radius); this.dummy.updateMatrix();
      this.jumper.setMatrixAt(i, this.dummy.matrix); this.jumper.setColorAt(i, this.color.set(p.color));
    });
    this.jumper.instanceMatrix.needsUpdate = true; this.jumper.instanceColor.needsUpdate = true;
    this.cursor.visible = !race.launch;
    this.shadow.position.x = race.launch ? race.athlete.x - race.distance + race.landTime * 1.5 : -0.25;
    this.shadow.material.opacity = race.launch ? 0.22 : 0.5;
    this.landingLine.visible = !!race.landing;
    this.footprints.forEach((foot, i) => { foot.visible = !!race.landing; if (race.landing) foot.position.x = race.landing.heels[i].x - race.distance + 0.16; });
    if (race.landing) this.landingLine.position.x = race.landing.x - race.distance;
    this.dust.visible = !!race.landing && race.landTime < 0.6;
    if (this.dust.visible) {
      const age = race.landTime;
      for (let i = 0; i < 28; i++) {
        const a = i * 2.399, speed = 0.8 + i % 5 * 0.3;
        this.dummy.position.set(race.landing.x - race.distance + 0.2 + age * (1.5 + Math.cos(a)), Math.max(0.08, 0.08 + speed * age - 3 * age * age), Math.sin(a) * age * 1.1);
        this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.dust.setMatrixAt(i, this.dummy.matrix);
      }
      this.dust.instanceMatrix.needsUpdate = true; this.dust.material.opacity = 1 - age / 0.6;
    }
    super.render(race);
  }
}
