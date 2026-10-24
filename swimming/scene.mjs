import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs?v=starts-1";
import { createPoolWall } from "./pool.mjs?v=starts-1";
import { SWIMMING_COURSE } from "./engine.mjs?v=starts-1";
import { SWIMMER_ART } from "./swimmer.mjs?v=starts-1";

export class SwimmingScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: SWIMMING_COURSE, athlete: SWIMMER_ART });
    this.turnWall = new THREE.Group(); createPoolWall(this, this.turnWall); this.scene.add(this.turnWall);
    this.startWall = new THREE.Group(); createPoolWall(this, this.startWall); this.startWall.scale.x = -1; this.scene.add(this.startWall);
    for (let lane = -2; lane <= 2; lane++) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.48, 0.55), new THREE.MeshStandardMaterial({ color: "#d3e8e3" }));
      support.position.set(-1.35, 0.51, lane * 1.4); this.startWall.add(support); support.position.x *= -1;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.85), new THREE.MeshStandardMaterial({ color: lane === 0 ? "#65c9ff" : "#f4f5e8" }));
      top.position.set(1.35, 0.8, lane * 1.4); this.startWall.add(top);
    }
    this.poolRoot = new THREE.Group();
    for (const child of [...this.scene.children]) if (!child.isLight) this.poolRoot.add(child);
    this.scene.add(this.poolRoot); this.runner.material.side = THREE.DoubleSide;
  }
  positionCourse(race) {
    this.poolRoot.scale.x = race.turned ? -1 : 1;
    this.turnWall.visible = race.distance > 13 && race.distance < 38;
    this.turnWall.position.x = 25 - race.distance;
    this.turnWall.scale.x = race.turned ? -1 : 1;
    this.startWall.visible = !race.turned && race.distance < 12;
    this.startWall.position.x = -race.distance;
    this.zoneMeshes.forEach((mesh, i) => { mesh.group.visible &&= this.isZoneVisible(race.zones[i], race); });
  }
  isZoneVisible(zone, race) { return zone.status !== "done" && (race.turned ? zone.start >= 25 : zone.end <= 25); }
  positionGhost(athlete, ghost, race) {
    if (athlete.parent !== this.poolRoot) this.poolRoot.add(athlete);
    const physical = r => r.turned ? 50 - r.distance : r.distance;
    athlete.position.x = (physical(ghost) - physical(race)) * (race.turned ? -1 : 1);
    athlete.scale.x = SWIMMER_ART.scaleX * (race.turned === ghost.turned ? 1 : -1);
    athlete.material.side = THREE.DoubleSide;
  }
  timingPoint(distance, z, y, race) {
    const physical = distance > 25 ? 50 - distance : distance;
    const current = race.turned ? 50 - race.distance : race.distance;
    return { x: (physical - current) * (race.turned ? -1 : 1), y, z };
  }
}
