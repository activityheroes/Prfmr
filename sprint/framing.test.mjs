import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "./vendor/three.module.min.js";
import { TrackScene } from "./track-scene.mjs?v=framing-1";
import { LongJumpScene } from "../long-jump/scene.mjs?v=framing-1";
import { VaultScene } from "../pole-vault/scene.mjs?v=framing-1";
import { JavelinScene } from "../javelin/scene.mjs?v=framing-1";
import { CyclingScene } from "../cycling/scene.mjs?v=framing-1";
import { VELODROME } from "../cycling/velodrome.mjs?v=boost-1";

const sizes = [[296, 300], [358, 300], [1056, 248], [1056, 340]];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function view(width, height, id = "sprint") {
  return { width, height, course: { id }, renderer: { setSize() {} }, camera: new THREE.OrthographicCamera(-9, 9, 5, -5, 0.1, 100) };
}
const span = scene => scene.camera.right - scene.camera.left;

test("sprint and swimming widen their cameras without changing other course framing", () => {
  for (const [width, height] of sizes) {
    for (const id of ["sprint", "swimming", "hurdles", "high-jump", "speed-skating", "ski-jumping", "biathlon"]) {
      const scene = view(width, height, id), swim = id === "swimming";
      TrackScene.prototype.resize.call(scene, width, height);
      const oldSpan = Math.max(swim ? width < 650 ? 7.5 : 14 : width < 650 ? 11.8 : 17.2, width / height * (swim ? 4.8 : 6.2));
      close(span(scene), oldSpan * (id === "sprint" ? 1.18 : swim ? 1.25 : 1));
      close(span(scene) / (scene.camera.top - scene.camera.bottom), width / height);
    }
  }
});

test("field event run-ups share a wider view while retaining world coordinates", () => {
  for (const [width, height] of sizes) {
    for (const [Scene, mobile, vertical] of [[LongJumpScene, 9, 6.3], [VaultScene, 9, 6.2], [JavelinScene, 8.8, 6.2]]) {
      const scene = view(width, height), race = { distance: 12, athlete: { x: 12, y: 1.2 } }, before = structuredClone(race);
      Scene.prototype.frameCamera.call(scene, race);
      close(span(scene), 1.3 * Math.max(width < 650 ? mobile : 17.2, width / height * vertical));
      assert.deepEqual(race, before);
    }
  }
});

test("wider field cameras retain landing and celebration framing", () => {
  for (const [width, height] of sizes) {
    for (const age of [0, 0.6, 1.5, 2.6, 4]) {
      const scene = view(width, height);
      const race = { distance: 44.7, launch: {}, flightTime: 1, athlete: { x: 52, y: 0.6 }, presentation: { age } };
      LongJumpScene.prototype.frameCamera.call(scene, race);
      scene.camera.updateMatrixWorld();
      const landing = new THREE.Vector3(race.athlete.x - race.distance, 1, 0).project(scene.camera);
      assert.ok(Math.abs(landing.x) < 0.8 && Math.abs(landing.y) < 0.8);
      const spear = { ...race, projectile: { x: 115, y: 0 } };
      JavelinScene.prototype.frameCamera.call(scene, spear);
      assert.ok(Number.isFinite(span(scene)) && span(scene) >= 14.3);
      const vault = { ...race, plant: { launchY: 6 }, vaultTime: 1 };
      VaultScene.prototype.frameCamera.call(scene, vault);
      assert.ok(Number.isFinite(span(scene)) && span(scene) >= 14.3);
    }
  }
});

test("cycling uses a smaller ride athlete and preserves the readable full-track overview", () => {
  for (const [width, height] of sizes) {
    const scene = Object.assign(view(width, height), {
      origin: new THREE.Vector3(VELODROME.straight / 2, 0, VELODROME.radius),
      frameCamera: CyclingScene.prototype.frameCamera
    });
    CyclingScene.prototype.setView.call(scene, "ride");
    close(scene.riderScale, 1.65);
    close(span(scene), 1.1 * Math.max(width < 650 ? 21 : 32, width / height * 11.5));
    CyclingScene.prototype.setView.call(scene, "track");
    close(scene.riderScale, width < 650 ? 3.4 : 2.4);
    close(span(scene), Math.max(126, width / height * 60));
    CyclingScene.prototype.setView.call(scene, "ride");
    close(scene.riderScale, 1.65);
  }
});
