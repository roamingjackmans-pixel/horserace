// Horse and rider customization: every colour, pattern and silly add-on. Purely cosmetic.
// Plain data only (no drawing), so the rules engine can check what people pick. render.js draws them.
//
// A horse's look: { coat, mane, outfit, hat, hgear, rgear }
//   coat    the horse's coat (any PALETTE id)
//   mane    mane and tail ('match' = goes with the coat, or any PALETTE id)
//   outfit  the rider's silks ('team' = the lane's racing colours, or any PALETTE id)
//   hat     the rider's headwear (HATS)
//   hgear   an add-on for the horse (HORSE_GEAR)
//   rgear   an add-on for the rider (RIDER_GEAR)

// css is the swatch shown in the picker (a CSS background); color is the main colour, used for shading.
export const PALETTE = [
  // natural horse colours
  { id: 'bay', name: 'Bay', group: 'Natural', color: '#8a4b2a', mane: '#2a1810' },
  { id: 'chestnut', name: 'Chestnut', group: 'Natural', color: '#b8622e', mane: '#7a3615' },
  { id: 'black', name: 'Black', group: 'Natural', color: '#2d2522', mane: '#120e0c' },
  { id: 'grey', name: 'Grey', group: 'Natural', color: '#a7a39d', mane: '#5c5853' },
  { id: 'palomino', name: 'Palomino', group: 'Natural', color: '#dcae57', mane: '#f6ead0' },
  { id: 'white', name: 'White', group: 'Natural', color: '#ece5d8', mane: '#b9b0a2' },
  { id: 'dun', name: 'Dun', group: 'Natural', color: '#b58c5c', mane: '#3b2a1a' },
  { id: 'chocolate', name: 'Chocolate', group: 'Natural', color: '#6e3b2a', mane: '#e9e2d6' },
  // bright, very unnatural colours
  { id: 'hotpink', name: 'Hot pink', group: 'Bright', color: '#ff2e93', mane: '#a1005a' },
  { id: 'bubblegum', name: 'Bubblegum', group: 'Bright', color: '#ff8ad8', mane: '#ff2e93' },
  { id: 'red', name: 'Fire truck', group: 'Bright', color: '#e8202a', mane: '#7a0008' },
  { id: 'orange', name: 'Neon orange', group: 'Bright', color: '#ff7a00', mane: '#ffd400' },
  { id: 'sunshine', name: 'Sunshine', group: 'Bright', color: '#ffd400', mane: '#ff7a00' },
  { id: 'lime', name: 'Lime', group: 'Bright', color: '#9cff1a', mane: '#1f9a48' },
  { id: 'mint', name: 'Mint', group: 'Bright', color: '#5fffc0', mane: '#00a07a' },
  { id: 'teal', name: 'Teal', group: 'Bright', color: '#00c2c7', mane: '#00616a' },
  { id: 'blue', name: 'Electric blue', group: 'Bright', color: '#1f6bff', mane: '#59c7ff' },
  { id: 'sky', name: 'Sky', group: 'Bright', color: '#59c7ff', mane: '#ffffff' },
  { id: 'purple', name: 'Royal purple', group: 'Bright', color: '#7a2cff', mane: '#ffd400' },
  { id: 'lavender', name: 'Lavender', group: 'Bright', color: '#c49bff', mane: '#7a2cff' },
  // crazy patterns
  { id: 'zebra', name: 'Zebra', group: 'Wild', color: '#f2f2f2', mane: '#111111', css: 'repeating-linear-gradient(60deg,#111 0 5px,#fff 5px 10px)' },
  { id: 'rainbow', name: 'Rainbow', group: 'Wild', color: '#ffcc00', mane: 'rainbow', css: 'linear-gradient(90deg,#ff3b30,#ff9500,#ffcc00,#34c759,#007aff,#5856d6,#af52de)' },
  { id: 'unicorn', name: 'Unicorn', group: 'Wild', color: '#ffc8e8', mane: 'rainbow', css: 'linear-gradient(135deg,#ffc8e8,#d8c4ff,#bff3ff,#c8ffd9)' },
  { id: 'dalmatian', name: 'Dalmatian', group: 'Wild', color: '#ffffff', mane: '#111111', css: 'radial-gradient(circle at 30% 30%,#111 3px,transparent 4px) 0 0/14px 14px,radial-gradient(circle at 75% 70%,#111 2px,transparent 3px) 0 0/14px 14px,#fff' },
  { id: 'leopard', name: 'Leopard', group: 'Wild', color: '#e0a84a', mane: '#4a2a0a', css: 'radial-gradient(circle,#2a1505 2px,#7a4a12 3px,transparent 4px) 0 0/12px 12px,#e0a84a' },
  { id: 'tiger', name: 'Tiger', group: 'Wild', color: '#ff8a00', mane: '#111111', css: 'repeating-linear-gradient(100deg,#111 0 3px,#ff8a00 3px 10px)' },
  { id: 'giraffe', name: 'Giraffe', group: 'Wild', color: '#f3d9a4', mane: '#6b3a12', css: 'radial-gradient(circle,#a0522d 4px,transparent 5px) 0 0/12px 12px,#f3d9a4' },
  { id: 'cow', name: 'Moo cow', group: 'Wild', color: '#ffffff', mane: '#111111', css: 'radial-gradient(circle at 30% 40%,#111 5px,transparent 6px) 0 0/22px 22px,#fff' },
  { id: 'galaxy', name: 'Galaxy', group: 'Wild', color: '#3b1670', mane: '#e0c8ff', css: 'radial-gradient(circle,#fff 1px,transparent 1.5px) 0 0/9px 9px,linear-gradient(135deg,#1a0b3d,#5b1d8f,#0b2a6b)' },
  { id: 'gold', name: 'Solid gold', group: 'Wild', color: '#e0a420', mane: '#fff1b0', css: 'linear-gradient(135deg,#a8741a,#ffe27a,#c99212,#fff1b0,#a8741a)' },
  { id: 'chrome', name: 'Chrome', group: 'Wild', color: '#c8ccd2', mane: '#ffffff', css: 'linear-gradient(135deg,#8a9099,#f5f7fa,#6b7280,#e5e7eb,#9ca3af)' },
  { id: 'fire', name: 'On fire', group: 'Wild', color: '#ff6a00', mane: 'fire', css: 'linear-gradient(0deg,#ff2a00,#ff8a00,#ffe14d)' },
  { id: 'candy', name: 'Candy cane', group: 'Wild', color: '#ffffff', mane: '#e8202a', css: 'repeating-linear-gradient(45deg,#e8202a 0 5px,#fff 5px 10px)' },
  { id: 'checker', name: 'Checkered', group: 'Wild', color: '#888888', mane: '#111111', css: 'conic-gradient(#111 25%,#fff 0 50%,#111 0 75%,#fff 0) 0 0/10px 10px' },
  { id: 'camo', name: 'Camo', group: 'Wild', color: '#7d8a4a', mane: '#3d4a23', css: 'radial-gradient(circle at 30% 30%,#3d4a23 5px,transparent 6px) 0 0/16px 16px,radial-gradient(circle at 70% 70%,#6b5a2e 4px,transparent 5px) 0 0/14px 14px,#7d8a4a' },
];
export const PALETTE_BY_ID = Object.fromEntries(PALETTE.map(p => [p.id, p]));
for (const p of PALETTE) if (!p.css) p.css = p.color;

