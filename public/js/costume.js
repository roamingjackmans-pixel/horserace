// Drawing the customizations: a fill for every colour and pattern in looks.js, plus every hat and add-on.
// Everything is drawn in the horse's own coordinates (see drawHorse in render.js: nose at 0, ground at 0,
// facing right, about 112 wide and 90 tall), so it moves, flips and rears with the horse.
import { PALETTE_BY_ID } from './looks.js';

const TAU = Math.PI * 2;
const nowSec = () => (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;

// ---------------------------------------------------------------- fills
const TILE_RES = 2;            // tiles are drawn at 2x so patterns stay crisp on big horses
const tiles = {};
const patternCache = new WeakMap();

function tile(id) {
  if (tiles[id]) return tiles[id];
  const S = ['cow', 'camo', 'giraffe', 'galaxy'].includes(id) ? 40 : 24;
  const c = document.createElement('canvas');
  c.width = c.height = S * TILE_RES;
  const g = c.getContext('2d');
  g.scale(TILE_RES, TILE_RES);
  const fill = col => { g.fillStyle = col; g.fillRect(0, 0, S, S); };
  const blob = (x, y, rx, ry, rot, col) => {
    g.fillStyle = col;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, rot, 0, TAU); g.fill(); }
  };
  const stripes = (bg, fg, width, period, slant) => {
    fill(bg); g.fillStyle = fg;
    for (let k = -2 * S; k < 3 * S; k += period) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + width, 0); g.lineTo(k + width - slant, S); g.lineTo(k - slant, S); g.closePath(); g.fill();
    }
  };
  switch (id) {
    case 'zebra': stripes('#f6f6f6', '#141414', 6, 12, 12); break;
    case 'tiger':
      fill('#ff8a00');
      g.fillStyle = '#151515';
      for (const [x, w] of [[2, 3.5], [10, 2.5], [17, 4]]) {
        g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 3, S / 2, x, S); g.lineTo(x + w, S); g.quadraticCurveTo(x + w + 3, S / 2, x + w, 0); g.closePath(); g.fill();
      }
      break;
    case 'candy': stripes('#ffffff', '#e8202a', 6, 12, 24); break;
    case 'checker': fill('#ffffff'); g.fillStyle = '#141414'; g.fillRect(0, 0, S / 2, S / 2); g.fillRect(S / 2, S / 2, S / 2, S / 2); break;
    case 'dalmatian':
      fill('#ffffff');
      blob(5, 6, 3, 2.5, 0.4, '#141414'); blob(16, 4, 2, 1.8, 0, '#141414'); blob(13, 15, 3.4, 2.8, 1, '#141414'); blob(3, 19, 2, 2, 0, '#141414'); blob(21, 20, 1.6, 1.4, 0, '#141414');
      break;
    case 'leopard':
      fill('#e2a84a');
      for (const [x, y] of [[5, 6], [17, 9], [9, 18], [21, 21]]) {
        blob(x, y, 3.4, 2.8, 0.3, '#2a1505');
        blob(x, y, 2, 1.5, 0.3, '#b9762a');
      }
      break;
    case 'giraffe':
      fill('#f6e2b5');
      for (const [x, y, rx, ry] of [[9, 9, 7, 6], [28, 8, 8, 6], [18, 26, 8, 7], [36, 30, 5, 6], [3, 32, 5, 6]]) blob(x, y, rx, ry, 0.2, '#a5552a');
      break;
    case 'cow':
      fill('#ffffff');
      blob(10, 10, 8, 6, 0.6, '#141414'); blob(30, 26, 9, 6, -0.4, '#141414'); blob(32, 5, 3, 2.5, 0, '#141414'); blob(8, 32, 4, 3, 0, '#141414');
      break;
    case 'camo':
      fill('#7d8a4a');
      blob(8, 8, 8, 5, 0.5, '#3d4a23'); blob(28, 14, 9, 5, -0.3, '#5b4a2a'); blob(14, 28, 7, 6, 0.9, '#a3a061'); blob(33, 33, 6, 4, 0.2, '#3d4a23');
      break;
    case 'galaxy': {
      const gr = g.createLinearGradient(0, 0, S, S);
      gr.addColorStop(0, '#1a0b3d'); gr.addColorStop(0.5, '#5b1d8f'); gr.addColorStop(1, '#0b2a6b');
      fill(gr);
      blob(12, 28, 9, 5, 0.6, 'rgba(255,90,200,.35)'); blob(30, 10, 7, 4, -0.3, 'rgba(90,200,255,.35)');
      g.fillStyle = '#fff';
      for (const [x, y, r] of [[4, 5, 0.8], [15, 9, 0.5], [26, 3, 0.7], [35, 20, 0.9], [9, 18, 0.5], [22, 22, 1.1], [31, 33, 0.6], [5, 35, 0.8], [17, 37, 0.5]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      break;
    }
    default: fill('#888');
  }
  return (tiles[id] = c);
}

