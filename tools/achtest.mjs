// Checks the achievements: the list itself, unlocks from real engine races and attacks (each counted once),
// and how often each race moment happens, so every one of them can actually be unlocked.
//   node tools/achtest.mjs
import * as E from '../public/js/engine.js';
import { ACHIEVEMENTS, ACH_COUNT, GROUPS, freshProgress, cleanProgress, observe, analyzeRace } from '../public/js/achievements.js';
import { writeRace, rng } from '../public/js/sim.js';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };

// ---- the list
ok(ACH_COUNT === 50, `50 achievements (have ${ACH_COUNT})`);
ok(new Set(ACHIEVEMENTS.map(a => a.id)).size === ACH_COUNT, 'ids are unique');
ok(new Set(ACHIEVEMENTS.map(a => a.name)).size === ACH_COUNT, 'names are unique');
ok(ACHIEVEMENTS.every(a => a.icon && a.name && a.desc && a.g >= 0 && a.g < GROUPS.length), 'every achievement has an icon, name, description and group');

// ---- a little lobby: play races with chosen winners
const rand = rng(7);
const s = E.newRoom('12345', { pid: 'A', name: 'Ann', ach: 0 }, 1000, rand);
for (const [pid, name] of [['B', 'Bob'], ['C', 'Cat'], ['D', 'Dee'], ['E', 'Eve']]) E.addPlayer(s, { pid, name });
const prog = { A: freshProgress(), B: freshProgress(), C: freshProgress(), D: freshProgress(), E: freshProgress() };
const seeAll = () => { const out = {}; for (const pid in prog) out[pid] = observe(prog[pid], s, pid, 1); return out; };
/** Run a race; `bets` = { pid: [onWinner, bet] }. Returns what each player unlocked. */
function race(bets) {
  E.apply(s, 'A', { k: 'pick', h: 0, bet: 1 });     // something to start with
  ok(E.apply(s, 'A', { k: 'start' }, Date.now(), rand).ok, 'race starts');
  const w = s.race.winner, other = (w + 1) % s.race.n;
  s.picks = {};
  let seq = 0;
  for (const [pid, [win, bet]] of Object.entries(bets)) s.picks[pid] = { h: win ? w : other, bet, seq: ++seq };
  E.tick(s, s.race.endsAt + 1);
  ok(s.phase === 'results', 'race finished');
  return seeAll();
}
const has = (list, id) => list.includes(id);

let got = seeAll();
ok(has(got.A, 'host') && !has(got.B, 'host'), 'the host gets Stable Owner');
got = race({ A: [true, 20], B: [false, 20], C: [false, 5] });
ok(has(got.A, 'first-bet') && has(got.A, 'first-win') && has(got.A, 'all-in'), 'winner: first bet, first win, all in');
ok(has(got.B, 'first-loss') && has(got.B, 'farm') && !has(got.B, 'first-win'), 'loser: first loss, bet the farm');
ok(got.D.length === 0, 'someone who sat it out unlocks nothing');
ok(prog.A.st.wins === 1 && prog.A.st.chips === 20 && prog.B.st.taken === 20, 'lifetime counts');
got = seeAll();
ok(got.A.length === 0 && prog.A.st.bets === 1, 'seeing the same results again counts nothing twice');

// A attacks B with all 40
ok(E.apply(s, 'A', { k: 'attack', hits: { B: 40 } }).ok, 'attack goes through');
got = seeAll();
ok(has(got.A, 'first-attack') && has(got.A, 'vendetta') && !has(got.A, 'bite'), 'attacker: no mercy, vendetta (host attacking is not biting the hand)');
ok(has(got.B, 'first-hit') && has(got.B, 'pile-on'), 'target: ouch, pile-on');
ok(prog.B.st.taken === 60 && has(got.B, 'bruised'), 'penalties taken add up: 20 lost + 40 hit = bruised');

// next race: B wins and hits the host back; C and D hit E
E.apply(s, 'A', { k: 'next' });
const r2 = race({ B: [true, 10], C: [true, 3], D: [true, 3], A: [false, 1], E: [false, 2] });
ok(has(r2.A, 'first-loss'), 'A lost this one');
ok(has(r2.B, 'bandwagon') && has(r2.C, 'bandwagon') && has(r2.D, 'bandwagon'), 'bandwagon: B, C and D all backed the winner');
ok(E.apply(s, 'B', { k: 'attack', hits: { A: 20 } }).ok, 'B attacks the host');
ok(E.apply(s, 'C', { k: 'attack', hits: { E: 6 } }).ok && E.apply(s, 'D', { k: 'attack', hits: { E: 6 } }).ok, 'C and D attack E');
got = seeAll();
ok(has(got.B, 'revenge') && has(got.B, 'bite'), 'B: revenge on the host who hit them, bite the hand');
ok(has(got.E, 'ganged') && !has(got.E, 'pile-on'), 'E: ganged up on (12 penalties, not a pile-on)');

