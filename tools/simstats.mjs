// Runs many races and prints how long they take, how many gate stops happen, and win rates per lane.
//   node tools/simstats.mjs [races]
import { simulate, COUNTDOWN } from '../public/js/sim.js';
const N = +process.argv[2] || 3000;
for (const n of [4, 5, 6]) {
  const dur = [], evs = [], wins = new Array(n).fill(0); let boostWins = 0, margin = [];
  for (let k = 0; k < N; k++) {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const r = simulate(seed, n);
    if (r.winner < 0) { console.log('NO WINNER', seed); continue; }
    dur.push(r.fin[r.winner]); evs.push(r.events.length); wins[r.winner]++;
    const last = r.events[r.events.length - 1];
    if (last && r.fin[r.winner] >= last.t && r.fin[r.winner] <= last.t + 2.0) boostWins++;
    const second = r.order[1]; margin.push(r.fin[second] >= 0 ? r.fin[second] - r.fin[r.winner] : 99);
    // determinism check
    const r2 = simulate(seed, n);
    if (r2.winner !== r.winner || r2.steps !== r.steps || r2.frames[r2.steps * n - 1] !== r.frames[r.steps * n - 1]) console.log('NONDETERMINISTIC', seed);
  }
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))].toFixed(1); };
  console.log(`${n} horses: winner time p10/p50/p90 = ${q(dur, .1)}/${q(dur, .5)}/${q(dur, .9)}s (+${COUNTDOWN}s countdown)` +
    ` | gate stops p10/p50/p90 = ${q(evs, .1)}/${q(evs, .5)}/${q(evs, .9)} | won by a boost ${(100 * boostWins / N).toFixed(0)}%` +
    ` | close finish (<0.5s) ${(100 * margin.filter(m => m < .5).length / N).toFixed(0)}% | lane wins ${wins.map(w => (100 * w / N).toFixed(0) + '%').join(' ')}`);
}
