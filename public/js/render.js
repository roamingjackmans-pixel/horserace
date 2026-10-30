// Drawing: the cartoon horses and the race track. Pure canvas, no images.
import { GATES, PAUSE, BOOST_AT, BOOST_LEN, SETBACK_AT, SETBACK_LEN, positionsAt, eventAt, gatesClearedAt } from './sim.js';
import { SILKS, COATS } from './engine.js';

const TAU = Math.PI * 2;

function shade(hex, k) {
  // k < 0 darkens, k > 0 lightens
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = k < 0 ? 0 : 255, p = Math.abs(k);
  r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
  return `rgb(${r},${g},${b})`;
}

function limb(ctx, x, y, a1, a2, l1, l2, w1, w2, color, hoof) {
  const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
  const fx = kx + Math.sin(a1 + a2) * l2, fy = ky + Math.cos(a1 + a2) * l2;
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.lineWidth = w1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.stroke();
  ctx.lineWidth = w2; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  ctx.fillStyle = hoof;
  ctx.beginPath(); ctx.arc(fx, fy, w2 * 0.62, 0, TAU); ctx.fill();
}

/**
 * A side-on cartoon racehorse with jockey, facing right.
 * (x, y) is the tip of the nose at ground level; the horse is about 112*s wide and 86*s tall.
 * phase: gallop cycle (radians); run: 0 = standing still, 1 = full gallop
 */
