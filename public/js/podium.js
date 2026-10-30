// The celebration after a race: the winner reared up on a podium holding a trophy and cheering,
// everyone else standing sadly at the bottom. Pure canvas, like the rest of the art.
import { SILKS } from './engine.js';
import { drawHorse, roundRect } from './render.js';

const TAU = Math.PI * 2;
const CROWD = ['#e8452c', '#ffd23f', '#2a5bd7', '#ffffff', '#1f9a48', '#ff7eb6', '#8a5cf6', '#ff9b3d', '#3fd0ff'];
const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; };
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = x => 1 - (1 - clamp01(x)) ** 3;
function bounceOut(x) {
  x = clamp01(x);
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
}

/**
 * draw(t, horses, order): t is seconds since the scene started (the entrance plays in the first second),
 * horses are the race's horses, order is the finishing order with the winner first.
 */
export class PodiumView {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.confetti = [];
    this.lastT = null;
    this.burst = false;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = this.c.parentElement.clientWidth;
    const H = Math.round(Math.max(240, Math.min(340, W * 0.48)));
    if (this.W !== W || this.H !== H || this.dpr !== dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr);
      this.c.style.height = H + 'px';
    }
  }

  draw(t, horses, order) {
    this.resize();
    const { ctx, W, H, still } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const dt = this.lastT == null ? 0 : Math.max(0, Math.min(0.05, t - this.lastT));
    this.lastT = t;
    const winner = order[0], losers = order.slice(1);
    const groundY = H - 26;               // where the horses stand
    const fieldTop = H * 0.5;             // the grass starts here
    const cx = W / 2;

    // ---- evening sky and stars
    const sky = ctx.createLinearGradient(0, 0, 0, fieldTop);
    sky.addColorStop(0, '#121a42'); sky.addColorStop(0.65, '#3b2a70'); sky.addColorStop(1, '#7a4596');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 46; k++) {
      const h = hash(k * 977 + 3);
      const tw = still ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + k));
      ctx.fillStyle = `rgba(255,255,255,${0.55 * tw})`;
      ctx.fillRect(h % W, (h >>> 9) % Math.max(1, Math.round(H * 0.28)), 1.6, 1.6);
    }
    // ---- grandstand with a cheering crowd (kept dim so the horses stand out)
    const standTop = H * 0.27;
    ctx.fillStyle = '#1b2130'; ctx.fillRect(0, standTop - 6, W, 6);
    ctx.fillStyle = '#232a3b'; ctx.fillRect(0, standTop, W, fieldTop - standTop);
    const rows = Math.max(2, Math.floor((fieldTop - standTop - 6) / 8));
    ctx.globalAlpha = 0.6;
    for (let i = 0; i * 9 < W + 9; i++) {
      for (let r = 0; r < rows; r++) {
        const h = hash(i * 31 + r * 7919);
        const jump = still ? 0 : Math.max(0, Math.sin(t * 8 + (h % 29))) * 2.5;
        ctx.fillStyle = CROWD[h % CROWD.length];
        ctx.beginPath(); ctx.arc(i * 9 + (r % 2) * 4.5, standTop + 6 + r * 8 - jump, 2.3, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // ---- grass and rail
    ctx.fillStyle = '#3f9a3a'; ctx.fillRect(0, fieldTop, W, H - fieldTop);
    ctx.fillStyle = '#48a842';
    for (let x = 0; x < W; x += 60) ctx.fillRect(x, fieldTop, 30, H - fieldTop);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, fieldTop - 2, W, 3);
    for (let x = 6; x < W; x += 22) ctx.fillRect(x, fieldTop - 8, 2, 8);

    // ---- sizes: the losers fill both sides of the podium, the winner is a bit bigger up top
    const pw = Math.max(84, Math.min(150, W * 0.2));
    const ph = Math.max(52, Math.min(88, H * 0.26));
    const perSide = Math.max(1, Math.ceil(losers.length / 2));
    const hs = Math.max(0.3, Math.min(0.8, (H * 0.3) / 92, ((W - pw) / 2 - 14) / (perSide * 104 + 12)));
    const podTop = groundY - ph;
    const ws = Math.max(0.35, Math.min(hs * 1.5, 1.1, (podTop - 48) / 132));   // leaves room for the title at the top

    // ---- spotlights on the podium
    const sway = still ? 0 : Math.sin(t * 0.9) * 22;
    for (const side of [-1, 1]) {
      const sx = cx + side * W * 0.44, tx = cx - side * sway * 0.6;
      const g = ctx.createLinearGradient(sx, 0, tx, podTop);
      g.addColorStop(0, 'rgba(255,244,200,.28)'); g.addColorStop(1, 'rgba(255,244,200,.06)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(sx - 7, 0); ctx.lineTo(sx + 7, 0); ctx.lineTo(tx + pw * 0.55, podTop + 6); ctx.lineTo(tx - pw * 0.55, podTop + 6); ctx.closePath(); ctx.fill();
    }

    // ---- the losers, at the bottom, facing the podium and very sad about it
    const fadeIn = clamp01(t / 0.45);
    losers.forEach((h, j) => {
      const left = j % 2 === 0, k = Math.floor(j / 2);
      const nose = left ? cx - pw / 2 - 6 - k * 104 * hs : cx + pw / 2 + 6 + k * 104 * hs;
      const sigh = still ? 0 : Math.sin(t * 1.4 + j * 1.7) * 1.2;
      const horse = horses[h];
      ctx.globalAlpha = fadeIn;
      drawHorse(ctx, nose, groundY + sigh, hs, h, horse ? horse.coat : h, 0, 0,
        { flip: !left, mood: 'sad', tear: still ? null : (t * 0.5 + j * 0.31) % 1, look: horse && horse.look });
      // finishing place under it
      const bx = left ? nose - 56 * hs : nose + 56 * hs;
      const label = `${ordinal(j + 2)} · #${h + 1}`;
      ctx.font = `700 ${Math.round(Math.max(10, Math.min(13, hs * 17)))}px Fredoka, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = SILKS[h].bg; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
      roundRect(ctx, bx - tw / 2, groundY + 5, tw, 16, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = SILKS[h].fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, bx, groundY + 13.5);
      ctx.globalAlpha = 1;
    });

    // ---- the podium rises out of the ground
    const rise = easeOut((t - 0.05) / 0.5);
    const top = groundY - ph * rise;
    if (rise > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - pw / 2 - 4, top - 2, pw + 8, groundY - top + 6); ctx.clip();
      const g = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0);
      g.addColorStop(0, '#d79a17'); g.addColorStop(0.45, '#ffd54a'); g.addColorStop(1, '#c58610');
      ctx.fillStyle = g;
      roundRect(ctx, cx - pw / 2, top, pw, ph + 4, 6); ctx.fill();
      ctx.fillStyle = '#fff1b0'; ctx.fillRect(cx - pw / 2 + 3, top + 2, pw - 6, 5);   // lit top edge
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(cx - pw / 2, top + ph * 0.86, pw, ph * 0.2);
      ctx.font = `700 ${Math.round(ph * 0.62)}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(120,70,0,.45)'; ctx.fillText('1', cx + 2, top + ph * 0.55 + 2);
      ctx.fillStyle = '#fffbe6'; ctx.fillText('1', cx, top + ph * 0.55);
      ctx.restore();
    }

    // ---- the winner drops onto the podium, rears up with the trophy and cheers
    const drop = clamp01((t - 0.45) / 0.55);
    if (drop > 0) {
      const fall = (1 - bounceOut(drop)) * (podTop + 40);
      const cheerUnits = still || t < 1 ? 0 : Math.abs(Math.sin((t - 1) * 5)) * 9;   // little jumps for joy
      const cheer = cheerUnits * ws;
      const horse = horses[winner];
      // a rearing horse pivots on its hind hooves, 84 units behind the nose: this centres it over the podium
      const nose = cx + 92 * ws;
      drawHorse(ctx, nose, podTop - fall, ws, winner, horse ? horse.coat : winner, t * 3.2, 0,
        { pose: 'rear', mood: 'happy', trophy: drop >= 1, lift: cheerUnits, look: horse && horse.look });
      // sparkles around the trophy
      if (drop >= 1) {
        const sx = nose - 60 * ws, sy = podTop - cheer - 110 * ws;   // where the trophy is
        for (let k = 0; k < 6; k++) {
          const a = t * 1.8 + (k * TAU) / 6, r = (26 + 6 * Math.sin(t * 4 + k)) * ws;
          star(ctx, sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.7, (3 + 2 * Math.abs(Math.sin(t * 5 + k))) * Math.max(0.7, ws), '#fff6b0');
        }
      }
    }

    // ---- confetti: a burst when the winner lands, then a steady sprinkle
    if (t >= 1 && !this.burst) {
      this.burst = true;
      const n = still ? 40 : 160;
      for (let k = 0; k < n; k++) this.confetti.push(piece(cx + (Math.random() - 0.5) * 60, podTop - 60 * ws, true));
    }
    if (!still && t >= 1 && this.confetti.length < 260) {
      for (let k = 0; k < Math.round(dt * 40); k++) this.confetti.push(piece(Math.random() * W, -8, false));
    }
    this.confetti = this.confetti.filter(p => p.y < H + 10 && (p.life -= dt) > 0);
    for (const p of this.confetti) {
      p.vy += (p.burst ? 260 : 40) * dt;
      if (p.vy > 90) p.vy = 90;          // paper flutters down slowly
      p.vx *= 0.99;
      p.x += (p.vx + Math.sin(t * 3 + p.w) * 18) * dt; p.y += p.vy * dt; p.r += dt * p.spin;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    }
  }
}

function piece(x, y, burst) {
  return {
    x, y, burst,
    vx: burst ? (Math.random() - 0.5) * 320 : (Math.random() - 0.5) * 20,
    vy: burst ? -Math.random() * 300 - 80 : 20 + Math.random() * 40,
    r: Math.random() * TAU, spin: (Math.random() - 0.5) * 10, w: Math.random() * TAU,
    c: CROWD[Math.floor(Math.random() * CROWD.length)], life: 9,
  };
}

function star(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, rr = k % 2 ? r * 0.38 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}
