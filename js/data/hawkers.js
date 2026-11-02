// Liimy Land: the hawker carts down the middle of the road, the walkways on
// either side, and the walkable area. Metres; the street runs from the gate
// (z ≈ +3) toward −Z.

export const STREET = {
  buildingX: 7.4, // facade line of the G+2 buildings
  walkInner: 1.9, // walkway starts just beyond the cart row
  walkOuter: 6.6, // and ends just before the buildings
  gateZ: 3,
  start: 4,
  end: -84,
  cartStart: -5,
  cartSpacing: 5,
  eyeHeight: 1.6,
};

export const BOUNDS = { minX: -STREET.walkOuter, maxX: STREET.walkOuter, minZ: STREET.end, maxZ: STREET.start };

/**
 * The 16 carts. `side` is the walkway the cart faces: −1 = west walkway (front at −X),
 * +1 = east walkway. Items marked `kind` count toward the activities.
 */
const RAW = [
  {
    id: 'baskets',
    name: 'Basket stand',
    sign: 'Grab a basket!',
    canopy: '#FF8FAB',
    description: 'Every little shopper starts here. Pick up a basket to carry what you collect.',
    items: [],
  },
  {
    id: 'icecream',
    name: 'Ice cream',
    sign: 'Ice Cream',
    canopy: '#7FD4F5',
    description: 'Ring the bell and the ice cream uncle scoops a cone just for you.',
    items: [],
  },
  {
    id: 'flowers',
    name: 'Flowers',
    sign: 'Flowers',
    canopy: '#FF7EB6',
    description: 'Roses, sunflowers, marigold garlands and jasmine strings in every colour.',
    items: [
      { type: 'rose', label: 'Rose bunch', kind: 'flower' },
      { type: 'sunflower', label: 'Sunflower', kind: 'flower' },
      { type: 'marigold', label: 'Marigold garland', kind: 'flower' },
      { type: 'tulip', label: 'Pink tulip', kind: 'flower' },
    ],
  },
  {
    id: 'vegetables',
    name: 'Vegetables',
    sign: 'Veggies',
    canopy: '#7BD389',
    description: 'Shiny tomatoes, crunchy carrots, purple brinjals and a big round cabbage.',
    items: [
      { type: 'tomato', label: 'Tomato', kind: 'vegetable' },
      { type: 'carrot', label: 'Carrot', kind: 'vegetable' },
      { type: 'brinjal', label: 'Brinjal', kind: 'vegetable' },
      { type: 'cabbage', label: 'Cabbage', kind: 'vegetable' },
    ],
  },
  {
    id: 'fruits',
    name: 'Fruits',
    sign: 'Fruits',
    canopy: '#FFB84D',
    description: 'Sweet mangoes, bananas, red apples and juicy watermelon slices.',
    items: [
      { type: 'mango', label: 'Mango', kind: 'fruit' },
      { type: 'banana', label: 'Bananas', kind: 'fruit' },
      { type: 'apple', label: 'Apple', kind: 'fruit' },
      { type: 'watermelon', label: 'Watermelon slice', kind: 'fruit' },
    ],
  },
  {
    id: 'snacks',
    name: 'Snacks',
    sign: 'Yummy Snacks',
    canopy: '#FFD95A',
    description: 'Jars of cookies and candy with red lids, and crinkly packets of murukku.',
    items: [
      { type: 'jar', label: 'Cookie jar', kind: 'snack' },
      { type: 'packet', label: 'Murukku packet', kind: 'snack' },
      { type: 'candyjar', label: 'Candy jar', kind: 'snack' },
    ],
  },
  {
    id: 'pottery',
    name: 'Pottery',
    sign: 'Clay Pots',
    canopy: '#E8875B',
    description: 'Little clay pots, cups and diyas, painted with happy dots.',
    items: [
      { type: 'pot', label: 'Clay pot', kind: 'pottery' },
      { type: 'diya', label: 'Diya lamp', kind: 'pottery' },
      { type: 'kulhad', label: 'Clay cup', kind: 'pottery' },
    ],
  },
  {
    id: 'corn',
    name: 'Corn',
    sign: 'Hot Corn',
    canopy: '#F5C542',
    description: 'Roasted corn on a coal stove, rubbed with lemon and a pinch of masala.',
    items: [{ type: 'corn', label: 'Corn cob', kind: 'food' }],
  },
  {
    id: 'sugarcane',
    name: 'Sugarcane juice',
    sign: 'Cane Juice',
    canopy: '#9BE07A',
    description: 'Fresh sugarcane squeezed through the big wheel, served cold in a glass.',
    items: [{ type: 'juice', label: 'Juice glass', kind: 'food' }],
  },
  {
    id: 'cottoncandy',
    name: 'Cotton candy',
    sign: 'Cotton Candy',
    canopy: '#FFB3DE',
    description: 'Fluffy pink clouds of sugar spun onto sticks.',
    items: [{ type: 'candyfloss', label: 'Cotton candy', kind: 'food' }],
  },
  {
    id: 'panipuri',
    name: 'Pani puri',
    sign: 'Pani Puri',
    canopy: '#FF9A4D',
    description: 'Crispy puris filled with potato and tangy water, one bite each.',
    items: [{ type: 'puriplate', label: 'Pani puri plate', kind: 'food' }],
  },
  {
    id: 'balloons',
    name: 'Balloons',
    sign: 'Balloons',
    canopy: '#B79CFF',
    description: 'A bobbing bunch of balloons in every colour of the sunset.',
    items: [
      { type: 'balloon', label: 'Red balloon', kind: 'toy', color: '#FF5A6E' },
      { type: 'balloon', label: 'Yellow balloon', kind: 'toy', color: '#FFD23F' },
    ],
  },
  {
    id: 'toys',
    name: 'Toys',
    sign: 'Toy Cart',
    canopy: '#5BC0EB',
    description: 'Teddies, bouncy balls, spinning tops and a tiny red car.',
    items: [
      { type: 'teddy', label: 'Teddy bear', kind: 'toy' },
      { type: 'ball', label: 'Bouncy ball', kind: 'toy' },
      { type: 'top', label: 'Spinning top', kind: 'toy' },
      { type: 'car', label: 'Toy car', kind: 'toy' },
    ],
  },
  {
    id: 'bangles',
    name: 'Bangles',
    sign: 'Bangles',
    canopy: '#FF6F91',
    description: 'Stacks of glass bangles that clink and sparkle in the lights.',
    items: [
      { type: 'bangles', label: 'Bangle stack', kind: 'craft', color: '#E63E6D' },
      { type: 'bangles', label: 'Gold bangles', kind: 'craft', color: '#FFC93C' },
    ],
  },
  {
    id: 'bamboo',
    name: 'Bamboo baskets',
    sign: 'Bamboo Craft',
    canopy: '#C9B26B',
    description: 'Woven bamboo baskets, hand fans and little lantern shades.',
    items: [
      { type: 'bamboobasket', label: 'Bamboo basket', kind: 'craft' },
      { type: 'fan', label: 'Hand fan', kind: 'craft' },
    ],
  },
  {
    id: 'accessories',
    name: 'Accessories',
    sign: 'Sparkles',
    canopy: '#C77DFF',
    description: 'Hair clips, hairbands, chains and rings that sparkle like stars.',
    items: [
      { type: 'clip', label: 'Hair clip', kind: 'accessory' },
      { type: 'hairband', label: 'Hairband', kind: 'accessory' },
      { type: 'chain', label: 'Chain', kind: 'accessory' },
      { type: 'ring', label: 'Ring', kind: 'accessory' },
    ],
  },
];

