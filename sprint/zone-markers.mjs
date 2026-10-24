import * as THREE from "./vendor/three.module.min.js";
import { releaseBands } from "./engine.mjs?v=starts-1";

const COLORS = { bad: "#ed667d", good: "#ffd473", perfect: "#81f6b6", entry: "#f4fff4", exit: "#ffffff" };
const SEGMENTS = 24;
function strip(color, opacity = 1) {
  const geometry = new THREE.BufferGeometry(), indices = [];
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage));
  for (let i = 0; i < SEGMENTS; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, opacity, transparent: opacity < 1, side: THREE.DoubleSide, depthWrite: false }));
  mesh.frustumCulled = false; mesh.renderOrder = 2; return mesh;
}
function label(text) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#11251f"; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#f4fff4"; ctx.font = "bold 30px monospace"; ctx.textAlign = "center"; ctx.fillText(text, 128, 43);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
  sprite.renderOrder = 6; return sprite;
}
export class ZoneMarkers extends THREE.Group {
  constructor(count) {
    super();
    this.zones = Array.from({ length: count + 1 }, () => {
      const group = new THREE.Group(), bands = Object.fromEntries(Object.entries(COLORS).map(([key, color]) => [key, strip(color, key === "bad" ? 0.65 : 0.95)]));
      const hold = label("HOLD"), release = label("RELEASE");
      group.add(...Object.values(bands), hold, release); this.add(group);
      return { group, bands, hold, release, cacheKey: null, ranges: null };
    });
  }
  update(race, scene) {
    this.visible = ["ready", "sprint", "line"].includes(race.phase) && !race.presentation;
    if (!this.visible) return;
    const point = (s, z, y) => scene.timingPoint?.(s, z, y, race) ?? { x: s - race.distance, y, z };
    const zones = [...race.zones, ...(race.finishZone ? [race.finishZone] : [])];
    this.zones.forEach((view, i) => {
      const zone = zones[i]; view.group.visible = !!zone && zone.status !== "done" && (scene.isZoneVisible?.(zone, race) ?? true);
      if (!view.group.visible) return;
      const attempt = zone.id == null ? race.throwStart ?? race.plantStart ?? race.takeoffStart : zone.attempt;
      const timing = race.timingWindow(zone, attempt), press = attempt?.distance ?? zone.start;
      const hardEnd = zone.id == null ? race.course.distance : Infinity;
      const key = [press, timing.edgeWindow, timing.perfectEdge, hardEnd].join(":");
      if (view.cacheKey !== key) { view.ranges = releaseBands({ ...zone, ...timing }, press, hardEnd); view.cacheKey = key; }
      const ranges = { ...view.ranges, entry: { start: zone.start - 0.055, end: zone.start + 0.055 }, exit: { start: zone.end - 0.035, end: zone.end + 0.035 } };
      Object.entries(view.bands).forEach(([name, mesh], layer) => {
        // Nested transparent bands must draw from the broad red field to the white line.
        mesh.renderOrder = 2 + layer * 0.1;
        const range = ranges[name]; mesh.visible = !!range;
        if (!range) return;
        const positions = mesh.geometry.attributes.position;
        for (let n = 0; n <= SEGMENTS; n++) for (let side = 0; side < 2; side++) {
          const p = point(range.start + (range.end - range.start) * n / SEGMENTS, (side - 0.5) * 1.42, 0.09 + layer * 0.006);
          positions.setXYZ(n * 2 + side, p.x, p.y, p.z);
        }
        positions.needsUpdate = true;
      });
      const units = (scene.camera.top - scene.camera.bottom) / scene.height;
      for (const [sprite, distance] of [[view.hold, zone.start], [view.release, zone.end]]) {
        const p = point(distance, -0.95, 0.18), projected = scene.project(p.x, p.y, p.z);
        sprite.position.set(p.x, p.y + units * 14, p.z); sprite.scale.set(units * 60, units * 15, 1);
        sprite.visible = projected.x > 30 && projected.x < scene.width - 30 && projected.y > 55 && projected.y < scene.height - 45;
      }
      view.hold.visible &&= !attempt;
    });
  }
}
