import * as THREE from "../sprint/vendor/three.module.min.js";

export function createPool(track) {
  track.box(60, 0.12, 11, 8, -0.85, 0, "#315854");
  track.box(60, 0.7, 2, 8, -0.28, -4.7, "#aebbb6");
  track.box(60, 0.7, 2, 8, -0.28, 4.7, "#aebbb6");
  for (let lane = -2; lane <= 2; lane++) {
    track.plate(-22, 60, 1.35, lane * 1.4, lane === 0 ? "#266e72" : "#21494c", 1, track.scene, -0.76);
    track.plate(-22, 60, 0.12, lane * 1.4, "#132e32", 1, track.scene, -0.745);
  }
  for (let i = 0; i <= 14; i++) track.plate(-22, 60, 0.016, -3.5 + i * 0.5, "#679a99", 0.22, track.scene, -0.73);
  const water = track.plate(-22, 60, 7, 0, "#5ae2d2", 0.12, track.scene, 0);
  track.marks = Array.from({ length: 13 }, () => track.plate(0, 0.018, 7, 0, "#679a99", 0.35, track.scene, -0.73));

  // Instanced floats keep all six lane ropes inexpensive on mobile.
  const count = 230, ropes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.17, 8),
    new THREE.MeshStandardMaterial({ roughness: 0.7 }), count * 6);
  const dummy = new THREE.Object3D(), white = new THREE.Color("#dddcd0"), coral = new THREE.Color("#ea7768"), mint = new THREE.Color("#72d8b7");
  for (let lane = 0; lane < 6; lane++) for (let i = 0; i < count; i++) {
    const index = lane * count + i;
    dummy.rotation.z = Math.PI / 2; dummy.position.set(i * 0.24 - 18, 0.06, lane * 1.4 - 3.5);
    dummy.updateMatrix(); ropes.setMatrixAt(index, dummy.matrix);
    ropes.setColorAt(index, i % 10 < 5 ? white : lane === 2 || lane === 3 ? coral : mint);
  }
  track.scene.add(ropes);
  for (let i = 0; i < 14; i++) {
    track.box(0.8, 0.16, 0.45, i * 3 - 12, 0.28, -4.7, i % 2 ? "#52685b" : "#e18f73");
  }
  const ripples = Array.from({ length: 40 }, (_, i) => {
    const x = (i * 7.37) % 30 - 12, z = (i * 1.73) % 6.7 - 3.35;
    const mesh = track.plate(x, 0.24 + i % 3 * 0.12, 0.016, z, "#b2f2e2", 0.18, track.scene, 0.012);
    return { mesh, x, z };
  });
  return race => {
    ropes.position.x = -(race.distance % 2.4);
    water.material.opacity = 0.12 + Math.sin(race.time * 1.2) * 0.01;
    ripples.forEach(({ mesh, x, z }, i) => {
      mesh.position.x = ((x - race.distance * 0.2 + 90) % 30) - 12;
      mesh.position.z = z + Math.sin(race.time * 1.4 + i) * 0.025;
      mesh.material.opacity = 0.1 + (1 + Math.sin(race.time * 2 + i)) * 0.07;
    });
  };
}

export function createPoolWall(track, parent) {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 0.4, 7.4), new THREE.MeshStandardMaterial({ color: "#aebbb6" }));
  deck.position.set(12.3, 0.075, 0); parent.add(deck);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.05, 7.4), new THREE.MeshStandardMaterial({ color: "#aebbb6" }));
  wall.position.set(0.16, -0.25, 0); parent.add(wall);
  for (let lane = -2; lane <= 2; lane++) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.82, 1.13), new THREE.MeshStandardMaterial({ color: lane === 0 ? "#f4cf73" : "#545f58" }));
    pad.position.set(0, -0.21, lane * 1.4); parent.add(pad);
    track.plate(-0.025, 0.09, 1.13, lane * 1.4, lane === 0 ? "#f4cf73" : "#545f58", 1, parent, 0.28);
    track.plate(-0.9, 0.12, 0.65, lane * 1.4, "#132e32", 1, parent, -0.73);
  }
}
