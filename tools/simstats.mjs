// Runs many races and prints how long they take, how many gate stops happen, and win rates per lane.
// Also checks that every race is deterministic and that no horse goes over the boost/setback cap
// (30% of the gates, rounded up).
//   node tools/simstats.mjs [races per setup] [gate counts, comma separated]
import { simulate, COUNTDOWN, PAUSE, effectCap } from '../public/js/sim.js';
const N = +process.argv[2] || 2000;
const gateList = (process.argv[3] || '3,7,20,50,100').split(',').map(Number);
let bad = 0;
// the cap itself
for (const [g, want] of [[3, 1], [7, 3], [10, 3], [20, 6], [21, 7], [50, 15], [100, 30]]) {
  if (effectCap(g) !== want) { console.log(`CAP WRONG for ${g} gates: ${effectCap(g)}, expected ${want}`); bad++; }
}
for (const gates of gateList) {
  const cap = effectCap(gates);
  for (const n of [4, 6]) {
    const runs = gates >= 50 ? Math.ceil(N / 5) : N;
    const dur = [], evs = [], wins = new Array(n).fill(0); let boostWins = 0, maxB = 0, maxS = 0, capped = 0, skipped = 0;
    for (let k = 0; k < runs; k++) {
      const seed = (Math.random() * 2 ** 32) >>> 0;
      const r = simulate(seed, n, gates);
      if (r.winner < 0) { console.log('NO WINNER', gates, n, seed); bad++; continue; }
      dur.push(r.fin[r.winner]); evs.push(r.events.length); wins[r.winner]++;
      const last = r.events[r.events.length - 1];
      if (last && r.fin[r.winner] >= last.t && r.fin[r.winner] <= last.t + PAUSE) boostWins++;
      const b = new Array(n).fill(0), s = new Array(n).fill(0);
      for (const e of r.events) {
        if (e.boost >= 0) b[e.boost]++; else skipped++;
        if (e.setback >= 0) s[e.setback]++; else skipped++;
        if (e.boost >= 0 && e.boost === e.setback) { console.log('SAME HORSE BOOSTED AND SET BACK', seed); bad++; }
        if (e.gate >= gates) { console.log('EVENT AT THE FINISH GATE', seed); bad++; }
      }
      maxB = Math.max(maxB, ...b); maxS = Math.max(maxS, ...s);
      if (b.some(x => x === cap) || s.some(x => x === cap)) capped++;
      if (k < 50) {
        const r2 = simulate(seed, n, gates);
        if (r2.winner !== r.winner || r2.steps !== r.steps || r2.frames[r2.steps * n - 1] !== r.frames[r.steps * n - 1]) { console.log('NONDETERMINISTIC', seed); bad++; }
      }
    }
    if (maxB > cap || maxS > cap) { console.log(`LIMIT BROKEN at ${gates} gates: max boosts ${maxB}, max setbacks ${maxS}, cap ${cap}`); bad++; }
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))].toFixed(0); };
    console.log(`${String(gates).padStart(3)} gates, ${n} horses, cap ${String(cap).padStart(2)}: race ${q(dur, .1)}-${q(dur, .5)}-${q(dur, .9)}s (+${COUNTDOWN}s)` +
      ` | stops ${q(evs, .5)} | won by a boost ${(100 * boostWins / runs).toFixed(0)}% | lane wins ${wins.map(w => (100 * w / runs).toFixed(0)).join('/')}%` +
      ` | most on one horse ${maxB}⚡ ${maxS}🐌 | cap hit in ${(100 * capped / runs).toFixed(0)}% | ${skipped} skipped`);
  }
}
if (bad) { console.log(`${bad} problems`); process.exit(1); }
