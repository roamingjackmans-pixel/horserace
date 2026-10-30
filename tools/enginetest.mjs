// Plays a few rounds of the rules engine in memory and checks the important rules.
//   node tools/enginetest.mjs
import * as E from '../public/js/engine.js';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };
const s = E.newRoom('12345', { pid: 'A', name: 'Ann', av: '🤠' }, 1000);
E.addPlayer(s, { pid: 'B', name: 'Bob' }); E.addPlayer(s, { pid: 'C', name: 'Cat' });
ok(s.horses.length >= 4 && s.horses.length <= 6, 'horse count');
ok(new Set(s.horses.map(h => h.name)).size === s.horses.length, 'unique names');
ok(E.apply(s, 'B', { k: 'pick', h: 0, bet: 5 }).ok, 'B picks 0');
ok(E.apply(s, 'A', { k: 'pick', h: 0, bet: 20 }).ok, 'A picks 0 too');
ok(!E.apply(s, 'A', { k: 'pick', h: 0, bet: 21 }).ok, 'bet 21 rejected');
ok(!E.apply(s, 'A', { k: 'pick', h: 0, bet: 0 }).ok, 'bet 0 rejected');
ok(E.ownerOf(s, 0) === 'B', 'first picker owns horse');
ok(!E.apply(s, 'A', { k: 'rename', h: 0, name: 'Nope' }).ok, 'second picker cannot rename');
ok(E.apply(s, 'B', { k: 'rename', h: 0, name: 'Glue Stick' }).ok && s.horses[0].name === 'Glue Stick', 'owner renames');
ok(E.apply(s, 'B', { k: 'bet', bet: 7 }).ok && E.ownerOf(s, 0) === 'B', 'changing bet keeps ownership');
ok(E.apply(s, 'C', { k: 'pick', h: 1, bet: 3 }).ok, 'C picks 1');
ok(!E.apply(s, 'B', { k: 'start' }).ok, 'non-host cannot start');
ok(E.apply(s, 'A', { k: 'start' }, 2000).ok && s.phase === 'racing', 'host starts');
ok(!E.apply(s, 'C', { k: 'pick', h: 2, bet: 3 }).ok, 'no picks while racing');
ok(!E.tick(s, s.race.endsAt - 1), 'race still running');
// force a known winner for the test
s.race.winner = 0;
ok(E.tick(s, s.race.endsAt) && s.phase === 'results', 'race ends');
ok(s.players.A.chips === 20 && s.players.B.chips === 7 && s.players.C.chips === 0, 'chips paid only to winners');
ok(s.res.pools.A === 40 && s.res.pools.B === 14 && !s.res.pools.C, 'penalty pools are 2x bet');
ok(s.players.C.taken === 3 && s.players.A.taken === 0 && s.players.B.taken === 0, 'loser takes penalties equal to the bet, winners take none');
ok(!('given' in s.players.A), 'penalties given are not tracked');
ok(!E.apply(s, 'C', { k: 'attack', hits: { A: 1 } }).ok, 'loser cannot attack');
ok(!E.apply(s, 'B', { k: 'attack', hits: { C: 15 } }).ok, 'cannot exceed pool');
ok(!E.apply(s, 'B', { k: 'attack', hits: { B: 1 } }).ok, 'cannot hit yourself');
const r = E.apply(s, 'B', { k: 'attack', hits: { C: 10, A: 4 } });
ok(r.ok && r.attack.total === 14, 'B attacks C and A');
ok(!E.apply(s, 'B', { k: 'attack', hits: { C: 1 } }).ok, 'cannot attack twice');
ok(s.players.C.taken === 13 && s.players.A.taken === 4 && s.players.B.taken === 0, 'tallies: lost bet + attacks add up');
ok(E.pendingAttackers(s).join() === 'A', 'A still pending');
ok(E.apply(s, 'A', { k: 'attack', hits: {} }).ok && E.pendingAttackers(s).length === 0, 'mercy');
ok(!E.apply(s, 'B', { k: 'next' }).ok, 'non-host cannot advance');
ok(E.apply(s, 'A', { k: 'next' }).ok && s.phase === 'betting' && s.raceNo === 2 && !Object.keys(s.picks).length, 'next race');
ok(s.players.A.chips === 20, 'tallies persist across races');
// host leaves, Bob takes over
E.setOnline(s, 'A', false);
E.takeOver(s, 'B', 500);
ok(s.hostPid === 'B' && s.players.B.on && !s.players.C.on, 'takeover');
ok(E.addPlayer(s, { pid: 'A', name: 'Ann' }).back && s.players.A.chips === 20, 'old host comes back with tallies');
ok(!E.apply(s, 'B', { k: 'remove', pid: 'A' }).ok, 'cannot remove online player');
E.setOnline(s, 'C', false);
ok(E.apply(s, 'B', { k: 'remove', pid: 'C' }).ok && !s.players.C, 'remove offline player');
// a race with nobody on the winner
E.apply(s, 'A', { k: 'pick', h: 0, bet: 3 });
E.apply(s, 'B', { k: 'start' }, 5000); s.race.winner = 1; E.tick(s, s.race.endsAt);
ok(Object.keys(s.res.pools).length === 0, 'no winners, no penalties to hand out');
ok(s.players.A.taken === 7, 'everyone who bet still takes their bet in penalties when nobody wins');
ok(JSON.stringify(s).length < 6000, 'state stays small: ' + JSON.stringify(s).length + ' bytes');
console.log(fails ? `${fails} failed` : 'all engine checks passed');
process.exit(fails ? 1 : 0);
