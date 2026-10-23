import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs?v=weather-1";
import { HIGH_JUMP_COURSE, HIGH_JUMP, TAKEOFF_ZONE, approachPoint } from "./course.mjs?v=weather-1";
import { getHighJumperPose, jumperDots } from "./jumper.mjs?v=weather-1";
import { ease } from "../sprint/finish.mjs?v=weather-1";

const EMPTY_ART = { width: 2, height: 2, x: 0, ground: 0, unit: 1, scaleX: 1, scaleY: 1,
  anchorX: 0, anchorY: 0, headHeight: 2.2, feedbackX: 0, shadowStart: -0.6, shadowLength: 1.1, planar: true, draw() {} };
function ribbon(start, end, width, offset, color, y = 0.02) {
  const positions = [], indices = [], n = Math.ceil((end - start) / 0.3);
  for (let i = 0; i <= n; i++) {
    const p = approachPoint(start + (end - start) * i / n);
    for (const side of [-1, 1]) {
      const lateral = offset + side * width / 2;
      positions.push(p.x - Math.sin(p.heading) * lateral, y, p.z + Math.cos(p.heading) * lateral);
    }
    if (i < n) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
}
const environment = {
  create(track) {
    track.courseRoot = new THREE.Group(); track.scene.add(track.courseRoot);
    track.courseRoot.add(track.box(100, 0.1, 50, 30, -0.12, 0, "#284c39"));
    track.courseRoot.add(ribbon(-5, 38, 2.4, 0, "#65434b"));
    for (const offset of [-1.2, 1.2]) track.courseRoot.add(ribbon(-5, 38, 0.035, offset, "#d4cebf", 0.025));
    for (let i = 0; i < 18; i++) track.courseRoot.add(track.box(0.8, 0.35, 0.65, i * 3 - 5, 0.1, -10, i % 3 ? "#426950" : "#91786b"));
    track.marks = [];
    track.takeoffStrip = new THREE.Group(); track.scene.add(track.takeoffStrip);
    const length = TAKEOFF_ZONE.end - TAKEOFF_ZONE.start;
    track.plate(0, length, 1.2, 0, "#d8aa40", 0.6, track.takeoffStrip, 0.04);
    for (const x of [0, length]) track.plate(x - 0.035, 0.07, 1.35, 0, "#fff3c4", 1, track.takeoffStrip, 0.05);
    return () => {};
  },
  finish(track, parent) {
    const box = (w, h, d, x, y, z, color) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
      mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    };
    for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++)
      box(2.08, 0.65, 2.73, (x - 1) * 2.13, 0.325, 1.1 + z * 2.8, (x + z) % 2 ? "#b95969" : "#ce7180");
    for (const x of [-2.4, 2.4]) {
      box(0.09, 3, 0.09, x, 1.5, 0, "#bacabd"); box(0.6, 0.08, 0.65, x, 0.04, 0, "#4b6257");
      for (let y = 1.2; y <= 2.5; y += 0.1) box(0.17, 0.018, 0.1, x, y, 0, "#f0f5f1");
    }
    track.barSupports = [-2.4, 2.4].map(x => box(0.12, 0.055, 0.18, x, 1.65, 0, "#f0f5f1"));
    track.bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, HIGH_JUMP.barWidth, 10), new THREE.MeshBasicMaterial({ color: "#ffd473" }));
    track.bar.rotation.z = Math.PI / 2; parent.add(track.bar);
  }
};

