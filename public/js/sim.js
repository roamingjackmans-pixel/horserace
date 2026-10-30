// The race itself, in two parts:
//
//  1. writeRace(seed, horses, gates) writes the whole race up front as a script: every hop, every gate stop
//     (with its boost and setback), in order, from one random seed. All the rules live here. The host does this
//     when the race starts and stores the script with the race.
//  2. playRace(script, horses, gates) turns a script into timing and animation frames. Every browser plays the
//     same stored script, so everyone watches exactly the same race.
//
// Positions are measured in gates: the horses start at 0, gate k sits at k, and the last gate is the finish
// line. The host picks how many gates a race has (MIN_GATES to MAX_GATES, 20 by default).
//
// The rules:
//  - It's like rolling a die: on a steady beat, one horse is picked at random and hops forward exactly one
//    gate. Every horse that's allowed to move has the same odds on every roll, so streaks happen.
//  - Each horse can hop forward at most hopCap(gates) times: 110% of the gates, rounded up (22 on 20 gates).
//    Boosts don't use up hops, but setbacks still cost ground, so a horse set back 5 times on 20 gates can
//    only reach gate 17 unless it gets boosted.
//  - Until someone finishes, the leader is never more than leadCap(gates) gates ahead of second place: 25% of
//    the gates, rounded up (5 on 20 gates). A hop, boost or setback that would break that isn't allowed.
//  - Whenever every horse has made it through the next gate for the first time, all horses stop for PAUSE
//    seconds: one random horse is boosted forward one gate and a different one is set back one gate. No horse
//    gets more than effectCap(gates) boosts, or that many setbacks (30% of the gates, rounded up).
//  - If no horse is allowed to move any more and nobody has finished, the horse furthest ahead wins and bolts
//    for the line.
//
// Everything uses integer-friendly maths and a seeded random number generator, so it's identical everywhere.

export const DEFAULT_GATES = 20;
export const MIN_GATES = 3;
export const MAX_GATES = 100;
/** Most boosts (and, separately, setbacks) one horse can get in a race: 30% of the gates, rounded up. */
export const effectCap = gates => Math.ceil((gates * 3) / 10);   // integer math, so 30% of 10 is exactly 3
/** Most hops forward one horse can make in a race: 110% of the gates, rounded up. */
export const hopCap = gates => Math.ceil((gates * 11) / 10);
/** The most the leader can be ahead of second place: 25% of the gates, rounded up. */
export const leadCap = gates => Math.ceil(gates / 4);
export const cleanGates = g => {
  g = Math.round(+g);
  return Number.isFinite(g) ? Math.max(MIN_GATES, Math.min(MAX_GATES, g)) : DEFAULT_GATES;
};
export const DT = 1 / 30;            // animation frame step (seconds)
export const PAUSE = 2.0;            // how long the horses stand still at a gate stop
export const BOOST_AT = 0.42;        // seconds into the stop when the boosted horse starts its dash
export const BOOST_LEN = 0.45;
export const SETBACK_AT = 1.02;      // ...and when the set-back horse starts sliding back
export const SETBACK_LEN = 0.45;
export const AFTER_WIN = 4;          // the others keep going this long after the winner crosses the line
export const COUNTDOWN = 4;          // seconds between "start" and the gates opening
export const JUMP_LEN = 0.22;        // one hop forward of one gate takes this long (quicker with lots of horses)
export const ROLL_BASE = 1.0;        // seconds per roll of the die is ROLL_BASE / horses...
export const ROLL_MIN = 0.13;        // ...but never quicker than this

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
const rollEvery = n => Math.max(ROLL_MIN, ROLL_BASE / n);

// ---------------------------------------------------------------- 1. writing the race
/**
 * Writes the whole race. Returns { script, winner, order, bolt }.
 * script items: a number i = horse i hops forward one gate;
 *               [gate, boost, setback] = everyone is through `gate`: stop, boost one horse, set back another
 *                 (-1 = nobody; [gate, -1, -1] means the gate was cleared but there was nothing to do, so no stop);
 *               ['bolt', i] = nobody can move any more: horse i is furthest ahead and wins.
 */
