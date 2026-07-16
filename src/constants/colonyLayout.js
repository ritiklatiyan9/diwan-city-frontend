// Diwan City colony layout — digitized from the approved layout plan PDF (page 2).
// All coordinates are in feet, matching the plan's dimensions. Sizes are in sq. yards (gaj).
// Block P = residential plots {1}–{86}, Block S = shop strip along the south 40' road.

const plots = [];
const add = (block, no, size, x, y, w, h) =>
  plots.push({ block, no: String(no), size, x, y, w, h });

// ── West column (plots 9–24), x 0–56, facing ROAD 40' ──
add('P', 24, 170.10, 0, 0, 56, 24.75);
add('P', 23, 192.35, 0, 24.75, 56, 31);
[148.88, 148.84, 148.81, 148.77, 148.74, 148.70, 148.64, 148.42, 148.19, 147.95, 147.72, 147.48, 147.25]
  .forEach((size, i) => add('P', 22 - i, size, 0, 55.75 + i * 24, 56, 24));
add('P', 9, 189.84, 0, 367.75, 56, 31);

// ── Middle block west column (25–39), 55' deep ──
add('P', 25, 189.44, 96, 24.75, 55, 31);
for (let i = 0; i < 13; i++) add('P', 26 + i, 146.67, 96, 55.75 + i * 24, 55, 24);
add('P', 39, 189.44, 96, 367.75, 55, 31);

// ── Middle block east column (40–54), 56' deep ──
add('P', 54, 192.89, 151, 24.75, 56, 31);
for (let i = 0; i < 13; i++) add('P', 53 - i, 149.33, 151, 55.75 + i * 24, 56, 24);
add('P', 40, 192.89, 151, 367.75, 56, 31);

// ── East section: 45' col + 21'/21'/~23.5' cols (54' deep), 3 blocks split by 25' roads ──
const C1 = 247, C2 = 292, C3 = 313, C4 = 334;
const eastRow45 = (top, [a, b, c, d]) => {
  add('P', a, 150.00, C1, top, 45, 30);
  add('P', b, 120.00, C1, top + 30, 45, 24);
  add('P', c, 120.00, C1, top + 54, 45, 24);
  add('P', d, 150.00, C1, top + 78, 45, 30);
};
eastRow45(24.75, [56, 57, 58, 59]);
add('P', 55, 126.00, C2, 24.75, 21, 54);
add('P', 60, 126.00, C2, 78.75, 21, 54);
add('P', 61, 126.00, C3, 78.75, 21, 54);
add('P', 62, 142.47, C4, 78.75, 23.5, 54);

eastRow45(157.75, [66, 67, 68, 69]);
add('P', 65, 126.00, C2, 157.75, 21, 54);
add('P', 70, 126.00, C2, 211.75, 21, 54);
add('P', 64, 126.00, C3, 157.75, 21, 54);
add('P', 71, 126.00, C3, 211.75, 21, 54);
add('P', 63, 139.33, C4, 157.75, 23.5, 54);
add('P', 72, 137.18, C4, 211.75, 23.5, 54);

eastRow45(290.75, [76, 77, 78, 79]);
add('P', 75, 126.00, C2, 290.75, 21, 54);
add('P', 80, 126.00, C2, 344.75, 21, 54);
add('P', 74, 126.00, C3, 290.75, 21, 54);
add('P', 81, 126.00, C3, 344.75, 21, 54);
add('P', 73, 134.04, C4, 290.75, 23.5, 54);
add('P', 82, 131.89, C4, 344.75, 23.5, 54);

// ── Bottom row, south of ROAD 30' ──
[110.06, 111.64, 112.59, 113.54, 114.49, 115.44, 116.39]
  .forEach((size, i) => add('P', 8 - i, size, i * 23, 428.75, 23, 45));
add('P', 1, 230.46, 161, 428.75, 45, 45);
add('P', 86, 237.27, C1, 428.75, 45, 45);
add('P', 85, 111.94, C2, 428.75, 21, 45);
add('P', 84, 112.71, C3, 428.75, 21, 45);
add('P', 83, 115.88, C4, 428.75, 23.5, 45);

