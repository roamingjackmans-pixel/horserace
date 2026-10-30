// The connection check page: tests each thing the game needs, on this phone and network, and says in plain
// words what works. Players who can't get in can copy the results and send them to whoever runs the game.
// No addresses are shown or copied, only what kind of connection works.
import { openPeer, roomPeerId, cleanCode } from './net.js';
import { BROKERS, Link, RelayGuest } from './relay.js';

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ms = t0 => `${Math.round(performance.now() - t0)} ms`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = { run: '⏳', ok: '✅', warn: '⚠️', bad: '❌', info: 'ℹ️' };

const v = window.HR_VERSION;
if (v) $('#buildTag').textContent = `v${v.version}${v.commit && v.commit !== 'dev' ? ' · ' + v.commit : ''}`;
const codeInput = $('#code');
codeInput.value = cleanCode(new URLSearchParams(location.search).get('room'));
codeInput.addEventListener('input', () => { codeInput.value = cleanCode(codeInput.value); });

let report = [];
function row(title) {
  const li = document.createElement('li');
  $('#results').appendChild(li);
  const set = (state, detail, line) => {
    li.innerHTML = `<span class="ic">${ICON[state]}</span><div><b>${esc(title)}</b>${detail ? `<div class="det">${esc(detail)}</div>` : ''}</div>`;
    if (line) report.push(`${title}: ${line}`);
  };
  set('run', 'Checking…');
  return set;
}

// ------------------------------------------------------------ the browser
async function browser() {
  const ua = navigator.userAgent;
  const m = re => (ua.match(re) || [])[1];
  let name = 'Unknown browser';
  if (m(/SamsungBrowser\/(\d+)/)) name = `Samsung Internet ${m(/SamsungBrowser\/(\d+)/)}`;
  else if (m(/EdgA?\/(\d+)/)) name = `Edge ${m(/EdgA?\/(\d+)/)}`;
  else if (m(/OPR\/(\d+)/)) name = `Opera ${m(/OPR\/(\d+)/)}`;
  else if (m(/Firefox\/(\d+)/)) name = `Firefox ${m(/Firefox\/(\d+)/)}`;
  else if (m(/CriOS\/(\d+)/)) name = `Chrome ${m(/CriOS\/(\d+)/)}`;
  else if (m(/Chrome\/(\d+)/)) name = `Chrome ${m(/Chrome\/(\d+)/)}`;
  else if (m(/Version\/(\d+).*Safari/)) name = `Safari ${m(/Version\/(\d+)/)}`;
  let os = m(/Android (\d+)/) ? `Android ${m(/Android (\d+)/)}` : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  try {
    const hi = navigator.userAgentData && await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
    if (hi && hi.model) os += ` · ${hi.model}`;
  } catch { }
  const inApp = /; wv\)|FBAN|FBAV|Instagram|Snapchat|MicroMessenger|GSA\/|Line\//.test(ua);
  return { name, os, inApp, ua };
}

// ------------------------------------------------------------ direct connections (WebRTC)
async function gather(iceServers, wait = 6000) {
  const pc = new RTCPeerConnection({ iceServers });
  pc.createDataChannel('check');
  const found = [];
  pc.onicecandidate = e => { if (e.candidate && e.candidate.candidate) found.push({ c: e.candidate, url: e.url || '' }); };
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise(r => {
    const t = setTimeout(r, wait);
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } };
  });
  pc.close();
  return found;
}

/** What kind of network this is, for direct connections. */
async function network() {
  const found = await gather([{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }]);
  const typeOf = x => x.c.type || (x.c.candidate.match(/ typ (\w+)/) || [])[1];
  const srflx = found.filter(x => typeOf(x) === 'srflx');
  const v6 = found.some(x => (x.c.address || '').includes(':') && typeOf(x) !== 'relay');
  // the same public address seen with a different port by each server = strict (symmetric) NAT
  const byAddr = new Map();
  for (const x of srflx) {
    if ((x.c.address || '').includes(':')) continue;
    const k = x.c.address;
    if (!byAddr.has(k)) byAddr.set(k, new Set());
    byAddr.get(k).add(x.c.port);
  }
  const strict = [...byAddr.values()].some(ports => ports.size > 1);
  return { any: found.length, srflx: srflx.length, v4: byAddr.size, strict, v6 };
}

