// Diwan City flats and shops, based on the supplied sketch.
// A4–A6 are included beside A1–A3 as confirmed by the user.
// Coordinates describe the drawing only; no physical areas were supplied.
export const COLONY_BLOCKS = ['A', 'B', 'C', 'D', 'S'];

const plots = [];
const add = (block, no, x, y, w, h) => plots.push({
  block, no: String(no), type: block === 'S' ? 'Shop' : 'Flat', x, y, w, h,
});

// Each flat block has two columns: 5/6 above 3/4 above 1/2.
// Left to right: D, C, B, A, office, stairs, then shops.
['D', 'C', 'B', 'A'].forEach((block, column) => {
  for (let no = 1; no <= 6; no++) {
    add(block, no, 68 + column * 160 + (no % 2 === 0 ? 80 : 0),
      70 + (2 - Math.floor((no - 1) / 2)) * 54, 80, 54);
  }
});

add('S', 5, 868, 70, 80, 162);
add('S', 4, 948, 70, 80, 162);
add('S', 3, 1028, 70, 80, 162);
add('S', 1, 1108, 70, 120, 81);
add('S', 2, 1108, 151, 120, 81);

export const FLAT_SHOP_UNITS = plots;
export const FLAT_SHOP_COMMON_AREAS = [
  { id: 'west-stairs', label: 'STAIRS', x: 28, y: 70, w: 40, h: 162, vertical: true },
  { id: 'office', label: 'OFFICE', x: 708, y: 70, w: 120, h: 162 },
  { id: 'shop-stairs', label: 'STAIRS', x: 828, y: 70, w: 40, h: 162, vertical: true },
];
export const FLAT_SHOP_VIEWBOX = '0 0 1256 292';