// ── Block S: shop strip along the south 40' road (marked plots on the plan) ──
const SX = 248, SW = 25;
for (let i = 0; i < 8; i++) add('S', 8 - i, 66.67, SX, 487 + i * 24, SW, 24); // S8 (top) … S1 (at gate)
add('S', 9, 66.67, SX, 679, SW, 24);
add('S', 10, 25.00, SX, 703, SW, 9);
add('S', 11, 33.33, SX, 712, SW, 12);
add('S', 12, 33.33, SX, 724, SW, 12);
add('S', 13, 33.33, SX, 736, SW, 12);
add('S', 14, 43.19, SX, 748, 12.5, 31.1);
add('S', 15, 43.19, SX + 12.5, 748, 12.5, 31.1);

export const COLONY_PLOTS = plots;

export const ROADS = [
  { x: 56, y: 0, w: 40, h: 428.75 },        // west ROAD 40'
  { x: 207, y: 0, w: 40, h: 428.75 },       // east ROAD 40'
  { x: 96, y: 0, w: 111, h: 24.75 },        // top road strip (middle block)
  { x: 247, y: 0, w: 66, h: 24.75 },        // top road strip (east, ends at park)
  { x: 247, y: 132.75, w: 110.5, h: 25 },   // ROAD 25' upper
  { x: 247, y: 265.75, w: 110.5, h: 25 },   // ROAD 25' lower
  { x: 0, y: 398.75, w: 357.5, h: 30 },     // ROAD 30'
  { x: 212, y: 487, w: 36, h: 305 },        // south ROAD 40' (to Goharni bypass)
];

// White road-name plates drawn on top of roads: [cx, cy, text, vertical?]
export const ROAD_LABELS = [
  { x: 76, y: 140, text: "ROAD 40'-0\" WIDE", vertical: true },
  { x: 76, y: 315, text: "ROAD 40'-0\" WIDE", vertical: true },
  { x: 227, y: 140, text: "ROAD 40'-0\" WIDE", vertical: true },
  { x: 227, y: 315, text: "ROAD 40'-0\" WIDE", vertical: true },
  { x: 151.5, y: 12.4, text: 'R O A D' },
  { x: 280, y: 12.4, text: 'R O A D' },
  { x: 302, y: 145.25, text: "ROAD 25'-0\" WIDE" },
  { x: 302, y: 278.25, text: "ROAD 25'-0\" WIDE" },
  { x: 103, y: 413.75, text: "ROAD 30'-0\" WIDE" },
  { x: 302, y: 413.75, text: "ROAD 30'-0\" WIDE" },
  { x: 230, y: 570, text: "ROAD 40'-0\" WIDE", vertical: true },
  { x: 230, y: 745, text: "ROAD 40'-0\" WIDE", vertical: true },
];

// White chakroad bands around the colony boundary
export const CHAKROAD_BANDS = [
  { x: -8, y: -13, w: 380, h: 13, labels: [{ x: 100, y: -3.5 }, { x: 290, y: -3.5 }] },
  { x: 357.5, y: -13, w: 13, h: 487, vertical: true, labels: [{ x: 364.5, y: 150 }, { x: 364.5, y: 330 }] },
  { x: -8, y: 473.75, w: 365.5, h: 13.25, labels: [{ x: 60, y: 483 }, { x: 175, y: 483 }, { x: 300, y: 483 }] },
];

export const PARKS = [
  { kind: 'rect', x: 313, y: 8.4, w: 44.5, h: 70.35, label: '{PARK}', size: 348.47 },
  { kind: 'poly', points: '189.4,507 207,507 207,770', label: 'PARK', lx: 199, ly: 640 },
];

export const TEMPLE = { x: 188.6, y: 487, w: 18.4, h: 20 };
export const GATE = { x: 212, y: 672, w: 36, h: 14 };
export const COMPASS = { x: 95, y: 600 };
export const BYPASS_ROAD = { x1: 120, x2: 355, y: 812, label: 'GOHARNI BYPASS ROAD' };

// viewBox covering the whole plan incl. labels
export const VIEWBOX = '-14 -20 392 880';