export function drawHorse(ctx, x, y, s, lane, coatIdx, phase = 0, run = 0, opts = {}) {
  const silk = SILKS[lane % SILKS.length];
  const [coat, mane] = COATS[coatIdx % COATS.length];
  const far = shade(coat, -0.28);
  const hoof = '#2a2320';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const bob = run ? -Math.abs(Math.sin(phase)) * 3.2 * run : 0;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(-58, 1, 44, 4.5, 0, 0, TAU); ctx.fill();
  ctx.translate(0, bob);
  const swing = (o, amp) => Math.sin(phase + o) * amp * run;
  const bend = (o, amp) => Math.max(0, Math.sin(phase + o + 1.3)) * amp * run;
  // far legs
  limb(ctx, -44, -38, swing(0.6, 0.75), -bend(0.6, 1.1), 17, 18, 6.5, 4.6, far, hoof);
  limb(ctx, -84, -40, -swing(3.7, 0.7), bend(3.7, 1.0), 17, 19, 7.5, 4.6, far, hoof);
  // tail
  ctx.strokeStyle = mane; ctx.lineCap = 'round'; ctx.lineWidth = 7;
  const tw = run ? Math.sin(phase * 0.5) * 5 : 1.5;
  ctx.beginPath(); ctx.moveTo(-90, -52);
  ctx.quadraticCurveTo(-110, -50 + tw, -112 - run * 6, -30 + tw * 0.6 - run * 10);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-92, -50);
  ctx.quadraticCurveTo(-106, -42 + tw, -106 - run * 4, -24 - run * 8);
  ctx.stroke();
  // body
  ctx.fillStyle = coat;
  ctx.beginPath(); ctx.ellipse(-64, -48, 31, 15, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-84, -47, 13, 14, 0, 0, TAU); ctx.fill(); // rump
  ctx.beginPath(); ctx.ellipse(-42, -47, 12, 13, 0, 0, TAU); ctx.fill(); // chest
  // near legs
  limb(ctx, -40, -38, -swing(0, 0.75), -bend(0, 1.1), 17, 18, 7, 5, coat, hoof);
  limb(ctx, -80, -40, swing(3.1, 0.7), bend(3.1, 1.0), 17, 19, 8, 5, coat, hoof);
  // neck
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(-50, -58); ctx.lineTo(-20, -80); ctx.lineTo(-6, -70); ctx.lineTo(-32, -38);
  ctx.closePath(); ctx.fill();
  // head
  ctx.beginPath(); ctx.ellipse(-11, -66, 13, 7.5, 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(coat, -0.2);
  ctx.beginPath(); ctx.ellipse(-2, -59, 4.5, 4, 0.6, 0, TAU); ctx.fill();  // muzzle
  ctx.fillStyle = '#1b1411';
  ctx.beginPath(); ctx.arc(-1.5, -59.5, 1.1, 0, TAU); ctx.fill();          // nostril
  // ear
  ctx.fillStyle = coat;
  ctx.beginPath(); ctx.moveTo(-22, -77); ctx.lineTo(-21, -88); ctx.lineTo(-15, -78); ctx.closePath(); ctx.fill();
  // eye (+ blinker hood in the jockey's colour)
  ctx.fillStyle = silk.bg === '#f3efe6' ? '#d8312c' : silk.bg;
  ctx.beginPath(); ctx.ellipse(-15, -70, 4.4, 3.4, 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-14, -70, 2.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-13.4, -70, 1.3, 0, TAU); ctx.fill();
  // mane
  ctx.strokeStyle = mane; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  const mw = run ? Math.sin(phase * 1.3) * 2.5 : 0;
  ctx.beginPath(); ctx.moveTo(-21, -80);
  ctx.lineTo(-29, -76 + mw); ctx.lineTo(-27, -72); ctx.lineTo(-37, -70 - mw); ctx.lineTo(-35, -66); ctx.lineTo(-46, -62 + mw);
  ctx.stroke();
  // saddle cloth with number
  ctx.fillStyle = silk.bg;
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  roundRect(ctx, -76, -60, 24, 18, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = silk.fg;
  ctx.font = 'bold 13px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(lane + 1), -64, -50.5);
  // jockey
  const lean = run ? 0.15 * run : 0;
  ctx.save();
  ctx.translate(-62, -60);
  ctx.rotate(0.55 + lean);
  // leg (white breeches + boot)
  ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, 8); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 5.5;
  ctx.beginPath(); ctx.moveTo(-58, -57); ctx.lineTo(-52, -50); ctx.stroke();
  ctx.strokeStyle = '#1d1a18'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-52, -50); ctx.lineTo(-57, -45); ctx.stroke();
  // torso
  ctx.fillStyle = silk.bg;
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-66, -60); ctx.lineTo(-58, -82 + lean * 10); ctx.lineTo(-47, -78 + lean * 10); ctx.lineTo(-54, -58);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // sleeve stripe
  ctx.strokeStyle = silk.cap; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-60, -76 + lean * 10); ctx.lineTo(-52, -74 + lean * 10); ctx.stroke();
  // arm reaching to the reins
  const armY = run ? Math.sin(phase) * 1.5 : 0;
  ctx.strokeStyle = silk.bg; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(-52, -76 + lean * 10); ctx.lineTo(-36, -64 + armY); ctx.stroke();
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(-35, -63.5 + armY, 2.4, 0, TAU); ctx.fill();
  // reins
  ctx.strokeStyle = 'rgba(40,20,10,.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-35, -63 + armY); ctx.lineTo(-8, -62); ctx.stroke();
  // head + helmet
  const hx = -50, hy = -87 + lean * 12;
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(hx + 1.5, hy + 2, 4.6, 0, TAU); ctx.fill();
  ctx.fillStyle = silk.cap;
  ctx.beginPath(); ctx.arc(hx, hy, 5.6, Math.PI, 0); ctx.fill();
  ctx.fillRect(hx, hy - 1.2, 8.5, 2.4); // peak
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(hx, hy, 5.6, Math.PI, 0); ctx.stroke();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draw a standing horse portrait into a <canvas> (used on the betting cards and the results screen). */
export function paintPortrait(canvas, lane, coat, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || +canvas.getAttribute('width') || 120, h = canvas.clientHeight || +canvas.getAttribute('height') || 80;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const s = Math.min(w / 125, h / 96);
  drawHorse(ctx, w / 2 + 58 * s, h - 6 * s, s, lane, coat, opts.phase || 0, opts.run || 0);
}

