// Horse Race: screens and buttons. The room state comes from net.js; this file only draws it and
// turns taps into actions.
import { Room, cleanCode } from './net.js';
import * as E from './engine.js';
import { simulate, playRace, BOOST_AT, SETBACK_AT, MIN_GATES, MAX_GATES, eventAt, gatesClearedAt } from './sim.js';
import { NAMES, PLAYER_NAMES, AVATARS } from './names.js';
import { TrackView, paintPortrait, drawHorse } from './render.js';
import { PodiumView } from './podium.js';
import { PALETTE, HATS, HORSE_GEAR, RIDER_GEAR, resolveLook, randomLook } from './looks.js';
import { sfx, unlock, isMuted, setMuted } from './audio.js';
import { ACHIEVEMENTS, ACH_BY_ID, ACH_COUNT, GROUPS, cleanProgress, observe, progressOf } from './achievements.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mkStore = area => ({
  get(k, d) { try { const v = area.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { area.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { area.removeItem(k); } catch { } },
});
const store = mkStore(window.localStorage);
const tabStore = mkStore(window.sessionStorage);
const rid = (n = 12) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); };
const pick = a => a[Math.floor(Math.random() * a.length)];
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

// ---------------------------------------------------------------- who am I
const TAB = tabStore.get('hr_tab') || (() => { const t = rid(8); tabStore.set('hr_tab', t); return t; })();
const profile = { name: store.get('hr_name', ''), av: store.get('hr_av', '') || pick(AVATARS) };
store.set('hr_av', profile.av);

// achievements: kept on this device, across every lobby (the rules are in achievements.js)
const achProg = cleanProgress(store.get('hr_ach', null));
const achCount = () => Object.keys(achProg.got).length;

/** The player id to use in a lobby: this tab's id, or the seat this browser had there before. */
function seatFor(code) {
  return tabStore.get('hr_pid') || store.get('hr_seat_' + code, '') || rid();
}
function saveSeat(code, pid) {
  tabStore.set('hr_pid', pid);
  store.set('hr_seat_' + code, pid);
}

// ---------------------------------------------------------------- app state
const ui = {
  room: null,
  state: null,
  bet: Math.max(E.MIN_BET, Math.min(E.MAX_BET, store.get('hr_bet', 5) | 0 || 5)),
  betTouched: 0,
  draft: {},
  stageKey: '',
  lastPhase: null,
  lastRace: 0,
  seen: new Set(tabStore.get('hr_seen', [])),
  sims: new Map(),
  track: null,
  raf: 0,
  race: null,            // per-race playback bookkeeping
  saveTimer: 0,
};
const me = () => ui.room && ui.room.me;
// in the browser console: hrTrace() shows how this tab's connection went
window.hrTrace = () => (ui.room && ui.room.trace ? ui.room.trace.join(' | ') : '');
const myPid = () => (ui.room ? ui.room.me.pid : null);
const pname = (s, pid) => (s.players[pid] ? s.players[pid].name : 'Someone');
const pav = (s, pid) => (s.players[pid] ? s.players[pid].av : '❔');

// ---------------------------------------------------------------- toasts + modals
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, kind === 'err' ? 4200 : 3200);
}

const modalQueue = [];
let modalOpen = null;
/** Opens a modal. build(el, close) fills it in. Modals queue up one after another. */
function modal(build, cls = '') {
  modalQueue.push({ build, cls });
  if (!modalOpen) nextModal();
}
function nextModal() {
  const root = $('#modal');
  const item = modalQueue.shift();
  if (!item) { modalOpen = null; root.classList.remove('open'); root.innerHTML = ''; return; }
  root.innerHTML = `<div class="card modal ${item.cls}" role="dialog" aria-modal="true"></div>`;
  root.classList.add('open');
  const el = root.firstElementChild;
  let closed = false;
  const close = () => { if (closed) return; closed = true; nextModal(); };
  modalOpen = { el, close };
  item.build(el, close);
  const f = el.querySelector('[autofocus]');
  if (f) setTimeout(() => f.focus(), 30);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOpen && !modalOpen.el.classList.contains('attack-modal')) modalOpen.close(); });

function confirmBox(title, text, yes, no, onYes) {
  modal((el, close) => {
    el.innerHTML = `<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row"><button class="btn" data-no>${esc(no)}</button><button class="btn primary" data-yes>${esc(yes)}</button></div>`;
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-yes]').onclick = () => { close(); onYes(); };
  });
}

function avatarPicker(current, onPick) {
  modal((el, close) => {
    el.innerHTML = `<h2>Pick your look</h2><div class="avatars">${AVATARS.map(a => `<button class="${a === current ? 'on' : ''}" data-av="${a}">${a}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-av]').forEach(b => b.onclick = () => { onPick(b.dataset.av); sfx.click(); close(); });
  });
}

// ---------------------------------------------------------------- home screen
const nameInput = $('#nameInput'), codeInput = $('#codeInput');
nameInput.value = profile.name;
$('#avatarBtn').textContent = profile.av;
nameInput.addEventListener('input', () => { profile.name = nameInput.value.trim().slice(0, 20); store.set('hr_name', profile.name); });
$('#avatarBtn').onclick = () => { unlock(); avatarPicker(profile.av, av => { profile.av = av; store.set('hr_av', av); $('#avatarBtn').textContent = av; }); };
codeInput.addEventListener('input', () => { codeInput.value = cleanCode(codeInput.value); });
$('#createBtn').onclick = () => createLobby();
$('#joinForm').onsubmit = e => { e.preventDefault(); joinLobby(codeInput.value); };
const v = window.HR_VERSION;
if (v) $('#buildTag').textContent = `v${v.version}${v.commit && v.commit !== 'dev' ? ' · ' + v.commit : ''}`;

function homeMsg(text, ok) {
  const m = $('#homeMsg');
  m.textContent = text || '';
  m.classList.toggle('ok', !!ok);
}
function readProfile() {
  let name = nameInput.value.trim().slice(0, 20);
  if (!name) {
    name = pick(PLAYER_NAMES);
    nameInput.value = name;
  }
  profile.name = name;
  store.set('hr_name', name);
  return true;
}
function setBusy(b) { $('#createBtn').disabled = b; $('#joinBtn').disabled = b; }

async function createLobby() {
  unlock(); sfx.click();
  readProfile();
  setBusy(true);
  homeMsg('Setting up your lobby…', true);
  const player = { pid: tabStore.get('hr_pid') || rid(), tab: TAB, name: profile.name, av: profile.av, ach: achCount() };
  const room = new Room(player);
  bindRoom(room);
  try {
    const code = await room.create();
    saveSeat(code, player.pid);
    showRoom();
    toast(`Lobby ${code} is open! Share the code with your friends.`, 'good');
  } catch (e) {
    console.warn(e);
    unbindRoom(room);
    homeMsg(e.message || 'Could not make a lobby. Check your internet and try again.');
  } finally { setBusy(false); }
}