function pattern(ctx, id, scale) {
  let cache = patternCache.get(ctx);
  if (!cache) patternCache.set(ctx, (cache = {}));
  const key = id + ':' + scale;
  if (!cache[key]) {
    const p = ctx.createPattern(tile(id), 'repeat');
    if (p && p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(scale / TILE_RES));
    cache[key] = p || '#888';
  }
  return cache[key];
}

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00b7ff', '#5856d6', '#af52de'];

/**
 * The fill/stroke style for a palette colour or pattern. box = the area it covers (for gradients),
 * scale = how big the pattern repeats are (smaller for the rider).
 */
export function paint(ctx, id, box, scale = 1) {
  const p = PALETTE_BY_ID[id];
  if (!p) return id && id[0] === '#' ? id : '#888';
  if (p.group !== 'Wild') return p.color;
  const { x0, y0, x1, y1 } = box;
  switch (id) {
    case 'rainbow': return grad(ctx, x0, y0, x1, y0, RAINBOW);
    case 'unicorn': return grad(ctx, x0, y0, x1, y1, ['#ffb8e0', '#d8c4ff', '#b5ecff', '#c8ffd9', '#fff3b0']);
    case 'fire': return grad(ctx, 0, y1, 0, y0, ['#c81400', '#ff5a00', '#ff9a00', '#ffe14d']);
    case 'gold': return grad(ctx, x0, y0, x1, y1, ['#a8741a', '#ffe27a', '#c99212', '#fff1b0', '#b8841a', '#ffe27a']);
    case 'chrome': return grad(ctx, x0, y0, x1, y1, ['#7d848e', '#f5f7fa', '#6b7280', '#e5e7eb', '#8f97a3', '#ffffff']);
    default: return pattern(ctx, id, scale);
  }
}

/** Main colour of a palette entry (for shading). */
export const baseColor = id => (PALETTE_BY_ID[id] ? PALETTE_BY_ID[id].color : id && id[0] === '#' ? id : '#888888');
/** True for plain colours (which can simply be shaded darker). */
export const isPlain = id => !PALETTE_BY_ID[id] || PALETTE_BY_ID[id].group !== 'Wild';

/** Mane and tail style: 'match' goes with the coat. */
export function maneStyle(ctx, maneId, coatId, box) {
  if (maneId === 'match') {
    const m = PALETTE_BY_ID[coatId] ? PALETTE_BY_ID[coatId].mane : '#2a1810';
    return m[0] === '#' ? m : paint(ctx, m, box);
  }
  return paint(ctx, maneId, box);
}

// ---------------------------------------------------------------- little helpers
function flame(ctx, x, y, dx, dy, len, t) {
  // a flickering rocket flame pointing along (dx, dy)
  const L = len * (0.8 + 0.25 * Math.sin(t * 31) + 0.1 * Math.sin(t * 53));
  const nx = -dy, ny = dx;
  const g = ctx.createLinearGradient(x, y, x + dx * L, y + dy * L);
  g.addColorStop(0, '#fff7c2'); g.addColorStop(0.35, '#ffcc00'); g.addColorStop(0.7, '#ff5a00'); g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + nx * 3.2, y + ny * 3.2);
  ctx.quadraticCurveTo(x + dx * L * 0.5 + nx * 4, y + dy * L * 0.5 + ny * 4, x + dx * L, y + dy * L);
  ctx.quadraticCurveTo(x + dx * L * 0.5 - nx * 4, y + dy * L * 0.5 - ny * 4, x - nx * 3.2, y - ny * 3.2);
  ctx.closePath(); ctx.fill();
}

