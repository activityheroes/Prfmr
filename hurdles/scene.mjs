import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs";
import { HURDLES_COURSE, HURDLES } from "./course.mjs";
import { getHurdlerPose, hurdlerDots } from "./hurdler.mjs";
import { ease } from "../sprint/finish.mjs";

const ART = { width: 2, height: 2, x: 0, ground: 0, unit: 1, scaleX: 1, scaleY: 1,
  anchorX: 0, anchorY: 0, headHeight: 2.5, feedbackX: 0, shadowStart: -0.6, shadowLength: 1.1, planar: true, draw() {} };
export class HurdlesScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: HURDLES_COURSE, athlete: ART });
    this.runner.visible = false; this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.athleteDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), 280);
    this.athleteDots.frustumCulled = false; this.scene.add(this.athleteDots);
    this.hurdleMeshes = HURDLES.map(h => {
      const group = new THREE.Group(), frame = new THREE.Group(); group.add(frame); this.scene.add(group);
      const box = (w, ht, d, x, y, z, color, parent = frame) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
        mesh.position.set(x, y, z); parent.add(mesh); return mesh;
      };
      for (const z of [-0.55, 0.55]) {
        box(0.07, h.height, 0.07, 0, h.height / 2, z, "#adbcb9");
        box(0.65, 0.06, 0.09, 0.28, 0.03, z, "#465652", group);
      }
      const bars = [];
      for (let i = 0; i < 6; i++) bars.push(box(0.07, 0.1, 0.21, 0, h.height, -0.525 + i * 0.21, i % 2 ? "#f1eee1" : "#e4b94e"));
      return { group, frame, bars };
    });
  }
  resize(width, height) {
    super.resize(width, height);
    this.camera.position.set(12, 8, 17); this.camera.lookAt(width < 650 ? 1.7 : 3, 0.9, 0);
    const span = Math.max(width < 650 ? 10.2 : 17.2, width / height * 4.8), half = span / (width / height) / 2;
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = half; this.camera.bottom = -half; this.camera.updateProjectionMatrix();
  }
  positionCourse(race) {
    this.hurdleMeshes.forEach((mesh, i) => {
      const h = race.hurdles[i], age = h.hitAt === null ? 0 : race.time + (race.presentation?.age ?? 0) - h.hitAt;
      mesh.group.position.x = h.x - race.distance; mesh.group.visible = Math.abs(h.x - race.distance) < 23;
      mesh.frame.rotation.z = -ease(age / 0.45) * Math.PI / 2;
      mesh.bars.forEach((b, j) => b.material.color.set(h.status === "hit" ? "#ed667d" : h.status === "clear" ? "#81f6b6" : j % 2 ? "#f1eee1" : "#e4b94e"));
    });
    this.shadow.scale.z = Math.max(0.35, 0.8 - race.lift * 0.4);
    this.shadow.material.opacity = 0.45 - race.lift * 0.2;
  }
  render(race) {
    const dots = hurdlerDots(race); this.athleteDots.count = dots.length;
    dots.forEach((p, i) => {
      this.dummy.position.set(p.x, p.y, p.z); this.dummy.scale.setScalar(p.radius); this.dummy.updateMatrix();
      this.athleteDots.setMatrixAt(i, this.dummy.matrix); this.athleteDots.setColorAt(i, this.color.set(p.color));
    });
    this.athleteDots.instanceMatrix.needsUpdate = true; this.athleteDots.instanceColor.needsUpdate = true;
    const p = getHurdlerPose(race).head; this.finishFocus = { x: p.x, y: p.y + 0.3, z: p.z };
    super.render(race);
  }
}