async function joinLobby(raw) {
  unlock(); sfx.click();
  const code = cleanCode(raw);
  if (code.length !== 5) { homeMsg('Lobby codes are 5 numbers'); codeInput.focus(); return; }
  readProfile();
  setBusy(true);
  homeMsg(`Looking for lobby ${code}…`, true);
  let pid = seatFor(code);
  for (let attempt = 0; attempt < 2; attempt++) {
    const player = { pid, tab: TAB, name: profile.name, av: profile.av, ach: achCount() };
    const room = new Room(player);
    bindRoom(room);
    try {
      await room.join(code);
      saveSeat(code, pid);
      showRoom();
      sfx.join();
      setBusy(false);
      return;
    } catch (e) {
      unbindRoom(room);
      if (e.code === 'dup' && attempt === 0) { pid = rid(); tabStore.set('hr_pid', pid); continue; }
      homeMsg(e.message || 'Could not join that lobby');
      $('#checkLink').href = `check.html?room=${code}`;
      break;
    }
  }
  setBusy(false);
}

// ---------------------------------------------------------------- room wiring
let unsub = [];
function bindRoom(room) {
  ui.room = room;
  ui.state = null; ui.stageKey = ''; ui.lastPhase = null; ui.lastRace = 0; ui.draft = {};
  unsub = [
    room.on('state', s => onState(s)),
    room.on('status', t => { const el = $('#status'); el.hidden = !t; el.textContent = t || ''; }),
    room.on('error', msg => toast(msg, 'err')),
    room.on('toast', msg => toast(msg, 'good')),
    room.on('progress', msg => { if (!$('#home').hidden) homeMsg(msg, true); }),
    room.on('role', () => { ui.stageKey = ''; if (ui.state) render(); }),
    room.on('closed', msg => onClosed(msg)),
  ];
}
function unbindRoom(room) {
  for (const u of unsub) u();
  unsub = [];
  try { room.drop(); } catch { }
  if (ui.room === room) ui.room = null;
}

function showRoom() {
  $('#home').hidden = true;
  $('#room').hidden = false;
  stopHomeHorse();
  const url = new URL(location.href);
  url.searchParams.set('room', ui.room.code);
  history.replaceState(null, '', url);
  $('#codeText').textContent = ui.room.code;
  document.title = `Lobby ${ui.room.code} | Horse Race`;
  keepAwake(true);
  if (ui.state) render();
}

function showHome(msg) {
  stopRace();
  $('#room').hidden = true;
  $('#home').hidden = false;
  $('#status').hidden = true;
  const url = new URL(location.href);
  url.searchParams.delete('room');
  history.replaceState(null, '', url);
  document.title = 'Horse Race | josephjackman.com';
  homeMsg(msg || '');
  keepAwake(false);
  startHomeHorse();
}

function onClosed(msg) {
  const room = ui.room;
  tabStore.del('hr_session');
  if (room) unbindRoom(room);
  const code = room && room.code;
  showHome();
  if (code) codeInput.value = code;
  modal((el, close) => {
    el.innerHTML = `<h2>Disconnected</h2><p>${esc(msg || 'Lost the connection to the lobby.')}</p><div class="row"><button class="btn" data-home>OK</button>${code ? `<button class="btn primary" data-retry>Try to rejoin</button>` : ''}</div>`;
    el.querySelector('[data-home]').onclick = close;
    const r = el.querySelector('[data-retry]');
    if (r) r.onclick = () => { close(); joinLobby(code); };
  });
}

$('#leaveBtn').onclick = () => {
  confirmBox('Leave the lobby?', 'Your chips and penalties stay on the scoreboard if you come back with the same code.', 'Leave', 'Stay', async () => {
    const room = ui.room;
    tabStore.del('hr_session');
    if (room) { for (const u of unsub) u(); unsub = []; await room.leave(); ui.room = null; }
    showHome();
  });
};
$('#codeBtn').onclick = async () => {
  if (!ui.room) return;
  const link = `${location.origin}${location.pathname}?room=${ui.room.code}`;
  const text = `Join my Horse Race lobby! Code ${ui.room.code}`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: 'Horse Race', text, url: link }); return; } catch { }
  }
  try { await navigator.clipboard.writeText(link); toast('Invite link copied! Paste it to your friends.', 'good'); }
  catch { modal((el, close) => { el.innerHTML = `<h2>Invite link</h2><p>Lobby code <b>${ui.room.code}</b></p><input value="${esc(link)}" readonly><div class="row"><button class="btn primary">Done</button></div>`; el.querySelector('input').select(); el.querySelector('button').onclick = close; }); }
};
const muteBtn = $('#muteBtn');
const showMute = () => { muteBtn.textContent = isMuted() ? '🔇' : '🔊'; };
showMute();
muteBtn.onclick = () => { unlock(); setMuted(!isMuted()); showMute(); sfx.click(); };
document.addEventListener('pointerdown', () => unlock(), { once: true });

// keep the screen on while in a lobby (phones)
let wake = null;
async function keepAwake(on) {
  try {
    if (on && !wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    } else if (!on && wake) { await wake.release(); wake = null; }
  } catch { }
}
document.addEventListener('visibilitychange', () => { if (ui.room && document.visibilityState === 'visible') keepAwake(true); });
window.addEventListener('pagehide', () => {
  if (!ui.room) return;
  saveSession();
  ui.room.drop();
});
function saveSession() {
  if (ui.room && ui.state && !ui.room.closed) tabStore.set('hr_session', { code: ui.state.code, pid: myPid(), state: ui.state, offset: ui.room.offset, at: Date.now() });
}
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

// ---------------------------------------------------------------- state updates
function onState(s) {
  ui.state = s;
  if (ui.room && ui.room.code !== $('#codeText').textContent) $('#codeText').textContent = ui.room.code;
  // remember enough to get straight back in after a reload
  if (!ui.saveTimer) {
    ui.saveTimer = setTimeout(() => { ui.saveTimer = 0; saveSession(); }, 700);
  }
  if (s.raceNo !== ui.lastRace) { ui.draft = {}; ui.lastRace = s.raceNo; }
  const mine = s.picks[myPid()];
  if (mine && Date.now() - ui.betTouched > 2000) ui.bet = mine.bet;
  if (s.phase !== ui.lastPhase) {
    const was = ui.lastPhase;
    ui.lastPhase = s.phase;
    ui.stageKey = '';
    if (s.phase === 'betting' && was === 'results') sfx.join();
  }
  checkAttacks(s);
  checkAchievements(s);
  render();
}

function render() {
  const s = ui.state;
  if (!s || !ui.room) return;
  renderPlayers(s);
  renderLog(s);
  if (s.phase === 'betting') { stopRace(); stopPodium(); renderBetting(s); }
  else if (s.phase === 'racing') { stopPodium(); renderRace(s); }
  else if (s.phase === 'results') { stopRace(); renderResults(s); }
}