// ---------------------------------------------------------------- the race track
const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; };
const CROWD = ['#e8452c', '#ffd23f', '#2a5bd7', '#ffffff', '#1f9a48', '#ff7eb6', '#8a5cf6', '#ff9b3d', '#3fd0ff'];

export class TrackView {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = null;
    this.phase = [];
    this.prevPos = null;
    this.confetti = [];
    this.lastT = null;
    this.myLane = -1;
  }

  resize(n) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = this.c.parentElement.clientWidth;
    const laneH = Math.round(Math.max(44, Math.min(70, W / 11)));
    const skyH = Math.round(laneH * 0.95);
    const H = skyH + 10 + n * laneH + 16;
    if (this.W !== W || this.H !== H || this.dpr !== dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr);
      this.c.style.height = H + 'px';
    }
    this.laneH = laneH; this.skyH = skyH; this.n = n;
  }

  /**
   * race: simulate() output. horses: state horses. t: seconds since the gates opened (negative = countdown).
   * dt: real seconds since the last frame (for smoothing)
   */
  draw(race, horses, t, dt) {
    const n = race.n;
    this.resize(n);
    const { ctx, W, H, laneH, skyH } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pos = positionsAt(race, t);
    const prev = positionsAt(race, t - 0.08);
    const ev = eventAt(race, t);
    const cleared = gatesClearedAt(race, t);
    const horsePx = laneH * 1.2;
    const sc = (laneH * 0.92) / 92;

    // ---- camera: keep the whole pack in view, zoomed in as far as possible
    let min = Infinity, max = -Infinity;
    for (const p of pos) { if (p < min) min = p; if (p > max) max = p; }
    max = Math.min(max, GATES + 0.3);
    const marginL = 18, marginR = Math.max(26, W * 0.08);
    const ppgMax = W / 5.2, ppgMin = (W - horsePx - marginL - marginR) / (GATES + 0.6);
    let ppg = (W - horsePx - marginL - marginR) / Math.max(0.01, max - min + 0.9);
    ppg = Math.max(ppgMin, Math.min(ppgMax, ppg));
    let left = min - (horsePx + marginL) / ppg;
    const maxLeft = GATES + 0.9 - W / ppg;
    if (left > maxLeft) left = maxLeft;
    if (!this.cam || dt > 1) this.cam = { ppg, left };
    else {
      const k = 1 - Math.exp(-dt * 3.2);
      this.cam.ppg += (ppg - this.cam.ppg) * k;
      this.cam.left += (left - this.cam.left) * k;
    }
    const cam = this.cam;
    const X = g => (g - cam.left) * cam.ppg;
    const laneTop = i => skyH + 10 + i * laneH;

    // ---- sky + grandstand (parallax)
    const sky = ctx.createLinearGradient(0, 0, 0, skyH);
    sky.addColorStop(0, '#7cc7ff'); sky.addColorStop(1, '#cdeeff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, skyH);
    const par = 0.55, crowdLeft = cam.left * cam.ppg * par;
    ctx.fillStyle = '#3c4a5c';
    ctx.fillRect(0, skyH * 0.28, W, skyH * 0.72);
    ctx.fillStyle = '#2a3442';
    ctx.fillRect(0, skyH * 0.2, W, skyH * 0.1);
    const step = 9, rows = 4, cheer = ev || (race.winner >= 0 && t >= race.fin[race.winner]);
    const startIdx = Math.floor(crowdLeft / step) - 1;
    for (let i = startIdx; i < startIdx + W / step + 3; i++) {
      for (let r = 0; r < rows; r++) {
        const hsh = hash(i * 7 + r * 131);
        const x = i * step - crowdLeft + (r % 2) * 4.5;
        const jump = cheer ? Math.max(0, Math.sin(t * 9 + (hsh % 17))) * 2.5 : 0;
        const y = skyH * 0.4 + r * (skyH * 0.6 / rows) - jump;
        ctx.fillStyle = CROWD[hsh % CROWD.length];
        ctx.beginPath(); ctx.arc(x, y, 2.8, 0, TAU); ctx.fill();
      }
    }
    // ---- turf with mowing stripes
    ctx.fillStyle = '#3f9a3a';
    ctx.fillRect(0, skyH, W, H - skyH);
    ctx.fillStyle = '#48a842';
    const stripe = 0.5;
    for (let g = Math.floor(cam.left / stripe) * stripe; g < cam.left + W / cam.ppg + stripe; g += stripe) {
      if (Math.round(g / stripe) % 2 === 0) ctx.fillRect(X(g), skyH + 10, stripe * cam.ppg + 0.5, n * laneH);
    }
    // my lane glow
    if (this.myLane >= 0 && this.myLane < n) {
      ctx.fillStyle = 'rgba(255,240,150,.16)';
      ctx.fillRect(0, laneTop(this.myLane), W, laneH);
    }
    // lane lines
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; ctx.setLineDash([6, 8]);
    for (let i = 1; i < n; i++) { const y = laneTop(i) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.setLineDash([]);
    // ---- event roulette: the lane being "chosen" lights up
    if (ev) {
      const { pt } = ev;
      const spin = (target, from, to, color) => {
        if (target < 0 || pt < from || pt > to + 0.9) return;   // -1: no horse was eligible (all at their limit)
        let lane = target;
        if (pt < to) {
          const ticks = Math.floor(((pt - from) / (to - from)) ** 0.6 * 9 * n);
          lane = (target + 1 + ticks) % n;
        }
        ctx.fillStyle = color;
        ctx.fillRect(0, laneTop(lane), W, laneH);
      };
      spin(ev.ev.boost, 0.05, BOOST_AT, 'rgba(255,214,0,.38)');
      spin(ev.ev.setback, BOOST_AT + BOOST_LEN * 0.6, SETBACK_AT, 'rgba(120,160,255,.38)');
    }
    // ---- rails
    const railY = [skyH + 3, H - 12];
    for (const ry of railY) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, ry, W, 4);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, ry + 4, W, 2);
      ctx.fillStyle = '#ffffff';
      const postStep = 0.25;
      for (let g = Math.floor(cam.left / postStep) * postStep; g < cam.left + W / cam.ppg + postStep; g += postStep) {
        ctx.fillRect(X(g) - 1, ry - 3, 2, 10);
      }
    }
    // ---- gates
    for (let g = 1; g <= GATES; g++) {
      const x = X(g);
      if (x < -20 || x > W + 20) continue;
      const top = skyH + 7, bot = H - 12;
      if (g === GATES) {
        // finish line: checkered strip
        const sq = 5;
        for (let y = top, r = 0; y < bot; y += sq, r++) {
          for (let c = 0; c < 2; c++) {
            ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
            ctx.fillRect(x - sq + c * sq, y, sq, Math.min(sq, bot - y));
          }
        }
        ctx.fillStyle = '#d8312c';
        ctx.fillRect(x - 2, top - 8, 4, 12);
        flag(ctx, x, top - 16, 'FINISH', '#d8312c', '#fff');
        continue;
      }
      const done = g <= cleared, next = g === cleared + 1 && !(race.winner >= 0 && t >= race.fin[race.winner]);
      ctx.strokeStyle = done ? 'rgba(255,215,64,.75)' : 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
      ctx.setLineDash([]);
      let bg = '#ffffff', fg = '#2a2118';
      if (done) { bg = '#ffd23f'; fg = '#2a2118'; }
      if (next) { const p = 0.5 + 0.5 * Math.sin(t * 6); bg = `rgb(255,${Math.round(150 + 60 * p)},${Math.round(60 * p)})`; fg = '#2a2118'; }
      if (ev && ev.ev.gate === g && ev.pt < PAUSE) { bg = '#ff5a36'; fg = '#fff'; }
      flag(ctx, x, top - 16, String(g), bg, fg);
    }
    // ---- starting stalls (closed during the countdown, then swing open and fade)
    if (t < 1.6) {
      const a = t < 0 ? 1 : Math.max(0, 1 - t / 1.6);
      const x = X(0);
      ctx.globalAlpha = a;
      for (let i = 0; i < n; i++) {
        const y = laneTop(i);
        ctx.fillStyle = '#c9ced6'; ctx.fillRect(x - horsePx - 6, y + 2, 5, laneH - 4);
        ctx.fillStyle = '#9aa3ae'; ctx.fillRect(x - horsePx - 6, y + 2, horsePx + 12, 4);
        const open = t < 0 ? 0 : Math.min(1, t / 0.25);
        ctx.fillStyle = SILKS[i].bg;
        ctx.fillRect(x + 3, y + 4, 6 * (1 - open) + 1, laneH - 8);
        ctx.fillStyle = '#5b6573'; ctx.fillRect(x + 1, y + 2, 2, laneH - 4);
      }
      ctx.globalAlpha = 1;
    }
    // ---- horses
    for (let i = 0; i < n; i++) {
      const v = (pos[i] - prev[i]) / 0.08;
      const run = Math.max(0, Math.min(1, Math.abs(v) / 0.6));
      this.phase[i] = (this.phase[i] || i * 1.7) + (dt > 0 && dt < 0.5 ? dt * (6 + 9 * Math.min(1.6, Math.abs(v))) * (run > 0.05 ? 1 : 0) : 0);
      const x = X(pos[i]), y = laneTop(i) + laneH - 5;
      if (x < -horsePx || x > W + horsePx * 2) continue;
      // boost / setback effects
      if (ev) {
        if (i === ev.ev.boost && ev.pt >= BOOST_AT - 0.05 && ev.pt < BOOST_AT + BOOST_LEN + 0.5) {
          ctx.strokeStyle = 'rgba(255,230,80,.9)'; ctx.lineWidth = 2;
          for (let k = 0; k < 5; k++) {
            const ly = y - laneH * (0.2 + 0.13 * k), lx = x - horsePx - 8 - ((t * 400 + k * 37) % 40);
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 18 - k * 3, ly); ctx.stroke();
          }
        }
        if (i === ev.ev.setback && ev.pt >= SETBACK_AT && ev.pt < SETBACK_AT + SETBACK_LEN + 0.5) {
          ctx.fillStyle = 'rgba(200,190,170,.55)';
          for (let k = 0; k < 4; k++) {
            const r = 5 + ((ev.pt - SETBACK_AT) * 18 + k * 3);
            ctx.beginPath(); ctx.arc(x + 4 + k * 5, y - 4 - k * 2, r * 0.6, 0, TAU); ctx.fill();
          }
        }
      }
      // name tag trailing the horse
      const h = horses[i];
      const label = `${i + 1} ${h ? h.name : ''}`;
      ctx.font = `600 ${Math.round(Math.max(10, laneH * 0.2))}px Fredoka, system-ui, sans-serif`;
      const tw = Math.min(ctx.measureText(label).width, 150) + 10;
      const tx = x - horsePx - tw - 2, ty = laneTop(i) + laneH * 0.5 - 8;
      if (tx + tw > 0) {
        ctx.fillStyle = SILKS[i].bg; ctx.globalAlpha = 0.88;
        roundRect(ctx, tx, ty, tw, 16, 8); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = SILKS[i].fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw - 4, 16); ctx.clip();
        ctx.fillText(label, tx + 5, ty + 8.5);
        ctx.restore();
      }
      drawHorse(ctx, x, y, sc, i, h ? h.coat : i, this.phase[i], run);
      // "you" marker
      if (i === this.myLane) {
        const by = laneTop(i) + 3 + Math.sin(t * 5) * 1.5;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(x - horsePx * 0.5 - 6, by); ctx.lineTo(x - horsePx * 0.5 + 6, by); ctx.lineTo(x - horsePx * 0.5, by + 7); ctx.closePath(); ctx.fill();
      }
      // floating +1 / -1
      if (ev) {
        const float = (txt, color, from) => {
          const k = (ev.pt - from) / 0.9;
          if (k < 0 || k > 1.3) return;
          ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.8) * 2);
          ctx.font = `700 ${Math.round(laneH * 0.36)}px Fredoka, system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)';
          const fy = laneTop(i) + laneH * 0.3 - k * 10;
          ctx.strokeText(txt, x - horsePx * 0.45, fy); ctx.fillStyle = color; ctx.fillText(txt, x - horsePx * 0.45, fy);
          ctx.globalAlpha = 1;
        };
        if (i === ev.ev.boost) float('+1 GATE ⚡', '#ffe14d', BOOST_AT);
        if (i === ev.ev.setback) float('-1 GATE 🐌', '#9fc2ff', SETBACK_AT);
      }
    }
    // ---- confetti once someone wins
    if (race.winner >= 0) {
      const wt = race.fin[race.winner];
      if (t >= wt && !this.confettiFor) {
        this.confettiFor = true;
        for (let k = 0; k < 140; k++) {
          this.confetti.push({ x: X(GATES) + (Math.random() - 0.5) * 40, y: skyH + Math.random() * 20, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260 - 60, c: CROWD[k % CROWD.length], r: Math.random() * TAU, life: 2.8 });
        }
      }
      if (t < wt) this.confettiFor = false;
    }
    if (this.confetti.length) {
      const d = Math.min(0.05, Math.max(0, dt));
      this.confetti = this.confetti.filter(p => (p.life -= d) > 0);
      for (const p of this.confetti) {
        p.vy += 380 * d; p.x += p.vx * d; p.y += p.vy * d; p.r += d * 8;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillRect(-3, -2, 6, 4);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // ---- mini map of the whole course
    const mmW = Math.min(W - 24, 420), mmX = (W - mmW) / 2, mmY = 5, mmH = 12;
    ctx.fillStyle = 'rgba(20,30,40,.55)'; roundRect(ctx, mmX - 6, mmY - 3, mmW + 12, mmH + 6, 8); ctx.fill();
    for (let g = 0; g <= GATES; g++) {
      const gx = mmX + (g / GATES) * mmW;
      ctx.fillStyle = g === GATES ? '#fff' : g <= cleared && g > 0 ? '#ffd23f' : 'rgba(255,255,255,.45)';
      ctx.fillRect(gx - 0.5, mmY + (g === GATES ? 0 : 3), g === GATES ? 2 : 1, g === GATES ? mmH : mmH - 6);
    }
    // the visible window
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1;
    const vx0 = mmX + Math.max(0, cam.left / GATES) * mmW, vx1 = mmX + Math.min(1.03, (cam.left + W / cam.ppg) / GATES) * mmW;
    ctx.strokeRect(vx0, mmY - 1, Math.max(4, vx1 - vx0), mmH + 2);
    for (let i = n - 1; i >= 0; i--) {
      const gx = mmX + Math.min(1.02, Math.max(0, pos[i] / GATES)) * mmW;
      ctx.fillStyle = SILKS[i].bg; ctx.strokeStyle = i === this.myLane ? '#ffd23f' : 'rgba(0,0,0,.6)'; ctx.lineWidth = i === this.myLane ? 2 : 1;
      ctx.beginPath(); ctx.arc(gx, mmY + mmH / 2, 4, 0, TAU); ctx.fill(); ctx.stroke();
    }
    this.lastPos = pos;
    return pos;
  }
}

function flag(ctx, x, y, text, bg, fg) {
  ctx.font = '700 11px Fredoka, system-ui, sans-serif';
  const w = Math.max(16, ctx.measureText(text).width + 8);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  roundRect(ctx, x - w / 2 + 1, y + 1, w, 14, 4); ctx.fill();
  ctx.fillStyle = bg;
  roundRect(ctx, x - w / 2, y, w, 14, 4); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 7.5);
}
