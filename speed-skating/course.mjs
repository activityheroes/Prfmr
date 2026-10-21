export const OVAL = { length: 400, radius: 28, straight: 200 - Math.PI * 28 };
export const SKATING_COURSE = {
  id: "speed-skating", distance: 500, finishAt: 495, fatigueAt: 450, finishMove: false,
  baseSpeed: 12, acceleration: 4.8, maxSpeeds: [15.6, 16.4, 17.2], momentumScale: 1.2,
  zones: [55, 125, 205, 280, 355, 445].map((start, i) => ({ id: i + 1, start,
    end: start + (i === 5 ? 8 : 12), edgeWindow: i === 5 ? 1.3 : 2.2, perfectEdge: i === 5 ? 0.2 : 0.35 }))
};
export function ovalPoint(distance) {
  const s = ((distance % OVAL.length) + OVAL.length) % OVAL.length, r = OVAL.radius, l = OVAL.straight;
  if (s < l) return { x: s, z: 0, heading: 0, bend: 0 };
  if (s < 200) { const a = (s - l) / r; return { x: l + r * Math.sin(a), z: r * (1 - Math.cos(a)), heading: a, bend: 1 }; }
  if (s < 200 + l) return { x: l - (s - 200), z: r * 2, heading: Math.PI, bend: 0 };
  const a = (s - 200 - l) / r;
  return { x: -r * Math.sin(a), z: r * (1 + Math.cos(a)), heading: Math.PI + a, bend: 1 };
}
export function bendAmount(distance) {
  const s = ((distance % 200) + 200) % 200;
  const edge = s < OVAL.straight ? -Math.min(OVAL.straight - s, s) : Math.min(s - OVAL.straight, 200 - s);
  const t = Math.max(0, Math.min(1, (edge + 4) / 8));
  return t * t * (3 - 2 * t);
}
