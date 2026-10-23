import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs?v=zones-2";
import { finishTravel } from "../sprint/finish.mjs?v=zones-2";
import { BIATHLON_COURSE, RANGE, trailHeight } from "./course.mjs?v=zones-2";
import { getSkierPose, skierDots, SKIER_SCALE as SCALE } from "./skier.mjs?v=zones-2";

const ART = { width: 2, height: 2, x: 0, ground: 0, unit: 1, scaleX: 1, scaleY: 1,
  anchorX: 0, anchorY: 0, headHeight: 2.7, feedbackX: 0, shadowStart: -0.6, shadowLength: 1.3, planar: true, draw() {} };
function ribbon(start, end, width, offset = 0, lift = 0.02) {
  const vertices = [], indices = [], n = Math.max(1, Math.ceil((end - start) / 0.7));
  for (let i = 0; i <= n; i++) {
    const s = start + (end - start) * i / n;
    vertices.push(s, trailHeight(s) + lift, offset - width / 2, s, trailHeight(s) + lift, offset + width / 2);
    if (i < n) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
const environment = {
  create(track) {
    track.trailRoot = new THREE.Group(); track.scene.add(track.trailRoot); track.marks = [];
    track.scene.background = new THREE.Color("#b8d2d7");
    const band = (width, offset, color, lift = 0.01) => {
      const m = new THREE.Mesh(ribbon(-100, 500, width, offset, lift), new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }));
      track.trailRoot.add(m); return m;
    };
    band(140, 0, "#d7e4de", -0.03); band(4, 0, "#f1f5ec");
    for (const z of [-1.9, 1.9]) band(0.08, z, "#9cbbb6", 0.035);
    for (const z of [-0.36, 0.36]) band(0.025, z, "#c4d7d0", 0.04);
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 1 }), 360);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    for (let i = 0; i < 120; i++) {
      const x = -70 + i * 4.6, z = (i % 4 === 0 ? 1 : -1) * (14 + ((i * 17) % 19)), height = 3.2 + i % 5 * 0.55;
      for (let row = 0; row < 3; row++) {
        dummy.position.set(x, trailHeight(x) + height * (0.34 + row * 0.25), z);
        dummy.scale.set(1.4 - row * 0.31, height * 0.5, 1.4 - row * 0.31); dummy.updateMatrix();
        trees.setMatrixAt(i * 3 + row, dummy.matrix); trees.setColorAt(i * 3 + row, color.set(row === 2 ? "#dce9df" : i % 3 ? "#38655a" : "#234b45"));
      }
    }
    track.trailRoot.add(trees);
    const stakes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), new THREE.MeshBasicMaterial({ color: "#ed7b82" }), 70);
    for (let i = 0; i < 70; i++) { const x = i * 6; dummy.position.set(x, trailHeight(x) + 0.275, i % 2 ? -2.3 : 2.3); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); stakes.setMatrixAt(i, dummy.matrix); }
    track.trailRoot.add(stakes);
    const range = new THREE.Group(); range.position.set(RANGE.distance + 9, 0, -4.5); range.rotation.y = Math.PI * 0.35; track.trailRoot.add(range);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 5.5), new THREE.MeshBasicMaterial({ color: "#f5f7ef" }));
    board.position.y = 1.6; range.add(board);
    for (const z of [-2, 2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), new THREE.MeshBasicMaterial({ color: "#31595d" }));
      leg.position.set(0, 0.55, z); range.add(leg);
    }
    track.targets = Array.from({ length: 5 }, (_, i) => {
      const target = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ color: "#163e43", side: THREE.DoubleSide }));
      target.rotation.y = -Math.PI / 2; target.position.set(-0.15, 1.6, -2 + i); range.add(target); return target;
    });
    const mat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 2.1), new THREE.MeshBasicMaterial({ color: "#547e77" }));
    mat.position.set(RANGE.distance, 0.05, 0); track.trailRoot.add(mat);
    return () => {};
  },
  finish(track, parent) {
    for (let row = 0; row < 8; row++) for (let col = 0; col < 2; col++)
      track.plate(col * 0.2, 0.2, 0.5, -1.75 + row * 0.5, (row + col) % 2 ? "#244b48" : "#ffffff", 1, parent, 0.05);
    for (const z of [-2.2, 2.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), new THREE.MeshBasicMaterial({ color: "#ee7d85" }));
      post.position.set(0, 1.6, z); parent.add(post);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 4.5), new THREE.MeshBasicMaterial({ color: "#244b48" }));
    banner.position.y = 3.1; parent.add(banner);
  }
};
export class BiathlonScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: BIATHLON_COURSE, athlete: ART, environment }); this.runner.visible = false; this.shadow.visible = false;
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.athleteDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), 700);
    this.athleteDots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.athleteDots.frustumCulled = false; this.scene.add(this.athleteDots);
    this.zoneMeshes.forEach((mesh, i) => {
      const zone = BIATHLON_COURSE.zones[i];
      for (const [key, a, b, w, y] of [["glow", zone.start - 0.1, zone.end + 0.1, 2.7, 0.05], ["surface", zone.start, zone.end, 2.5, 0.06],
        ["core", zone.start, zone.end, 0.25, 0.07], ["entry", zone.start - 0.05, zone.start + 0.05, 2.7, 0.08], ["exit", zone.end - 0.05, zone.end + 0.05, 2.7, 0.08]]) {
        mesh[key].geometry.dispose(); mesh[key].geometry = ribbon(a, b, w, 0, y); mesh[key].position.set(0, 0, 0); mesh[key].scale.set(1, 1, 1);
      }
      mesh.entryBand.visible = mesh.exitBand.visible = false;
    });
  }
  resize(w, h) {
    super.resize(w, h); this.camera.position.set(8, 14, 26); this.camera.lookAt(w < 650 ? 4 : 7, 1.8, 0);
    const span = Math.max(w < 650 ? 32 : 52, w / h * 17), half = span / (w / h) / 2;
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = half; this.camera.bottom = -half;
    this.camera.far = 180; this.camera.updateProjectionMatrix();
  }
  timingPoint(distance, z, y, race) { return { x: distance - race.distance, y: trailHeight(distance) - trailHeight(race.distance) + y, z }; }
  positionCourse(race) {
    const height = trailHeight(race.distance);
    this.trailRoot.position.set(-race.distance, -height, 0);
    this.zoneMeshes.forEach((mesh, i) => { mesh.group.position.copy(this.trailRoot.position); mesh.group.visible = Math.abs(BIATHLON_COURSE.zones[i].start - race.distance) < 65; });
    this.finish.position.set(400 - race.distance, trailHeight(400) - height, 0); this.finish.visible = race.distance > 360;
    this.cursor.visible = race.phase !== "shooting"; this.cursor.position.set(0, 0.095, 0);
    this.targets.forEach((target, i) => target.material.color.set(race.shots[i] ? race.shots[i].hit ? "#b7fa76" : "#ee7d85" : "#163e43"));
  }
  render(race) {
    const distance = race.distance + finishTravel(race), height = trailHeight(distance);
    const local = p => ({ x: p.x * SCALE, y: trailHeight(distance + p.x * SCALE) - height + p.y * SCALE, z: p.z * SCALE });
    const dots = skierDots(race); this.athleteDots.count = dots.length;
    dots.forEach((p, i) => { const v = local(p); this.dummy.position.set(v.x, v.y, v.z); this.dummy.scale.setScalar(p.radius * SCALE); this.dummy.updateMatrix(); this.athleteDots.setMatrixAt(i, this.dummy.matrix); this.athleteDots.setColorAt(i, this.color.set(p.color)); });
    this.athleteDots.instanceMatrix.needsUpdate = true; this.athleteDots.instanceColor.needsUpdate = true;
    this.finishFocus = local(getSkierPose(race).head); this.finishFocus.y += 0.3;
    super.render(race);
  }
}
