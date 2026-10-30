// The race itself. Given a seed and a number of horses, every browser computes exactly the same race,
// so the host only has to send the seed. The simulation sticks to + - * / and comparisons (no Math.sin,
// Math.pow, ...), which JavaScript guarantees to give identical results on every device.
//
// Positions are measured in gates: the horses start at 0, gate k sits at k, and gate 20 is the finish line.
// Whenever every horse has made it through the next gate for the first time, all horses stop for PAUSE
// seconds: one random horse is boosted forward one gate and a different one is set back one gate.
// No horse gets more than MAX_BOOSTS boosts or MAX_SETBACKS setbacks in one race.

export const GATES = 20;
export const DT = 1 / 30;            // simulation step (seconds)
export const PAUSE = 2.0;            // how long the horses stand still at a gate event
export const BOOST_AT = 0.42;        // seconds into the pause when the boosted horse starts its dash
export const BOOST_LEN = 0.45;
export const SETBACK_AT = 1.02;      // ...and when the set-back horse starts sliding back
export const SETBACK_LEN = 0.45;
export const AFTER_WIN = 4;          // keep the rest running this long after the winner crosses the line
export const COUNTDOWN = 4;          // seconds between "start" and the gates opening
export const MAX_BOOSTS = 6;         // per horse, per race
export const MAX_SETBACKS = 6;       // per horse, per race

/** Small, fast, seeded random number generator (mulberry32). Integer math only. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

/**
 * Runs the whole race up front.
 * Returns { n, steps, frames, events, winner, order, fin, endT }
 *  frames: Float32Array, frames[step * n + i] = position of horse i at time step * DT
 *  events: [{ t, gate, boost, setback }] — t is when the horses froze; boost/setback is a horse index,
 *          or -1 when every eligible horse has already used up its 6 (only possible in very long races)
 *  fin[i]: time horse i crossed the finish line (-1 if it never did)
 */
export function simulate(seed, n) {
  const r = rng(seed);
  const H = [];
  for (let i = 0; i < n; i++) {
    H.push({ pos: 0, v: 0, base: 0.92 + r() * 0.14, mood: 0.9 + r() * 0.2, moodLeft: 0.3 + r() * 1.2, fin: -1, boosts: 0, setbacks: 0 });
  }
  const pickFrom = list => (list.length ? list[Math.floor(r() * list.length)] : -1);
  const maxSteps = Math.ceil(240 / DT);
  const frames = new Float32Array(maxSteps * n);
  const events = [];
  let t = 0, step = 0, nextGate = 1, pause = null, winner = -1, winT = 0;

  const record = () => { for (let i = 0; i < n; i++) frames[step * n + i] = H[i].pos; step++; };
  const crossed = (i, prev, at) => {
    const h = H[i];
    if (h.fin >= 0 || h.pos < GATES) return;
    // when exactly did it cross? (straight line between the two steps)
    const span = h.pos - prev;
    h.fin = span > 0 ? at - DT + DT * ((GATES - prev) / span) : at;
    if (winner < 0 || h.fin < winT) { winner = i; winT = h.fin; }
  };

  record(); // t = 0
  while (step < maxSteps) {
    t = step * DT;
    if (pause) {
      const pt = t - pause.t0;
      for (let i = 0; i < n; i++) {
        const prev = H[i].pos;
        let p = pause.from[i];
        if (i === pause.boost) p += ease((pt - BOOST_AT) / BOOST_LEN);
        if (i === pause.setback) { p -= ease((pt - SETBACK_AT) / SETBACK_LEN); if (p < 0) p = 0; }
        H[i].pos = p;
        crossed(i, prev, t);
      }
      if (pt >= PAUSE) pause = null;
    } else {
      for (let i = 0; i < n; i++) {
        const h = H[i];
        const prev = h.pos;
        if (h.fin >= 0) {          // past the line: ease off
          h.v *= 0.96;
          h.pos += h.v * DT;
          continue;
        }
        h.moodLeft -= DT;
        if (h.moodLeft <= 0) { h.mood = 0.72 + r() * 0.56; h.moodLeft = 0.6 + r() * 1.6; }
        h.v += (h.base * h.mood - h.v) * 0.09;
        h.pos += h.v * DT;
        crossed(i, prev, t);
      }
      // everyone through the next gate for the first time? (not after the race is won, and not the finish)
      if (winner < 0 && nextGate < GATES) {
        let min = H[0].pos;
        for (let i = 1; i < n; i++) if (H[i].pos < min) min = H[i].pos;
        if (min >= nextGate) {
          // only horses that haven't hit their limit can be picked
          const all = H.map((h, i) => i);
          const boost = pickFrom(all.filter(i => H[i].boosts < MAX_BOOSTS));
          const setback = pickFrom(all.filter(i => i !== boost && H[i].setbacks < MAX_SETBACKS));
          if (boost >= 0) H[boost].boosts++;
          if (setback >= 0) H[setback].setbacks++;
          pause = { t0: t, from: H.map(h => h.pos), boost, setback };
          events.push({ t, gate: nextGate, boost, setback });
          nextGate++;
          for (const h of H) h.v = 0;
        }
      }
    }
    record();
    if (winner >= 0 && !pause) {
      const allIn = H.every(h => h.fin >= 0);
      if (allIn || t - winT >= AFTER_WIN) break;
    }
  }
  const endT = (step - 1) * DT;
  // finishing order: by finish time, then (for horses still running) by how far they got
  const order = H.map((h, i) => i).sort((a, b) => {
    const fa = H[a].fin, fb = H[b].fin;
    if (fa >= 0 && fb >= 0) return fa - fb || a - b;
    if (fa >= 0) return -1;
    if (fb >= 0) return 1;
    return H[b].pos - H[a].pos || a - b;
  });
  return { n, steps: step, frames, events, winner, order, fin: H.map(h => h.fin), endT };
}

/** Position of every horse at time `t` (seconds since the gates opened), smoothly interpolated. */
export function positionsAt(race, t, out) {
  const n = race.n;
  out = out || new Array(n);
  if (t <= 0) { for (let i = 0; i < n; i++) out[i] = 0; return out; }
  const f = t / DT;
  let a = Math.floor(f);
  if (a >= race.steps - 1) { a = race.steps - 1; for (let i = 0; i < n; i++) out[i] = race.frames[a * n + i]; return out; }
  const k = f - a;
  for (let i = 0; i < n; i++) out[i] = race.frames[a * n + i] * (1 - k) + race.frames[(a + 1) * n + i] * k;
  return out;
}

/** The gate event happening at time t, if any: { ev, pt } where pt is seconds into its pause. */
export function eventAt(race, t) {
  for (const ev of race.events) {
    if (t >= ev.t && t < ev.t + PAUSE) return { ev, pt: t - ev.t };
    if (ev.t > t) break;
  }
  return null;
}

/** Boosts and setbacks each horse has taken by time t: { boosts: [..], setbacks: [..] } */
export function tallyAt(race, t) {
  const boosts = new Array(race.n).fill(0), setbacks = new Array(race.n).fill(0);
  for (const ev of race.events) {
    if (ev.t > t) break;
    if (ev.boost >= 0 && t >= ev.t + BOOST_AT) boosts[ev.boost]++;
    if (ev.setback >= 0 && t >= ev.t + SETBACK_AT) setbacks[ev.setback]++;
  }
  return { boosts, setbacks };
}

/** How many gate events have started by time t (gates every horse has cleared). */
export function gatesClearedAt(race, t) {
  let c = 0;
  for (const ev of race.events) { if (ev.t <= t) c = ev.gate; else break; }
  return c;
}