export function writeRace(seed, n, gates = DEFAULT_GATES) {
  const G = cleanGates(gates);
  const cap = effectCap(G), hopMax = hopCap(G), lead = leadCap(G);
  const r = rng(seed);
  const pickFrom = list => (list.length ? list[Math.floor(r() * list.length)] : -1);
  const pos = new Array(n).fill(0), hops = new Array(n).fill(0), boosts = new Array(n).fill(0), setbacks = new Array(n).fill(0);
  const at = new Array(n).fill(0);          // when each horse reached its current spot (script index)
  const done = new Array(n).fill(false);    // over the line
  const finished = [];                      // finishing order
  const script = [];
  let nextGate = 1, winner = -1, bolt = false, afterLeft = 0;
  const afterBeats = Math.ceil(AFTER_WIN / rollEvery(n));

  // would moving horse i by d leave the leader within reach of second place? (only matters before a winner)
  const fair = (p, i, d) => {
    if (winner >= 0) return true;
    let a = -Infinity, b = -Infinity;
    for (let k = 0; k < n; k++) {
      const v = k === i ? Math.max(0, p[k] + d) : p[k];
      if (v > a) { b = a; a = v; } else if (v > b) b = v;
    }
    return a - b <= lead;
  };
  const cross = i => {
    if (done[i] || pos[i] < G) return;
    done[i] = true; finished.push(i);
    if (winner < 0) { winner = i; afterLeft = afterBeats; }
  };

  for (let guard = 0; guard < 200000; guard++) {
    if (winner >= 0 && afterLeft-- <= 0) break;
    // roll the die among the horses that are allowed to hop
    const racing = [];
    for (let i = 0; i < n; i++) if (!done[i] && hops[i] < hopMax && fair(pos, i, 1)) racing.push(i);
    if (!racing.length) {
      if (winner < 0) {
        // stuck: nobody can move. The horse furthest ahead (who got there first) wins
        let best = 0;
        for (let i = 1; i < n; i++) if (pos[i] > pos[best] || (pos[i] === pos[best] && at[i] < at[best])) best = i;
        winner = best; bolt = true; done[best] = true; finished.push(best);
        script.push(['bolt', best]);
      }
      break;
    }
    const i = racing[Math.floor(r() * racing.length)];
    pos[i]++; hops[i]++; at[i] = script.length;
    script.push(i);
    cross(i);
    // everyone through the next gate for the first time? stop: one boost, one setback
    while (winner < 0 && nextGate < G && Math.min(...pos) >= nextGate) {
      const all = [];
      for (let k = 0; k < n; k++) all.push(k);
      const boost = pickFrom(all.filter(k => boosts[k] < cap && fair(pos, k, 1)));
      if (boost >= 0) { boosts[boost]++; pos[boost]++; at[boost] = script.length; }
      const setback = pickFrom(all.filter(k => k !== boost && setbacks[k] < cap && fair(pos, k, -1)));
      if (setback >= 0) { setbacks[setback]++; pos[setback] = Math.max(0, pos[setback] - 1); at[setback] = script.length; }
      script.push([nextGate, boost, setback]);
      nextGate++;
      if (boost >= 0) cross(boost);
    }
  }
  // finishing order: who crossed first, then (for horses still out there) how far they got, then who got there first
  const rest = [];
  for (let i = 0; i < n; i++) if (!done[i]) rest.push(i);
  rest.sort((a, b) => pos[b] - pos[a] || at[a] - at[b] || a - b);
  return { script, winner, order: [...finished, ...rest], bolt };
}

