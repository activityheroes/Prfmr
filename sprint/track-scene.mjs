import * as THREE from "./vendor/three.module.min.js";
import { SPRINT_COURSE, clamp } from "./engine.mjs?v=starts-1";
import { drawRunner } from "./runner.mjs?v=starts-1";
import { createPool, createPoolWall } from "../swimming/pool.mjs?v=starts-1";
import { finishTravel, reactionAge } from "./finish.mjs?v=starts-1";
import { BoostEffects } from "./boost-effects.mjs?v=starts-1";
import { ZoneMarkers } from "./zone-markers.mjs?v=starts-1";
import { RivalScene } from "./rival-scene.mjs?v=starts-1";

const RUNNER_ART = { width: 256, height: 256, x: 104, ground: 238, unit: 12,
  scaleX: 3.2, scaleY: 3.2, anchorX: 104 / 256, anchorY: 0.07,
  headHeight: 2.5, feedbackX: 0, shadowStart: -0.6, shadowLength: 1.15, draw: drawRunner };

export class TrackScene {
  constructor(canvas, { course = SPRINT_COURSE, athlete = RUNNER_ART, environment = null } = {}) {
    this.course = course; this.art = athlete;
    const cycling = course.id === "cycling";
    const swimming = course.id === "swimming";
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#141d1b");
    this.camera = new THREE.OrthographicCamera(-9, 9, 5, -5, 0.1, 100);
    this.camera.position.set(10, 12, 19);
    if (swimming) this.camera.position.set(8, 8, 20);
    this.camera.lookAt(cycling ? 2.4 : 3.8, 1.3, 0);
    this.scene.add(new THREE.HemisphereLight(0xd5f6ff, 0x514348, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(-2, 12, 10); this.scene.add(sun);
    if (environment) this.updateEnvironment = environment.create(this);
    else if (swimming) this.updatePool = createPool(this);
    else {
      this.box(60, 0.1, course.id === "sprint" ? 60 : 24, 8, -0.12, 0, "#223c32");
      for (let lane = -2; lane <= 2; lane++) {
        this.box(60, 0.08, 1.35, 8, -0.04, lane * 1.4, cycling ? lane === 0 ? "#4b5351" : "#373d3d" : lane === 0 ? "#653e46" : "#443038");
        this.plate(-22, 60, 0.025, lane * 1.4 - 0.7, "#bcb3a8", 0.6);
      }
      this.plate(-22, 60, 0.025, 3.5, "#bcb3a8", 0.6);
      this.marks = [];
      for (let i = 0; i < 13; i++) {
        const marker = this.plate(0, 0.045, 7, 0, "#cab8b2", 0.25);
        this.marks.push(marker);
      }
      for (let i = 0; i < 20; i++) this.box(0.9, 0.45, 0.8, i * 2 - 12, 0.15, -7, i % 3 ? "#345a50" : "#607465");
    }

    this.zoneMeshes = course.zones.map(zone => {
      const group = new THREE.Group(); this.scene.add(group);
      const length = zone.end - zone.start;
      const glow = this.plate(-0.08, length + 0.16, 1.34, 0, "#0ba5ff", 0.18, group, 0.029);
      const surface = this.plate(0, length, 1.2, 0, "#139ff5", 0.62, group, 0.034);
      const core = this.plate(0, length, 0.24, 0, "#8cecff", 0.48, group, 0.039);
      const entryBand = this.plate(-0.1, 0.2, 1.28, 0, "#d9fcff", 0.25, group, 0.045);
      const exitBand = this.plate(length - 0.1, 0.2, 1.28, 0, "#d9fcff", 0.25, group, 0.045);
      const entry = this.plate(-0.035, 0.07, 1.28, 0, "#d9fcff", 1, group, 0.05);
      const exit = this.plate(length - 0.035, 0.07, 1.28, 0, "#d9fcff", 1, group, 0.05);
      return { group, glow, surface, core, entry, exit, entryBand, exitBand };
    });
    this.cursor = this.plate(-0.035, 0.07, 1.42, 0, "#f4ffd9", 1, this.scene, 0.075);

    const runnerCanvas = document.createElement("canvas");
    runnerCanvas.width = athlete.width; runnerCanvas.height = athlete.height;
    this.runnerContext = runnerCanvas.getContext("2d");
    this.runnerTexture = new THREE.CanvasTexture(runnerCanvas);
    this.runnerTexture.colorSpace = THREE.SRGBColorSpace;
    this.runnerTexture.minFilter = THREE.LinearFilter;
    if (cycling || swimming || athlete.planar) {
      // Horizontal athletes share the course's X axis and perspective.
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.translate(0.5 - athlete.anchorX, 0.5 - athlete.anchorY, 0);
      this.runner = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: this.runnerTexture, transparent: true, depthWrite: false }));
    } else {
      this.runner = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.runnerTexture, transparent: true, depthWrite: false }));
      this.runner.center.set(athlete.anchorX, athlete.anchorY);
    }
    this.runner.scale.set(athlete.scaleX, athlete.scaleY, 1);
    this.runner.position.set(0, 0.08, 0); this.runner.renderOrder = 5; this.scene.add(this.runner);
    this.shadow = this.plate(athlete.shadowStart, athlete.shadowLength, 0.8, 0, "#0b1311", 0.5, this.scene, 0.028);
    if (swimming) { this.shadow.position.y = -0.7; this.shadow.material.opacity = 0.12; }

    this.sparkPositions = new Float32Array(48 * 3);
    const sparks = new THREE.BufferGeometry();
    sparks.setAttribute("position", new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparks = new THREE.Points(sparks, new THREE.PointsMaterial({ color: "#acfbff", size: 0.095, transparent: true, depthWrite: false }));
    this.sparks.frustumCulled = false; this.scene.add(this.sparks);
    this.boostEffects = new BoostEffects(); this.scene.add(this.boostEffects);
    this.timingMarkers = new ZoneMarkers(course.zones.length); this.scene.add(this.timingMarkers);
    this.rivalScene = new RivalScene(this);
    this.finish = new THREE.Group(); this.scene.add(this.finish);
    if (environment) environment.finish(this, this.finish);
    else if (swimming) createPoolWall(this, this.finish);
    else for (let row = 0; row < 10; row++) for (let col = 0; col < 2; col++) {
      this.plate(col * 0.16, 0.16, 0.7, -3.15 + row * 0.7, (row + col) % 2 ? "#f3f4eb" : "#26312e", 1, this.finish, 0.085);
    }
  }
  box(w, h, d, x, y, z, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    mesh.position.set(x, y, z); this.scene.add(mesh); return mesh;
  }
  plate(start, length, width, z, color, opacity = 1, parent = this.scene, y = 0.015) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.008, 1), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }));
    mesh.scale.set(length, 1, width); mesh.position.set(start + length / 2, y, z);
    parent.add(mesh); return mesh;
  }
  resize(width, height) {
    this.width = width; this.height = height;
    this.renderer.setSize(width, height, false);
    const cycling = this.course.id === "cycling";
    const swimming = this.course.id === "swimming";
    const zoomOut = this.course.id === "sprint" ? 1.18 : swimming ? 1.25 : 1;
    if (this.course.id === "sprint") this.camera.lookAt(width < 650 ? 2.2 : 3.8, 1, 0);
    if (cycling) this.camera.lookAt(width < 650 ? 1.5 : 2.4, 1.3, 0);
    if (swimming) this.camera.lookAt(width < 650 ? 0.35 : 1.8, 0.1, 0);
    const span = zoomOut * Math.max(swimming ? width < 650 ? 7.5 : 14 : width < 650 ? cycling ? 11.5 : 11.8 : cycling ? 18.5 : 17.2, width / height * (swimming ? 4.8 : 6.2));
    const halfHeight = span / (width / height) / 2;
    this.camera.left = -span / 2; this.camera.right = span / 2;
    this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }
  project(x, y = 0.07, z = 0) {
    const p = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (p.x + 1) * this.width / 2, y: (1 - p.y) * this.height / 2 };
  }
  render(race) {
    const travel = finishTravel(race);
    if (travel) { const view = Object.create(race); view.distance = race.distance + travel; race = view; }
    this.updateEnvironment?.(race);
    this.updatePool?.(race);
    this.marks.forEach((mark, i) => { mark.position.x = i * 5 - 15 - race.distance % 5; });
    this.zoneMeshes.forEach((mesh, i) => {
      const zone = race.zones[i], color = zone.result ? ({ Perfect: "#81f6b6", Great: "#ffd473", Good: "#ffd473", Early: "#ed667d", Late: "#ed667d", Miss: "#ed667d" })[zone.result.grade] : "#139ff5";
      mesh.group.position.x = zone.start - race.distance;
      mesh.group.visible = zone.end - race.distance > -14 && zone.start - race.distance < 24;
      mesh.surface.material.color.set(color);
      mesh.surface.material.opacity = zone.status === "holding" ? 0.88 : zone.status === "done" ? 0.32 : 0.62;
      mesh.glow.material.opacity = zone.status === "holding" ? 0.3 : 0.18;
      mesh.core.material.opacity = zone.status === "holding" ? 0.9 : 0.48;
      const window = race.timingWindow(zone), next = race.nextZone === zone;
      mesh.entryBand.scale.x = mesh.exitBand.scale.x = window.perfectEdge * 2;
      mesh.entryBand.visible = mesh.exitBand.visible = false;
      mesh.entry.material.color.set(next && ["prepare", "press"].includes(race.cue) ? "#ffd473" : "#d9fcff");
      mesh.exit.material.color.set(next && race.cue === "release" ? "#ffd473" : "#d9fcff");
    });
    this.cursor.material.color.set(race.activeHold ? "#c5fcff" : "#f4ffd9");
    const missed = ["Early", "Late", "Miss"].includes(race.lastAttempt?.grade);

    const ctx = this.runnerContext;
    const art = this.art;
    if (this.runner.visible) {
      ctx.clearRect(0, 0, art.width, art.height);
      art.draw(ctx, art.x, art.ground, art.unit, race);
      this.runnerTexture.needsUpdate = true;
    }
    const age = race.lastAttempt === null ? 100 : race.time - race.lastAttempt.time;
    this.runner.material.rotation = this.course.id === "sprint" && missed && age < 0.5 ? Math.sin(age * 30) * 0.055 * (1 - age * 2) : 0;
    const celebrating = race.presentation?.success && reactionAge(race) > 0.4 && !race.presentation.reducedMotion;
    this.sparks.visible = celebrating || !race.presentation && race.lastAttempt?.grade === "Perfect" && age < 0.55;
    if (this.sparks.visible) {
      const count = celebrating && race.presentation.personalBest ? 48 : 24;
      this.sparks.geometry.setDrawRange(0, count);
      this.sparks.material.color.set(celebrating && race.presentation.personalBest ? "#ffe19a" : "#acfbff");
      const t = celebrating ? (reactionAge(race) - 0.4) % 1.1 / 1.1 : clamp(age / 0.55, 0, 1);
      const origin = celebrating ? this.finishFocus ?? { x: art.feedbackX, y: 1.1 } : { x: art.feedbackX, y: 1.1 };
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399;
        this.sparkPositions[i * 3] = origin.x + Math.cos(angle) * (0.3 + t * 1.1);
        this.sparkPositions[i * 3 + 1] = origin.y + Math.sin(angle * 1.3) * 0.8 + t * 1.1;
        this.sparkPositions[i * 3 + 2] = (origin.z ?? 0) + Math.sin(angle) * (0.15 + t * 0.55);
      }
      this.sparks.geometry.attributes.position.needsUpdate = true;
      this.sparks.material.opacity = 1 - t;
    }
    this.finish.position.x = race.course.distance - race.distance;
    this.finish.visible = race.distance > race.course.distance - 13;
    this.positionCourse?.(race);
    this.timingMarkers.update(race, this);
    this.boostEffects.update(race, this);
    this.rivalScene.update(race);
    this.renderer.render(this.scene, this.camera);
  }
}
