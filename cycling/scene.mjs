import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs?v=boost-1";
import { finishTravel } from "../sprint/finish.mjs?v=boost-1";
import { CYCLING_COURSE } from "./engine.mjs?v=boost-1";
import { CYCLIST_ART, METERS_PER_UNIT, BIKE, getBikeMotion, getBikePose } from "./cyclist.mjs?v=boost-1";
import { VELODROME, trackPoint, bikeFrame } from "./velodrome.mjs?v=boost-1";
import { DotBike } from "./dot-bike.mjs?v=boost-1";

function ribbon(start, end, width, offset = 0, lift = 0.01) {
  const positions = [], uv = [], indices = [], count = Math.max(1, Math.ceil((end - start) / 0.5));
  const across = Math.max(1, Math.ceil(width / 0.3)), stride = across + 1;
  for (let i = 0; i <= count; i++) {
    const s = start + (end - start) * i / count;
    for (let j = 0; j <= across; j++) {
      const z = offset - width / 2 + j / across * width, p = trackPoint(s, z, lift);
      positions.push(p.x, p.y, p.z); uv.push(s / 4, z / 2);
      if (i < count && j < across) { const a = i * stride + j; indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
function woodTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d"), colors = ["#c9ae8f", "#c2a589", "#d1b699", "#c8a88b"];
  for (let row = 0; row < 16; row++) {
    ctx.fillStyle = colors[row % colors.length]; ctx.fillRect(0, row * 16, 512, 16);
    ctx.fillStyle = "#6e52491c"; ctx.fillRect(0, row * 16, 512, 1);
    ctx.fillRect(row % 2 ? 140 : 380, row * 16, 1, 16);
    ctx.fillStyle = "#fff4da14"; ctx.fillRect(0, row * 16 + 8, 512, 1);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; return texture;
}
const environment = {
  create(track) {
    track.trackRoot = new THREE.Group(); track.scene.add(track.trackRoot); track.marks = [];
    track.scene.background = new THREE.Color("#223d43");
    const band = (start, end, width, offset, color, lift = 0.01) => {
      const mesh = new THREE.Mesh(ribbon(start, end, width, offset, lift), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      track.trackRoot.add(mesh); return mesh;
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 400), new THREE.MeshBasicMaterial({ color: "#2e5358" }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(VELODROME.straight / 2, -0.08, VELODROME.radius); track.trackRoot.add(floor);
    band(0, 250, 1.3, -1.05, "#68bfda");
    const boards = band(0, 250, 6.9, 3.05, "#ffffff"); boards.material.map = woodTexture();
    band(0, 250, 0.06, -1.75, "#e3f0e8", 0.025);
    for (const [offset, color] of [[-0.2, "#262f31"], [0.5, "#d3445c"], [2.6, "#287db4"], [6.48, "#eff2e9"]]) band(0, 250, 0.055, offset, color, 0.035);
    band(-0.075, 0.075, 6.9, 3.05, "#f3f5ee", 0.045);
    band(99.925, 100.075, 6.9, 3.05, "#f3f5ee", 0.045);
    for (const s of [77.5, 202.5]) band(s - 0.08, s + 0.08, 3.4, 1.3, "#d3445c", 0.045);
    const positions = [], indices = [], step = 0.5;
    for (let i = 0; i <= 500; i++) {
      const p = trackPoint(i * step, 6.65);
      positions.push(p.x, p.y, p.z, p.x, p.y + 0.7, p.z);
      if (i < 500) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const rail = new THREE.BufferGeometry(); rail.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); rail.setIndex(indices);
    track.trackRoot.add(new THREE.Mesh(rail, new THREE.MeshBasicMaterial({ color: "#dce5df", side: THREE.DoubleSide })));
    band(0, 250, 0.12, 6.65, "#25444c", 0.72);
    const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.35, 0.75), new THREE.MeshBasicMaterial(), 240);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    for (let i = 0; i < 240; i++) {
      const row = i % 3, s = Math.floor(i / 3) * 250 / 80, p = trackPoint(s, 8.5 + row * 1.15), rim = trackPoint(s, 6.65);
      dummy.position.set(p.x, rim.y + 0.45 + row * 0.55, p.z); dummy.rotation.y = -p.heading; dummy.updateMatrix();
      seats.setMatrixAt(i, dummy.matrix); seats.setColorAt(i, color.set(Math.floor(i / 18) % 2 ? "#61939d" : "#cd7281"));
    }
    track.trackRoot.add(seats); return () => {};
  },
  finish(track, group) {
    for (const [a, b, color] of [[199.64, 200.36, "#f7f8f1"], [199.98, 200.02, "#172b31"]])
      group.add(new THREE.Mesh(ribbon(a, b, 6.9, 3.05, 0.06), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
  }
};

export class CyclingScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: CYCLING_COURSE, athlete: CYCLIST_ART, environment });
    this.basis = new THREE.Matrix4(); this.shadow.material.opacity = 0.15; this.runner.visible = false;
    this.cyclist = new DotBike(); this.scene.add(this.cyclist);
    this.origin = new THREE.Vector3(VELODROME.straight / 2, 0, VELODROME.radius);
    this.riderScale = 1.8; this.viewMode = "ride";
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.zoneMeshes.forEach((mesh, i) => {
      const z = CYCLING_COURSE.zones[i];
      for (const [key, a, b, width, lift] of [["glow", z.start - 0.08, z.end + 0.08, 1.35, 0.045], ["surface", z.start, z.end, 1.2, 0.055], ["core", z.start, z.end, 0.18, 0.065], ["entry", z.start - 0.035, z.start + 0.035, 1.35, 0.075], ["exit", z.end - 0.035, z.end + 0.035, 1.35, 0.075]]) {
        mesh[key].geometry.dispose(); mesh[key].geometry = ribbon(a, b, width, 0, lift); mesh[key].position.set(0, 0, 0); mesh[key].scale.set(1, 1, 1);
      }
      mesh.entryBand.visible = mesh.exitBand.visible = false;
    });
  }
  resize(w, h) { super.resize(w, h); this.setView(this.viewMode); }
  setView(mode) {
    this.viewMode = mode === "track" ? "track" : "ride";
    this.riderScale = this.viewMode === "ride" ? 1.8 : this.width < 650 ? 3.4 : 2.4;
    this.boostScale = this.riderScale;
    this.bike = bikeFrame(this.lastDistance ?? 0, this.riderScale); this.frameCamera();
  }
  frameCamera() {
    const aspect = this.width / this.height, overview = this.viewMode === "track";
    if (overview) { this.camera.position.set(0, 120, 150); this.camera.lookAt(0, 0, 0); }
    else {
      const f = this.bike, ahead = this.width < 650 ? 2 : 4;
      const focus = f.origin.clone().sub(this.origin).addScaledVector(f.forward, ahead); focus.y += 1.1;
      const side = new THREE.Vector3(-f.forward.z, 0, f.forward.x).normalize();
      this.camera.position.copy(focus).addScaledVector(side, 28).addScaledVector(f.forward, 4); this.camera.position.y += 7;
      this.camera.lookAt(focus);
    }
    this.camera.far = 350;
    const span = overview ? Math.max(126, aspect * 60) : Math.max(this.width < 650 ? 21 : 32, aspect * 11.5);
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = span / aspect / 2; this.camera.bottom = -this.camera.top; this.camera.updateProjectionMatrix();
  }
  boostPoint(x, y, z) { return this.bikePoint(x - 2, y + 0.2, z); }
  bikePoint(x, y, z = 0) {
    const f = this.bike;
    return f.origin.clone().addScaledVector(f.forward, x * f.stretch * this.riderScale).addScaledVector(f.up, y * this.riderScale).addScaledVector(f.side, z * this.riderScale).sub(this.origin);
  }
  positionCourse(race) {
    for (const group of [this.trackRoot, this.finish, ...this.zoneMeshes.map(mesh => mesh.group)]) group.position.copy(this.origin).multiplyScalar(-1);
    this.finish.visible = true;
    this.zoneMeshes.forEach(mesh => { mesh.group.visible = true; });
    this.basis.makeBasis(this.bike.forward, this.bike.up, this.bike.side);
    this.runner.quaternion.setFromRotationMatrix(this.basis); this.runner.position.copy(this.bikePoint(0, 0));
    this.runner.scale.set(CYCLIST_ART.scaleX * this.bike.stretch * this.riderScale, CYCLIST_ART.scaleY * this.riderScale, 1);
    const riderRace = Object.create(race); riderRace.distance = race.distance / this.riderScale; riderRace.cadenceMultiplier = 1.45;
    this.cyclist.update(riderRace); this.cyclist.quaternion.copy(this.runner.quaternion); this.cyclist.position.copy(this.runner.position);
    this.cyclist.scale.set(this.bike.stretch * this.riderScale, this.riderScale, this.riderScale);
    this.cursor.quaternion.copy(this.runner.quaternion); this.cursor.position.copy(this.bikePoint(0, 0.045));
    this.shadow.quaternion.copy(this.runner.quaternion); this.shadow.position.copy(this.bikePoint(-1.5, -0.015));
    if (this.sparks.visible && !race.presentation) {
      for (let i = 0; i < 24; i++) {
        const j = i * 3, p = this.bikePoint(this.sparkPositions[j], this.sparkPositions[j + 1], this.sparkPositions[j + 2]);
        this.sparkPositions[j] = p.x; this.sparkPositions[j + 1] = p.y; this.sparkPositions[j + 2] = p.z;
      }
      this.sparks.geometry.attributes.position.needsUpdate = true;
    }
  }
  render(race) {
    const distance = race.distance + finishTravel(race);
    this.lastDistance = distance;
    this.bike = bikeFrame(distance, this.riderScale);
    this.frameCamera();
    const pose = getBikePose(getBikeMotion(distance).cycle), nose = BIKE.front.x + BIKE.wheelRadius;
    this.finishFocus = this.bikePoint((pose.head.x - nose) * METERS_PER_UNIT, race.presentation ? 3.1 : -pose.head.y * METERS_PER_UNIT + 0.25);
    super.render(race);
  }
}
