// The race itself. Given a seed and a number of horses, every browser computes exactly the same race,
// so the host only has to send the seed. The simulation sticks to + - * / and comparisons (no Math.sin,
// Math.pow, ...), which JavaScript guarantees to give identical results on every device.
//
// Positions are measured in gates: the horses start at 0, gate k sits at k, and the last gate is the finish
// line. The host picks how many gates a race has (MIN_GATES to MAX_GATES, 20 by default).
// Horses don't run smoothly: each one waits a random moment, then hops forward exactly one gate in a quick
// JUMP_LEN-second leap. Every horse has the same odds, so a horse way out in front can still be caught.
// Whenever every horse has made it through the next gate for the first time, all horses stop for PAUSE
// seconds: one random horse is boosted forward one gate and a different one is set back one gate.
// No horse gets more than effectCap(gates) boosts, or that many setbacks, in one race.

export const DEFAULT_GATES = 20;
export const MIN_GATES = 3;
export const MAX_GATES = 100;
/** Most boosts (and, separately, setbacks) one horse can get in a race: 30% of the gates, rounded up. */
export const effectCap = gates => Math.ceil((gates * 3) / 10);   // integer math, so 30% of 10 is exactly 3
export const cleanGates = g => {
  g = Math.round(+g);
  return Number.isFinite(g) ? Math.max(MIN_GATES, Math.min(MAX_GATES, g)) : DEFAULT_GATES;
};
export const DT = 1 / 30;            // simulation step (seconds)
export const PAUSE = 2.0;            // how long the horses stand still at a gate event
export const BOOST_AT = 0.42;        // seconds into the pause when the boosted horse starts its dash
export const BOOST_LEN = 0.45;
export const SETBACK_AT = 1.02;      // ...and when the set-back horse starts sliding back
export const SETBACK_LEN = 0.45;
export const AFTER_WIN = 4;          // keep the rest running this long after the winner crosses the line
export const COUNTDOWN = 4;          // seconds between "start" and the gates opening
export const JUMP_LEN = 0.22;        // one hop forward of one gate takes this long
export const WAIT_MIN = 0.3;         // each horse waits this long...
export const WAIT_MAX = 1.3;         // ...to this long (at random) between hops

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
 * Returns { n, gates, cap, steps, frames, events, winner, order, fin, endT }
 *  frames: Float32Array, frames[step * n + i] = position of horse i at time step * DT
 *  events: [{ t, gate, boost, setback }] — t is when the horses froze; boost/setback is a horse index,
 *          or -1 when every horse that could be picked has already used up its cap
 *  fin[i]: time horse i crossed the finish line (-1 if it never did)
 */
