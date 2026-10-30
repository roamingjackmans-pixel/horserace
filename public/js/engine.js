// Room state and game rules. Only the host runs these functions; everyone else just receives the state.
// Every function here is plain data in, plain data out, so it also runs under Node for tests.
import { NAMES } from './names.js';
import { cleanLook, isCustom } from './looks.js';
import { writeRace, playRace, COUNTDOWN, DEFAULT_GATES, MIN_GATES, MAX_GATES } from './sim.js';

export const PROTO = 9;               // bump when the message format, rules or race simulation change
/** Gates on this lobby's track (older saved lobbies didn't have the setting). */
export const gatesOf = s => s.gates || DEFAULT_GATES;
export const MIN_BET = 1;
export const MAX_BET = 20;
export const PENALTY_MULT = 2;        // winners dish out 2x their bet in penalties
export const MAX_PLAYERS = 8;         // players online at once (seats of players who left don't count)
// A lobby starts with 4 to 6 horses at random. The host can set any number from 2 to 8 (or roll a random 4-6).
// The same horses race every round (names, looks and everyone's pick all carry over); adding horses puts new
// ones on the end, removing takes them off the end.
export const MIN_HORSES = 2;
export const MAX_HORSES = 8;
export const RANDOM_MIN = 4;
export const RANDOM_MAX = 6;

// Saddle cloth / silks colours by lane, the classic racing set:
// 1 red, 2 white, 3 blue, 4 yellow, 5 green, 6 black, 7 orange, 8 pink.
export const SILKS = [
  { bg: '#d8312c', fg: '#ffffff', cap: '#ffffff' },
  { bg: '#f3efe6', fg: '#1d1d1d', cap: '#d8312c' },
  { bg: '#2a5bd7', fg: '#ffffff', cap: '#ffd23f' },
  { bg: '#f7d02c', fg: '#1d1d1d', cap: '#2a5bd7' },
  { bg: '#1f9a48', fg: '#ffffff', cap: '#ffffff' },
  { bg: '#1e1e22', fg: '#f7d02c', cap: '#f7d02c' },
  { bg: '#f28a1d', fg: '#1d1d1d', cap: '#1e1e22' },
  { bg: '#f48fb8', fg: '#1d1d1d', cap: '#1f9a48' },
];

// Coat colours: [body, mane/tail]
export const COATS = [
  ['#8a4b2a', '#2a1810'], // bay
  ['#b8622e', '#7a3615'], // chestnut
  ['#2d2522', '#120e0c'], // black
  ['#a7a39d', '#5c5853'], // grey
  ['#dcae57', '#f6ead0'], // palomino
  ['#ece5d8', '#b9b0a2'], // white
  ['#b58c5c', '#3b2a1a'], // dun
  ['#6e3b2a', '#e9e2d6'], // chocolate with a flaxen mane
];

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const int = v => (Number.isFinite(+v) ? Math.round(+v) : NaN);

function shuffle(a, rand = Math.random) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function log(s, msg) {
  s.logId = (s.logId || 0) + 1;
  s.log.push({ id: s.logId, msg });
  if (s.log.length > 30) s.log.splice(0, s.log.length - 30);
}

export function newRoom(code, host, now = Date.now()) {
  const s = {
    v: PROTO, code, hostPid: host.pid, created: now,
    players: {}, order: [], joinSeq: 0,
    raceNo: 0, phase: 'betting', horses: [], picks: {}, pickSeq: 0, recent: [], gates: DEFAULT_GATES,
    race: null, res: null, log: [], logId: 0,
  };
  addPlayer(s, host);
  setFieldSize(s, randomFieldSize());
  newRace(s);
  s.log = [];
  log(s, `${s.players[host.pid].name} opened the lobby`);
  return s;
}

/** Someone said hello. Adds them, or brings back their old seat (and tallies) if they were here before. */
export function addPlayer(s, p) {
  const pid = clean(p.pid, 24);
  if (!pid) return { ok: false, err: 'Bad player id' };
  const name = clean(p.name, 20) || 'Mystery Guest';
  const av = clean(p.av, 8) || '🐴';
  const old = s.players[pid];
  const online = s.order.filter(id => s.players[id].on).length;
  const full = { ok: false, err: `This lobby is full (${MAX_PLAYERS} players max)` };
  if (old) {
    const back = !old.on;
    if (back && online >= MAX_PLAYERS) return full;
    old.on = true; old.name = name; old.av = av; old.relay = !!p.relay;
    if (back && !(s.quietUntil > Date.now())) log(s, `${name} is back`);
    return { ok: true, back };
  }
  if (online >= MAX_PLAYERS) return full;
  s.players[pid] = { pid, name, av, n: ++s.joinSeq, on: true, chips: 0, wins: 0, taken: 0, races: 0, relay: !!p.relay };
  s.order.push(pid);
  log(s, `${name} joined`);
  return { ok: true, back: false };
}