export class HighJumpScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: HIGH_JUMP_COURSE, athlete: EMPTY_ART, environment });
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color(); this.visibleDots = [];
    this.jumper = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), 280);
    this.jumper.frustumCulled = false; this.scene.add(this.jumper);
    this.zoneMeshes.forEach((mesh, i) => {
      const z = HIGH_JUMP_COURSE.zones[i];
      for (const [key, start, end, width, y] of [["glow", z.start - 0.08, z.end + 0.08, 1.34, 0.029], ["surface", z.start, z.end, 1.2, 0.034], ["core", z.start, z.end, 0.24, 0.039], ["entry", z.start - 0.035, z.start + 0.035, 1.28, 0.05], ["exit", z.end - 0.035, z.end + 0.035, 1.28, 0.05]]) {
        const curved = ribbon(start, end, width, 0, "#ffffff", y);
        mesh[key].geometry.dispose(); mesh[key].geometry = curved.geometry; curved.material.dispose();
        mesh[key].material.side = THREE.DoubleSide; mesh[key].scale.set(1, 1, 1); mesh[key].position.set(0, 0, 0);
      }
    });
  }
  resize(w, h) { super.resize(w, h); this.frameCamera(null); }
  frameCamera(race) {
    const origin = approachPoint(race?.distance ?? 0), t = race?.launch ? ease(race.flightTime / 0.35) : 0;
    const x = 2.2 * Math.cos(origin.heading) * (1 - t) + (HIGH_JUMP.barX - origin.x) * t;
    const z = 2.2 * Math.sin(origin.heading) * (1 - t) + (HIGH_JUMP.matZ - origin.z - 0.7) * t;
    const span = Math.max(this.width < 650 ? 9 + t * 1.5 : 17.2, this.width / this.height * 6.3);
    const half = span / (this.width / this.height) / 2;
    this.camera.position.set(x + 14, 10, z + 12); this.camera.lookAt(x, 1.2, z);
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = half; this.camera.bottom = -half; this.camera.updateProjectionMatrix();
  }
  positionCourse(race) {
    const origin = approachPoint(race.distance);
    this.courseRoot.position.set(-origin.x, 0, -origin.z);
    const place = (group, start, end) => {
      const point = approachPoint(start), mid = approachPoint((start + end) / 2);
      group.position.set(point.x - origin.x, 0, point.z - origin.z); group.rotation.y = -mid.heading;
    };
    this.zoneMeshes.forEach(mesh => mesh.group.position.set(-origin.x, 0, -origin.z));
    place(this.takeoffStrip, TAKEOFF_ZONE.start, TAKEOFF_ZONE.end);
    this.takeoffStrip.visible = race.distance > 22 && !race.launch;
    this.finish.position.set(HIGH_JUMP.barX - origin.x, 0, HIGH_JUMP.barZ - origin.z); this.finish.visible = race.distance > 18;
    this.cursor.visible = !race.launch && !race.terminal; this.cursor.position.set(0, 0.075, 0); this.cursor.rotation.y = -origin.heading;
    this.shadow.visible = !race.launch; this.shadow.position.set(-0.2 * Math.cos(origin.heading), 0.028, -0.2 * Math.sin(origin.heading)); this.shadow.rotation.y = -origin.heading;
    const age = race.barHitAt === null ? 0 : Math.min(1.2, race.time + (race.presentation?.age ?? 0) - race.barHitAt);
    this.bar.position.set(0, Math.max(0.72, race.barHeight - 4.9 * age * age), age * 0.4);
    this.bar.rotation.set(0, age * 0.18, Math.PI / 2 + Math.sin(age * 7) * 0.15 * (1 - ease(age / 1.2)));
    this.bar.material.color.set(race.barHit ? "#ff7f86" : "#ffd473");
    this.barSupports.forEach(s => { s.position.y = race.barHeight; });
  }
  render(race) {
    const origin = approachPoint(race.distance); this.frameCamera(race);
    this.visibleDots = jumperDots(race); this.jumper.count = this.visibleDots.length;
    this.visibleDots.forEach((p, i) => {
      this.dummy.position.set(p.x - origin.x, p.y, p.z - origin.z); this.dummy.scale.setScalar(p.radius); this.dummy.updateMatrix();
      this.jumper.setMatrixAt(i, this.dummy.matrix); this.jumper.setColorAt(i, this.color.set(p.color));
    });
    this.jumper.instanceMatrix.needsUpdate = true; this.jumper.instanceColor.needsUpdate = true;
    const head = getHighJumperPose(race).head;
    this.finishFocus = { x: head.x - origin.x, y: head.y + 0.18, z: head.z - origin.z };
    super.render(race);
  }
  boostPoint(x, y, z) {
    const a = -this.cursor.rotation.y, c = Math.cos(a), s = Math.sin(a);
    return { x: c * x - s * z, y, z: s * x + c * z };
  }
  timingPoint(distance, z, y, race) {
    const p = approachPoint(distance), origin = approachPoint(race.distance);
    return { x: p.x - Math.sin(p.heading) * z - origin.x, y, z: p.z + Math.cos(p.heading) * z - origin.z };
  }
}
