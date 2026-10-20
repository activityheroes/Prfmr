export const HURDLES = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, x: 13 + 8.5 * i, height: 0.838 }));
export const HURDLES_COURSE = {
  id: "hurdles", distance: 100, finishAt: 96, fatigueAt: 90, finishMove: false,
  baseSpeed: 7.2, acceleration: 7.2, maxSpeeds: [9.5, 9.9, 10.3],
  zones: HURDLES.map(h => ({ id: h.id, start: h.x - (h.id === 10 ? 5.1 : 5.5), end: h.x - 2.7,
    edgeWindow: h.id === 10 ? 0.6 : 0.9, perfectEdge: h.id === 10 ? 0.12 : 0.2 }))
};