// ---------------------------------------------------------------- players + tallies
function renderPlayers(s) {
  const pid = myPid(), isHost = s.hostPid === pid;
  const online = s.order.filter(id => s.players[id] && s.players[id].on).length;
  $('#playerCount').textContent = `${online}/${E.MAX_PLAYERS} here${s.order.length > online ? `, ${s.order.length - online} away` : ''}`;
  $('#players').innerHTML = s.order.map(id => {
    const p = s.players[id];
    if (!p) return '';
    const pk = s.picks[id];
    let status = '';
    if (s.phase === 'betting') status = pk ? `${dot(pk.h)} #${pk.h + 1} ${esc(s.horses[pk.h].name)} · ${pk.bet} chips` : (p.on ? 'Choosing a horse…' : '');
    else if (s.phase === 'racing') status = pk ? `${dot(pk.h)} Riding on #${pk.h + 1} · ${pk.bet} chips` : 'Watching this one';
    else if (s.phase === 'results' && s.res) {
      const po = s.res.payouts.find(x => x.pid === id);
      if (po && po.win) status = s.res.done[id] ? `🏆 Won ${po.bet} chips` : `🏆 Won ${po.bet} chips · picking victims…`;
      else if (po) status = `#${po.h + 1} lost · took ${plural(po.bet, 'penalty', 'penalties')}`;
      else status = 'Sat this one out';
    }
    return `<div class="player ${id === pid ? 'me' : ''} ${p.on ? '' : 'off'}">
      <div class="pav">${esc(p.av)}</div>
      <div class="pbody">
        <div class="pname">${esc(p.name)}${id === s.hostPid ? '<span class="tag host">HOST</span>' : ''}${id === pid ? '<span class="tag you">YOU</span><button class="pedit" data-edit title="Change name">✏️</button>' : ''}${p.on ? (p.relay ? '<span class="tag relay" title="Connected through the backup relay (a direct connection didn\'t work for them)">📡 RELAY</span>' : '') : '<span class="tag away">AWAY</span>'}</div>
        <div class="ptally"><span>🪙 <b>${p.chips}</b> chips won</span><span>🤕 <b>${p.taken}</b> penalties</span><span title="Achievements unlocked">🏅 <b>${p.ach || 0}</b></span></div>
        ${status ? `<div class="pstatus">${status}</div>` : ''}
      </div>
      ${isHost && !p.on ? `<button class="premove" data-remove="${esc(id)}" title="Remove from the lobby">✕</button>` : ''}
    </div>`;
  }).join('');
  const edit = $('#players [data-edit]');
  if (edit) edit.onclick = () => editProfile();
  $('#players').querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
    const id = b.dataset.remove;
    confirmBox('Remove player?', `${pname(s, id)} has left. Remove them (and their tallies) from the lobby?`, 'Remove', 'Keep', () => ui.room && ui.room.act({ k: 'remove', pid: id }));
  });
}
const dot = h => `<span class="dot" style="background:${E.SILKS[h].bg}"></span>`;