// The natural coat each new horse starts with (index = the horse's `coat` number)
export const NATURAL = ['bay', 'chestnut', 'black', 'grey', 'palomino', 'white', 'dun', 'chocolate'];

export const HATS = [
  { id: 'helmet', name: 'Racing helmet', icon: '🏇' },
  { id: 'sombrero', name: 'Sombrero', icon: '🌮' },
  { id: 'cowboy', name: 'Cowboy hat', icon: '🤠' },
  { id: 'tophat', name: 'Top hat', icon: '🎩' },
  { id: 'crown', name: 'Crown', icon: '👑' },
  { id: 'viking', name: 'Viking helmet', icon: '⚔️' },
  { id: 'wizard', name: 'Wizard hat', icon: '🧙' },
  { id: 'chef', name: 'Chef hat', icon: '🍳' },
  { id: 'propeller', name: 'Propeller cap', icon: '🚁' },
  { id: 'party', name: 'Party hat', icon: '🥳' },
  { id: 'pirate', name: 'Pirate hat', icon: '🏴‍☠️' },
  { id: 'halo', name: 'Halo', icon: '😇' },
  { id: 'mohawk', name: 'Punk mohawk', icon: '🤘' },
  { id: 'cone', name: 'Traffic cone', icon: '🚧' },
  { id: 'astronaut', name: 'Space helmet', icon: '🪐' },
];

