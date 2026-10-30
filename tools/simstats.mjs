// Writes and plays thousands of races and checks every rule, after every single action:
//  - no horse hops more than hopCap (110% of the gates, rounded up)
//  - until someone finishes, the leader is never more than leadCap (15% of the gates, rounded up) ahead of 2nd
//  - no horse gets more than effectCap boosts or setbacks (30% of the gates, rounded up)
//  - the same seed always writes the same race, and playing it agrees with what was written
// and prints race lengths, gate stops, how often a race ends with a bolt, and win rates per lane.
//   node tools/simstats.mjs [races per setup] [gate counts, comma separated]
import { writeRace, playRace, COUNTDOWN, effectCap, hopCap, leadCap } from '../public/js/sim.js';
const N = +process.argv[2] || 2000;
const gateList = (process.argv[3] || '3,7,20,50,100').split(',').map(Number);
let bad = 0;
const fail = msg => { if (bad++ < 20) console.log('PROBLEM:', msg); };
for (const [g, h, l, c] of [[20, 22, 3, 6], [7, 8, 2, 3], [3, 4, 1, 1], [10, 11, 2, 3], [50, 55, 8, 15], [100, 110, 15, 30]]) {
  if (hopCap(g) !== h || leadCap(g) !== l || effectCap(g) !== c) fail(`caps for ${g} gates: ${hopCap(g)}/${leadCap(g)}/${effectCap(g)}`);
}
for (const gates of gateList) {
  const H = hopCap(gates), L = leadCap(gates), C = effectCap(gates);
  for (const n of [2, 4, 6, 8]) {
    const runs = gates >= 50 ? Math.ceil(N / 5) : N;
    const dur = [], stops = [], wins = new Array(n).fill(0);
    let bolts = 0, maxGap = 0, maxHops = 0, maxB = 0, maxS = 0;
    for (let k = 0; k < runs; k++) {
      const seed = (Math.random() * 2 ** 32) >>> 0;
      const w = writeRace(seed, n, gates);
      if (k < 30 && JSON.stringify(writeRace(seed, n, gates).script) !== JSON.stringify(w.script)) fail(`seed ${seed} wrote two different races`);
      // replay the script and check the rules after every action
      const pos = new Array(n).fill(0), hops = new Array(n).fill(0), b = new Array(n).fill(0), s = new Array(n).fill(0);
      let winner = -1;
      const gap = () => { const p = [...pos].sort((x, y) => y - x); return p[0] - p[1]; };
      for (const a of w.script) {
        if (typeof a === 'number') { pos[a]++; hops[a]++; }
        else if (a[0] === 'bolt') { winner = a[1]; break; }
        else {
          if (a[1] >= 0) { pos[a[1]]++; b[a[1]]++; }
          if (a[2] >= 0) { pos[a[2]] = Math.max(0, pos[a[2]] - 1); s[a[2]]++; }
        }
        if (winner < 0) {
          const g = gap();
          if (g > L) fail(`${gates} gates, ${n} horses, seed ${seed}: leader ${g} gates ahead (limit ${L})`);
          maxGap = Math.max(maxGap, g);
          const first = pos.findIndex(p => p >= gates);
          if (first >= 0) winner = first;
        }
      }
      if (winner !== w.winner) fail(`seed ${seed}: replayed winner ${winner} but written winner ${w.winner}`);
      if (hops.some(x => x > H)) fail(`seed ${seed}: a horse hopped ${Math.max(...hops)} times (limit ${H})`);
      if (b.some(x => x > C) || s.some(x => x > C)) fail(`seed ${seed}: boost/setback cap broken`);
      maxHops = Math.max(maxHops, ...hops); maxB = Math.max(maxB, ...b); maxS = Math.max(maxS, ...s);
      const p = playRace(w, n, gates);
      if (p.winner !== w.winner || p.fin[w.winner] < 0) fail(`seed ${seed}: playback disagrees about the winner`);
      for (let i = 0; i < n; i++) if (i !== w.winner && p.fin[i] >= 0 && p.fin[i] < p.fin[w.winner]) fail(`seed ${seed}: someone crossed before the winner on screen`);
      if (w.bolt) bolts++;
      wins[w.winner]++;
      dur.push(p.fin[w.winner]); stops.push(p.events.length);
    }
    const q = (a, pp) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))].toFixed(0); };
    console.log(`${String(gates).padStart(3)} gates, ${n} horses: race ${q(dur, .1)}-${q(dur, .5)}-${q(dur, .9)}s (+${COUNTDOWN}s) | stops ${q(stops, .5)}` +
      ` | most hops ${maxHops}/${H} | biggest lead ${maxGap}/${L} | boosts ${maxB}/${C} setbacks ${maxS}/${C}` +
      ` | won by bolting ${(100 * bolts / runs).toFixed(1)}% | lane wins ${wins.map(x => (100 * x / runs).toFixed(0)).join('/')}%`);
  }
}
if (bad) { console.log(`${bad} problems`); process.exit(1); }
console.log('all race rules hold');