function editProfile() {
  const s = ui.state;
  const p = s && s.players[myPid()];
  let av = p ? p.av : profile.av;
  modal((el, close) => {
    el.innerHTML = `<h2>You</h2><input maxlength="20" value="${esc(p ? p.name : profile.name)}" autofocus>
      <div class="avatars">${AVATARS.map(a => `<button class="${a === av ? 'on' : ''}" data-av="${a}">${a}</button>`).join('')}</div>
      <div class="row"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
    el.querySelectorAll('[data-av]').forEach(b => b.onclick = () => { av = b.dataset.av; el.querySelectorAll('[data-av]').forEach(x => x.classList.toggle('on', x === b)); });
    const save = () => {
      const name = el.querySelector('input').value.trim().slice(0, 20);
      if (!name) return;
      profile.name = name; profile.av = av;
      store.set('hr_name', name); store.set('hr_av', av);
      nameInput.value = name; $('#avatarBtn').textContent = av;
      ui.room && ui.room.setProfile(name, av);
      close();
    };
    el.querySelector('input').onkeydown = e => { if (e.key === 'Enter') save(); };
    el.querySelector('[data-cancel]').onclick = close;
    el.querySelector('[data-save]').onclick = save;
  });
}

function renderLog(s) {
  const key = s.log.length ? s.log[s.log.length - 1].id : 0;
  if (ui.logKey === key) return;
  ui.logKey = key;
  $('#log').innerHTML = s.log.slice().reverse().map(l => `<div>${esc(l.msg)}</div>`).join('');
}

// ---------------------------------------------------------------- betting
/** Rough race length for a track, from simulating thousands of races (tools/simstats.mjs). */
function raceLength(gates) {
  const secs = Math.max(4, 2.35 * gates - 9);   // 7 gates ≈ 8 s, 20 ≈ 40 s, 100 ≈ 4 min
  if (secs < 30) return `about ${Math.round(secs)} seconds`;
  if (secs < 90) return `about ${Math.round(secs / 5) * 5} seconds`;
  return `about ${Math.round(secs / 30) / 2} minutes`;
}

function renderBetting(s) {
  // the host is typing a gate count: don't redraw under their fingers (it redraws when they finish)
  if (document.activeElement && document.activeElement.id === 'gatesInput') { ui.stageKey = ''; return; }
  const pid = myPid(), isHost = s.hostPid === pid, mine = s.picks[pid];
  const online = s.order.filter(id => s.players[id] && s.players[id].on);
  const G = E.gatesOf(s);
  const hn = s.horses.length;
  const key = JSON.stringify(['bet', s.raceNo, s.horses, s.picks, s.hostPid, pid, ui.bet, online, G, s.order.map(id => s.players[id] && s.players[id].name)]);
  if (key === ui.stageKey) return;
  ui.stageKey = key;
  const presets = [[7, 'Quick'], [20, 'Classic'], [50, 'Long'], [100, 'Marathon']];
  const track = `<div class="trackbar">
      <div class="setrow">
        <span class="label">🏁 Track</span>
        ${isHost
      ? `<div class="stepper"><button data-gstep="-1" aria-label="Fewer gates" ${G <= MIN_GATES ? 'disabled' : ''}>−</button><input id="gatesInput" type="number" inputmode="numeric" min="${MIN_GATES}" max="${MAX_GATES}" value="${G}" aria-label="Number of gates"><button data-gstep="1" aria-label="More gates" ${G >= MAX_GATES ? 'disabled' : ''}>+</button></div><span class="gunit">gates</span>
           <div class="quick presets">${presets.map(([n, name]) => `<button data-gates="${n}" class="${G === n ? 'on' : ''}">${name} ${n}</button>`).join('')}</div>`
      : `<b class="gcount">${G} gates</b>`}
      </div>
      <div class="setrow">
        <span class="label">🐴 Horses</span>
        ${isHost
      ? `<div class="stepper"><button data-hstep="-1" aria-label="Fewer horses" ${hn <= E.MIN_HORSES ? 'disabled' : ''}>−</button><div class="amt hcount">${hn}</div><button data-hstep="1" aria-label="More horses" ${hn >= E.MAX_HORSES ? 'disabled' : ''}>+</button></div>
           <div class="quick presets"><button data-hrandom>🎲 Random ${E.RANDOM_MIN}–${E.RANDOM_MAX}</button></div>`
      : `<b class="gcount">${hn} horses</b>`}
      </div>
      <div class="track-note">Races take ${raceLength(G)} · ${isHost ? `${E.MIN_HORSES} to ${E.MAX_HORSES} horses, or random` : `${esc(pname(s, s.hostPid))} picks the track and the horses`}</div>
    </div>`;
  const cards = s.horses.map((h, i) => {
    const bs = E.backers(s, i);
    const owner = bs[0];
    const isMine = mine && mine.h === i;
    let meta;
    if (owner) meta = `${owner === pid ? 'You' : esc(pname(s, owner))} picked first${owner === pid ? ', so you get to style it' : ''}`;
    else meta = 'Pick it first to name and style it';
    if (h.by && h.name !== h.orig) meta += ` · was “${esc(h.orig)}”`;
    if (h.look && h.styledBy && h.styledBy !== owner) meta += ` · styled by ${esc(pname(s, h.styledBy))}`;
    const chips = bs.map((id, k) => `<span class="backer ${k === 0 ? 'first' : ''} ${id === pid ? 'is-me' : ''}">${esc(pav(s, id))} ${esc(pname(s, id))} · ${s.picks[id].bet}</span>`).join('');
    return `<div class="horse-card ${isMine ? 'mine' : ''}" role="button" tabindex="0" data-h="${i}" aria-label="Pick horse ${i + 1}, ${esc(h.name)}">
      <span class="num" style="background:${E.SILKS[i].bg};color:${E.SILKS[i].fg}">${i + 1}</span>
      ${isMine ? '<span class="mine-badge">YOUR PICK</span>' : ''}
      <canvas data-portrait="${i}"></canvas>
      <div class="hname">${esc(h.name)}</div>
      <div class="hmeta">${meta}</div>
      ${chips ? `<div class="backers">${chips}</div>` : ''}
      ${owner === pid ? `<button class="rename-btn" data-style="${i}">🎨 Customize</button>` : ''}
    </div>`;
  }).join('');
  const betCount = Object.keys(s.picks).filter(id => s.players[id] && s.players[id].on).length;
  const summary = mine
    ? `You're betting <b>${plural(mine.bet, 'chip')}</b> on <b>#${mine.h + 1} ${esc(s.horses[mine.h].name)}</b>. If it wins you get ${plural(mine.bet, 'chip')} and <b>${mine.bet * E.PENALTY_MULT} penalties</b> to hand out. If it loses, you take <b>${plural(mine.bet, 'penalty', 'penalties')}</b>.`
    : 'Tap a horse to bet on it.';
  const hostName = esc(pname(s, s.hostPid));
  $('#stage').innerHTML = `<div class="card panel">
    <div class="phase-head"><h2>Race ${s.raceNo}</h2><span class="sub">${s.horses.length} horses · ${G} gates</span></div>
    <p class="hint">Pick a horse and bet 1 to 20 chips. Lots of people can back the same horse, but only the first to pick it gets to name it and dress it up.</p>
    ${track}
    <div class="horses">${cards}</div>
    <div class="betbar">
      <span class="label">Your bet</span>
      <div class="stepper"><button data-step="-1" aria-label="Bet less">−</button><div class="amt">${ui.bet}<small>chips</small></div><button data-step="1" aria-label="Bet more">+</button></div>
      <div class="quick">${[1, 5, 10, 20].map(n => `<button data-set="${n}" class="${ui.bet === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="bet-summary">${summary}</div>
    </div>
    <div class="host-row">
      ${isHost
      ? `<button class="btn primary" data-start ${betCount ? '' : 'disabled'}>🏁 Start the race</button><span class="note">${betCount} of ${online.length} ${online.length === 1 ? 'player has' : 'players have'} bet</span>`
      : `<div class="waiting">${mine ? '✅ You\'re in!' : '👆 Pick a horse!'} ${hostName} starts the race when everyone's ready (${betCount} of ${online.length} have bet).</div>`}
    </div>
  </div>`;
  // portraits
  $('#stage').querySelectorAll('canvas[data-portrait]').forEach(c => { const i = +c.dataset.portrait; paintPortrait(c, i, s.horses[i].coat, { look: s.horses[i].look }); });
  // pick a horse
  $('#stage').querySelectorAll('.horse-card').forEach(card => {
    const go = () => {
      const h = +card.dataset.h;
      const cur = s.picks[pid];
      if (cur && cur.h === h) return;
      sfx.pick();
      ui.room.act({ k: 'pick', h, bet: ui.bet });
    };
    card.onclick = e => { if (!e.target.closest('[data-style]')) go(); };
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  $('#stage').querySelectorAll('[data-style]').forEach(b => b.onclick = e => { e.stopPropagation(); styleHorse(+b.dataset.style); });
  const setBet = n => {
    n = Math.max(E.MIN_BET, Math.min(E.MAX_BET, n));
    if (n === ui.bet) return;
    ui.bet = n; ui.betTouched = Date.now();
    store.set('hr_bet', n);
    sfx.click();
    clearTimeout(ui.betTimer);
    if (ui.state.picks[pid]) ui.betTimer = setTimeout(() => ui.room && ui.room.act({ k: 'bet', bet: ui.bet }), 250);
    ui.stageKey = '';
    renderBetting(ui.state);
  };
  $('#stage').querySelectorAll('[data-step]').forEach(b => b.onclick = () => setBet(ui.bet + +b.dataset.step));
  $('#stage').querySelectorAll('[data-set]').forEach(b => b.onclick = () => setBet(+b.dataset.set));
  // track length (host only)
  const setGates = n => {
    n = Math.max(MIN_GATES, Math.min(MAX_GATES, Math.round(n)));
    if (!Number.isFinite(n) || n === E.gatesOf(ui.state)) { ui.stageKey = ''; renderBetting(ui.state); return; }
    sfx.click();
    ui.room.act({ k: 'gates', n });
  };
  $('#stage').querySelectorAll('[data-gstep]').forEach(b => b.onclick = () => setGates(E.gatesOf(ui.state) + +b.dataset.gstep));
  $('#stage').querySelectorAll('[data-gates]').forEach(b => b.onclick = () => setGates(+b.dataset.gates));
  const gi = $('#gatesInput');
  if (gi) {
    gi.onkeydown = e => { if (e.key === 'Enter') gi.blur(); };
    gi.onblur = () => setGates(parseInt(gi.value, 10));   // also redraws if nothing changed
  }
  // number of horses (host only). New horses join at the end; removing takes horses off the end, so only
  // ask first if one of those has a pick, a new name or a costume (they'd be lost).
  const setHorses = n => {
    const st = ui.state;
    const go = () => { sfx.click(); ui.room.act({ k: 'horses', n }); };
    const keep = n || E.RANDOM_MIN;   // a random roll keeps at least the first 4
    const lost = st.horses.map((h, i) => i).filter(i => i >= keep && (
      Object.values(st.picks).some(p => p.h === i) || (st.horses[i].by && st.horses[i].name !== st.horses[i].orig) || st.horses[i].look));
    if (lost.length) {
      const which = lost.map(i => `#${i + 1} ${st.horses[i].name}`).join(', ');
      confirmBox(n ? `Race with ${n} horses?` : 'Random number of horses?', `${n ? 'That takes' : 'That might take'} ${which} out of the race, along with its name, its look and anyone's bet on it. If you add it back later it'll be a brand new horse.`, n ? 'Take it out' : 'Roll the dice', 'Cancel', go);
    } else go();
  };
  $('#stage').querySelectorAll('[data-hstep]').forEach(b => b.onclick = () => {
    const n = Math.max(E.MIN_HORSES, Math.min(E.MAX_HORSES, ui.state.horses.length + +b.dataset.hstep));
    if (n !== ui.state.horses.length) setHorses(n);
  });
  const hr = $('#stage [data-hrandom]');
  if (hr) hr.onclick = () => setHorses(0);
  const start = $('#stage [data-start]');
  if (start) start.onclick = () => {
    const st = ui.state;
    const missing = st.order.filter(id => st.players[id] && st.players[id].on && !st.picks[id]);
    const go = () => { unlock(); ui.room.act({ k: 'start' }); };
    if (missing.length) confirmBox('Start without them?', `${missing.map(id => pname(st, id)).join(', ')} ${missing.length === 1 ? "hasn't" : "haven't"} bet yet. They'll sit this race out.`, 'Start anyway', 'Wait', go);
    else go();
  };
}

