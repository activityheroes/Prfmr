import * as THREE from "../sprint/vendor/three.module.min.js";
import { BIKE, METERS_PER_UNIT, getBikeMotion, getCyclistPose } from "./cyclist.mjs?v=weather-1";

// The same pedal/limb poses as the motion lab, with depth for the oval's changing viewing angles.
export class DotBike extends THREE.InstancedMesh {
  constructor() {
    super(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial(), 1000);
    this.dummy = new THREE.Object3D(); this.colors = new Map(); this.frustumCulled = false;
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  update(race) {
    const pose = getCyclistPose(race), { wheelAngle } = getBikeMotion(race.distance);
    const nose = BIKE.front.x + BIKE.wheelRadius, m = METERS_PER_UNIT;
    let count = 0;
    const dot = (x, y, z, color, radius = 0.28) => {
      this.dummy.position.set((x - nose) * m, -y * m, z * m);
      this.dummy.scale.setScalar(radius * m); this.dummy.updateMatrix();
      if (!this.colors.has(color)) this.colors.set(color, new THREE.Color(color));
      this.setMatrixAt(count, this.dummy.matrix); this.setColorAt(count++, this.colors.get(color));
    };
    const bone = (a, b, color, z = 0, radius = 0.28) => {
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? z) - (a.z ?? z)) / 0.6));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        dot(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, (a.z ?? z) + ((b.z ?? z) - (a.z ?? z)) * t, color, radius);
      }
    };
    for (const center of [BIKE.rear, BIKE.front]) {
      for (let i = 0; i < 46; i++) {
        const a = i / 46 * Math.PI * 2;
        dot(center.x + Math.cos(a) * BIKE.wheelRadius, center.y + Math.sin(a) * BIKE.wheelRadius, 0, i % 3 ? "#164e64" : "#65d8ff", 0.3);
      }
      for (let i = 0; i < 6; i++) {
        const a = wheelAngle + i * Math.PI / 3;
        bone(center, { x: center.x + Math.cos(a) * 3.3, y: center.y + Math.sin(a) * 3.3 }, "#356573", 0, 0.14);
      }
      dot(center.x, center.y, 0, "#e8ffe5", 0.4);
    }
    for (const [a, b] of [[BIKE.rear, BIKE.seatTube], [BIKE.rear, BIKE.crank], [BIKE.seatTube, BIKE.crank],
      [BIKE.seatTube, BIKE.headTube], [BIKE.crank, BIKE.fork], [BIKE.headTube, BIKE.front], [BIKE.seatTube, BIKE.saddle]]) bone(a, b, "#65d8ff");
    bone({ x: -3.85, y: -10.5 }, { x: -1.65, y: -10.5 }, "#e8ffe5", 0, 0.36);
    bone(BIKE.headTube, { x: BIKE.grip.x, y: BIKE.grip.y }, "#65d8ff");
    bone({ ...BIKE.grip, z: -1.3 }, { ...BIKE.grip, z: 1.3 }, "#e8ffe5");
    for (const sign of [-1, 1]) {
      bone({ x: BIKE.rear.x, y: BIKE.rear.y + sign * 0.4 }, { x: BIKE.crank.x, y: BIKE.crank.y + sign * 0.82 }, "#ad8141", 0.2, 0.14);
      const hand = { ...BIKE.grip, z: sign * 1.3 };
      bone(hand, { x: hand.x + 0.45, y: hand.y + 1.3, z: hand.z }, "#e8ffe5");
    }
    for (const [i, limb] of pose.limbs.entries()) {
      const z = i ? -1.1 : 1.1, suit = i ? "#328879" : "#79ff78";
      bone(pose.hip, limb.knee, suit, z, 0.34); bone(limb.knee, limb.foot.ankle, suit, z, 0.3);
      bone(BIKE.crank, limb.pedal, "#ffcf5a", z, 0.18); bone(limb.foot.heel, limb.foot.toe, "#ffcf5a", z, 0.34);
      bone(pose.shoulder, limb.elbow, suit, z, 0.32); bone(limb.elbow, limb.hand, "#bcffc9", z, 0.3);
    }
    for (let row = 0; row <= 10; row++) {
      const t = row / 10, x = pose.hip.x * (1 - t) + pose.shoulder.x * t, y = pose.hip.y * (1 - t) + pose.shoulder.y * t;
      for (let col = -2; col <= 2; col++) dot(x, y, col * 0.55, col === -2 ? "#328879" : "#79ff78", 0.34);
    }
    bone(pose.shoulder, pose.head, "#bcffc9", 0, 0.4);
    for (let row = -2; row <= 2; row++) for (let col = 0; col < 10; col++) {
      const a = col / 10 * Math.PI * 2, radius = Math.sqrt(1 - (row / 3) ** 2);
      dot(pose.head.x + Math.cos(a) * radius, pose.head.y + row * 0.5, Math.sin(a) * radius, row < 0 ? "#65d8ff" : "#e8ffe5", 0.32);
    }
    bone({ x: pose.head.x + 1, y: pose.head.y - 0.2, z: -0.6 }, { x: pose.head.x + 1, y: pose.head.y - 0.2, z: 0.6 }, "#173b40", 0, 0.3);
    this.count = count; this.instanceMatrix.needsUpdate = true; this.instanceColor.needsUpdate = true;
  }
}