function star(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

function wing(ctx, x, y, size, flap, col, edge) {
  // a feathery wing attached at (x, y), sweeping up and back
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.15 + flap); ctx.scale(size, size);
  ctx.fillStyle = col; ctx.strokeStyle = edge; ctx.lineWidth = 1 / size;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, -26, -34, -40);
  ctx.quadraticCurveTo(-30, -30, -36, -26);
  ctx.quadraticCurveTo(-28, -20, -33, -14);
  ctx.quadraticCurveTo(-24, -10, -27, -4);
  ctx.quadraticCurveTo(-16, -2, -16, 4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-24, -24); ctx.moveTo(-8, -2); ctx.lineTo(-22, -12); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- horse add-ons
/**
 * layer: 'behind' (before the body), 'back' (on its back, before the rider), 'head' (inside the head group)
 */
export function drawHorseGear(ctx, id, layer, coatBase) {
  if (!id || id === 'none') return;
  const t = nowSec();
  if (id === 'cape' && layer === 'behind') {
    const w = Math.sin(t * 6) * 3, w2 = Math.sin(t * 6 + 1.3) * 3;
    ctx.fillStyle = '#d8312c'; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-44, -66);
    ctx.quadraticCurveTo(-78, -76 + w, -110, -62 + w2);
    ctx.lineTo(-104, -40 + w);
    ctx.quadraticCurveTo(-80, -52 + w2, -50, -56);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (id === 'wings') {
    const flap = Math.sin(t * 5) * 0.25;
    if (layer === 'behind') wing(ctx, -58, -60, 1.25, flap - 0.1, '#e6e1f2', '#a99fc4');
    if (layer === 'back') wing(ctx, -62, -58, 1.3, flap, '#ffffff', '#b9b0d6');
  }
  if (id === 'jetpack' && layer === 'back') {
    // a rocket strapped along its back, flames out of the back end
    flame(ctx, -98, -73, -1, 0.15, 22, t);
    const g = grad(ctx, 0, -79, 0, -67, ['#f5f7fa', '#9ca3af', '#e5e7eb']);
    ctx.fillStyle = g; ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-97, -79); ctx.lineTo(-76, -79); ctx.quadraticCurveTo(-68, -73, -76, -67); ctx.lineTo(-97, -67); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8202a';
    ctx.beginPath(); ctx.moveTo(-97, -79); ctx.lineTo(-103, -85); ctx.lineTo(-92, -79); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-97, -67); ctx.lineTo(-103, -61); ctx.lineTo(-92, -67); ctx.closePath(); ctx.fill();
    ctx.fillRect(-82, -79, 3, 12);
    ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-90, -67); ctx.lineTo(-88, -60); ctx.moveTo(-80, -67); ctx.lineTo(-78, -60); ctx.stroke();
  }
  if (layer !== 'head') return;
  switch (id) {
    case 'horn': {
      const g = grad(ctx, -12, -76, -3, -98, ['#fff6d6', '#ffd54a', '#ffffff', '#ffb8e0']);
      ctx.fillStyle = g; ctx.strokeStyle = '#c99212'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-16, -77); ctx.lineTo(-2, -99); ctx.lineTo(-9, -75); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (let k = 1; k < 4; k++) { const f = k / 4.2; ctx.moveTo(-16 + 14 * f - 1.5, -77 - 22 * f + 1); ctx.lineTo(-9 + 7 * f + 1, -75 - 24 * f - 1); } ctx.stroke();
      star(ctx, -1, -101, 2.5 + Math.sin(t * 6), '#fff6b0');
      break;
    }
    case 'party': {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-25, -79); ctx.lineTo(-14, -98); ctx.lineTo(-12, -77); ctx.closePath();
      ctx.fillStyle = '#ff2e93'; ctx.fill(); ctx.clip();
      ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2.4;
      for (let k = -100; k < -70; k += 6) { ctx.beginPath(); ctx.moveTo(-30, k); ctx.lineTo(-8, k + 10); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#5fffc0'; ctx.beginPath(); ctx.arc(-14, -99, 2.6, 0, TAU); ctx.fill();
      break;
    }
    case 'crown': drawCrown(ctx, -18, -79, 1.1, -0.15); break;
    case 'tophat':
      ctx.save(); ctx.translate(-17, -79); ctx.rotate(-0.15);
      ctx.fillStyle = '#1d1d22'; ctx.fillRect(-10, -1.5, 20, 3); ctx.fillRect(-6.5, -16, 13, 15);
      ctx.fillStyle = '#7a2cff'; ctx.fillRect(-6.5, -5, 13, 3);
      ctx.restore();
      break;
    case 'shades':
      ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(-14.5, -70, 5.4, 3.6, 0.45, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-19, -72); ctx.lineTo(-25, -76); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-16, -71.5, 1.6, 0.8, 0.45, 0, TAU); ctx.fill();
      break;
    case 'flowers': {
      const spots = [[-27, -79, '#ff8ad8'], [-21, -82, '#ffd400'], [-15, -81, '#59c7ff'], [-9.5, -78, '#ffffff']];
      for (const [fx, fy, c] of spots) {
        ctx.fillStyle = '#1f9a48'; ctx.beginPath(); ctx.ellipse(fx - 2.5, fy + 1.5, 2, 1, 0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = c;
        for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 1.8, fy + Math.sin(a) * 1.8, 1.5, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#ff9500'; ctx.beginPath(); ctx.arc(fx, fy, 1.1, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'devil':
      ctx.fillStyle = '#d8312c'; ctx.strokeStyle = '#7a0008'; ctx.lineWidth = 0.8;
      for (const [bx, lean] of [[-23, -1], [-14, 1]]) {
        ctx.beginPath(); ctx.moveTo(bx - 2.5, -79); ctx.quadraticCurveTo(bx - 1 + lean, -86, bx + lean * 3, -91); ctx.quadraticCurveTo(bx + 1 + lean, -85, bx + 2.5, -78.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    case 'bowtie':
      ctx.save(); ctx.translate(-23, -49); ctx.rotate(0.95);
      ctx.fillStyle = '#e8202a';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, -4.5); ctx.lineTo(-7, 4.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, -4.5); ctx.lineTo(7, 4.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; for (const [dx, dy] of [[-4.5, -1], [4.5, 1], [-5, 2], [5, -2]]) { ctx.beginPath(); ctx.arc(dx, dy, 0.7, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#a3000c'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, TAU); ctx.fill();
      ctx.restore();
      break;
  }
}

function drawCrown(ctx, x, y, size, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size, size);
  ctx.fillStyle = grad(ctx, -7, 0, 7, -9, ['#c99212', '#ffe27a', '#e0a420']);
  ctx.strokeStyle = '#8a5a08'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-7, -8); ctx.lineTo(-3.5, -4); ctx.lineTo(0, -9.5); ctx.lineTo(3.5, -4); ctx.lineTo(7, -8); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8202a'; ctx.beginPath(); ctx.arc(0, -2.5, 1.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a5bd7'; ctx.beginPath(); ctx.arc(-4, -2, 0.9, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(4, -2, 0.9, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the rider
/** Rider add-ons drawn behind the rider: jetpack, cape, wings, balloon, flag. */
export function drawRiderBehind(ctx, id, L) {
  const t = nowSec();
  switch (id) {
    case 'jetpack': {
      flame(ctx, -69, -66 + L, -0.35, 1, 12, t);
      flame(ctx, -63, -64 + L, -0.35, 1, 12, t + 0.3);
      ctx.fillStyle = grad(ctx, -73, 0, -60, 0, ['#9ca3af', '#f5f7fa', '#9ca3af']);
      ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 0.8;
      roundRect(ctx, -73, -86 + L, 6, 19, 2.5); ctx.fill(); ctx.stroke();
      roundRect(ctx, -67, -85 + L, 6, 19, 2.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8202a'; ctx.fillRect(-73, -86 + L, 6, 3); ctx.fillRect(-67, -85 + L, 6, 3);
      break;
    }
    case 'cape': {
      const w = Math.sin(t * 7) * 2.5;
      ctx.fillStyle = '#7a2cff'; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-58, -82 + L); ctx.quadraticCurveTo(-74, -80 + L + w, -88, -70 + L + w); ctx.lineTo(-84, -60 + L - w); ctx.quadraticCurveTo(-72, -66 + L, -62, -64 + L); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'wings': wing(ctx, -60, -76 + L, 0.62, Math.sin(t * 7) * 0.3, '#ffffff', '#b9b0d6'); break;
    case 'balloon': {
      const bob = Math.sin(t * 2) * 2;
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-60, -74 + L); ctx.quadraticCurveTo(-70, -96 + L, -72, -112 + L + bob); ctx.stroke();
      ctx.fillStyle = '#ff2e93'; ctx.beginPath(); ctx.ellipse(-72, -119 + L + bob, 6, 7.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-72, -111.5 + L + bob); ctx.lineTo(-74, -109 + L + bob); ctx.lineTo(-70, -109 + L + bob); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-74, -122 + L + bob, 1.6, 2.4, 0.4, 0, TAU); ctx.fill();
      break;
    }
    case 'flag': {
      const w = Math.sin(t * 8) * 2;
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-64, -70 + L); ctx.lineTo(-72, -112 + L); ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-72, -112 + L); ctx.quadraticCurveTo(-82, -114 + L + w, -92, -110 + L); ctx.lineTo(-90, -100 + L - w); ctx.quadraticCurveTo(-80, -104 + L + w, -70.5, -102 + L); ctx.closePath();
      ctx.clip();
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(-93 + i * 4, -116 + L + j * 4.5, 4, 4.5); }
      ctx.restore();
      break;
    }
  }
}

/** Rider add-ons drawn over the rider: scarf, sunglasses, mustache. */
export function drawRiderFront(ctx, id, hx, hy) {
  const t = nowSec();
  switch (id) {
    case 'scarf': {
      const cols = ['#e8202a', '#ffffff', '#1f9a48', '#ffffff'];
      for (let k = 0; k < 7; k++) {
        const w = Math.sin(t * 9 - k * 0.8) * 2;
        ctx.fillStyle = cols[k % cols.length];
        ctx.beginPath(); ctx.ellipse(hx - 3 - k * 4.2, hy + 7 + k * 0.6 + w * (k / 6), 2.6, 1.9, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#e8202a'; roundRect(ctx, hx - 4, hy + 5.5, 8, 3, 1.2); ctx.fill();
      break;
    }
    case 'shades':
      ctx.fillStyle = '#111'; roundRect(ctx, hx + 1.5, hy + 0.6, 6.8, 2.6, 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(hx + 3, hy + 1.1, 1.4, 0.7);
      break;
    case 'mustache':
      ctx.fillStyle = '#3b2418';
      ctx.beginPath(); ctx.ellipse(hx + 5, hy + 4.6, 2.6, 1.1, 0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx + 7.4, hy + 4.2, 2, 0.9, -0.5, 0, TAU); ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = '#3b2418';
      ctx.beginPath(); ctx.arc(hx + 9.6, hy + 2.8, 1.4, Math.PI * 0.5, Math.PI * 1.6, true); ctx.stroke();
      break;
  }
}

/** The rider's headwear. (hx, hy) is the middle of where a helmet would sit. capColor = the lane's cap colour. */
export function drawHat(ctx, id, hx, hy, capColor) {
  // silly hats are drawn a bit bigger than life so you can tell them apart at race size
  if (id && id !== 'helmet') {
    ctx.save();
    ctx.translate(hx, hy + 2); ctx.scale(1.2, 1.2); ctx.translate(-hx, -hy - 2);
    drawHatInner(ctx, id, hx, hy, capColor);
    ctx.restore();
    return;
  }
  drawHatInner(ctx, id, hx, hy, capColor);
}

function drawHatInner(ctx, id, hx, hy, capColor) {
  const t = nowSec();
  const helmet = () => {
    ctx.fillStyle = capColor;
    ctx.beginPath(); ctx.arc(hx, hy, 5.6, Math.PI, 0); ctx.fill();
    ctx.fillRect(hx, hy - 1.2, 8.5, 2.4);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hx, hy, 5.6, Math.PI, 0); ctx.stroke();
  };
  switch (id) {
    case 'sombrero': {
      ctx.fillStyle = '#e8b84a';
      ctx.beginPath(); ctx.moveTo(hx - 5, hy + 0.5); ctx.quadraticCurveTo(hx - 4, hy - 11, hx + 1, hy - 11); ctx.quadraticCurveTo(hx + 6, hy - 11, hx + 6, hy + 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8202a'; ctx.fillRect(hx - 5.2, hy - 3.2, 11.4, 2.4);
      ctx.fillStyle = '#1f9a48'; for (let k = 0; k < 4; k++) ctx.fillRect(hx - 4 + k * 3, hy - 2.6, 1.2, 1.2);
      ctx.fillStyle = '#f2c95a'; ctx.strokeStyle = '#a8741a'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(hx + 0.5, hy + 1, 15, 2.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8202a'; for (let k = -12; k <= 12; k += 4) { ctx.beginPath(); ctx.arc(hx + 0.5 + k, hy + 1.4, 0.8, 0, TAU); ctx.fill(); }
      break;
    }
    case 'cowboy':
      ctx.fillStyle = '#8b5a2b';
      roundRect(ctx, hx - 5, hy - 9, 11, 9.5, 3); ctx.fill();
      ctx.fillStyle = '#5a3418'; ctx.fillRect(hx - 5, hy - 2.5, 11, 2);
      ctx.fillStyle = '#9c6a36';
      ctx.beginPath(); ctx.moveTo(hx - 12, hy - 2); ctx.quadraticCurveTo(hx + 0.5, hy + 4, hx + 13, hy - 2); ctx.quadraticCurveTo(hx + 0.5, hy + 1, hx - 12, hy - 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(hx + 0.5, hy - 9); ctx.lineTo(hx + 0.5, hy - 6); ctx.stroke();
      break;
    case 'tophat':
      ctx.fillStyle = '#1d1d22'; ctx.fillRect(hx - 7.5, hy - 0.8, 16, 2.4); ctx.fillRect(hx - 5, hy - 14, 11, 13.5);
      ctx.fillStyle = '#e8202a'; ctx.fillRect(hx - 5, hy - 4.2, 11, 2.2);
      break;
    case 'crown': helmet(); drawCrown(ctx, hx + 0.5, hy - 4, 0.8, 0); break;
    case 'viking': {
      ctx.fillStyle = '#f4f1ea'; ctx.strokeStyle = '#a99f8c'; ctx.lineWidth = 0.7;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(hx + s * 4, hy - 2); ctx.quadraticCurveTo(hx + s * 11, hy - 4, hx + s * 10, hy - 13); ctx.quadraticCurveTo(hx + s * 8, hy - 6, hx + s * 3, hy - 4.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(hx, hy, 6, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6b7280'; ctx.fillRect(hx - 6, hy - 1.2, 12, 2); ctx.fillRect(hx - 0.8, hy - 6, 1.6, 6);
      break;
    }
    case 'wizard':
      ctx.fillStyle = '#4b1d8f';
      ctx.beginPath(); ctx.moveTo(hx - 6.5, hy); ctx.quadraticCurveTo(hx - 3, hy - 10, hx - 7, hy - 20); ctx.quadraticCurveTo(hx + 1, hy - 12, hx + 6.5, hy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx, hy + 0.3, 10, 2.2, 0, 0, TAU); ctx.fill();
      star(ctx, hx - 1.5, hy - 7, 2, '#ffd400'); star(ctx, hx + 2.5, hy - 2.5, 1.3, '#ffd400'); star(ctx, hx - 5.5, hy - 15, 1.4, '#ffffff');
      break;
    case 'chef':
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 0.7;
      for (const [dx, dy, r] of [[-4, -8, 4], [4, -8, 4], [0, -11, 4.6]]) { ctx.beginPath(); ctx.arc(hx + dx, hy + dy, r, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillRect(hx - 5.5, hy - 6, 11, 6.5); ctx.strokeRect(hx - 5.5, hy - 1.5, 11, 2);
      break;
    case 'propeller': {
      const cols = ['#e8202a', '#ffd400', '#2a5bd7', '#1f9a48'];
      for (let k = 0; k < 4; k++) { ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.arc(hx, hy, 5.8, Math.PI + (k * Math.PI) / 4, Math.PI + ((k + 1) * Math.PI) / 4); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#333'; ctx.fillRect(hx - 0.6, hy - 8.5, 1.2, 3);
      const spin = Math.cos(t * 30);
      ctx.fillStyle = '#e8202a'; ctx.beginPath(); ctx.ellipse(hx + spin * 3.5, hy - 8.8, Math.abs(spin) * 4 + 0.6, 1.1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a5bd7'; ctx.beginPath(); ctx.ellipse(hx - spin * 3.5, hy - 8.8, Math.abs(spin) * 4 + 0.6, 1.1, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'party':
      ctx.save();
      ctx.beginPath(); ctx.moveTo(hx - 5, hy + 0.5); ctx.lineTo(hx - 1, hy - 15); ctx.lineTo(hx + 5, hy + 0.5); ctx.closePath();
      ctx.fillStyle = '#2a5bd7'; ctx.fill(); ctx.clip();
      ctx.fillStyle = '#ffd400'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(hx - 2 + (k % 2) * 3, hy - 2 - k * 3.4, 1, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#ff2e93'; ctx.beginPath(); ctx.arc(hx - 1, hy - 15.5, 2, 0, TAU); ctx.fill();
      break;
    case 'pirate':
      ctx.fillStyle = '#1d1d22'; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(hx - 10, hy + 0.5); ctx.quadraticCurveTo(hx, hy - 15, hx + 10, hy + 0.5); ctx.quadraticCurveTo(hx, hy - 4, hx - 10, hy + 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx, hy - 5.5, 1.8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(hx - 2.5, hy - 2.5); ctx.lineTo(hx + 2.5, hy - 4.5); ctx.moveTo(hx + 2.5, hy - 2.5); ctx.lineTo(hx - 2.5, hy - 4.5); ctx.stroke();
      break;
    case 'halo':
      helmet();
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1.6; ctx.shadowColor = '#fff3a0'; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.ellipse(hx + 0.5, hy - 9 + Math.sin(t * 3) * 0.6, 6, 1.7, 0, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    case 'mohawk': {
      const cols = ['#ff2e93', '#ffd400', '#9cff1a', '#00c2c7', '#7a2cff'];
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = cols[k];
        const bx = hx - 4.5 + k * 2.2;
        ctx.beginPath(); ctx.moveTo(bx - 1.3, hy - 2); ctx.lineTo(bx - 2 - (4 - k) * 0.6, hy - 11 + Math.abs(k - 2) * 1.5); ctx.lineTo(bx + 1.3, hy - 2); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'cone':
      ctx.fillStyle = '#ff7a00';
      ctx.beginPath(); ctx.moveTo(hx - 6, hy + 0.5); ctx.lineTo(hx - 0.5, hy - 15); ctx.lineTo(hx + 5, hy + 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - 3.6, hy - 6.5, 6.4, 1.8); ctx.fillRect(hx - 2.3, hy - 10.5, 3.8, 1.4);
      ctx.fillStyle = '#c45500'; ctx.fillRect(hx - 7.5, hy - 0.5, 14, 2);
      break;
    case 'astronaut':
      helmet();
      ctx.fillStyle = 'rgba(180,225,255,.28)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(hx + 1.5, hy + 1.5, 9, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hx + 1.5, hy + 1.5, 6.5, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(hx - 6, hy + 8.5, 15, 2.2);
      break;
    default: helmet();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