/** The styling studio: the first person on a horse names it and dresses up the horse and its rider. */
function styleHorse(h) {
  const s = ui.state;
  const horse = s.horses[h];
  const draft = resolveLook(horse.look, horse.coat);
  const swatch = (k, v, name, css) => `<button class="sw ${draft[k] === v ? 'on' : ''}" data-k="${k}" data-v="${v}" title="${esc(name)}" aria-label="${esc(name)}" style="background:${css}"></button>`;
  const palette = k => ['Natural', 'Bright', 'Wild'].map(g => `<div class="swgroup"><span>${g === 'Wild' ? 'Wild 🤪' : g}</span><div class="swatches">${PALETTE.filter(p => p.group === g).map(p => swatch(k, p.id, p.name, p.css)).join('')}</div></div>`).join('');
  const gear = (k, list) => `<div class="gearlist">${list.map(x => `<button class="gearbtn ${draft[k] === x.id ? 'on' : ''}" data-k="${k}" data-v="${x.id}"><span>${x.icon}</span>${esc(x.name)}</button>`).join('')}</div>`;
  const label = k => {
    const v = draft[k];
    if (k === 'mane' && v === 'match') return 'Goes with the coat';
    if (k === 'outfit' && v === 'team') return 'Team colours';
    const all = [...PALETTE, ...HATS, ...HORSE_GEAR, ...RIDER_GEAR];
    const found = all.find(x => x.id === v && (k === 'hat' ? HATS.includes(x) : k === 'hgear' ? HORSE_GEAR.includes(x) : k === 'rgear' ? RIDER_GEAR.includes(x) : PALETTE.includes(x)));
    return found ? found.name : v;
  };
  const team = E.SILKS[h];
  modal((el, close) => {
    el.innerHTML = `<h2>🎨 Style #${h + 1}</h2>
      <div class="studio-stage"><canvas></canvas></div>
      <div class="studio-name"><input maxlength="28" value="${esc(horse.name)}" aria-label="Horse name"><button class="btn small" data-randname title="Random name">🎲</button></div>
      <div class="studio-tabs"><button data-tab="horse" class="on">🐴 Horse</button><button data-tab="rider">🏇 Rider</button></div>
      <div class="studio-panel" data-panel="horse">
        <h4>Coat <span data-label="coat"></span></h4>${palette('coat')}
        <h4>Mane &amp; tail <span data-label="mane"></span></h4>
        <div class="swatches">${swatch('mane', 'match', 'Goes with the coat', 'conic-gradient(#8a4b2a 0 50%,#2a1810 0)')}</div>${palette('mane')}
        <h4>Add-on <span data-label="hgear"></span></h4>${gear('hgear', HORSE_GEAR)}
      </div>
      <div class="studio-panel" data-panel="rider" hidden>
        <h4>Outfit <span data-label="outfit"></span></h4>
        <div class="swatches">${swatch('outfit', 'team', 'Team colours', `linear-gradient(135deg,${team.bg} 0 60%,${team.cap} 0)`)}</div>${palette('outfit')}
        <h4>Hat <span data-label="hat"></span></h4>${gear('hat', HATS)}
        <h4>Add-on <span data-label="rgear"></span></h4>${gear('rgear', RIDER_GEAR)}
      </div>
      <div class="row studio-buttons"><button class="btn" data-surprise>🎲 Surprise me</button><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
    const showLabels = () => el.querySelectorAll('[data-label]').forEach(sp => { sp.textContent = label(sp.dataset.label); });
    const showPicks = () => {
      el.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', draft[b.dataset.k] === b.dataset.v));
      showLabels();
    };
    showLabels();
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { draft[b.dataset.k] = b.dataset.v; sfx.click(); showPicks(); });
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      el.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      el.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
    });
    const input = el.querySelector('input');
    el.querySelector('[data-randname]').onclick = () => { input.value = pick(NAMES); sfx.click(); };
    el.querySelector('[data-surprise]').onclick = () => { Object.assign(draft, randomLook()); sfx.pick(); showPicks(); };
    el.querySelector('[data-cancel]').onclick = close;
    el.querySelector('[data-save]').onclick = () => {
      const name = input.value.trim().slice(0, 28) || horse.name;
      ui.room.act({ k: 'look', h, look: { ...draft }, name });
      sfx.pick();
      close();
    };
    // live preview: the horse galloping in its new outfit
    const c = el.querySelector('canvas');
    const t0 = performance.now();
    const frame = () => {
      if (!el.isConnected) return;
      requestAnimationFrame(frame);
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth, hgt = c.clientHeight;
      if (!w) return;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr); }
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, hgt);
      const t = (performance.now() - t0) / 1000;
      ctx.fillStyle = '#48a842'; for (let x = -((t * 120) % 60); x < w; x += 60) ctx.fillRect(x, hgt - 16, 30, 16);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(0, hgt - 17, w, 2);
      const sc = Math.min(w / 160, (hgt - 6) / 132);
      drawHorse(ctx, w / 2 + 64 * sc, hgt - 8, sc, h, horse.coat, t * 10, 1, { look: draft });
    };
    requestAnimationFrame(frame);
  }, 'studio');
}

// ---------------------------------------------------------------- the race
function getSim(race) {
  const k = `${race.seed}:${race.n}:${race.gates || 20}`;
  let sim = ui.sims.get(k);
  if (!sim) {
    // play out the race exactly as the host wrote it (older hosts only sent the seed)
    sim = race.script
      ? playRace({ script: race.script, winner: race.winner, order: race.order, bolt: race.bolt }, race.n, race.gates || 20)
      : simulate(race.seed, race.n, race.gates || 20);
    ui.sims.set(k, sim);
    if (ui.sims.size > 4) ui.sims.delete(ui.sims.keys().next().value);
  }
  return sim;
}

function renderRace(s) {
  const key = `race:${s.raceNo}:${s.race.seed}`;
  if (ui.stageKey === key && ui.raf) { updateStandings(true); return; }
  ui.stageKey = key;
  $('#stage').innerHTML = `<div class="card panel race-panel">
    <div class="phase-head"><h2>Race ${s.raceNo}</h2><span class="gate-info" id="gateInfo"></span></div>
    <div class="track-wrap"><canvas id="track"></canvas><div class="banner" id="banner"></div><div class="countdown" id="countdown"></div></div>
    <div class="commentary" id="commentary">The horses are in the starting gate…</div>
    <div class="standings" id="standings"></div>
  </div>`;
  ui.track = new TrackView($('#track'));
  ui.race = { key, lastT: null, lastFrame: performance.now(), leader: -1, lastComment: -9, lastStand: 0, lastGallop: 0, banner: '', cd: '' };
  cancelAnimationFrame(ui.raf);
  const frame = () => {
    ui.raf = requestAnimationFrame(frame);
    try { raceFrame(); } catch (e) { console.error(e); }
  };
  ui.raf = requestAnimationFrame(frame);
}

function stopRace() {
  if (ui.raf) cancelAnimationFrame(ui.raf);
  ui.raf = 0;
  ui.race = null;
}

const hname = (s, i) => `#${i + 1} ${s.horses[i] ? s.horses[i].name : ''}`;

function raceFrame() {
  const s = ui.state;
  if (!s || s.phase !== 'racing' || !s.race || !ui.race) return;
  const R = ui.race;
  const sim = getSim(s.race);
  const now = performance.now();
  const dt = Math.min(0.1, (now - R.lastFrame) / 1000);
  R.lastFrame = now;
  const t = (ui.room.now() - s.race.startAt) / 1000;
  const mine = s.picks[myPid()];
  ui.track.myLane = mine ? mine.h : -1;
  const pos = ui.track.draw(sim, s.horses, t, R.lastT == null ? 2 : dt);
  const prevT = R.lastT == null ? t : R.lastT;
  R.lastT = t;
  const crossed = x => prevT < x && t >= x && t - x < 0.6;   // only make noise for things that just happened

  // countdown
  let cd = '';
  if (t < 0) { const n = Math.ceil(-t); cd = n > 3 ? `<small>Race ${s.raceNo}</small>Get ready!` : `<span class="pop">${n}</span>`; }
  else if (t < 0.8) cd = '<span class="pop">GO!</span>';
  if (cd !== R.cd) { R.cd = cd; $('#countdown').innerHTML = cd; }
  for (const k of [3, 2, 1]) if (crossed(-k)) sfx.beep(false);
  if (crossed(0)) sfx.beep(true);
  if (R.fanfare !== s.race.seed && t > -4.2 && t < -2.5) { R.fanfare = s.race.seed; sfx.fanfare(); }

  // gate events
  const ev = eventAt(sim, t);
  let banner = '';
  const won = sim.winner >= 0 && t >= sim.fin[sim.winner];
  if (ev) {
    const e = ev.ev;
    // phones get a one-line version so it doesn't cover the horses (the commentary below has the names)
    const narrow = window.innerWidth < 600;
    banner = narrow ? `<div class="big">🚧 Gate ${e.gate}! FREEZE!</div>` : `<div class="big">🚧 Everyone's through gate ${e.gate}! FREEZE!</div>`;
    // (a horse that has had 6 boosts or 6 setbacks this race can't get another; -1 means nobody was eligible)
    const hasBoost = e.boost >= 0, hasSetback = e.setback >= 0;
    if (ev.pt >= BOOST_AT && hasBoost) banner += `<div class="boost">⚡ ${narrow ? `#${e.boost + 1}` : esc(hname(s, e.boost))} +1 gate</div>`;
    if (ev.pt >= SETBACK_AT && hasSetback) banner += `<div class="setback">🐌 ${narrow ? `#${e.setback + 1}` : esc(hname(s, e.setback))} −1 gate</div>`;
    if (crossed(e.t)) { sfx.freeze(); comment(`Everyone made it through gate ${e.gate}. FREEZE!`); }
    if (hasBoost && crossed(e.t + BOOST_AT)) { sfx.boost(); comment(`⚡ Boost! ${hname(s, e.boost)} jumps forward a gate!`); }
    if (hasSetback && crossed(e.t + SETBACK_AT)) { sfx.setback(); comment(`🐌 Ouch! ${hname(s, e.setback)} gets sent back a gate!`); }
  }
  if (won) {
    const w = sim.winner;
    banner = `<div class="big">🏆 ${esc(hname(s, w))} wins!</div>` + (mine ? (mine.h === w ? `<div class="boost">You won ${plural(mine.bet, 'chip')}!</div>` : `<div class="setback">Your horse came ${ordinal(sim.order.indexOf(mine.h) + 1)}. Take ${plural(mine.bet, 'penalty', 'penalties')}!</div>`) : '');
    if (crossed(sim.fin[w])) {
      sfx.cheer();
      if (mine) setTimeout(() => (mine.h === w ? sfx.win() : sfx.lose()), 600);
      comment(sim.bolt ? `🏆 Nobody else can move! ${hname(s, w)} is furthest ahead and bolts for the line!` : `🏆 ${hname(s, w)} crosses the line first!`);
    }
  }
  if (banner !== R.banner) {
    R.banner = banner;
    const b = $('#banner');
    if (banner) { b.innerHTML = banner; b.classList.toggle('win', won); }
    b.classList.toggle('show', !!banner);
  }
  if (t > 0.3 && !R.saidOff) { R.saidOff = true; if (!ev && !won) comment("And they're off!"); }
  // a clop each time a horse lands a hop (at most one sound every 60 ms)
  if (R.prevPos && t > 0 && !ev && now - (R.lastClop || 0) > 60) {
    for (let i = 0; i < pos.length; i++) {
      if (Math.floor(pos[i]) > Math.floor(R.prevPos[i])) { R.lastClop = now; sfx.hop(); break; }
    }
  }
  R.prevPos = pos.slice();
  // lead changes
  if (t > 1 && !ev && !won) {
    let lead = 0;
    for (let i = 1; i < pos.length; i++) if (pos[i] > pos[lead]) lead = i;
    if (lead !== R.leader && pos[lead] - [...pos].sort((a, b) => b - a)[1] > 0.04) {
      if (R.leader >= 0 && t - R.lastComment > 1.5) comment(`${hname(s, lead)} ${pick(['takes the lead!', 'surges to the front!', 'pokes a nose in front!', 'is out in front!', 'grabs the lead!'])}`);
      R.leader = lead;
    }
  }
  // gate counter
  const cleared = gatesClearedAt(sim, t);
  const gi = won ? 'Finished!' : t < 0 ? `${sim.gates} gates to go` : `Gate ${cleared} of ${sim.gates} cleared by everyone`;
  if (gi !== R.gi) { R.gi = gi; $('#gateInfo').textContent = gi; }
  if (now - R.lastStand > 250) { R.lastStand = now; updateStandings(); }

  function comment(text) { R.lastComment = t; $('#commentary').textContent = text; }
}

function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

function updateStandings(force) {
  const s = ui.state;
  if (!s || !ui.track || !ui.track.lastPos || s.phase !== 'racing') return;
  const sim = getSim(s.race);
  const t = (ui.room.now() - s.race.startAt) / 1000;
  const pos = ui.track.lastPos;
  const pid = myPid(), mine = s.picks[pid];
  const done = i => sim.fin[i] >= 0 && t >= sim.fin[i];
  const order = pos.map((p, i) => i).sort((a, b) => {
    if (done(a) && done(b)) return sim.fin[a] - sim.fin[b];
    if (done(a)) return -1;
    if (done(b)) return 1;
    return pos[b] - pos[a];
  });
  const html = order.map((i, k) => {
    const who = E.backers(s, i).map(id => esc(pav(s, id))).join('');
    return `<div class="stand ${mine && mine.h === i ? 'mine' : ''}"><span class="place">${ordinal(k + 1)}</span><span class="chip" style="background:${E.SILKS[i].bg};color:${E.SILKS[i].fg}">${i + 1}</span><span class="nm">${esc(s.horses[i].name)}</span><span class="who">${who}</span></div>`;
  }).join('');
  if (html !== ui.race.stand || force) { ui.race.stand = html; $('#standings').innerHTML = html; }
}

// ---------------------------------------------------------------- results + penalties
// The podium scene at the top of the results keeps animating on its own; only the part below it is redrawn.
function startPodium(s) {
  const key = `${s.code}:${s.raceNo}:${s.race ? s.race.seed : ''}`;
  if (!ui.podium || ui.podium.key !== key) ui.podium = { key, start: performance.now(), cheered: false };
  const view = new PodiumView($('#podium'));
  view.burst = (performance.now() - ui.podium.start) / 1000 > 1.5;   // redrawn later: no second confetti burst
  ui.podium.view = view;
  if (ui.podiumRaf) return;
  const frame = () => {
    ui.podiumRaf = requestAnimationFrame(frame);
    const st = ui.state, P = ui.podium;
    if (!st || st.phase !== 'results' || !st.res || !P || !P.view || !document.contains(P.view.c)) return;
    const t = (performance.now() - P.start) / 1000;
    if (t >= 1 && !P.cheered) { P.cheered = true; if (t < 3) sfx.win(); }   // the winner lands on the podium
    try { P.view.draw(t, st.horses, st.res.order); } catch (e) { console.error(e); }
  };
  ui.podiumRaf = requestAnimationFrame(frame);
}
function stopPodium() {
  if (ui.podiumRaf) cancelAnimationFrame(ui.podiumRaf);
  ui.podiumRaf = 0;
}

function renderResults(s) {
  const res = s.res;
  if (!res) return;
  const pid = myPid(), isHost = s.hostPid === pid;
  const w = res.winner, wh = s.horses[w];
  // the frame with the podium: built once per race
  const shell = `res:${s.code}:${s.raceNo}`;
  if (ui.resShell !== shell || !$('#podium')) {
    ui.resShell = shell;
    ui.stageKey = '';
    $('#stage').innerHTML = `<div class="card panel">
      <div class="phase-head"><h2>Race ${s.raceNo} results</h2><span class="sub" id="resHeadline"></span></div>
      <div class="podium-box"><canvas id="podium"></canvas><div class="podium-title" id="podiumTitle"></div></div>
      <div id="resBody"></div>
    </div>`;
    startPodium(s);
  }
  const key = JSON.stringify(['res', s.raceNo, res, s.hostPid, pid, ui.draft, s.order, s.horses.map(h => h.name), s.order.map(id => s.players[id] && [s.players[id].name, s.players[id].on])]);
  if (key === ui.stageKey) return;
  ui.stageKey = key;
  const winners = res.payouts.filter(p => p.win);
  const minePo = res.payouts.find(p => p.pid === pid);
  let headline;
  if (minePo && minePo.win) headline = `🎉 You won ${plural(minePo.bet, 'chip')}!`;
  else if (minePo) headline = `Your horse #${minePo.h + 1} came ${ordinal(res.order.indexOf(minePo.h) + 1)}, so you take ${plural(minePo.bet, 'penalty', 'penalties')}.`;
  else headline = 'You sat this one out.';
  const backedBy = winners.length ? `Backed by ${winners.map(p => `${esc(pav(s, p.pid))} ${esc(pname(s, p.pid))} (+${p.bet})`).join(', ')}` : 'Nobody backed it, so nobody wins chips this race.';

  const order = res.order.map((h, k) => `<li><span class="pl">${ordinal(k + 1)}</span>${dot(h)}<span>#${h + 1} ${esc(s.horses[h].name)}</span></li>`).join('');
  const payouts = res.payouts.length
    ? res.payouts.map(p => `<div class="payout"><span>${esc(pav(s, p.pid))} ${esc(pname(s, p.pid))}</span>${dot(p.h)}<span>#${p.h + 1}</span><span class="amt ${p.win ? 'win' : 'lose'}">${p.win ? `+${p.bet} chips` : `🤕 ${plural(p.bet, 'penalty', 'penalties')}`}</span></div>`).join('')
    : '<div class="payout">No bets this race.</div>';

  // penalty panel for me
  let panel = '';
  const pool = res.pools[pid] || 0;
  if (pool && !res.done[pid]) {
    const targets = s.order.filter(id => id !== pid && s.players[id]);
    const used = Object.values(ui.draft).reduce((a, b) => a + b, 0);
    const left = pool - used;
    panel = `<div class="penalty">
      <h3>💥 Dish out your penalties</h3>
      <p>You bet ${plural(minePo.bet, 'chip')} and won, so you get <b>${pool} penalties</b> to give out. Split them between as many people as you like.</p>
      ${targets.length ? `<div class="pen-rows">${targets.map(id => {
      const n = ui.draft[id] || 0, p = s.players[id];
      return `<div class="pen-row ${p.on ? '' : 'off'}"><span class="who">${esc(p.av)} ${esc(p.name)}${p.on ? '' : ' (away)'}</span>
          <div class="stepper"><button data-pen="${esc(id)}" data-d="-1" ${n ? '' : 'disabled'} aria-label="Fewer">−</button><div class="amt">${n}</div><button data-pen="${esc(id)}" data-d="1" ${left ? '' : 'disabled'} aria-label="More">+</button></div></div>`;
    }).join('')}</div>` : '<p>There is nobody else here to attack!</p>'}
      <div class="pen-foot">
        <span class="pen-left ${left ? '' : 'zero'}">${left ? `${left} left to give` : 'All handed out!'}</span>
        <span class="spacer"></span>
        ${targets.length > 1 ? '<button class="btn small" data-even>Split evenly</button>' : ''}
        ${used ? '<button class="btn small" data-clear>Reset</button>' : ''}
        <button class="btn primary" data-attack ${used ? '' : 'disabled title="Give at least one penalty first"'}>💥 Attack!</button>
      </div>
    </div>`;
  }
  const pending = E.pendingAttackers(s).filter(id => id !== pid);
  const waiting = pending.length ? `<p class="waiting">Waiting for ${pending.map(id => esc(pname(s, id))).join(' and ')} to dish out penalties…</p>` : '';
  const attacks = res.attacks.length ? `<div class="attacks">${res.attacks.map(a => {
    const list = Object.entries(a.hits).map(([id, n]) => `${esc(pname(s, id))} 💥${n}`).join(', ');
    const hitMe = a.hits[pid];
    return `<div class="attack-line ${hitMe ? 'me' : ''}">${esc(pav(s, a.from))} <b>${esc(pname(s, a.from))}</b> attacked ${list}</div>`;
  }).join('')}</div>` : '';

  $('#resHeadline').textContent = headline;
  $('#podiumTitle').textContent = `🏆 #${w + 1} ${wh.name} wins!`;
  $('#resBody').innerHTML = `
    <p class="backed">${backedBy}</p>
    <div class="host-row next-row">
      ${isHost ? `<button class="btn primary big-next" data-next>Next race ▶</button>${pending.length || (pool && !res.done[pid]) ? '<span class="note">Winners are still handing out penalties</span>' : ''}` : `<div class="waiting">${esc(pname(s, s.hostPid))} will start the next race.</div>`}
    </div>
    ${panel}
    ${attacks}
    ${waiting}
    <div class="res-grid">
      <div class="res-block"><h3>Finishing order</h3><ol class="order">${order}</ol></div>
      <div class="res-block"><h3>Bets</h3><div class="payouts">${payouts}</div></div>
    </div>`;

  const stage = $('#resBody');
  stage.querySelectorAll('[data-pen]').forEach(b => b.onclick = () => {
    const id = b.dataset.pen, d = +b.dataset.d;
    const used = Object.values(ui.draft).reduce((a, x) => a + x, 0);
    const cur = ui.draft[id] || 0;
    if (d > 0 && used >= pool) return;
    const n = Math.max(0, cur + d);
    if (n) ui.draft[id] = n; else delete ui.draft[id];
    sfx.click();
    renderResults(ui.state);
  });
  const even = stage.querySelector('[data-even]');
  if (even) even.onclick = () => {
    const ids = s.order.filter(id => id !== pid && s.players[id] && s.players[id].on);
    const list = ids.length ? ids : s.order.filter(id => id !== pid && s.players[id]);
    ui.draft = {};
    list.forEach((id, k) => { const n = Math.floor(pool / list.length) + (k < pool % list.length ? 1 : 0); if (n) ui.draft[id] = n; });
    sfx.click();
    renderResults(ui.state);
  };
  const clear = stage.querySelector('[data-clear]');
  if (clear) clear.onclick = () => { ui.draft = {}; renderResults(ui.state); };
  const atk = stage.querySelector('[data-attack]');
  if (atk) atk.onclick = () => { sfx.send(); ui.room.act({ k: 'attack', hits: { ...ui.draft } }); };
  const next = stage.querySelector('[data-next]');
  if (next) next.onclick = () => {
    const pendingNow = E.pendingAttackers(ui.state);
    const go = () => ui.room.act({ k: 'next' });
    if (pendingNow.length) confirmBox('Skip ahead?', `${pendingNow.map(id => pname(ui.state, id)).join(' and ')} still ${pendingNow.length === 1 ? 'has' : 'have'} penalties to hand out. Start the next race anyway?`, 'Next race', 'Wait', go);
    else go();
  };
}

/** Popups for anyone who just got attacked (and a quick note for everyone else). */
function checkAttacks(s) {
  if (!s.res || !s.res.attacks) return;
  const pid = myPid();
  let changed = false;
  for (const a of s.res.attacks) {
    const id = `${s.code}:${s.created}:${a.id}`;
    if (ui.seen.has(id)) continue;
    ui.seen.add(id); changed = true;
    const from = pname(s, a.from), av = pav(s, a.from);
    const hit = a.hits[pid];
    if (hit) {
      modal((el, close) => {
        el.innerHTML = `<div class="boom">💥</div><h2>ATTACKED!</h2><p>${esc(av)} <b>${esc(from)}</b> attacked you for<span class="num">${plural(hit, 'penalty', 'penalties')}</span></p><div class="row"><button class="btn primary" autofocus>Ouch!</button></div>`;
        el.querySelector('button').onclick = close;
        sfx.attack();
        if (navigator.vibrate) navigator.vibrate([80, 40, 140]);
      }, 'attack-modal');
    } else if (a.from === pid) {
      toast('💥 Attack sent!', 'good');
    } else if (a.total) {
      const list = Object.entries(a.hits).map(([t, n]) => `${pname(s, t)} (${n})`).join(', ');
      toast(`💥 ${from} attacked ${list}`);
    }
  }
  if (changed) tabStore.set('hr_seen', [...ui.seen].slice(-200));
}

// ---------------------------------------------------------------- achievements
/** Anything new unlocked in this state? Save, pop up each one, and tell the lobby. */
function checkAchievements(s) {
  const fresh = observe(achProg, s, myPid());
  if (achProg.dirty) {
    achProg.dirty = false;
    const { dirty, ...keep } = achProg;
    store.set('hr_ach', keep);
  }
  if (!fresh.length) return;
  if (ui.room) ui.room.me.ach = achCount();
  showAchCount();
  // one at a time, so a big race (first win, all in, photo finish...) is a little parade; the lobby hears
  // about them all at once
  fresh.forEach((id, k) => setTimeout(() => announceAch(id), 700 + k * 1100));
  setTimeout(() => { if (ui.room && ui.room.role) ui.room.act({ k: 'ach', ids: fresh, n: achCount() }); }, 700);
}

function announceAch(id) {
  const a = ACH_BY_ID[id];
  if (!a) return;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'toast ach';
  el.innerHTML = `<span class="ach-ic">${a.icon}</span><span class="ach-txt"><small>Achievement unlocked!</small><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></span>`;
  el.onclick = () => showAchievements();
  $('#toasts').appendChild(el);
  sfx.ach();
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 420); }, 5200);
}

