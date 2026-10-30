// Room state and game rules. Only the host runs these functions; everyone else just receives the state.
// Every function here is plain data in, plain data out, so it also runs under Node for tests.
import { NAMES } from './names.js';
import { cleanLook, isCustom } from './looks.js';
import { simulate, COUNTDOWN, DEFAULT_GATES, MIN_GATES, MAX_GATES, effectCap } from './sim.js';

export const PROTO = 6;               // bump when the message format, rules or race simulation change
/** Gates on this lobby's track (older saved lobbies didn't have the setting). */
export const gatesOf = s => s.gates || DEFAULT_GATES;
export const MIN_BET = 1;
export const MAX_BET = 20;
export const PENALTY_MULT = 2;        // winners dish out 2x their bet in penalties
export const MAX_PLAYERS = 16;
// The host picks how many horses run (2 to 8), or leaves it on random, which deals 4 to 6 each race.
export const MIN_HORSES = 2;
export const MAX_HORSES = 8;
export const RANDOM_MIN = 4;
export const RANDOM_MAX = 6;
/** The lobby's horse setting: 0 = random 4-6, otherwise the exact number. */
export const horseSetting = s => s.horseCount || 0;

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
  if (old) {
    const back = !old.on;
    old.on = true; old.name = name; old.av = av;
    if (back && !(s.quietUntil > Date.now())) log(s, `${name} is back`);
    return { ok: true, back };
  }
  const online = s.order.filter(id => s.players[id].on).length;
  if (online >= MAX_PLAYERS) return { ok: false, err: `This lobby is full (${MAX_PLAYERS} players)` };
  s.players[pid] = { pid, name, av, n: ++s.joinSeq, on: true, chips: 0, wins: 0, taken: 0, races: 0 };
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

/** Next race: a fresh field of horses with random funny names. */
export function newRace(s, rand = Math.random) {
  dealHorses(s, rand);
  s.raceNo++;
  s.phase = 'betting';
  s.race = null;
  s.res = null;
}

/** Deal the horses for this race (as many as the host chose, or 4-6 at random). Clears everyone's picks. */
export function dealHorses(s, rand = Math.random) {
  const n = horseSetting(s) || RANDOM_MIN + Math.floor(rand() * (RANDOM_MAX - RANDOM_MIN + 1));
  const recent = new Set(s.recent);
  const pool = shuffle(NAMES.filter(x => !recent.has(x)), rand);
  const coats = shuffle(COATS.map((c, i) => i), rand);
  s.horses = [];
  for (let i = 0; i < n; i++) {
    s.horses.push({ name: pool[i], orig: pool[i], coat: coats[i % coats.length], by: null });
  }
  s.recent = [...(s.recent || []), ...s.horses.map(h => h.name)].slice(-60);
  s.picks = {};
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
      const sim = simulate(seed, s.horses.length, gates);
      const startAt = now + COUNTDOWN * 1000;
      s.race = { seed, n: s.horses.length, gates, startAt, endsAt: startAt + Math.ceil((sim.endT + 1) * 1000), winner: sim.winner, order: sim.order };
      s.phase = 'racing';
      const bettors = Object.keys(s.picks).length;
      log(s, `Race ${s.raceNo} is off! ${gates} gates, ${bettors} ${bettors === 1 ? 'bet' : 'bets'} placed`);
      return { ok: true };
    }
    case 'horses': {
      if (!isHost) return { ok: false, err: 'Only the host can change how many horses run' };
      if (s.phase !== 'betting') return { ok: false, err: 'You can change the horses between races' };
      const n = int(a.n);
      if (!(n === 0 || (n >= MIN_HORSES && n <= MAX_HORSES))) return { ok: false, err: `Races have ${MIN_HORSES} to ${MAX_HORSES} horses` };
      if (n === horseSetting(s) && (n === 0 || s.horses.length === n)) return { ok: true };
      s.horseCount = n;
      dealHorses(s, rand);   // a new field for this race, so everyone picks again
      log(s, n ? `${me.name} set the field to ${n} horses (new horses, pick again)` : `${me.name} set the field to random (4 to 6 horses)`);
      return { ok: true };
    }
    case 'gates': {
      if (!isHost) return { ok: false, err: 'Only the host can change the track' };
      if (s.phase !== 'betting') return { ok: false, err: 'You can change the track between races' };
      const g = int(a.n);
      if (!(g >= MIN_GATES && g <= MAX_GATES)) return { ok: false, err: `Tracks have ${MIN_GATES} to ${MAX_GATES} gates` };
      if (g === gatesOf(s)) return { ok: true };
      s.gates = g;
      log(s, `${me.name} set the track to ${g} gates (max ${effectCap(g)} boosts and ${effectCap(g)} setbacks per horse)`);
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
