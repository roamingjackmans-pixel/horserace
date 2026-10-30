// Little synthesized sound effects. Nothing loads; everything is made with WebAudio on the fly.
let ac = null, master = null;
let muted = false;
try { muted = localStorage.getItem('hr_muted') === '1'; } catch { }

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem('hr_muted', muted ? '1' : '0'); } catch { }
  if (master) master.gain.value = muted ? 0 : 0.5;
}

/** Call from a click/tap: browsers only allow sound after the player has touched the page. */
export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
}

function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005 } = {}) {
  if (!ac || muted) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(dur, { vol = 0.2, at = 0, freq = 1200, q = 1, type = 'bandpass', attack = 0.01 } = {}) {
  if (!ac || muted) return;
  const t0 = ac.currentTime + at;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

export const sfx = {
  click() { tone(660, 0.06, { type: 'triangle', vol: 0.12 }); },
  pick() { tone(523, 0.08, { type: 'triangle', vol: 0.18 }); tone(784, 0.12, { type: 'triangle', vol: 0.18, at: 0.06 }); },
  join() { tone(440, 0.1, { type: 'sine', vol: 0.15 }); tone(660, 0.14, { type: 'sine', vol: 0.15, at: 0.08 }); },
  beep(hi) { tone(hi ? 880 : 520, hi ? 0.45 : 0.16, { type: 'square', vol: 0.11 }); },
  fanfare() {
    // a short made-up bugle call
    const n = [392, 523, 659, 784, 659, 784];
    const d = [0.12, 0.12, 0.12, 0.3, 0.12, 0.45];
    let at = 0;
    n.forEach((f, i) => { tone(f, d[i] + 0.05, { type: 'sawtooth', vol: 0.09, at, attack: 0.02 }); tone(f * 2, d[i], { type: 'square', vol: 0.025, at }); at += d[i]; });
  },
  gallop() { noise(0.05, { vol: 0.08, freq: 220, q: 2 }); noise(0.05, { vol: 0.06, freq: 260, q: 2, at: 0.09 }); },
  freeze() { tone(1200, 0.18, { type: 'sine', vol: 0.12, slide: 0.5 }); },
  boost() { tone(300, 0.4, { type: 'sawtooth', vol: 0.1, slide: 4 }); tone(600, 0.35, { type: 'square', vol: 0.05, slide: 3, at: 0.05 }); },
  setback() {
    // sad trombone, wah-wah
    [392, 370, 349, 311].forEach((f, i) => tone(f, i === 3 ? 0.55 : 0.2, { type: 'sawtooth', vol: 0.09, at: i * 0.18, slide: i === 3 ? 0.9 : 1, attack: 0.03 }));
  },
  cheer() { noise(2.2, { vol: 0.22, freq: 1500, q: 0.4, attack: 0.25 }); tone(1047, 0.25, { type: 'triangle', vol: 0.15 }); tone(1319, 0.4, { type: 'triangle', vol: 0.15, at: 0.12 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.18, at: i * 0.1 })); },
  lose() { tone(330, 0.3, { type: 'triangle', vol: 0.12, slide: 0.7 }); },
  attack() { noise(0.35, { vol: 0.4, freq: 180, q: 0.7, type: 'lowpass' }); tone(140, 0.4, { type: 'sine', vol: 0.4, slide: 0.4 }); noise(0.5, { vol: 0.15, freq: 3000, q: 0.5, at: 0.05 }); },
  send() { tone(500, 0.12, { type: 'square', vol: 0.08, slide: 2 }); },
};