export const HORSE_GEAR = [
  { id: 'none', name: 'Nothing', icon: '✖️' },
  { id: 'jetpack', name: 'Jetpack', icon: '🚀' },
  { id: 'horn', name: 'Unicorn horn', icon: '🦄' },
  { id: 'wings', name: 'Angel wings', icon: '🕊️' },
  { id: 'cape', name: 'Superhero cape', icon: '🦸' },
  { id: 'shades', name: 'Sunglasses', icon: '😎' },
  { id: 'party', name: 'Party hat', icon: '🥳' },
  { id: 'crown', name: 'Crown', icon: '👑' },
  { id: 'tophat', name: 'Top hat', icon: '🎩' },
  { id: 'bowtie', name: 'Bow tie', icon: '🎀' },
  { id: 'flowers', name: 'Flower crown', icon: '🌸' },
  { id: 'devil', name: 'Devil horns', icon: '😈' },
];

export const RIDER_GEAR = [
  { id: 'none', name: 'Nothing', icon: '✖️' },
  { id: 'jetpack', name: 'Jetpack', icon: '🚀' },
  { id: 'cape', name: 'Cape', icon: '🦸' },
  { id: 'shades', name: 'Sunglasses', icon: '😎' },
  { id: 'mustache', name: 'Fancy mustache', icon: '🥸' },
  { id: 'balloon', name: 'Balloon', icon: '🎈' },
  { id: 'scarf', name: 'Long scarf', icon: '🧣' },
  { id: 'flag', name: 'Flag', icon: '🏁' },
  { id: 'wings', name: 'Wings', icon: '🕊️' },
];

const ids = list => new Set(list.map(x => x.id));
const COLOR_IDS = ids(PALETTE), HAT_IDS = ids(HATS), HG_IDS = ids(HORSE_GEAR), RG_IDS = ids(RIDER_GEAR);

/** A horse's look with every gap filled in. coatIdx is the natural coat it was dealt. */
export function resolveLook(look, coatIdx = 0) {
  const l = look || {};
  return {
    coat: COLOR_IDS.has(l.coat) ? l.coat : NATURAL[coatIdx % NATURAL.length],
    mane: l.mane === 'match' || COLOR_IDS.has(l.mane) ? l.mane : 'match',
    outfit: l.outfit === 'team' || COLOR_IDS.has(l.outfit) ? l.outfit : 'team',
    hat: HAT_IDS.has(l.hat) ? l.hat : 'helmet',
    hgear: HG_IDS.has(l.hgear) ? l.hgear : 'none',
    rgear: RG_IDS.has(l.rgear) ? l.rgear : 'none',
  };
}

/** Keep only known values (used by the host when someone sends a new look). */
export function cleanLook(look, coatIdx = 0) {
  return resolveLook(look && typeof look === 'object' ? look : {}, coatIdx);
}

/** A random, probably ridiculous look. */
export function randomLook(rand = Math.random) {
  const pick = list => list[Math.floor(rand() * list.length)].id;
  return {
    coat: pick(PALETTE), mane: rand() < 0.3 ? 'match' : pick(PALETTE), outfit: rand() < 0.2 ? 'team' : pick(PALETTE),
    hat: pick(HATS), hgear: pick(HORSE_GEAR), rgear: pick(RIDER_GEAR),
  };
}

/** True if the look differs from how the horse was dealt. */
export function isCustom(look, coatIdx = 0) {
  const a = resolveLook(look, coatIdx), b = resolveLook(null, coatIdx);
  return Object.keys(a).some(k => a[k] !== b[k]);
}
