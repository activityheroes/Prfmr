import * as THREE from "./vendor/three.module.min.js";

export const GHOST_COLOR = "#e2abff";
export function ghostMaterial(map = null, sprite = false) {
  const options = { color: GHOST_COLOR, transparent: true, opacity: 0.48, depthWrite: false, ...(map ? { map } : {}) };
  return sprite ? new THREE.SpriteMaterial(options) : new THREE.MeshBasicMaterial(options);
}
export function ghostDots(track, dots) {
  if (!track.ghostDots) {
    track.ghostDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), ghostMaterial(), 1000);
    track.ghostDots.frustumCulled = false; track.ghostDots.renderOrder = 4;
    track.ghostDummy = new THREE.Object3D(); track.scene.add(track.ghostDots);
  }
  track.ghostDots.count = Math.min(dots.length, 1000);
  dots.slice(0, 1000).forEach((p, i) => {
    track.ghostDummy.position.set(p.x, p.y, p.z ?? 0); track.ghostDummy.scale.setScalar(p.radius);
    track.ghostDummy.updateMatrix(); track.ghostDots.setMatrixAt(i, track.ghostDummy.matrix);
  });
  track.ghostDots.instanceMatrix.needsUpdate = true;
  return track.ghostDots;
}

export class RivalScene {
  constructor(track) {
    this.track = track;
    this.marker = track.plate(0, 0.06, 3.2, 0, GHOST_COLOR, 0.8); this.marker.visible = false;
    const canvas = document.createElement("canvas"); canvas.width = 192; canvas.height = 64;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
    this.label.scale.set(1.8, 0.6, 1); this.label.renderOrder = 7; this.label.visible = false;
    track.scene.add(this.label); this.labelContext = canvas.getContext("2d");
  }
  update(race) {
    const track = this.track, ghost = race.rival?.ghost;
    const visible = !!ghost && !race.terminal && !ghost.terminal && Math.abs(ghost.distance - race.distance) < 55;
    if (visible) {
      if (track.renderGhost) this.athlete = track.renderGhost(ghost, race);
      else {
        if (!this.athlete) {
          const canvas = document.createElement("canvas"); canvas.width = track.art.width; canvas.height = track.art.height;
          this.context = canvas.getContext("2d"); this.texture = new THREE.CanvasTexture(canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
          this.athlete = track.runner.clone(); this.athlete.material = ghostMaterial(this.texture, track.runner.isSprite);
          this.athlete.renderOrder = 4; track.scene.add(this.athlete);
        }
        const art = track.art;
        this.context.clearRect(0, 0, art.width, art.height); art.draw(this.context, art.x, art.ground, art.unit, ghost); this.texture.needsUpdate = true;
        this.athlete.position.set(ghost.distance - race.distance, 0.08, -0.85);
      }
    }
    if (this.athlete) this.athlete.visible = visible;
    const mark = race.previousBest;
    const point = Number.isFinite(mark) && mark > 0 ? track.bestPoint?.(mark, race) : null;
    this.marker.visible = !!point;
    if (point) {
      this.marker.position.set(point.x, point.y ?? 0.09, point.z ?? 0);
      this.marker.rotation.set(0, point.heading ?? 0, 0);
      this.marker.scale.set(0.06, 1, point.width ?? 3.2);
    }
    this.label.visible = visible || !!point;
    if (!this.label.visible) return;
    const text = visible ? "PB GHOST" : "PB " + mark.toFixed(2) + " M";
    if (text !== this.text) {
      this.text = text; const ctx = this.labelContext;
      ctx.clearRect(0, 0, 192, 64); ctx.fillStyle = "#24192e"; ctx.fillRect(4, 8, 184, 48);
      ctx.font = "bold 23px monospace"; ctx.fillStyle = GHOST_COLOR; ctx.textAlign = "center"; ctx.fillText(text, 96, 40);
      this.label.material.map.needsUpdate = true;
    }
    const at = visible ? track.timingPoint?.(ghost.distance, -0.85, track.art.headHeight + 0.4, race)
      ?? { x: ghost.distance - race.distance, y: track.art.headHeight + 0.4, z: -0.85 } : { ...point, y: (point.y ?? 0) + 0.65 };
    this.label.position.set(at.x, at.y, at.z ?? 0);
  }
}
