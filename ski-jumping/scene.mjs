import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs?v=meets-1";
import { ease } from "../sprint/finish.mjs?v=meets-1";
import { SKI_COURSE, TAKEOFF_ZONE, HILL, inrunPoint, landingPoint, distancePoint } from "./course.mjs?v=meets-1";
import { getSkierPose, skierDots } from "./skier.mjs?v=meets-1";

const ART = { width: 2, height: 2, x: 0, ground: 0, unit: 1, scaleX: 1, scaleY: 1,
  anchorX: 0, anchorY: 0, headHeight: 3, feedbackX: 0, shadowStart: -0.6, shadowLength: 1.8, planar: true, draw() {} };
function ribbon(start, end, width, offset = 0, lift = 0.02, ramp = true) {
  const vertices = [], indices = [], count = Math.max(1, Math.ceil((end - start) / 0.5));
  for (let i = 0; i <= count; i++) {
    const s = start + (end - start) * i / count, p = ramp ? inrunPoint(s) : { x: s, ...landingPoint(s) };
    for (const side of [-1, 1]) vertices.push(p.x, p.y + lift, offset + side * width / 2);
    if (i < count) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function label(text, color) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = color; ctx.font = "bold 36px monospace"; ctx.textAlign = "center"; ctx.fillText(text, 128, 44);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false })); sprite.scale.set(4, 1, 1); return sprite;
}
const environment = {
  create(track) {
    track.courseRoot = new THREE.Group(); track.scene.add(track.courseRoot); track.marks = []; track.distanceLabels = [];
    track.scene.background = new THREE.Color("#203b40");
    const band = (start, end, width, offset, color, lift = 0.02, ramp = true) => {
      const mesh = new THREE.Mesh(ribbon(start, end, width, offset, lift, ramp), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      track.courseRoot.add(mesh); return mesh;
    };
    band(0, 140, 36, 0, "#91b9b6", -2.5);
    band(0, 140, HILL.runwayWidth + 0.5, 0, "#45666a", -0.16);
    band(0, 140, HILL.runwayWidth, 0, "#dcebe7");
    for (const side of [-1, 1]) {
      band(0, 140, 0.08, side * 0.3, "#779fa7", 0.035);
      band(0, 140, 0.16, side * 2, "#ce7e88", 0.24);
    }
    band(0, 260, 70, 0, "#a9c9c4", -0.08, false);
    band(0, 260, 20, 0, "#dcebe7", 0.02, false);
    for (const side of [-1, 1]) band(0, 260, 0.12, side * 9, "#629da7", 0.045, false);
    for (let m = 10; m <= 220; m += 10) {
      const p = distancePoint(m);
      band(p.x - 0.055, p.x + 0.055, 18, 0, m === HILL.kPoint ? "#ce667b" : "#91b6b4", 0.045, false);
      if (m % 30 === 0) { const text = label(m === HILL.kPoint ? "K 90" : m + " M", m === HILL.kPoint ? "#ad3f5c" : "#355f62"); text.position.set(p.x, p.y + 0.4, -7); track.courseRoot.add(text); track.distanceLabels.push(text); }
    }
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4.5, 6), new THREE.MeshBasicMaterial({ color: "#355e55" }), 80);
    const snow = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 2.4, 6), new THREE.MeshBasicMaterial({ color: "#d5e4da" }), 80), dummy = new THREE.Object3D();
    for (let i = 0; i < 80; i++) {
      const p = i < 30 ? inrunPoint(i * 4.5) : { x: (i - 30) * 5, ...landingPoint((i - 30) * 5) };
      const side = i % 3 ? -1 : 1, z = side * (13 + i % 4 * 3);
      dummy.scale.setScalar(0.75 + i % 5 * 0.09); dummy.position.set(p.x, p.y + 1.7, z); dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix);
      dummy.position.y += 1.15; dummy.updateMatrix(); snow.setMatrixAt(i, dummy.matrix);
    }
    track.courseRoot.add(trees, snow);
    track.takeoffStrip = new THREE.Group(); track.scene.add(track.takeoffStrip);
    for (const [a, b, color] of [[TAKEOFF_ZONE.start, TAKEOFF_ZONE.end, "#d4aa4a"], [TAKEOFF_ZONE.start, TAKEOFF_ZONE.start + 0.1, "#fff1bc"], [TAKEOFF_ZONE.end, TAKEOFF_ZONE.end + 0.1, "#fff1bc"]])
      track.takeoffStrip.add(new THREE.Mesh(ribbon(a, b, 1.4, 0, 0.07), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
    track.landingMark = new THREE.Group(); track.scene.add(track.landingMark);
    track.plate(-0.06, 0.12, 7, 0, "#d46e83", 1, track.landingMark, 0.09);
    track.landingLabel = label("", "#173b3f"); track.landingLabel.position.set(0, 0.3, 2); track.landingMark.add(track.landingLabel);
    track.landingLabel.material.depthTest = false; track.landingLabel.renderOrder = 2;
    return () => {};
  },
  finish(track, group) {
    track.plate(-0.08, 0.16, 4.1, 0, "#e66c84", 1, group, 0.08);
    for (const z of [-2.2, 2.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), new THREE.MeshBasicMaterial({ color: "#24474b" })); post.position.set(0, 0.9, z); group.add(post);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.02), new THREE.MeshBasicMaterial({ color: "#ff8d9b" })); flag.position.set(0.35, 1.6, z); group.add(flag);
    }
  }
};
export class SkiJumpScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: SKI_COURSE, athlete: ART, environment }); this.runner.visible = false;
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.athleteDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), 340);
    this.athleteDots.frustumCulled = false; this.scene.add(this.athleteDots);
    this.zoneMeshes.forEach((mesh, i) => {
      const zone = SKI_COURSE.zones[i];
      for (const [key, a, b, width, lift] of [["glow", zone.start, zone.end, 1.65, 0.05], ["surface", zone.start, zone.end, 1.45, 0.06], ["core", zone.start, zone.end, 0.24, 0.07], ["entry", zone.start, zone.start + 0.1, 1.65, 0.08], ["exit", zone.end, zone.end + 0.1, 1.65, 0.08]]) {
        mesh[key].geometry.dispose(); mesh[key].geometry = ribbon(a, b, width, 0, lift); mesh[key].position.set(0, 0, 0); mesh[key].scale.set(1, 1, 1);
      }
      mesh.entryBand.visible = mesh.exitBand.visible = false;
    });
    this.shadow.material.opacity = 0.13;
  }
  resize(w, h) { super.resize(w, h); this.frameCamera(null); }
  timingPoint(distance, z, y) { const p = inrunPoint(distance); return { x: p.x - this.origin.x, y: p.y - this.origin.y + y, z }; }
  frameCamera(race) {
    const flying = !!race?.launch, clearance = flying ? Math.max(0, race.athlete.y - landingPoint(race.athlete.x).y) : 0;
    const airborne = flying && !race.landing;
    const travel = race?.landing ? Math.max(0, race.athlete.x - race.landing.x) : 0;
    const targetY = airborne ? -Math.max(0, clearance - 3) * 0.32 : 0.7 + ease((race?.presentation?.age ?? 0) / 0.5) * 0.7;
    const aspect = this.width / this.height, mobile = this.width < 650;
    // Widen the landing view to retain both the touchdown mark and the runout.
    const span = 1.65 * Math.max(mobile ? 12 : 23, travel + 7, aspect * (7.8 + (airborne ? clearance * 0.45 : 0)));
    const ahead = race?.landing ? -travel * 0.25 : mobile ? 1 : 3;
    this.camera.position.set(ahead + 7, targetY + 7, 22); this.camera.lookAt(ahead, targetY, 0);
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = span / aspect / 2; this.camera.bottom = -this.camera.top; this.camera.updateProjectionMatrix();
  }
  positionCourse(race) {
    const p = this.origin, angle = race.launch ? landingPoint(p.x).angle : inrunPoint(race.distance).angle;
    for (const group of [this.courseRoot, this.takeoffStrip, ...this.zoneMeshes.map(z => z.group)]) group.position.set(-p.x, -p.y, 0);
    this.takeoffStrip.visible = !race.launch;
    this.finish.position.set(-p.x, -p.y, 0); this.finish.visible = p.x > -25 && p.x < 25;
    this.cursor.visible = !race.launch; this.cursor.rotation.z = angle;
    this.shadow.visible = !race.launch || !!race.landing; this.shadow.rotation.z = angle; this.shadow.position.set(0, 0.04, 0);
    this.landingMark.visible = !!race.landing;
    this.distanceLabels.forEach(label => { label.visible = !race.landing; });
    if (race.landing) {
      this.landingMark.position.set(race.landing.x - p.x, race.landing.y - p.y, 0); this.landingMark.rotation.z = landingPoint(race.landing.x).angle;
      if (this.mark !== race.landing.mark) {
        const canvas = this.landingLabel.material.map.image, ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = "#173b3f"; ctx.fillText(race.landing.mark.toFixed(1) + " M", 128, 44); this.landingLabel.material.map.needsUpdate = true; this.mark = race.landing.mark;
      }
    }
  }
  bestPoint(mark) {
    const p = distancePoint(mark);
    return { x: p.x - this.origin.x, y: p.y - this.origin.y + 0.09, width: 4.2 };
  }
  render(race) {
    this.origin = race.launch ? race.athlete : inrunPoint(race.distance); this.frameCamera(race);
    const pose = getSkierPose(race), dots = skierDots(race); this.pose = pose; this.athleteDots.count = dots.length;
    dots.forEach((p, i) => {
      this.dummy.position.set(p.x - this.origin.x, p.y - this.origin.y, p.z); this.dummy.scale.setScalar(p.radius); this.dummy.updateMatrix();
      this.athleteDots.setMatrixAt(i, this.dummy.matrix); this.athleteDots.setColorAt(i, this.color.set(p.color));
    });
    this.athleteDots.instanceMatrix.needsUpdate = true; this.athleteDots.instanceColor.needsUpdate = true;
    this.finishFocus = { x: pose.head.x - this.origin.x, y: pose.head.y - this.origin.y + 0.2, z: pose.head.z };
    super.render(race);
    const projected = dots.map(dot => this.project(dot.x - this.origin.x, dot.y - this.origin.y, dot.z));
    this.callout = { x: (Math.min(...projected.map(p => p.x)) + Math.max(...projected.map(p => p.x))) / 2,
      y: Math.min(...projected.map(p => p.y)) - 38 };
  }
}