export const CARTS = RAW.map((c, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const z = STREET.cartStart - i * STREET.cartSpacing;
  return {
    ...c,
    index: i,
    side,
    z,
    // The visitor stands on the walkway in front of the cart, looking at it.
    view: { x: side * 3.4, z, yaw: side < 0 ? -Math.PI / 2 : Math.PI / 2 },
  };
});

/** Cart footprint (cart, canopy poles and the hawker standing behind it). */
export const CART_BOX = { halfX: 1.45, halfZ: 1.25 };
const RADIUS = 0.3; // the visitor's body

/**
 * Keeps a position on the walkways: inside the street, outside the buildings,
 * and never inside a cart. Gaps between carts let visitors cross the road.
 */
export function clampToWalk(x, z) {
  let px = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, x));
  let pz = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, z));
  for (const c of CARTS) {
    const hx = CART_BOX.halfX + RADIUS;
    const hz = CART_BOX.halfZ + RADIUS;
    const dx = px;
    const dz = pz - c.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      const penX = hx - Math.abs(dx);
      const penZ = hz - Math.abs(dz);
      if (penX < penZ) px = (dx < 0 ? -1 : 1) * hx;
      else pz = c.z + (dz < 0 ? -1 : 1) * hz;
    }
  }
  return { x: px, z: pz };
}

/** Kept for modules written against the old name. */
export const clampToBounds = clampToWalk;

/** 360° panorama spots along the walkways. */
export const SPOTS = [
  { x: 0, z: 2.2, label: 'Gate' },
  { x: 3.6, z: -10, label: 'Ice cream and flowers' },
  { x: -3.6, z: -21, label: 'Veggies and fruits' },
  { x: 3.6, z: -33, label: 'Pottery and corn' },
  { x: -3.6, z: -46, label: 'Sweet treats' },
  { x: 3.6, z: -60, label: 'Balloons and toys' },
  { x: -3.6, z: -74, label: 'Bamboo and sparkles' },
];

/** The shopping list in "Interact along". */
export const ACTIVITIES = [
  { id: 'basket', label: 'Pick a basket' },
  { id: 'icecream', label: 'Get an ice cream' },
  { id: 'flowers', label: 'Pick some flowers' },
  { id: 'vegfruit', label: 'Bag a vegetable and a fruit' },
];