function showAchCount() {
  $('#achCount').textContent = `${achCount()} / ${ACH_COUNT}`;
}

function showAchievements() {
  unlock();
  modal((el, close) => {
    const n = achCount();
    el.innerHTML = `<h2>🏅 Achievements</h2>
      <p class="ach-sub"><b>${n}</b> of ${ACH_COUNT} unlocked · saved on this device</p>
      <div class="ach-bar"><i style="width:${Math.round((100 * n) / ACH_COUNT)}%"></i></div>
      ${GROUPS.map((g, gi) => `<h3 class="ach-group">${esc(g)}</h3><div class="ach-list">${ACHIEVEMENTS.filter(a => a.g === gi).map(a => {
        const got = achProg.got[a.id], pr = progressOf(achProg, a);
        return `<div class="ach-item ${got ? 'got' : ''}"><span class="ach-ic">${a.icon}</span><span class="ach-txt"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${!got && pr ? `<span class="ach-prog"><i style="width:${Math.round((100 * pr[0]) / pr[1])}%"></i><em>${pr[0]} / ${pr[1]}</em></span>` : ''}</span>${got ? '<span class="ach-tick" title="Unlocked">✓</span>' : ''}</div>`;
      }).join('')}</div>`).join('')}
      <div class="row"><button class="btn primary" data-close>Close</button></div>`;
    el.querySelector('[data-close]').onclick = close;
  }, 'ach-modal');
}
$('#achBtn').onclick = () => { sfx.click(); showAchievements(); };
$('#achTopBtn').onclick = () => { sfx.click(); showAchievements(); };
showAchCount();