export function simulate(seed, n, gates = DEFAULT_GATES, tune = {}) {
  const GATES = cleanGates(gates);
  const cap = effectCap(GATES);
  const waitMin = tune.waitMin || WAIT_MIN, waitMax = tune.waitMax || WAIT_MAX;   // (tune: for tools/simstats only)
  const r = rng(seed);
  const wait = () => waitMin + r() * (waitMax - waitMin);
  const H = [];
  for (let i = 0; i < n; i++) {
    // jump: the hop in progress { start, from } · next: when the next hop starts · at: when it reached its spot
    H.push({ pos: 0, jump: null, next: 0.1 + r() * (waitMax - 0.1), at: 0, fin: -1, boosts: 0, setbacks: 0 });
  }
  const pickFrom = list => (list.length ? list[Math.floor(r() * list.length)] : -1);
  const maxSteps = Math.ceil((60 + GATES * 6) / DT);   // far more time than any race needs
  const frames = new Float32Array(maxSteps * n);
  const events = [];
  const clears = [];   // when each gate was cleared by every horse (a stop can be skipped; this can't)
  let t = 0, step = 0, nextGate = 1, pause = null, winner = -1, winT = 0;

  const record = () => { for (let i = 0; i < n; i++) frames[step * n + i] = H[i].pos; step++; };
  const finish = (i, at) => {
    const h = H[i];
    if (h.fin >= 0) return;
    h.fin = at;
    if (winner < 0 || at < winT) { winner = i; winT = at; }
  };
  // a boost during a stop can carry a horse over the line too
  const crossed = (i, prev, at) => {
    const h = H[i];
    if (h.fin >= 0 || h.pos < GATES) return;
    const span = h.pos - prev;
    finish(i, span > 0 ? at - DT + DT * ((GATES - prev) / span) : at);
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
      if (pt >= PAUSE) {
        const done = pause;
        pause = null;
        // back to hopping, each horse after its own fresh random wait
        for (let i = 0; i < n; i++) {
          const h = H[i];
          h.pos = Math.round(h.pos);
          if (i === done.boost || i === done.setback) h.at = t;
          h.next = t + wait();
        }
      }
    } else {
      // Each step is done in passes so that no horse gets an edge from where it sits in the list:
      // 1) land the hops that are due, and move the ones still in the air
      for (let i = 0; i < n; i++) {
        const h = H[i];
        if (h.fin >= 0 || !h.jump) continue;           // (over the line: stands there)
        const k = (t - h.jump.start) / JUMP_LEN;
        if (k >= 1) {
          const land = h.jump.start + JUMP_LEN;
          h.pos = h.jump.from + 1; h.jump = null; h.at = land;
          h.next = land + wait();
          if (h.pos >= GATES) finish(i, land);
        } else {
          h.pos = h.jump.from + ease(k);
        }
      }
      // 2) is everyone through the next gate? (a horse in the air counts from where it took off)
      let minLanded = Infinity;
      for (const h of H) { const p = h.jump ? h.jump.from : h.pos; if (p < minLanded) minLanded = p; }
      const stopping = winner < 0 && nextGate < GATES && minLanded >= nextGate;
      // 3) start new hops for horses whose wait is up (none while we're about to stop)
      if (!stopping) {
        for (let i = 0; i < n; i++) {
          const h = H[i];
          if (h.fin >= 0 || h.jump || t < h.next) continue;
          h.jump = { start: h.next, from: h.pos };
          h.pos = h.jump.from + ease((t - h.jump.start) / JUMP_LEN);
        }
      }
      // 4) everyone through the next gate for the first time, and nobody mid-air: freeze!
      if (stopping && H.every(h => !h.jump)) {
        clears.push({ t, gate: nextGate });
        // only horses that haven't hit their limit can be picked
        const all = H.map((h, i) => i);
        const boost = pickFrom(all.filter(i => H[i].boosts < cap));
        const setback = pickFrom(all.filter(i => i !== boost && H[i].setbacks < cap));
        if (boost >= 0) H[boost].boosts++;
        if (setback >= 0) H[setback].setbacks++;
        // if every horse is already at its cap there's nothing to do here, so don't stop at all
        if (boost >= 0 || setback >= 0) {
          pause = { t0: t, from: H.map(h => h.pos), boost, setback };
          events.push({ t, gate: nextGate, boost, setback });
        }
        nextGate++;
      }
    }
    record();
    if (winner >= 0 && !pause) {
      const allIn = H.every(h => h.fin >= 0);
      if (allIn || t - winT >= AFTER_WIN) break;
    }
  }
  const endT = (step - 1) * DT;
  // finishing order: by finish time, then (for horses still going) by how far they got, then who got there first
  const order = H.map((h, i) => i).sort((a, b) => {
    const fa = H[a].fin, fb = H[b].fin;
    if (fa >= 0 && fb >= 0) return fa - fb || a - b;
    if (fa >= 0) return -1;
    if (fb >= 0) return 1;
    return H[b].pos - H[a].pos || H[a].at - H[b].at || a - b;
  });
  return { n, gates: GATES, cap, steps: step, frames, events, clears, winner, order, fin: H.map(h => h.fin), endT };
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

/** How many gate events have started by time t (gates every horse has cleared). */
export function gatesClearedAt(race, t) {
  let c = 0;
  for (const ev of race.clears || race.events) { if (ev.t <= t) c = ev.gate; else break; }
  return c;
}