export function setOnline(s, pid, on) {
  const p = s.players[pid];
  if (!p || p.on === on) return false;
  p.on = on;
  if (!on) log(s, `${p.name} left`);
  return true;
}

/**
 * Next race. The same horses run again, looking just the same, and everyone's pick (and bet) from last race
 * is already selected for them; they can change it before the start.
 */
export function newRace(s, rand = Math.random) {
  if (!s.horses.length) setFieldSize(s, randomFieldSize(rand), rand);
  for (const pid in s.picks) {
    if (!s.players[pid] || !(s.picks[pid].h < s.horses.length)) delete s.picks[pid];
  }
  s.raceNo++;
  s.phase = 'betting';
  s.race = null;
  s.res = null;
}

export const randomFieldSize = (rand = Math.random) => RANDOM_MIN + Math.floor(rand() * (RANDOM_MAX - RANDOM_MIN + 1));

/**
 * Make the field n horses long. Horses already there stay exactly as they are. New ones join at the end with
 * a fresh funny name; taking horses away removes them from the end (with their name, look and anyone's pick),
 * so a horse added back later is brand new.
 */
export function setFieldSize(s, n, rand = Math.random) {
  n = Math.max(MIN_HORSES, Math.min(MAX_HORSES, n));
  if (n < s.horses.length) {
    s.horses = s.horses.slice(0, n);
    for (const pid in s.picks) if (s.picks[pid].h >= n) delete s.picks[pid];
    return;
  }
  const taken = new Set([...(s.recent || []), ...s.horses.map(h => h.name), ...s.horses.map(h => h.orig)]);
  let pool = shuffle(NAMES.filter(x => !taken.has(x)), rand);
  if (pool.length < n) pool = shuffle(NAMES.filter(x => !s.horses.some(h => h.name === x)), rand);
  const usedCoats = new Set(s.horses.map(h => h.coat));
  const coats = shuffle(COATS.map((c, i) => i).filter(i => !usedCoats.has(i)), rand);
  while (s.horses.length < n) {
    const name = pool.shift();
    const coat = coats.length ? coats.shift() : Math.floor(rand() * COATS.length);
    s.horses.push({ name, orig: name, coat, by: null });
    s.recent = [...(s.recent || []), name].slice(-60);
  }
}

/** pid of the person allowed to rename horse h: whoever picked it first (of the people still on it). */
export function ownerOf(s, h) {
  let best = null;
  for (const pid in s.picks) {
    const p = s.picks[pid];
    if (p.h === h && (!best || p.seq < s.picks[best].seq)) best = pid;
  }
  return best;
}

export function backers(s, h) {
  return Object.keys(s.picks).filter(pid => s.picks[pid].h === h).sort((a, b) => s.picks[a].seq - s.picks[b].seq);
}

/**
 * Apply a player's action. Returns { ok, err?, attack? }.
 * Actions: pick {h, bet} · bet {bet} · unpick · rename {h, name} · gates {n} · start · attack {hits} · next · profile {name, av} · remove {pid}
 */