// streaks (C won race 2 too)
E.apply(s, 'A', { k: 'next' });
got = race({ C: [true, 1] });
ok(has(got.C, 'penny') && !has(got.C, 'streak-3'), 'C: penny pincher, two wins in a row');
E.apply(s, 'A', { k: 'next' });
got = race({ C: [true, 1] });
ok(has(got.C, 'streak-3'), 'C: three wins in a row');
E.apply(s, 'A', { k: 'next' });
got = race({ C: [false, 1], A: [false, 1] });
E.apply(s, 'A', { k: 'next' });
got = race({ C: [false, 1], A: [false, 1] });
ok(has(got.A, 'cursed') && !has(got.C, 'cursed'), 'A: three losses in a row (C only two)');

// lone wolf and bandwagon
E.apply(s, 'A', { k: 'next' });
got = race({ D: [true, 4], A: [false, 1], B: [false, 1], C: [false, 1] });
ok(has(got.D, 'lone-wolf'), 'lone wolf');
E.apply(s, 'A', { k: 'next' });
got = race({ A: [true, 1], B: [true, 1], C: [true, 1] });
ok(has(got.A, 'bandwagon') && !has(got.C, 'bandwagon'), 'bandwagon for A (C already has it)');

// styling and naming (as the state shows them)
E.apply(s, 'A', { k: 'next' });
E.apply(s, 'E', { k: 'pick', h: 1, bet: 2 });
ok(E.apply(s, 'E', { k: 'look', h: 1, look: { coat: 'zebra', mane: 'rainbow', hgear: 'jetpack' }, name: 'Sparkle Hooves' }).ok, 'E styles a horse');
got = seeAll();
ok(has(got.E, 'makeover') && has(got.E, 'rainbow') && has(got.E, 'namer'), 'makeover, rainbow, what\'s in a name');

// full house
for (const pid of ['F', 'G', 'H']) E.addPlayer(s, { pid, name: pid });
got = seeAll();
ok(has(got.A, 'full-house') && has(got.E, 'full-house'), 'full house at 8 players');

// the lobby hears about unlocks in one line
ok(E.apply(s, 'B', { k: 'ach', ids: ['photo', 'nope', 'wire', 'photo'], n: 12 }).ok && s.players.B.ach === 12, 'unlocks reach the lobby, with the count');
ok(s.log[s.log.length - 1].msg === '🏅 Bob unlocked 📸 Photo Finish and 🏁 Wire to Wire', 'one log line for several: ' + s.log[s.log.length - 1].msg);
ok(!E.apply(s, 'B', { k: 'ach', ids: ['nope'] }).ok, 'unknown achievements are refused');
ok(E.apply(s, 'B', { k: 'ach', ids: ['host'], n: 999 }).ok && s.players.B.ach === 50, 'the count tops out at 50');

// saved progress survives a round trip and junk
const saved = JSON.parse(JSON.stringify(prog.A));
ok(JSON.stringify(cleanProgress(saved).got) === JSON.stringify(prog.A.got), 'progress survives saving');
ok(Object.keys(cleanProgress({ got: { nope: 1, host: 2 }, st: 'x' }).got).join() === 'host', 'unknown or broken saves are cleaned up');
ok(cleanProgress(null).st.wins === 0, 'no save: a fresh start');

// ---- race moments: how often each happens for the winning horse (they all need to be possible)
const freq = { comeback: 0, wire: 0, photo: 0, lonely: 0, turbo: 0, shake: 0, rocket: 0, banana: 0, empty: 0 };
const runs = 4000;
for (let k = 0; k < runs; k++) {
  const n = 2 + (k % 7), G = [7, 10, 20, 20, 30, 50][k % 6];
  const w = writeRace((Math.random() * 2 ** 32) >>> 0, n, G);
  const race = { script: w.script, gates: G, n, winner: w.winner, order: w.order };
  const a = analyzeRace(race, w.winner);
  if (a.lastLate) freq.comeback++;
  if (!a.trailed) freq.wire++;
  if (a.photo) freq.photo++;
  if (a.lonely) freq.lonely++;
  if (a.boostFinish) freq.turbo++;
  if (a.setbacks >= 3) freq.shake++;
  if (a.boosts >= 3) freq.rocket++;
  if (a.setbacks >= 3) freq.banana++;
  if (a.hops >= Math.ceil((G * 11) / 10)) freq.empty++;
  ok(!(a.photo && a.lonely), 'a win is never both by one gate and by the biggest lead');
}
console.log('race moments, % of winning horses: ' + Object.entries(freq).map(([k, v]) => `${k} ${((100 * v) / runs).toFixed(1)}`).join(' · '));
for (const [k, v] of Object.entries(freq)) ok(v > 0, `${k} can happen`);

console.log(fails ? `${fails} failed` : 'all achievement checks passed');
process.exit(fails ? 1 : 0);