/** Try the real thing: connect to a lobby's host directly and ask it to answer (without joining). */
function directProbe(code, wait = 12000) {
  return new Promise(resolve => {
    const t0 = performance.now();
    let peer, done = false;
    const end = r => { if (done) return; done = true; clearTimeout(timer); try { peer && peer.destroy(); } catch { } resolve(r); };
    const timer = setTimeout(() => end({ ok: false, why: 'timed out' }), wait);
    openPeer(null).then(p => {
      peer = p;
      if (done) { p.destroy(); return; }
      const conn = p.connect(roomPeerId(code), { reliable: true, serialization: 'json' });
      p.on('error', e => end({ ok: false, why: e && e.type === 'peer-unavailable' ? 'no lobby' : (e && e.type) || 'error' }));
      conn.on('open', () => conn.send({ t: 'probe' }));
      conn.on('data', m => { if (m && m.t === 'probe') end({ ok: true, t: ms(t0), v: m.v }); });
      conn.on('close', () => end({ ok: false, why: 'connection failed' }));
    }).catch(e => end({ ok: false, why: 'no matchmaking' }));
  });
}

function relayProbe(code, wait = 12000) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const g = new RelayGuest(code).prepare();
    let done = false;
    const end = r => { if (done) return; done = true; clearTimeout(timer); g.close(); resolve(r); };
    const timer = setTimeout(() => end({ ok: false, why: 'no answer' }), wait);
    g.on('data', m => { if (m && m.t === 'probe') end({ ok: true, t: ms(t0), via: g.via, v: m.v }); });
    g.on('dead', () => end({ ok: false, why: 'no relay server reachable' }));
    g.hello({ t: 'probe' });
  });
}

/** Connect to one relay server and get a message back through it. */
async function relayServer(b) {
  const t0 = performance.now();
  const topic = `jjgames/check/${Math.random().toString(36).slice(2)}`;
  let got;
  const back = new Promise(r => { got = r; });
  const link = new Link(b, (l, t, p) => { if (t === topic) got(); }, null);
  try {
    await link.connect(8000);
    await link.subscribe(topic);
    link.publish(topic, 'ping');
    await Promise.race([back, sleep(6000).then(() => { throw new Error('no echo'); })]);
    return { ok: true, t: ms(t0) };
  } catch (e) {
    return { ok: false, why: e.message.replace(/^\w+: /, '') };
  } finally { link.close(); }
}

