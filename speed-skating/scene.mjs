import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs?v=sports-1";
import { ease, finishTravel } from "../sprint/finish.mjs?v=sports-1";
import { SKATING_COURSE, ovalPoint } from "./course.mjs?v=sports-1";
import { getSkaterPose, skaterDots } from "./skater.mjs?v=sports-1";
import { ghostDots } from "../sprint/rival-scene.mjs?v=sports-1";

const ATHLETE_SCALE = 1;
const ART = { width: 2, height: 2, x: 0, ground: 0, unit: 1, scaleX: 1, scaleY: 1,
  anchorX: 0, anchorY: 0, headHeight: 2.5, feedbackX: 0, shadowStart: -0.5, shadowLength: 1.2, planar: true, draw() {} };
function ribbon(start, end, width, offset = 0, y = 0.01) {
  const vertices = [], indices = [], count = Math.max(1, Math.ceil((end - start) / 0.75));
  for (let i = 0; i <= count; i++) {
    const p = ovalPoint(start + (end - start) * i / count);
    for (const side of [-1, 1]) {
      const z = offset + side * width / 2;
      vertices.push(p.x - Math.sin(p.heading) * z, y, p.z + Math.cos(p.heading) * z);
    }
    if (i < count) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
const environment = {
  create(track) {
    track.iceRoot = new THREE.Group(); track.scene.add(track.iceRoot); track.marks = [];
    track.box(230, 0.1, 140, 55, -0.14, 28, "#78918c");
    const band = (width, offset, color, y) => track.iceRoot.add(new THREE.Mesh(ribbon(0, 400, width, offset, y), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
    band(10, -0.6, "#b9d3d6", 0); band(2.7, 0, "#cddfe0", 0.008);
    band(0.06, -1.4, "#f2f6ed", 0.014); band(0.06, 1.4, "#f2f6ed", 0.014); band(0.06, -4.15, "#f2f6ed", 0.014);
    band(0.26, -5.5, "#d8767c", 0.08); band(0.4, 4.6, "#e6eee4", 0.02);
    const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.12, 8), new THREE.MeshBasicMaterial({ color: "#d77365" }), 100);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 100; i++) { const p = ovalPoint(i * 4); dummy.position.set(p.x - Math.sin(p.heading) * 1.6, 0.065, p.z + Math.cos(p.heading) * 1.6); dummy.updateMatrix(); cones.setMatrixAt(i, dummy.matrix); }
    track.iceRoot.add(cones);
    for (const offset of [-6.4, 5.7]) {
      const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(2.7, 0.55, 0.7), new THREE.MeshStandardMaterial({ color: offset < 0 ? "#3b5958" : "#d0dfd8" }), 100);
      for (let i = 0; i < 100; i++) { const p = ovalPoint(i * 4); dummy.position.set(p.x - Math.sin(p.heading) * offset, 0.275, p.z + Math.cos(p.heading) * offset); dummy.rotation.y = -p.heading; dummy.updateMatrix(); blocks.setMatrixAt(i, dummy.matrix); }
      track.iceRoot.add(blocks);
    }
    return () => {};
  },
  finish(track, parent) {
    for (let row = 0; row < 10; row++) for (let col = 0; col < 2; col++)
      track.plate(col * 0.14, 0.14, 0.55, -4.1 + row * 0.55, (row + col) % 2 ? "#f8faf1" : "#23494c", 1, parent, 0.025);
  }
};
export class SkatingScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: SKATING_COURSE, athlete: ART, environment }); this.runner.visible = false;
    this.shadow.material.opacity = 0.18;
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color(); this.athleteDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), 300);
    this.athleteDots.frustumCulled = false; this.scene.add(this.athleteDots);
    this.zoneMeshes.forEach((mesh, i) => {
      const z = SKATING_COURSE.zones[i];
      for (const [key, start, end, width, y] of [["glow", z.start - 0.08, z.end + 0.08, 1.5, 0.029], ["surface", z.start, z.end, 1.3, 0.034], ["core", z.start, z.end, 0.24, 0.039], ["entry", z.start - 0.04, z.start + 0.04, 1.5, 0.05], ["exit", z.end - 0.04, z.end + 0.04, 1.5, 0.05]]) {
        mesh[key].geometry.dispose(); mesh[key].geometry = ribbon(start, end, width, 0, y); mesh[key].scale.set(1, 1, 1); mesh[key].position.set(0, 0, 0);
      }
      mesh.entryBand.visible = mesh.exitBand.visible = false;
    });
    this.tracePositions = new Float32Array(160 * 6); const traceGeometry = new THREE.BufferGeometry(); traceGeometry.setAttribute("position", new THREE.BufferAttribute(this.tracePositions, 3));
    this.trails = new THREE.LineSegments(traceGeometry, new THREE.LineBasicMaterial({ color: "#608b92", transparent: true, opacity: 0.3 })); this.trails.frustumCulled = false; this.scene.add(this.trails);
    this.traces = []; this.previousFeet = []; this.traceRace = null; this.lastTrace = -1;
  }
  resize(w, h) { super.resize(w, h); this.frameCamera(0); }
  frameCamera(distance, lift = 0) {
    const p = ovalPoint(distance), c = Math.cos(p.heading), s = Math.sin(p.heading), ahead = this.width < 650 ? 1.7 : 3;
    this.camera.position.set(c * 8 - s * 14, 8 + lift, s * 8 + c * 14); this.camera.lookAt(c * ahead, 0.8 + lift, s * ahead);
    const span = 1.65 * Math.max(this.width < 650 ? 7.2 : 13, this.width / this.height * 4.1), half = span / (this.width / this.height) / 2;
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = half; this.camera.bottom = -half; this.camera.updateProjectionMatrix();
  }
  positionCourse(race) {
    const origin = ovalPoint(race.distance), c = Math.cos(origin.heading), s = Math.sin(origin.heading);
    this.iceRoot.position.set(-origin.x, 0, -origin.z);
    this.zoneMeshes.forEach(mesh => mesh.group.position.set(-origin.x, 0, -origin.z));
    const end = ovalPoint(500); this.finish.position.set(end.x - origin.x, 0, end.z - origin.z); this.finish.rotation.y = -end.heading; this.finish.visible = Math.abs(race.distance - 500) < 22;
    this.cursor.rotation.y = -origin.heading;
    this.shadow.position.set(-s * this.pose.hip.z * ATHLETE_SCALE, 0.023, c * this.pose.hip.z * ATHLETE_SCALE); this.shadow.rotation.y = -origin.heading;
  }
  boostPoint(x, y, z) {
    const a = -this.cursor.rotation.y, c = Math.cos(a), s = Math.sin(a);
    return { x: c * x - s * z, y, z: s * x + c * z };
  }
  timingPoint(distance, z, y, race) {
    const p = ovalPoint(distance), origin = ovalPoint(race.distance);
    return { x: p.x - Math.sin(p.heading) * z - origin.x, y, z: p.z + Math.cos(p.heading) * z - origin.z };
  }
  renderGhost(ghost, race) {
    const p = ovalPoint(ghost.distance), c = Math.cos(p.heading), s = Math.sin(p.heading);
    const origin = this.timingPoint(ghost.distance, -0.85, 0, race);
    return ghostDots(this, skaterDots(ghost).map(dot => ({ ...dot,
      x: origin.x + (c * dot.x - s * dot.z) * ATHLETE_SCALE,
      y: dot.y * ATHLETE_SCALE, z: origin.z + (s * dot.x + c * dot.z) * ATHLETE_SCALE,
      radius: dot.radius * ATHLETE_SCALE })));
  }
  render(race) {
    const distance = race.distance + finishTravel(race), origin = ovalPoint(distance), c = Math.cos(origin.heading), s = Math.sin(origin.heading);
    this.frameCamera(distance, race.presentation ? 0.7 * ease(race.presentation.age) : 0); this.pose = getSkaterPose(race);
    const local = p => ({ x: (c * p.x - s * p.z) * ATHLETE_SCALE, y: p.y * ATHLETE_SCALE, z: (s * p.x + c * p.z) * ATHLETE_SCALE });
    const dots = skaterDots(race); this.athleteDots.count = dots.length;
    dots.forEach((p, i) => { const v = local(p); this.dummy.position.set(v.x, v.y, v.z); this.dummy.scale.setScalar(p.radius * ATHLETE_SCALE); this.dummy.updateMatrix(); this.athleteDots.setMatrixAt(i, this.dummy.matrix); this.athleteDots.setColorAt(i, this.color.set(p.color)); });
    this.athleteDots.instanceMatrix.needsUpdate = true; this.athleteDots.instanceColor.needsUpdate = true;
    const head = local(this.pose.head); this.finishFocus = { ...head, y: head.y + 0.22 };
    if (this.traceRace !== race) { this.traces = []; this.previousFeet = []; this.lastTrace = -1; this.traceRace = race; }
    const clock = race.time + (race.presentation?.age ?? 0);
    if (race.phase !== "ready" && clock - this.lastTrace >= 0.035) {
      this.pose.limbs.forEach((l, i) => {
        const foot = local(l.bladeBack), point = { x: foot.x + origin.x, z: foot.z + origin.z };
        const onIce = l.bladeBack.y < 0.03;
        if (onIce && this.previousFeet[i]) this.traces.push([this.previousFeet[i], point]);
        this.previousFeet[i] = onIce ? point : null;
      });
      if (this.traces.length > 160) this.traces.splice(0, this.traces.length - 160); this.lastTrace = clock;
    }
    this.traces.forEach((line, i) => line.forEach((p, j) => { const k = i * 6 + j * 3; this.tracePositions[k] = p.x - origin.x; this.tracePositions[k + 1] = 0.02; this.tracePositions[k + 2] = p.z - origin.z; }));
    this.trails.geometry.attributes.position.needsUpdate = true; this.trails.geometry.setDrawRange(0, this.traces.length * 2);
    super.render(race);
  }
}