export function apply(s, pid, a, now = Date.now(), rand = Math.random) {
  const me = s.players[pid];
  if (!me) return { ok: false, err: 'You are not in this lobby' };
  if (!a || typeof a !== 'object') return { ok: false, err: 'Bad action' };
  const isHost = pid === s.hostPid;
  switch (a.k) {
    case 'pick': {
      if (s.phase !== 'betting') return { ok: false, err: 'Bets are closed' };
      const h = int(a.h), bet = int(a.bet);
      if (!(h >= 0 && h < s.horses.length)) return { ok: false, err: 'No such horse' };
      if (!(bet >= MIN_BET && bet <= MAX_BET)) return { ok: false, err: `Bets are ${MIN_BET} to ${MAX_BET} chips` };
      const cur = s.picks[pid];
      if (cur && cur.h === h) { cur.bet = bet; return { ok: true }; }
      s.picks[pid] = { h, bet, seq: ++s.pickSeq };
      return { ok: true };
    }
    case 'bet': {
      if (s.phase !== 'betting') return { ok: false, err: 'Bets are closed' };
      const bet = int(a.bet);
      if (!(bet >= MIN_BET && bet <= MAX_BET)) return { ok: false, err: `Bets are ${MIN_BET} to ${MAX_BET} chips` };
      if (!s.picks[pid]) return { ok: false, err: 'Pick a horse first' };
      s.picks[pid].bet = bet;
      return { ok: true };
    }
    case 'unpick': {
      if (s.phase !== 'betting') return { ok: false, err: 'Bets are closed' };
      delete s.picks[pid];
      return { ok: true };
    }
    case 'rename': {
      if (s.phase !== 'betting') return { ok: false, err: 'Too late to rename, the race is on' };
      const h = int(a.h);
      if (!(h >= 0 && h < s.horses.length)) return { ok: false, err: 'No such horse' };
      if (ownerOf(s, h) !== pid) return { ok: false, err: 'Only the first person to pick this horse can rename it' };
      const name = clean(a.name, 28);
      if (!name) return { ok: false, err: 'Give it a name' };
      const horse = s.horses[h];
      if (name === horse.name) return { ok: true };
      log(s, `${me.name} renamed #${h + 1} ${horse.name} to ${name}`);
      horse.name = name; horse.by = pid;
      return { ok: true };
    }
    case 'look': {
      // the first person on a horse styles it: coat, mane, rider outfit, hat and add-ons (plus its name)
      if (s.phase !== 'betting') return { ok: false, err: 'Too late to restyle, the race is on' };
      const h = int(a.h);
      if (!(h >= 0 && h < s.horses.length)) return { ok: false, err: 'No such horse' };
      if (ownerOf(s, h) !== pid) return { ok: false, err: 'Only the first person to pick this horse can style it' };
      const horse = s.horses[h];
      if (a.name != null) {
        const name = clean(a.name, 28);
        if (name && name !== horse.name) {
          log(s, `${me.name} renamed #${h + 1} ${horse.name} to ${name}`);
          horse.name = name; horse.by = pid;
        }
      }
      const look = cleanLook(a.look, horse.coat);
      if (JSON.stringify(look) !== JSON.stringify(horse.look || null)) {
        horse.look = isCustom(look, horse.coat) ? look : null;
        horse.styledBy = horse.look ? pid : null;
        if (horse.look) log(s, `${me.name} gave #${h + 1} ${horse.name} a makeover`);
      }
      return { ok: true };
    }
    case 'start': {
      if (!isHost) return { ok: false, err: 'Only the host can start the race' };
      if (s.phase !== 'betting') return { ok: false, err: 'The race already started' };
      // anyone who is away doesn't race
      for (const id in s.picks) if (!s.players[id] || !s.players[id].on) delete s.picks[id];
      if (!Object.keys(s.picks).length) return { ok: false, err: 'Nobody has bet yet' };
      const seed = Math.floor(rand() * 4294967296) >>> 0;
      const gates = gatesOf(s);
      // the whole race is written now (every hop, stop, boost and setback); everyone just plays it out
      const written = writeRace(seed, s.horses.length, gates);
      const sim = playRace(written, s.horses.length, gates);
      const startAt = now + COUNTDOWN * 1000;
      s.race = { seed, n: s.horses.length, gates, startAt, endsAt: startAt + Math.ceil((sim.endT + 1) * 1000), winner: written.winner, order: written.order, bolt: written.bolt, script: written.script };
      s.phase = 'racing';
      const bettors = Object.keys(s.picks).length;
      log(s, `Race ${s.raceNo} is off! ${gates} gates, ${bettors} ${bettors === 1 ? 'bet' : 'bets'} placed`);
      return { ok: true };
    }
    case 'horses': {
      if (!isHost) return { ok: false, err: 'Only the host can change how many horses run' };
      if (s.phase !== 'betting') return { ok: false, err: 'You can change the horses between races' };
      // n = 0 means "roll a random 4-6"
      let n = int(a.n);
      if (!(n === 0 || (n >= MIN_HORSES && n <= MAX_HORSES))) return { ok: false, err: `Races have ${MIN_HORSES} to ${MAX_HORSES} horses` };
      if (n === 0) n = randomFieldSize(rand);
      const was = s.horses.length;
      if (n === was) return { ok: true };
      setFieldSize(s, n, rand);   // keeps the horses that are already there
      log(s, n > was
        ? `${me.name} added ${n - was === 1 ? 'a horse' : `${n - was} horses`} (${n} running)`
        : `${me.name} took ${was - n === 1 ? `#${was} out` : `#${n + 1} to #${was} out`} (${n} running)`);
      return { ok: true };
    }
    case 'gates': {
      if (!isHost) return { ok: false, err: 'Only the host can change the track' };
      if (s.phase !== 'betting') return { ok: false, err: 'You can change the track between races' };
      const g = int(a.n);
      if (!(g >= MIN_GATES && g <= MAX_GATES)) return { ok: false, err: `Tracks have ${MIN_GATES} to ${MAX_GATES} gates` };
      if (g === gatesOf(s)) return { ok: true };
      s.gates = g;
      log(s, `${me.name} set the track to ${g} gates`);
      return { ok: true };
    }
    case 'attack': {
      if (s.phase !== 'results' || !s.res) return { ok: false, err: 'No penalties to give right now' };
      const max = s.res.pools[pid] || 0;
      if (!max) return { ok: false, err: 'Only winners can dish out penalties' };
      if (s.res.done[pid]) return { ok: false, err: 'You already dished out your penalties' };
      const hits = {};
      let total = 0;
      for (const [target, v] of Object.entries(a.hits || {})) {
        const n = int(v);
        if (!(n > 0)) continue;
        if (target === pid) return { ok: false, err: "You can't penalize yourself" };
        if (!s.players[target]) return { ok: false, err: 'That player is not in the lobby' };
        hits[target] = n; total += n;
      }
      if (total > max) return { ok: false, err: `You only have ${max} penalties to give` };
      if (total < 1) return { ok: false, err: 'No mercy! Give at least one penalty to someone' };
      s.res.done[pid] = true;
      const attack = { id: `r${s.raceNo}-${pid}`, from: pid, hits, total };
      s.res.attacks.push(attack);
      for (const [target, n] of Object.entries(hits)) s.players[target].taken += n;
      const list = Object.entries(hits).map(([t, n]) => `${s.players[t].name} (${n})`).join(', ');
      log(s, `${me.name} attacked ${list}`);
      return { ok: true, attack };
    }
    case 'next': {
      if (!isHost) return { ok: false, err: 'Only the host can start the next race' };
      if (s.phase !== 'results') return { ok: false, err: 'The race is not over yet' };
      newRace(s, rand);
      return { ok: true };
    }
    case 'profile': {
      const name = clean(a.name, 20), av = clean(a.av, 8);
      if (name && name !== me.name) { log(s, `${me.name} is now ${name}`); me.name = name; }
      if (av) me.av = av;
      return { ok: true };
    }
    case 'remove': {
      if (!isHost) return { ok: false, err: 'Only the host can remove players' };
      const t = s.players[a.pid];
      if (!t || a.pid === pid) return { ok: false, err: 'No such player' };
      if (t.on) return { ok: false, err: 'You can only remove players who have left' };
      delete s.players[a.pid];
      delete s.picks[a.pid];
      s.order = s.order.filter(id => id !== a.pid);
      log(s, `${t.name} was removed from the lobby`);
      return { ok: true };
    }
  }
  return { ok: false, err: 'Unknown action' };
}

/** Called by the host a few times a second. Ends the race when its time is up. Returns true if the state changed. */
export function tick(s, now = Date.now()) {
  if (s.phase === 'racing' && s.race && now >= s.race.endsAt) { finishRace(s); return true; }
  return false;
}

/**
 * The race is over. Winners win the chips they bet and get 2x their bet in penalties to hand out.
 * Everyone who backed a losing horse takes penalties equal to their bet.
 */
export function finishRace(s) {
  const w = s.race.winner;
  const payouts = [], pools = {};
  for (const pid of Object.keys(s.picks).sort((a, b) => s.picks[a].seq - s.picks[b].seq)) {
    const p = s.picks[pid], pl = s.players[pid];
    if (!pl) continue;
    const win = p.h === w;
    payouts.push({ pid, h: p.h, bet: p.bet, win });
    pl.races++;
    if (win) {
      pl.chips += p.bet; pl.wins++;
      if (s.order.some(id => id !== pid)) pools[pid] = p.bet * PENALTY_MULT;   // (nobody else here: nobody to attack)
    }
    else pl.taken += p.bet;
  }
  s.res = { winner: w, order: s.race.order, payouts, pools, done: {}, attacks: [] };
  s.phase = 'results';
  const winners = payouts.filter(p => p.win), losers = payouts.filter(p => !p.win);
  log(s, `#${w + 1} ${s.horses[w].name} won race ${s.raceNo}! ` +
    (winners.length ? `Chips to ${winners.map(p => `${s.players[p.pid].name} (+${p.bet})`).join(', ')}` : 'Nobody backed it.'));
  if (losers.length) log(s, `Lost bets, penalties taken: ${losers.map(p => `${s.players[p.pid].name} (${p.bet})`).join(', ')}`);
}

/** Winners who still have penalties to hand out. */
export function pendingAttackers(s) {
  if (s.phase !== 'results' || !s.res) return [];
  return Object.keys(s.res.pools).filter(pid => !s.res.done[pid]);
}

/**
 * A guest takes over as host with the last state it saw.
 * offset: (old host's clock) - (my clock), so timestamps can be moved onto my clock.
 */
export function takeOver(s, pid, offset = 0) {
  const old = s.hostPid !== pid ? s.players[s.hostPid] : null;
  s.hostPid = pid;
  for (const id in s.players) s.players[id].on = id === pid;
  if (s.race) { s.race.startAt -= offset; s.race.endsAt -= offset; }
  s.quietUntil = Date.now() + 30000;   // everyone reconnecting right now is not news
  const me = s.players[pid] ? s.players[pid].name : 'Someone';
  log(s, old ? `${me} is now hosting (${old.name} dropped out)` : `${me} is hosting again`);
}
