import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs?v=sports-1";
import { createPoolWall } from "./pool.mjs?v=sports-1";
import { SWIMMING_COURSE } from "./engine.mjs?v=sports-1";
import { SWIMMER_ART } from "./swimmer.mjs?v=sports-1";

export class SwimmingScene extends TrackScene {
  constructor(canvas) {
    super(canvas, { course: SWIMMING_COURSE, athlete: SWIMMER_ART });
    this.turnWall = new THREE.Group(); createPoolWall(this, this.turnWall); this.scene.add(this.turnWall);
    this.poolRoot = new THREE.Group();
    for (const child of [...this.scene.children]) if (!child.isLight) this.poolRoot.add(child);
    this.scene.add(this.poolRoot); this.runner.material.side = THREE.DoubleSide;
  }
  positionCourse(race) {
    this.poolRoot.scale.x = race.turned ? -1 : 1;
    this.turnWall.visible = race.distance > 13 && race.distance < 38;
    this.turnWall.position.x = 25 - race.distance;
    this.turnWall.scale.x = race.turned ? -1 : 1;
    this.zoneMeshes.forEach((mesh, i) => { mesh.group.visible &&= race.turned ? i === 1 : i === 0; });
  }
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
