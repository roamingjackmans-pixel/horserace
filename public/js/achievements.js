// Achievements: 50 things to unlock. Each player's device keeps its own (in localStorage, see main.js), so they
// carry over from lobby to lobby. Everything here is plain data in, plain data out (it also runs under Node for
// tests): observe() looks at a lobby state from one player's side and says what they just unlocked.
//
// Race moments (photo finish, last to first...) are worked out by replaying the race's stored script, so they
// are exactly what everyone watched.
import { hopCap, leadCap } from './sim.js';

// who runs the lobby: the host, or in a game screen's lobby the first player still here (engine.js bossOf;
// copied here so the two files don't import each other)
const bossOf = s => (s.screen ? s.order.find(id => s.players[id] && s.players[id].on) || null : s.hostPid);

export const GROUPS = ['Getting started', 'Winning', 'Losing', 'Attacking', 'Race moments', 'Tracks', 'Style & friends'];

// goal: [lifetime stat, target] for the ones that count up (shown as progress)
export const ACHIEVEMENTS = [
  // getting started
  { id: 'first-bet', g: 0, icon: '🎟️', name: 'Off to the Races', desc: 'Bet on a race' },
  { id: 'first-win', g: 0, icon: '🏆', name: 'Winner Winner, Hay Dinner', desc: 'Win a race' },
  { id: 'first-loss', g: 0, icon: '🥀', name: 'Glue Factory Tour', desc: 'Lose a bet' },
  { id: 'host', g: 0, icon: '🏠', name: 'Stable Owner', desc: 'Host a lobby' },
  { id: 'first-attack', g: 0, icon: '💥', name: 'No Mercy', desc: 'Hand out penalties' },
  { id: 'first-hit', g: 0, icon: '🤕', name: 'Ouch!', desc: 'Get attacked by another player' },
  // winning
  { id: 'wins-5', g: 1, icon: '🍀', name: 'Lucky Horseshoe', desc: 'Win 5 races', goal: ['wins', 5] },
  { id: 'wins-25', g: 1, icon: '🌟', name: 'Derby Darling', desc: 'Win 25 races', goal: ['wins', 25] },
  { id: 'wins-100', g: 1, icon: '🐐', name: 'Greatest of All Time', desc: 'Win 100 races', goal: ['wins', 100] },
  { id: 'streak-3', g: 1, icon: '🎩', name: 'Hat Trick', desc: 'Win 3 races in a row' },
  { id: 'streak-5', g: 1, icon: '🔥', name: 'Unstoppable', desc: 'Win 5 races in a row' },
  { id: 'chips-100', g: 1, icon: '🪙', name: 'Chip Stack', desc: 'Win 100 chips in total', goal: ['chips', 100] },
  { id: 'chips-500', g: 1, icon: '💰', name: 'High Roller', desc: 'Win 500 chips in total', goal: ['chips', 500] },
  { id: 'all-in', g: 1, icon: '🎰', name: 'All In', desc: 'Win with a 20-chip bet' },
  { id: 'penny', g: 1, icon: '🪶', name: 'Penny Pincher', desc: 'Win with a 1-chip bet' },
  // losing
  { id: 'cursed', g: 2, icon: '🐈‍⬛', name: 'Cursed', desc: 'Lose 3 races in a row' },
  { id: 'farm', g: 2, icon: '🚜', name: 'Bet the Farm', desc: 'Lose a 20-chip bet' },
  { id: 'bruised', g: 2, icon: '🩹', name: 'Bruised', desc: 'Take 50 penalties in total', goal: ['taken', 50] },
  { id: 'punching', g: 2, icon: '🥊', name: 'Punching Bag', desc: 'Take 200 penalties in total', goal: ['taken', 200] },
  { id: 'pile-on', g: 2, icon: '🧱', name: 'Pile-On', desc: 'Get hit with 20 or more penalties after one race' },
  { id: 'ganged', g: 2, icon: '👥', name: 'Ganged Up On', desc: 'Get attacked by 2 or more players after the same race' },
  // attacking
  { id: 'menace', g: 3, icon: '😈', name: 'Menace', desc: 'Hand out 100 penalties in total', goal: ['dealt', 100] },
  { id: 'vendetta', g: 3, icon: '🎯', name: 'Personal Vendetta', desc: 'Give 10 or more penalties, all to one player' },
  { id: 'sharing', g: 3, icon: '🎁', name: 'Sharing Is Caring', desc: 'Hit 4 or more players with one attack' },
  { id: 'revenge', g: 3, icon: '🔁', name: 'Revenge Is Sweet', desc: 'Penalize someone who penalized you' },
  { id: 'bite', g: 3, icon: '🦷', name: 'Bite the Hand', desc: 'Penalize the host' },
  // race moments
  { id: 'comeback', g: 4, icon: '🐢', name: 'From Last to First', desc: 'Win after your horse was dead last past the halfway mark' },
  { id: 'wire', g: 4, icon: '🏁', name: 'Wire to Wire', desc: 'Win without your horse ever falling behind' },
  { id: 'photo', g: 4, icon: '📸', name: 'Photo Finish', desc: 'Win by a single gate (7 gates or more)' },
  { id: 'lonely', g: 4, icon: '🏝️', name: 'Lonely at the Top', desc: 'Win by as big a lead as a race can have (7 gates or more)' },
  { id: 'rocket', g: 4, icon: '⚡', name: 'Rocket Fuel', desc: 'Your horse gets boosted 3 times in one race' },
  { id: 'banana', g: 4, icon: '🍌', name: 'Banana Peel', desc: 'Your horse gets set back 3 times in one race' },
  { id: 'shake', g: 4, icon: '💪', name: 'Shake It Off', desc: 'Win after your horse was set back 3 times' },
  { id: 'turbo', g: 4, icon: '💨', name: 'Turbo Finish', desc: 'Win by getting boosted over the finish line' },
  { id: 'dead-last', g: 4, icon: '🐌', name: 'Dead Last', desc: 'Your horse finishes last (3 or more horses)' },
  { id: 'so-close', g: 4, icon: '🥈', name: 'So Close', desc: 'Your horse finishes second' },
  { id: 'empty', g: 4, icon: '⛽', name: 'Running on Empty', desc: 'Your horse hops so much it runs out of hops' },
  // tracks
  { id: 'sprint', g: 5, icon: '⏱️', name: 'Sprinter', desc: 'Bet on a race of 7 gates or fewer' },
  { id: 'blink', g: 5, icon: '👀', name: "Blink and You'll Miss It", desc: 'Bet on a 3-gate race' },
  { id: 'marathon', g: 5, icon: '🏃', name: 'Marathon Mule', desc: 'Bet on a 100-gate race' },
  { id: 'full-gallop', g: 5, icon: '🎠', name: 'Full Gallop', desc: 'Bet on a race with 8 horses' },
  { id: 'two-horse', g: 5, icon: '⚔️', name: 'Two-Horse Race', desc: 'Win a race with only 2 horses' },
  { id: 'full-house', g: 5, icon: '🎉', name: 'Full House', desc: 'Be in a lobby with 8 players' },
  // style & friends
  { id: 'makeover', g: 6, icon: '🎨', name: 'Makeover', desc: 'Style a horse' },
  { id: 'rainbow', g: 6, icon: '🌈', name: 'Taste the Rainbow', desc: 'Give a horse a rainbow coat, mane or outfit' },
  { id: 'jet-set', g: 6, icon: '🚀', name: 'Jet Set', desc: 'Win on a horse wearing a jetpack' },
  { id: 'namer', g: 6, icon: '🏷️', name: "What's in a Name?", desc: 'Rename a horse' },
  { id: 'lone-wolf', g: 6, icon: '🐺', name: 'Lone Wolf', desc: 'Win on a horse nobody else backed, with 3 or more others betting' },
  { id: 'bandwagon', g: 6, icon: '🚌', name: 'Bandwagon', desc: 'Win on a horse that 3 or more players backed' },
  { id: 'all', g: 6, icon: '🦄', name: 'Horse Whisperer', desc: 'Unlock every other achievement' },
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const ACH_COUNT = ACHIEVEMENTS.length;

/** A new player's saved progress. */
export function freshProgress() {
  return {
    v: 1,
    got: {},                // achievement id -> when it was unlocked
    st: { bets: 0, wins: 0, losses: 0, chips: 0, taken: 0, dealt: 0, wRun: 0, lRun: 0 },
    seen: [],               // races and attacks already counted
    hitBy: {},              // lobby code -> players who have penalized us there
  };
}

/** Fill in anything missing from saved progress (older saves, or junk). */
export function cleanProgress(p) {
  const f = freshProgress();
  if (!p || typeof p !== 'object') return f;
  return {
    v: 1,
    got: p.got && typeof p.got === 'object' ? Object.fromEntries(Object.entries(p.got).filter(([id]) => ACH_BY_ID[id])) : {},
    st: { ...f.st, ...(p.st && typeof p.st === 'object' ? p.st : {}) },
    seen: Array.isArray(p.seen) ? p.seen.slice(-400) : [],
    hitBy: p.hitBy && typeof p.hitBy === 'object' ? p.hitBy : {},
  };
}

/** How far along a counting achievement is: [have, need], or null. */
export function progressOf(prog, a) {
  if (!a.goal) return null;
  return [Math.min(prog.st[a.goal[0]] || 0, a.goal[1]), a.goal[1]];
}

/**
 * Replays a race's script and reports what happened to horse h (and how the winner won):
 * hops, boosts, setbacks it got; whether it ever trailed another horse before the finish; whether it was
 * alone in last place once the leader was past halfway; and, at the moment the winner crossed, whether 2nd
 * was one gate back (photo), as far back as the rules allow (lonely), and whether a boost carried it over.
 */
export function analyzeRace(race, h) {
  const G = race.gates, n = race.n, w = race.winner, lead = leadCap(G);
  const pos = new Array(n).fill(0);
  const out = { hops: 0, boosts: 0, setbacks: 0, trailed: false, lastLate: false, photo: false, lonely: false, boostFinish: false };
  let over = false;
  for (const a of race.script || []) {
    let boosted = -1;
    if (typeof a === 'number') { pos[a]++; if (a === h) out.hops++; }
    else if (a[0] === 'bolt') break;
    else {
      const [, b, sb] = a;
      if (b >= 0) { pos[b]++; boosted = b; if (b === h) out.boosts++; }
      if (sb >= 0) { pos[sb] = Math.max(0, pos[sb] - 1); if (sb === h) out.setbacks++; }
    }
    if (over) continue;
    if (w >= 0 && pos[w] >= G) {
      over = true;
      let second = 0;
      for (let k = 0; k < n; k++) if (k !== w) second = Math.max(second, pos[k]);
      // (on tiny tracks every win is by one gate, so these need room to mean something)
      out.photo = lead >= 2 && G - second <= 1;
      out.lonely = lead >= 2 && G - second >= lead;
      out.boostFinish = boosted === w;
      continue;
    }
    let top = 0, behind = false, alone = true;
    for (let k = 0; k < n; k++) {
      top = Math.max(top, pos[k]);
      if (k === h) continue;
      if (pos[k] > pos[h]) behind = true;
      if (pos[k] <= pos[h]) alone = false;
    }
    if (behind) out.trailed = true;
    if (alone && top * 2 >= G) out.lastLate = true;
  }
  return out;
}

const hasLook = (look, id, keys) => !!look && keys.some(k => look[k] === id);

/**
 * Looks at lobby state `s` from player `pid`'s side and returns the ids of achievements they just unlocked.
 * Updates `prog` in place (lifetime counts, which races and attacks were already counted, who attacked us)
 * and sets prog.dirty when it changed anything worth saving.
 */
export function observe(prog, s, pid, now = Date.now()) {
  const fresh = [];
  if (!s || !s.players || !s.players[pid]) return fresh;
  const st = prog.st;
  const unlock = id => { if (!prog.got[id] && ACH_BY_ID[id]) { prog.got[id] = now; fresh.push(id); prog.dirty = true; } };
  const seen = new Set(prog.seen);
  const first = key => {
    if (seen.has(key)) return false;
    seen.add(key); prog.seen.push(key); prog.dirty = true;
    if (prog.seen.length > 400) prog.seen.splice(0, prog.seen.length - 400);
    return true;
  };

  // the lobby itself
  if (bossOf(s) === pid) unlock('host');
  if (s.order.filter(id => s.players[id] && s.players[id].on).length >= 8) unlock('full-house');
  for (const horse of s.horses || []) {
    if (horse.styledBy === pid && horse.look) {
      unlock('makeover');
      if (hasLook(horse.look, 'rainbow', ['coat', 'mane', 'outfit'])) unlock('rainbow');
    }
    if (horse.by === pid) unlock('namer');
  }

  // a finished race
  if (s.phase === 'results' && s.res && s.race) {
    const key = `${s.code}:${s.race.seed}`;
    const p = (s.res.payouts || []).find(x => x.pid === pid);
    if (p && first(key)) {
      const G = s.race.gates, n = s.race.n, h = p.h, info = analyzeRace(s.race, h);
      st.bets++;
      unlock('first-bet');
      if (G <= 7) unlock('sprint');
      if (G <= 3) unlock('blink');
      if (G >= 100) unlock('marathon');
      if (n >= 8) unlock('full-gallop');
      if (info.boosts >= 3) unlock('rocket');
      if (info.setbacks >= 3) unlock('banana');
      if (info.hops >= hopCap(G)) unlock('empty');
      const place = (s.race.order || []).indexOf(h);
      if (n >= 3 && place === n - 1) unlock('dead-last');
      if (place === 1) unlock('so-close');
      if (p.win) {
        st.wins++; st.chips += p.bet; st.wRun++; st.lRun = 0;
        unlock('first-win');
        if (st.wRun >= 3) unlock('streak-3');
        if (st.wRun >= 5) unlock('streak-5');
        if (p.bet >= 20) unlock('all-in');
        if (p.bet <= 1) unlock('penny');
        if (info.lastLate) unlock('comeback');
        if (!info.trailed) unlock('wire');
        if (info.photo) unlock('photo');
        if (info.lonely) unlock('lonely');
        if (info.boostFinish) unlock('turbo');
        if (info.setbacks >= 3) unlock('shake');
        if (n === 2) unlock('two-horse');
        const backers = s.res.payouts.filter(x => x.h === h).length, others = s.res.payouts.length - 1;
        if (backers === 1 && others >= 3) unlock('lone-wolf');
        if (backers >= 3) unlock('bandwagon');
        const horse = s.horses[h];
        if (horse && hasLook(horse.look, 'jetpack', ['hgear', 'rgear'])) unlock('jet-set');
      } else {
        st.losses++; st.taken += p.bet; st.lRun++; st.wRun = 0;
        unlock('first-loss');
        if (st.lRun >= 3) unlock('cursed');
        if (p.bet >= 20) unlock('farm');
      }
    }

    // penalties handed out after it
    const hitBy = (prog.hitBy[s.code] ||= []);
    let onMe = 0;
    const attackers = new Set();
    for (const a of s.res.attacks || []) {
      const mine = a.hits && a.hits[pid];
      if (mine) { onMe += mine; attackers.add(a.from); }
      if (!first(`${key}:${a.id}`)) continue;
      if (a.from === pid) {
        const targets = Object.keys(a.hits || {});
        st.dealt += a.total || 0;
        unlock('first-attack');
        if (targets.length === 1 && a.total >= 10) unlock('vendetta');
        if (targets.length >= 4) unlock('sharing');
        if (targets.some(t => hitBy.includes(t))) unlock('revenge');
        const boss = bossOf(s);
        if (boss && pid !== boss && targets.includes(boss)) unlock('bite');
      } else if (mine) {
        st.taken += mine;
        unlock('first-hit');
        if (!hitBy.includes(a.from)) hitBy.push(a.from);
      }
    }
    if (onMe >= 20) unlock('pile-on');
    if (attackers.size >= 2) unlock('ganged');
    // only remember a few lobbies
    const codes = Object.keys(prog.hitBy);
    if (codes.length > 10) for (const c of codes.slice(0, codes.length - 10)) delete prog.hitBy[c];
  }

  for (const a of ACHIEVEMENTS) if (a.goal && (st[a.goal[0]] || 0) >= a.goal[1]) unlock(a.id);
  if (ACHIEVEMENTS.every(a => a.id === 'all' || prog.got[a.id])) unlock('all');
  return fresh;
}
