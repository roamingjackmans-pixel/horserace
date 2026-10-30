// Runs many races and prints how long they take, how many gate stops happen, and win rates per lane.
// Also checks that every race is deterministic and that no horse gets more than 6 boosts or 6 setbacks.
//   node tools/simstats.mjs [races]
import { simulate, COUNTDOWN, PAUSE, MAX_BOOSTS, MAX_SETBACKS } from '../public/js/sim.js';
const N = +process.argv[2] || 3000;
let bad = 0;
for (const n of [4, 5, 6]) {
  const dur = [], evs = [], wins = new Array(n).fill(0); let boostWins = 0, margin = [], maxB = 0, maxS = 0, capped = 0, skipped = 0;
  for (let k = 0; k < N; k++) {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const r = simulate(seed, n);
    if (r.winner < 0) { console.log('NO WINNER', seed); bad++; continue; }
    dur.push(r.fin[r.winner]); evs.push(r.events.length); wins[r.winner]++;
    const last = r.events[r.events.length - 1];
    if (last && r.fin[r.winner] >= last.t && r.fin[r.winner] <= last.t + PAUSE) boostWins++;
    const second = r.order[1]; margin.push(r.fin[second] >= 0 ? r.fin[second] - r.fin[r.winner] : 99);
    // the 6-per-horse limit
    const b = new Array(n).fill(0), s = new Array(n).fill(0);
    for (const e of r.events) {
      if (e.boost >= 0) b[e.boost]++; else skipped++;
      if (e.setback >= 0) s[e.setback]++; else skipped++;
      if (e.boost >= 0 && e.boost === e.setback) { console.log('SAME HORSE BOOSTED AND SET BACK', seed); bad++; }
    }
    maxB = Math.max(maxB, ...b); maxS = Math.max(maxS, ...s);
    if (b.some(x => x === MAX_BOOSTS) || s.some(x => x === MAX_SETBACKS)) capped++;
    // determinism check
    const r2 = simulate(seed, n);
    if (r2.winner !== r.winner || r2.steps !== r.steps || r2.frames[r2.steps * n - 1] !== r.frames[r.steps * n - 1]) { console.log('NONDETERMINISTIC', seed); bad++; }
  }
  if (maxB > MAX_BOOSTS || maxS > MAX_SETBACKS) { console.log(`LIMIT BROKEN: max boosts ${maxB}, max setbacks ${maxS}`); bad++; }
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))].toFixed(1); };
  console.log(`${n} horses: winner time p10/p50/p90 = ${q(dur, .1)}/${q(dur, .5)}/${q(dur, .9)}s (+${COUNTDOWN}s countdown)` +
    ` | gate stops p10/p50/p90 = ${q(evs, .1)}/${q(evs, .5)}/${q(evs, .9)} | won by a boost ${(100 * boostWins / N).toFixed(0)}%` +
    ` | close finish (<0.5s) ${(100 * margin.filter(m => m < .5).length / N).toFixed(0)}% | lane wins ${wins.map(w => (100 * w / N).toFixed(0) + '%').join(' ')}` +
    ` | most on one horse: ${maxB} boosts, ${maxS} setbacks (limit hit in ${(100 * capped / N).toFixed(1)}% of races, ${skipped} skipped)`);
}
if (bad) { console.log(`${bad} problems`); process.exit(1); }