// ---------------------------------------------------------------- 2. playing it out
// A little jitter on the beat so it doesn't sound like a metronome (from the hop's index, so no seed needed)
const jitter = k => { let x = Math.imul((k + 1) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; x ^= x >>> 13; return ((x >>> 0) % 1000) / 1000; };

/**
 * Turns a written script into a race you can watch.
 * Returns { n, gates, cap, steps, frames, events, clears, winner, order, fin, finPos, bolt, endT, script }
 *  frames: Float32Array, frames[step * n + i] = position of horse i at time step * DT
 *  events: [{ t, gate, boost, setback }]: the gate stops; t is when the horses froze
 *  clears: [{ t, gate }]: when every horse was through each gate
 *  fin[i]: when horse i crossed the line (or bolted, for a winner by default); -1 if it never did
 *  finPos[i]: where it was when that happened (the line, or its spot when it bolted)
 */
export function playRace(written, n, gates = DEFAULT_GATES) {
  const G = cleanGates(gates);
  const { script } = written;
  const beatBase = rollEvery(n);
  const beat = k => beatBase * (0.85 + 0.3 * jitter(k));
  const hop = Math.min(JUMP_LEN, beatBase * 0.8);   // shorter than the quickest beat: hops never overlap
  const moves = [];
  for (let i = 0; i < n; i++) moves.push([]);
  const pos = new Array(n).fill(0), fin = new Array(n).fill(-1), finPos = new Array(n).fill(-1);
  const events = [], clears = [];
  let t = 0.25, end = 0;
  const move = (i, t0, len, to) => {
    moves[i].push({ t0, t1: t0 + len, from: pos[i], to });
    pos[i] = to;
    if (to >= G && fin[i] < 0) { fin[i] = t0 + len; finPos[i] = G; }
    end = Math.max(end, t0 + len);
  };
  script.forEach((a, k) => {
    if (typeof a === 'number') { move(a, t, hop, pos[a] + 1); t += beat(k); return; }
    if (a[0] === 'bolt') { fin[a[1]] = t; finPos[a[1]] = pos[a[1]]; end = Math.max(end, t); return; }
    const [gate, boost, setback] = a;
    clears.push({ t, gate });
    if (boost < 0 && setback < 0) return;            // nothing to do at this gate: no stop
    events.push({ t, gate, boost, setback });
    if (boost >= 0) move(boost, t + BOOST_AT, BOOST_LEN, pos[boost] + 1);
    if (setback >= 0) move(setback, t + SETBACK_AT, SETBACK_LEN, Math.max(0, pos[setback] - 1));
    t += PAUSE;
  });
  const winner = written.winner;
  const endT = Math.max(end, fin[winner] >= 0 ? fin[winner] + 1 : 0) + 0.2;
  // sample every horse's position on a fixed frame grid
  const steps = Math.ceil(endT / DT) + 1;
  const frames = new Float32Array(steps * n);
  for (let i = 0; i < n; i++) {
    let m = 0, base = 0;
    const list = moves[i];
    for (let s = 0; s < steps; s++) {
      const time = s * DT;
      while (m < list.length && list[m].t1 <= time) { base = list[m].to; m++; }
      let p = base;
      if (m < list.length && list[m].t0 < time) {
        const mv = list[m];
        p = mv.from + (mv.to - mv.from) * ease((time - mv.t0) / (mv.t1 - mv.t0));
      }
      frames[s * n + i] = p;
    }
  }
  return {
    n, gates: G, cap: effectCap(G), steps, frames, events, clears, winner, order: written.order,
    fin, finPos, bolt: !!written.bolt, endT, script,
  };
}

/** Write and play in one go (for tools and previews). */
export function simulate(seed, n, gates = DEFAULT_GATES) {
  return playRace(writeRace(seed, n, gates), n, gates);
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

/** The gate stop happening at time t, if any: { ev, pt } where pt is seconds into its pause. */
export function eventAt(race, t) {
  for (const ev of race.events) {
    if (t >= ev.t && t < ev.t + PAUSE) return { ev, pt: t - ev.t };
    if (ev.t > t) break;
  }
  return null;
}

/** The last gate every horse had made it through by time t. */
export function gatesClearedAt(race, t) {
  let c = 0;
  for (const ev of race.clears || race.events) { if (ev.t <= t) c = ev.gate; else break; }
  return c;
}