// ---------------------------------------------------------------- home screen horse
let homeRaf = 0;
function startHomeHorse() {
  const c = $('#homeHorse');
  if (!c || homeRaf) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = 300, H = 110;
  c.width = W * dpr; c.height = H * dpr;
  const ctx = c.getContext('2d');
  const lane = Math.floor(Math.random() * 6), coat = Math.floor(Math.random() * 8);
  let phase = 0, last = performance.now(), x = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = now => {
    homeRaf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    phase += dt * 14; x += dt * 60;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // scrolling rail + turf
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, H - 14, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = -(x % 30); k < W; k += 30) ctx.fillRect(k, H - 20, 3, 12);
    drawHorse(ctx, W / 2 + 62, H - 8, 1.05, lane, coat, reduce ? 0 : phase, reduce ? 0 : 1);
  };
  homeRaf = requestAnimationFrame(loop);
}
function stopHomeHorse() { cancelAnimationFrame(homeRaf); homeRaf = 0; }

// ---------------------------------------------------------------- start up
window.addEventListener('resize', () => { if (ui.state && ui.state.phase !== 'racing') { ui.stageKey = ''; render(); } });

(function boot() {
  const params = new URLSearchParams(location.search);
  const urlCode = cleanCode(params.get('room'));
  const saved = tabStore.get('hr_session');
  if (saved && saved.state && Date.now() - saved.at < 6 * 3600e3 && (!urlCode || urlCode === saved.code)) {
    // reloaded the page while in a lobby: go straight back in
    const player = { pid: saved.pid, tab: TAB, name: profile.name || 'Mystery Guest', av: profile.av, ach: achCount() };
    const sp = saved.state.players && saved.state.players[saved.pid];
    if (sp) { player.name = sp.name; player.av = sp.av; }
    const room = new Room(player);
    bindRoom(room);
    room.code = saved.code;
    showRoom();
    room.resume(saved);
    return;
  }
  startHomeHorse();
  if (urlCode) {
    codeInput.value = urlCode;
    if (profile.name) joinLobby(urlCode);
    else { homeMsg('Type your name, then tap Join to get in.', true); nameInput.focus(); }
  }
})();
