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
// styling a horse
{
  const fancy = { coat: 'zebra', mane: 'rainbow', outfit: 'galaxy', hat: 'sombrero', hgear: 'jetpack', rgear: 'balloon' };
  ok(!E.apply(s, 'A', { k: 'look', h: 0, look: fancy }).ok, 'only the first picker can style a horse');
  ok(E.apply(s, 'B', { k: 'look', h: 0, look: fancy, name: 'Zebra Rocket' }).ok, 'first picker styles it');
  const h0 = s.horses[0];
  ok(h0.name === 'Zebra Rocket' && h0.look && h0.look.coat === 'zebra' && h0.look.hgear === 'jetpack' && h0.styledBy === 'B', 'look and name saved');
  E.apply(s, 'B', { k: 'look', h: 0, look: { coat: 'plaid<script>', hat: 'nope', hgear: 'horn' } });
  ok(h0.look.hat === 'helmet' && h0.look.hgear === 'horn' && !String(h0.look.coat).includes('<'), 'unknown values fall back to defaults');
  E.apply(s, 'B', { k: 'look', h: 0, look: {} });
  ok(h0.look === null, 'back to plain: no look stored');
  E.apply(s, 'B', { k: 'look', h: 0, look: fancy });
}
// number of horses
{
  const t = E.newRoom('22222', { pid: 'H', name: 'Hal' }, 1000);
  E.addPlayer(t, { pid: 'G', name: 'Gil' });
  ok(t.horses.length >= 4 && t.horses.length <= 6, 'a new lobby has 4-6 horses');
  ok(!E.apply(t, 'G', { k: 'horses', n: 8 }).ok, 'only the host picks the number of horses');
  ok(!E.apply(t, 'H', { k: 'horses', n: 1 }).ok && !E.apply(t, 'H', { k: 'horses', n: 9 }).ok, 'fields are 2 to 8 horses');
  // style horse 1 (index 0) and bet on it, then add a horse: horse 1 stays exactly as it is
  E.apply(t, 'H', { k: 'horses', n: 3 });
  E.apply(t, 'G', { k: 'pick', h: 0, bet: 3 });
  E.apply(t, 'G', { k: 'look', h: 0, look: { coat: 'rainbow', hat: 'wizard' }, name: 'Sparkle Pony' });
  const firstThree = JSON.stringify(t.horses);
  ok(E.apply(t, 'H', { k: 'horses', n: 4 }).ok && t.horses.length === 4, 'add a 4th horse');
  ok(JSON.stringify(t.horses.slice(0, 3)) === firstThree, 'the horses already there are untouched');
  ok(t.picks.G && t.picks.G.h === 0 && t.picks.G.bet === 3, 'picks on them stay');
  ok(!t.horses.slice(0, 3).some(h => h.name === t.horses[3].name), 'the new horse has its own name');
  // 6 horses, style #6, take it out, put it back: it comes back fresh
  E.apply(t, 'H', { k: 'horses', n: 6 });
  E.apply(t, 'H', { k: 'pick', h: 5, bet: 2 });
  E.apply(t, 'H', { k: 'look', h: 5, look: { coat: 'zebra' }, name: 'Stripey' });
  ok(t.horses[5].name === 'Stripey' && t.horses[5].look.coat === 'zebra', '#6 styled');
  ok(E.apply(t, 'H', { k: 'horses', n: 5 }).ok && t.horses.length === 5 && !t.picks.H, 'remove #6: its pick goes too');
  ok(t.horses[0].name === 'Sparkle Pony' && t.picks.G.h === 0, 'the others are untouched');
  E.apply(t, 'H', { k: 'horses', n: 6 });
  ok(t.horses[5].name !== 'Stripey' && !t.horses[5].look, '#6 comes back as a brand new horse');
  E.apply(t, 'H', { k: 'horses', n: 8 });
  ok(new Set(t.horses.map(h => h.coat)).size === 8 && E.SILKS.length >= 8, '8 horses all look different');
  // a race, then the next race: same horses, same looks, same picks already selected
  E.apply(t, 'H', { k: 'pick', h: 7, bet: 6 });
  const before = JSON.stringify(t.horses);
  ok(E.apply(t, 'H', { k: 'start' }, 2000).ok && t.race.n === 8, 'an 8-horse race starts');
  ok(!E.apply(t, 'H', { k: 'horses', n: 5 }).ok, 'no field changes mid-race');
  E.tick(t, t.race.endsAt);
  ok(E.apply(t, 'H', { k: 'next' }).ok && t.phase === 'betting', 'next race');
  ok(JSON.stringify(t.horses) === before, 'same horses next race, names and looks and all');
  ok(t.picks.G.h === 0 && t.picks.G.bet === 3 && t.picks.H.h === 7 && t.picks.H.bet === 6, 'last race\'s picks and bets are already selected');
  ok(E.ownerOf(t, 0) === 'G', 'the first picker can still style it');
  ok(E.apply(t, 'H', { k: 'horses', n: 0 }).ok && t.horses.length >= 4 && t.horses.length <= 6 && t.horses[0].name === 'Sparkle Pony', 'random 4-6 keeps the first horses');
}
// track length
ok(E.gatesOf(s) === 20, 'tracks start with 20 gates');
ok(!E.apply(s, 'B', { k: 'gates', n: 7 }).ok, 'only the host changes the track');
ok(!E.apply(s, 'A', { k: 'gates', n: 2 }).ok && !E.apply(s, 'A', { k: 'gates', n: 101 }).ok, 'track is 3 to 100 gates');
ok(E.apply(s, 'A', { k: 'gates', n: 7 }).ok && E.gatesOf(s) === 7, 'host sets 7 gates');
ok(!E.apply(s, 'B', { k: 'start' }).ok, 'non-host cannot start');
ok(E.apply(s, 'A', { k: 'start' }, 2000).ok && s.phase === 'racing', 'host starts');
ok(!E.apply(s, 'C', { k: 'pick', h: 2, bet: 3 }).ok, 'no picks while racing');
ok(s.race.gates === 7, 'the race uses the track length');
ok(!E.apply(s, 'A', { k: 'gates', n: 50 }).ok, 'no track changes mid-race');
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
ok(!E.apply(s, 'A', { k: 'attack', hits: {} }).ok, 'no mercy: an empty attack is refused');
ok(E.apply(s, 'A', { k: 'attack', hits: { B: 1 } }).ok && E.pendingAttackers(s).length === 0, 'A attacks');
ok(!E.apply(s, 'B', { k: 'next' }).ok, 'non-host cannot advance');
ok(E.apply(s, 'A', { k: 'next' }).ok && s.phase === 'betting' && s.raceNo === 2 && s.picks.B && s.picks.B.h === 0, 'next race (picks carry over)');
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
// the leaderboard: most chips, then fewest penalties; level players share a rank
{
  const t = E.newRoom('22222', { pid: 'a', name: 'A' }, 1000);
  for (const id of ['b', 'c', 'd', 'e']) E.addPlayer(t, { pid: id, name: id.toUpperCase() });
  Object.assign(t.players.a, { chips: 5, taken: 10 });
  Object.assign(t.players.b, { chips: 12, taken: 30 });
  Object.assign(t.players.c, { chips: 5, taken: 2 });
  Object.assign(t.players.d, { chips: 5, taken: 2 });
  Object.assign(t.players.e, { chips: 0, taken: 0 });
  const st = E.standings(t);
  ok(st.map(x => x.pid).join('') === 'bcdae', 'leaderboard order: ' + st.map(x => x.pid).join(''));
  ok(st.map(x => x.rank).join() === '1,2,2,4,5', 'tied players share a rank: ' + st.map(x => x.rank).join());
}
// up to 8 players online at once; seats of players who left don't count, but they can't come back into a full lobby
{
  const t = E.newRoom('54321', { pid: 'h', name: 'Host' }, 1000);
  for (let i = 1; i < E.MAX_PLAYERS; i++) ok(E.addPlayer(t, { pid: 'p' + i, name: 'P' + i, relay: i === 3 }).ok, `player ${i + 1} joins`);
  ok(E.MAX_PLAYERS === 8, 'lobby max is 8');
  ok(t.players.p3.relay === true && t.players.p2.relay === false, 'relayed players are marked');
  ok(!E.addPlayer(t, { pid: 'p9', name: 'Nine' }).ok, 'a 9th player is turned away');
  E.setOnline(t, 'p1', false);
  ok(E.addPlayer(t, { pid: 'p9', name: 'Nine' }).ok, 'a seat opens when someone leaves');
  ok(!E.addPlayer(t, { pid: 'p1', name: 'P1' }).ok, 'the player who left can not squeeze back into a full lobby');
  ok(E.addPlayer(t, { pid: 'p2', name: 'P2' }).ok, 'someone already here reconnecting is fine');
}
console.log(fails ? `${fails} failed` : 'all engine checks passed');
process.exit(fails ? 1 : 0);