// ------------------------------------------------------------ run it
async function run() {
  const code = cleanCode(codeInput.value);
  $('#run').disabled = true;
  $('#after').hidden = true;
  $('#verdict').hidden = true;
  $('#results').innerHTML = '';
  $('#copyMsg').textContent = '';
  report = [`Horse Race connection check${v ? ` (v${v.version} · ${v.commit})` : ''}, ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`];
  const out = {};

  const b = await browser();
  row('Your browser')(b.inApp ? 'warn' : 'info',
    `${b.name}${b.os ? ` on ${b.os}` : ''}${b.inApp ? '. This looks like the browser inside another app (a messenger or social app). If joining fails, open the link in Chrome or Samsung Internet instead.' : ''}`,
    `${b.name}${b.os ? ` · ${b.os}` : ''}${b.inApp ? ' · in-app browser' : ''}`);

  const rtcRow = row('Direct connections');
  out.rtc = false;
  try {
    if (typeof RTCPeerConnection !== 'function') throw new Error('missing');
    const pc = new RTCPeerConnection(); pc.createDataChannel('x'); await pc.createOffer(); pc.close();
    out.rtc = true;
  } catch { }
  if (!out.rtc) rtcRow('bad', 'This browser has direct connections (WebRTC) turned off or missing. The game will use the backup relay.', 'not available');
  else {
    rtcRow('run', 'Supported. Looking at your network…');
    const n = out.net = await network();
    if (!n.any) rtcRow('bad', 'Supported, but the browser shared no network routes at all, so direct connections will fail. A privacy setting or extension may be blocking WebRTC. The game will use the backup relay.', 'supported, no routes');
    else if (!n.srflx && !n.v6) rtcRow('warn', 'Supported, but your network blocks the kind of traffic direct connections use (UDP). Joining will probably go through the backup relay.', 'supported, UDP blocked');
    else if (n.strict && !n.v6) rtcRow('warn', 'Supported, but your network shares one address between many devices in a strict way (common on mobile data and some VPNs). Direct connections may fail; the backup relay takes over if so.', 'supported, strict NAT, no IPv6');
    else rtcRow('ok', `Supported, and your network looks friendly to them${n.v6 ? ' (IPv6 too)' : ''}${n.strict ? ', though its IPv4 sharing is strict' : ''}.`, `ok${n.strict ? ' · strict NAT' : ''}${n.v6 ? ' · IPv6' : ''}`);
  }

  const mmRow = row('Matchmaking service');
  try {
    const t0 = performance.now();
    const p = await openPeer(null, 10000);
    p.destroy();
    out.mm = true;
    mmRow('ok', `Reached it in ${ms(t0)}.`, `ok ${ms(t0)}`);
  } catch (e) {
    out.mm = false;
    mmRow('bad', "Couldn't reach it (0.peerjs.com). An ad blocker, Private DNS setting or VPN may be blocking it. You can still join through the backup relay, but you can't host a lobby from here.", `failed (${e.code || e.message})`);
  }

  const relRow = row('Backup relay');
  const rel = await Promise.all(BROKERS.map(relayServer));
  out.relay = rel.some(r => r.ok);
  const relText = BROKERS.map((br, i) => `${br.name} ${rel[i].ok ? rel[i].t : rel[i].why}`).join(' · ');
  relRow(out.relay ? 'ok' : 'bad',
    out.relay ? `${rel.filter(r => r.ok).length} of ${BROKERS.length} relay servers work (${relText}).` : `None of the relay servers could be reached (${relText}). Something on this network or phone blocks them.`,
    relText);

  if (code.length === 5) {
    const lr = row(`Lobby ${code}`);
    lr('run', 'Trying a direct connection and the relay…');
    const [d, r] = await Promise.all([out.mm ? directProbe(code) : Promise.resolve({ ok: false, why: 'no matchmaking' }), relayProbe(code)]);
    out.lobby = { d, r };
    const dt = d.ok ? `direct ok ${d.t}` : `direct ${d.why}`;
    const rt = r.ok ? `relay ok ${r.t} (${r.via})` : `relay ${r.why}`;
    if (d.why === 'no lobby' && !r.ok) lr('bad', `No lobby with code ${code} is open right now. Check the code, or ask your friend to open one.`, `${dt} · ${rt}`);
    else if (d.ok) lr('ok', `Connected straight to the host in ${d.t}.${r.ok ? ` The relay works too (${r.t}).` : ''}`, `${dt} · ${rt}`);
    else if (r.ok) lr('ok', `A direct connection didn't work (${d.why}), but the backup relay got through in ${r.t}. You can join.`, `${dt} · ${rt}`);
    else lr('bad', `Couldn't reach the host either way (direct: ${d.why}; relay: ${r.why}). If the host's game hasn't been reloaded since the latest update, ask them to reload it.`, `${dt} · ${rt}`);
    const ver = (d.ok && d.v) || (r.ok && r.v);
    if (ver) report.push(`Lobby game version: ${ver}`);
  }

  // the overall verdict
  let kind, text;
  const l = out.lobby;
  if (l && (l.d.ok || l.r.ok)) { kind = 'ok'; text = `You can join lobby ${code}${l.d.ok ? '.' : ' through the backup relay.'}`; }
  else if (l && l.d.why === 'no lobby' && !l.r.ok) { kind = 'warn'; text = `No lobby ${code} is open right now, but here's how your connection looks: ${out.relay || (out.rtc && out.mm) ? 'you should be able to join one.' : 'it may not be able to join one.'}`; }
  else if (l) { kind = 'bad'; text = `Couldn't reach lobby ${code}. Try switching between Wi-Fi and mobile data, turning off any VPN, ad blocker or Private DNS, or another browser, then run this again.`; }
  else if (out.relay && out.rtc && out.mm && out.net && out.net.srflx && !out.net.strict) { kind = 'ok'; text = 'Everything looks good. You should be able to join and host lobbies.'; }
  else if (out.relay) { kind = 'ok'; text = 'You should be able to join: if a direct connection fails, the game switches to the backup relay. For a sure answer, have a friend open a lobby and put its code above.'; }
  else if (out.rtc && out.mm) { kind = 'warn'; text = 'Direct connections may work, but the backup relay is blocked, so some lobbies may not be reachable from this network.'; }
  else { kind = 'bad'; text = 'This phone or network blocks both ways the game connects. Try switching between Wi-Fi and mobile data, turning off any VPN, ad blocker or Private DNS, or another browser.'; }
  const vd = $('#verdict');
  vd.className = `verdict ${kind}`;
  vd.textContent = text;
  vd.hidden = false;
  report.splice(1, 0, `Verdict: ${text}`);
  report.push(`Browser string: ${b.ua}`);
  $('#after').hidden = false;
  $('#run').disabled = false;
}

$('#run').onclick = run;
$('#again').onclick = run;
$('#copy').onclick = async () => {
  const text = report.join('\n');
  try { await navigator.clipboard.writeText(text); $('#copyMsg').textContent = 'Copied! Paste it in a message to whoever runs the game.'; }
  catch {
    if (navigator.share) { try { await navigator.share({ title: 'Horse Race connection check', text }); return; } catch { } }
    $('#copyMsg').textContent = '';
    const ta = document.createElement('textarea');
    ta.className = 'check-report'; ta.value = text; ta.readOnly = true;
    $('#after').after(ta); ta.select();
  }
};
