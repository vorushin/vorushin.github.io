// Magic cats — sound. Nothing is sampled: a small generative lullaby engine (pad, bass,
// plucked arpeggio, music-box lead and a counter-melody that comes and goes, all in 6/8) plus
// synthesised effects and ambiences, all WebAudio. Everything is scheduled on the context
// clock, so the engine also works on an OfflineAudioContext (used by the tests to check
// levels, spectra and harmony).

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10]
};
const MASTER = 1.5;   // overall level; the compressor and the soft clipper after it keep peaks in check
const SFX_NOTE = 0.7; // notes played by the player sit just above the music's own, never far over it
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const pc = (m) => ((m % 12) + 12) % 12;
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function degToMidi(key, scale, deg) {
  const d = deg - 1, oct = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
  return key + scale[i] + 12 * oct;
}

// The lullaby. [scale degree, length in eighths]; 0 = rest. 6 eighths per bar. (The tune is
// pentatonic — 1 2 3 5 6 — so it sits well in every mode; the mode colours the harmony.)
const THEME_A = [[3, 3], [5, 3], [6, 2], [5, 1], [3, 3], [2, 3], [3, 2], [2, 1], [1, 6], [3, 3], [5, 3], [6, 2], [8, 1], [6, 3], [5, 2], [3, 1], [2, 3], [1, 6]];
const THEME_B = [[5, 2], [6, 1], [8, 3], [6, 3], [5, 3], [3, 2], [5, 1], [3, 3], [2, 6], [5, 2], [6, 1], [8, 3], [9, 3], [8, 2], [6, 1], [5, 2], [3, 1], [2, 3], [1, 6]];

// Harmony: one entry per bar — a scale degree (the triad on it), a pair [first half, second
// half], or a special chord. Each mode has its own progression, chosen so that the tune never
// rubs against the chord on a strong beat (the test harness checks every bar of every song).
const N5 = { t: [5, 7, 11], alt: 1 };    // the fifth-degree chord as root, third and seventh: it leaves the tune's own note free
const HARMONY = {
  major: { A: [1, 6, 5, 1, 1, 4, 5, 1], B: [4, 1, 6, 5, 4, 1, 5, 1] },
  mixo: { A: [1, 6, 2, 1, 1, 4, 2, 1], B: [4, 1, 6, 2, 4, 1, 2, 1] },
  lydian: { A: [1, 6, 2, 1, 1, 2, 5, 1], B: [6, 1, 3, 2, 6, 1, 5, 1] },
  minor: { A: [1, 6, N5, 1, 1, 4, 5, 1], B: [6, 4, 3, 5, 6, 7, 5, 1] },
  dorian: { A: [1, [4, 1], N5, 1, 1, 4, 7, 1], B: [7, 4, 3, 5, 1, 4, 7, 1] }
};
// Arpeggio shapes over five rising chord tones (−1 = rest), one per eighth.
const ARPS = {
  rock: [0, 2, 3, 1, 2, 3], updown: [0, 1, 2, 3, 2, 1], sparse: [0, -1, 2, -1, 3, -1], waltz: [0, 2, 2, 0, 2, 2],
  high: [3, 2, 4, 2, 3, 1], drip: [4, -1, -1, 3, -1, 2], bounce: [0, 3, 2, 3, 1, 3],
  wave: [0, 1, 2, 3, 4, 3], skip: [0, 2, 1, 3, 2, 4], sway: [0, -1, 2, 1, -1, 2], fall: [4, 3, 2, 3, 1, 2],
  lilt: [0, 2, 1, 2, 3, 2], pond: [2, -1, 4, -1, 3, -1], hop: [0, 3, -1, 2, 4, -1],
  settle: [3, 2, 1, 0, -1, -1]
};
// Bass figures: [eighth, tone (0 root, 1 the chord's other low tone, 2 root an octave up), length in eighths, level].
const BASS = {
  root: [[0, 0, 4.5, 1]],
  sway: [[0, 0, 4.5, 1], [3, 1, 2, 0.52]],
  flow: [[0, 0, 3, 1], [3, 1, 1.6, 0.5], [4, 2, 2, 0.42]],
  bounce: [[0, 0, 2, 1], [2, 1, 1, 0.4], [3, 2, 2, 0.55], [5, 1, 1, 0.38]]
};

// step = seconds per eighth note. `trim` evens out the loudness between songs (measured).
const SONGS = {
  title: { key: 62, mode: 'major', step: 0.37, form: 'AABA', pad: 0.9, bass: 0.75, bassPat: 'sway', arp: 'updown', arpAlt: 'wave', arpInst: 'pluck', arpGain: 0.75, lead: 'box', leadGain: 0.9, leadEvery: 1, counter: 'glass', counterGain: 0.5, fill: 0.5, rev: 0.12, trim: 1 },
  candle: { key: 62, mode: 'major', step: 0.46, form: 'A', pad: 1, bass: 0.45, bassPat: 'root', arp: 'sparse', arpAlt: 'pond', arpInst: 'glass', arpGain: 0.6, lead: null, rev: 0.2, trim: 1.31 },
  treetops: { key: 62, mode: 'major', step: 0.33, form: 'AB', pad: 0.8, bass: 0.75, bassPat: 'sway', arp: 'rock', arpAlt: 'skip', arpInst: 'pluck', arpGain: 0.8, lead: null, rev: 0.08, trim: 1.3 },
  kitten: { key: 67, mode: 'major', step: 0.27, form: 'AB', pad: 0.6, bass: 0.7, bassPat: 'bounce', arp: 'bounce', arpAlt: 'hop', arpInst: 'pluck', arpGain: 0.9, lead: null, rev: 0.05, trim: 1.28 },
  moonmilk: { key: 59, mode: 'minor', step: 0.42, form: 'AB', pad: 0.85, bass: 0.6, bassPat: 'root', arp: 'drip', arpAlt: 'pond', arpInst: 'glass', arpGain: 0.6, lead: 'glass', leadGain: 0.9, leadEvery: 2, counter: 'flute', counterGain: 0.3, rev: 0.3, trim: 1 },
  library: { key: 57, mode: 'major', step: 0.31, form: 'AABA', pad: 0.75, bass: 0.7, bassPat: 'sway', arp: 'updown', arpAlt: 'lilt', arpInst: 'pluck', arpGain: 0.8, lead: 'flute', leadGain: 0.5, leadEvery: 2, counter: 'glass', counterGain: 0.5, fill: 0.45, rev: 0.1, trim: 0.95 },
  noticing: { key: 60, mode: 'lydian', step: 0.4, form: 'AB', pad: 0.85, bass: 0.6, bassPat: 'root', arp: 'high', arpAlt: 'fall', arpInst: 'glass', arpGain: 0.5, lead: 'box', leadGain: 0.8, leadEvery: 2, counter: 'flute', counterGain: 0.28, fill: 0.4, rev: 0.3, trim: 1.1 },
  towers: { key: 64, mode: 'dorian', step: 0.3, form: 'AB', pad: 0.85, bass: 0.72, bassPat: 'flow', arp: 'waltz', arpAlt: 'lilt', arpInst: 'pluck', arpGain: 0.85, lead: 'flute', leadGain: 0.5, leadEvery: 2, counter: 'glass', counterGain: 0.5, rev: 0.14, trim: 1 },
  clouds: { key: 60, mode: 'major', step: 0.4, form: 'BA', pad: 0.95, bass: 0.5, bassPat: 'root', arp: 'high', arpAlt: 'wave', arpInst: 'glass', arpGain: 0.55, lead: 'flute', leadGain: 0.5, leadEvery: 2, counter: 'glass', counterGain: 0.45, fill: 0.35, rev: 0.34, trim: 1 },
  garden: { key: 62, mode: 'major', step: 0.34, form: 'AABA', pad: 0.95, bass: 0.8, bassPat: 'sway', arp: 'rock', arpAlt: 'wave', arpInst: 'pluck', arpGain: 0.8, lead: 'box', leadGain: 0.9, leadEvery: 1, counter: 'flute', counterGain: 0.36, fill: 0.6, rev: 0.16, trim: 0.95 },
  lullaby: { key: 62, mode: 'major', step: 0.5, form: 'A', pad: 0.7, bass: 0.35, bassPat: 'root', arp: null, lead: 'box', leadGain: 1, leadEvery: 1, rev: 0.3, trim: 1 }
};

// A second voice under the tune: one chord tone per half bar, a third or a sixth below
// whenever it can be, moving as little as possible. It never forms a second, a seventh or a
// tritone with the tune.
function buildCounter(lead, bars, scale) {
  const semi = (deg) => degToMidi(0, scale, deg);
  const out = [];
  let prev = null;
  for (let b = 0; b < bars.length; b++) for (let h = 0; h < 2; h++) {
    const s0 = b * 6 + h * 3, s1 = s0 + 3, pcs = bars[b][h].t.map((d) => pc(semi(d)));
    const heard = lead.filter((n) => n.step < s1 && n.step + n.len > s0);
    let best = null, bs = 1e9;
    for (let c = 1; c <= 13; c++) {
      if (pcs.indexOf(pc(c)) < 0) continue;
      let sc = prev === null ? Math.abs(c - 7) * 0.3 : Math.abs(c - prev) * 0.5, ok = true;
      for (const n of heard) {
        const L = semi(n.deg) + 12, ic = pc(L - c), main = n.step <= s0 || n.len >= 2;
        if (ic === 1 || ic === 11 || ic === 6 || (main && (ic === 2 || ic === 10 || c > L - 3))) { ok = false; break; }
        if (main) sc += (ic === 3 || ic === 4 || ic === 8 || ic === 9) ? 0 : ic === 0 ? 2.5 : 1.5;
      }
      if (ok && sc < bs) { bs = sc; best = c; }
    }
    if (best === null) { prev = null; continue; }
    const last = out[out.length - 1];
    if (last && last.semi === best && last.step + last.len === s0 && last.len < 6) last.len += 3;
    else out.push({ step: s0, semi: best, len: 3 });
    prev = best;
  }
  return out;
}

function buildForm(def) {
  const scale = SCALES[def.mode] || SCALES.major, H = HARMONY[def.mode] || HARMONY.major;
  const memo = {}, chord = (x) => (typeof x === 'number' ? (memo[x] || (memo[x] = { t: [x, x + 2, x + 4], alt: 2 })) : x);
  const bars = [], lead = [], sections = [], hold = [];
  let bar = 0;
  for (let si = 0; si < def.form.length; si++) {
    const name = def.form[si], th = name === 'A' ? THEME_A : THEME_B;
    let s = bar * 6;
    for (const n of th) {
      if (n[0]) { lead.push({ step: s, deg: n[0], len: n[1] }); if (n[1] === 6 && s % 6 === 0) hold[s / 6] = n[0]; }
      s += n[1];
    }
    for (const c of H[name]) { const a = chord(Array.isArray(c) ? c[0] : c), b = Array.isArray(c) ? chord(c[1]) : a; bars.push([a, b]); }
    sections.push({ name, index: si, bar });
    bar += 8;
  }
  const leadAt = [], counterAt = [];
  for (const n of lead) (leadAt[n.step] || (leadAt[n.step] = [])).push(n);
  for (const n of buildCounter(lead, bars, scale)) counterAt[n.step] = n;
  return { bars, lead, leadAt, counterAt, sections, hold, steps: bar * 6 };
}

// Harmonic recipes for the oscillators' own timbres (sine partials, fundamental first).
const WAVES = {
  string: Array.from({ length: 14 }, (_, i) => Math.sin((i + 1) * Math.PI * 0.23) / Math.pow(i + 1, 1.7)),   // a string plucked a quarter of the way along
  warm: [1, 0.42, 0.24, 0.13, 0.075, 0.04, 0.022, 0.012],
  flute: [1, 0.26, 0.085, 0.03, 0.012],
  bass: [1, 0.42, 0.16, 0.06, 0.02],
  ping: [0, 1, 0.42, 0.5, 0, 0.16, 0, 0.07],                                                                 // the bright octaves of a music-box tine
  glass: [1, 0.16, 0.045]
};
WAVES.stringQ = WAVES.string;            // the same string a quarter-turn out of phase (names ending in Q use cosines)

export class AudioEngine {
  constructor(o) {
    o = o || {};
    this.ctx = o.ctx || null;
    this.enabled = o.enabled === undefined ? true : o.enabled;
    this.ready = false;
    this.song = null; this.songName = null;
    this.intensity = 1;
    this._amb = {}; this._ambName = 'none'; this._ambGen = [];
    this._player = 0;
    this._loops = new Set();
    this._waves = {};
    this._load = 0; this._duck = 1; this._duckAt = -1;
    this.sfx = this._makeSfx();
    if (this.ctx) this._build();
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // Call from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      // iOS: a WebAudio-only page is "ambient" and the ring/silent switch mutes it; a bedtime lullaby is playback (Safari 17+)
      try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
      try { this.ctx = new AC(); } catch (e) { return false; }
      this._build();
      if (!this.enabled) this.suspend();                        // sound is off: the renderer does not run at all
    }
    this._wake();
    return true;
  }
  // Switching the sound off also parks the context a moment later (a muted game must not keep
  // synthesising into silence for half an hour); switching it on wakes it and fades the master in.
  setEnabled(on) {
    this.enabled = !!on;
    this._sleepToken = (this._sleepToken || 0) + 1;
    if (!this.ready) return;
    const t = this.now;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? MASTER : 0, t, 0.08);
    if (on) this._wake();
    else { const k = this._sleepToken; setTimeout(() => { if (k === this._sleepToken && !this.enabled) this.suspend(); }, 350); }
  }
  // Voices and effects build nodes only while this is true: a parked context would otherwise
  // collect every note of a muted half hour and play them all at once when the sound returns.
  get live() { return this.ready && this.enabled; }
  // resume() is refused or deferred in some states (iOS's 'interrupted' after a call or an alarm,
  // a context parked by a mute): ask whenever the context is not running, and never let the
  // promise surface as an error.
  // `state` is not to be trusted right after suspend(): WebKit and Gecko change it only when the suspend settles,
  // so a resume asked for in between would be skipped. Keep what is wanted, and look again once a suspend settles.
  _wake() {
    const c = this.ctx;
    if (!c || !this.enabled || !c.resume || c.state === 'closed') return;
    this._want = true;
    if (c.state === 'running' && !this._parking) return;
    try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  suspend() {
    const c = this.ctx;
    this._want = false;
    if (!c || !c.suspend || c.state === 'closed' || (c.state === 'suspended' && !this._parking)) return;
    this._parking = (this._parking || 0) + 1;
    const settle = () => { this._parking--; if (this._want) this._wake(); };
    try { const p = c.suspend(); if (p && p.then) p.then(settle, settle); else settle(); } catch (e) { settle(); }
  }
  resume() { this._wake(); }

  _build() {
    const c = this.ctx, sr = c.sampleRate;
    // master → gentle compressor → soft clipper (so nothing ever hard-clips) → out
    this.master = c.createGain(); this.master.gain.value = this.enabled ? MASTER : 0;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.knee.value = 8; this.comp.ratio.value = 12; this.comp.attack.value = 0.003; this.comp.release.value = 0.18;   // untouched below −10 dB, firm near −3
    const pre = c.createGain(); pre.gain.value = 0.5;
    this.clip = c.createWaveShaper();
    const n = 2049, cur = new Float32Array(n), a = 0.7, top = 0.98;
    for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * 2, ax = Math.abs(x), y = ax <= a ? ax : a + (top - a) * Math.tanh((ax - a) / (top - a)); cur[i] = x < 0 ? -y : y; }
    this.clip.curve = cur;
    this.master.connect(this.comp); this.comp.connect(pre); pre.connect(this.clip); this.clip.connect(c.destination);
    // buses
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.62;
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 1.15;
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.8;
    const shelf = (f, db) => { const s = c.createBiquadFilter(); s.channelCount = 2; s.channelCountMode = 'explicit'; s.type = 'highshelf'; s.frequency.value = f; s.gain.value = db; return s; };
    const sTone = shelf(6200, -5), aTone = shelf(5200, -7);      // hiss is tiring at bedtime: effects and weather lose their top
    this.sfxBus.connect(sTone); sTone.connect(this.master);
    this.ambBus.connect(aTone); aTone.connect(this.master);
    this.musicBus.connect(this.master);
    // one shared room
    this.rev = c.createConvolver(); this.rev.buffer = this._impulse(3.2);
    const revOut = c.createGain(); revOut.gain.value = 0.85;
    this.rev.connect(revOut); revOut.connect(this.master);
    const send = (from, g) => { const s = c.createGain(); s.gain.value = g; from.connect(s); s.connect(this.rev); };
    send(this.musicBus, 0.42); send(sTone, 0.3); send(aTone, 0.14);
    // shared noise: white (effects), pink (weather), and the tiny tick of a plucked tine
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) / 8388608) - 1; };
    const len = Math.floor(sr * 2), wb = c.createBuffer(1, len, sr), pb = c.createBuffer(1, len, sr), w = wb.getChannelData(0), p = pb.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const x = rnd(); w[i] = x;
      b0 = 0.99765 * b0 + x * 0.099046; b1 = 0.963 * b1 + x * 0.2965164; b2 = 0.57 * b2 + x * 1.0526913;
      p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.22;
    }
    const xf = Math.floor(sr * 0.05);                           // the pink loop has slow waves in it: cross-fade its seam
    for (let i = 0; i < xf; i++) { const k = i / xf; p[len - xf + i] = p[len - xf + i] * (1 - k) + p[i] * k; }
    this.noiseBuf = wb; this.pinkBuf = pb;
    const tn = Math.floor(sr * 0.014), tb = c.createBuffer(1, tn, sr), td = tb.getChannelData(0);
    let l1 = 0, l2 = 0;
    for (let i = 0; i < tn; i++) { const x = rnd(); l1 += (x - l1) * 0.34; l2 += (x - l2) * 0.08; td[i] = (l1 - l2) * Math.exp(-i / (sr * 0.003)) * Math.min(1, i / 8); }
    this.tickBuf = tb;
    // a silent path: lets a source's "ended" event serve as a clock that also ticks offline
    this._mute = c.createGain(); this._mute.gain.value = 0; this._mute.connect(c.destination);
    this._hush = c.createBuffer(1, 2, sr);
    this.ready = true;
    if (this._pendingSong) { const q = this._pendingSong; this._pendingSong = null; this.play(q.name, q.o); }
    if (this._pendingAmb) { const q = this._pendingAmb; this._pendingAmb = null; this.ambience(q); }
  }
  // A small room: a few early echoes (different in each ear), then a smooth tail that grows
  // darker as it fades and carries no rumble.
  _impulse(sec) {
    const c = this.ctx, sr = c.sampleRate, len = Math.floor(sr * sec), buf = c.createBuffer(2, len, sr), rt = sec * 0.81;
    let seed = 777;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) / 8388608) - 1; };
    const pre = Math.floor(sr * 0.012), bloom = Math.floor(sr * 0.07);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0, slow = 0;
      const k = Math.pow(10, -3 / (sr * rt));                 // the decay as a running product: no pow per sample
      let dec = Math.pow(k, pre);
      for (let i = pre; i < len; i++) {
        const u = i / len, u2 = u * u, u4 = u2 * u2, env = dec * Math.min(1, (i - pre) / bloom) * (1 - u4 * u4);
        dec *= k;
        lp += (rnd() - lp) * (0.5 - 0.41 * Math.sqrt(u));
        slow += (lp - slow) * 0.014;
        d[i] = (lp - slow) * env;
      }
      const taps = ch ? [[13, 0.46], [23, -0.36], [34, 0.3], [43, -0.25], [58, 0.2], [71, -0.16], [89, 0.12]] : [[11, 0.5], [19, 0.38], [29, -0.32], [39, 0.27], [51, -0.22], [66, 0.17], [83, -0.13]];
      for (const tp of taps) { const i = Math.floor((sr * tp[0]) / 1000); d[i - 1] += tp[1] * 0.25; d[i] += tp[1] * 0.5; d[i + 1] += tp[1] * 0.25; }
    }
    return buf;
  }
  _wave(name) {
    let w = this._waves[name];
    if (!w) {
      const H = WAVES[name], re = new Float32Array(H.length + 1), im = new Float32Array(H.length + 1), q = /Q$/.test(name);
      for (let i = 0; i < H.length; i++) (q ? re : im)[i + 1] = H[i];
      w = this._waves[name] = this.ctx.createPeriodicWave(re, im);
    }
    return w;
  }
  // Run fn when the context clock reaches t (works the same in real time and offline).
  _after(t, fn) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._hush; s.connect(this._mute); s.onended = fn;
    s.start(Math.max(this.now, t));
  }

  // ── voices ──
  _env(g, t, peak, attack, decay, sustain, hold, release) {
    const p = Math.max(0.0001, peak);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(p, t + attack);              // a straight rise: no click, however short
    if (sustain === undefined) { g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); return t + attack + decay; }
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, p * sustain), t + attack + decay);
    g.gain.setValueAtTime(Math.max(0.0001, p * sustain), t + attack + decay + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay + hold + release);
    return t + attack + decay + hold + release;
  }
  // type: 'sine' | 'triangle' | … or the name of one of the WAVES
  _osc(type, f, t, end, dest, detune) {
    const o = this.ctx.createOscillator();
    if (WAVES[type]) o.setPeriodicWave(this._wave(type)); else o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(dest); o.start(t); o.stop(end + 0.05);
    return o;
  }
  _out(bus, pan) {
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(bus); return p; }
    return bus;
  }
  // Notes the player sets off share the effects bus: they are a touch softer than written, and
  // a flurry of gestures (a child drumming on the screen) ducks itself instead of piling up.
  // (Notes of one gesture — a bell's four, a fanfare's six — keep their own balance.)
  _vel(bus, vel) {
    if (bus !== this.sfxBus) return vel;
    const n = this.now;
    if (n !== this._duckAt) {
      this._load *= Math.exp(-Math.max(0, n - this._duckAt) / 0.45);
      this._duckAt = n; this._duck = 1 / (1 + 0.5 * this._load);
    }
    this._load += vel;
    return vel * SFX_NOTE * this._duck;
  }
  // music box / celesta: a tine's long-ringing fundamental, a bright ping of octaves that dies
  // quickly, one inharmonic partial and the tiny tick of the pluck
  box(m, o) {
    if (!this.live) return;
    o = o || {};
    const c = this.ctx, bus = o.bus || this.musicBus, t = Math.max(this.now, o.when || 0);
    const vel = this._vel(bus, o.vel === undefined ? 0.5 : o.vel), f = mtof(m) * (1 + (Math.random() - 0.5) * 0.0024);
    const out = this._out(bus, o.pan), A = vel * 0.2, k = Math.pow(523 / Math.max(f, 130), 0.35) * (o.long || 1);
    const g1 = c.createGain(); g1.connect(out);
    g1.gain.setValueAtTime(0.0001, t); g1.gain.linearRampToValueAtTime(A, t + 0.004);
    g1.gain.exponentialRampToValueAtTime(A * 0.5, t + 0.1 * k); g1.gain.exponentialRampToValueAtTime(0.0001, t + 1.8 * k);
    this._osc('sine', f, t, t + 1.8 * k, g1);
    if (f * 4 < 11000) {
      const g2 = c.createGain(); g2.connect(out);
      this._env(g2, t, A * (0.2 + 0.32 * vel), 0.003, 0.46 * k);
      this._osc('ping', f, t, t + 0.46 * k, g2);
    }
    if (f * 5.42 < 9000) {
      const g3 = c.createGain(); g3.connect(out);
      this._env(g3, t, A * 0.07, 0.002, 0.15 * k);
      this._osc('sine', f * 5.42, t, t + 0.15 * k, g3);
    }
    const tk = c.createBufferSource(), tg = c.createGain();
    tk.buffer = this.tickBuf; tg.gain.value = A * 0.4; tk.connect(tg); tg.connect(out); tk.start(t);
  }
  // soft plucked string (harp, nylon): two strings a few cents apart, brightness falling as they ring
  pluck(m, o) {
    if (!this.live) return;
    o = o || {};
    const c = this.ctx, bus = o.bus || this.musicBus, t = Math.max(this.now, o.when || 0);
    const vel = this._vel(bus, o.vel === undefined ? 0.5 : o.vel), f = mtof(m), out = this._out(bus, o.pan);
    const len = (o.len || 0.85) * Math.min(1.5, Math.max(0.7, Math.pow(330 / f, 0.3)));
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.7;
    fl.frequency.setValueAtTime(Math.min(8500, f * (4 + 6 * vel)), t); fl.frequency.exponentialRampToValueAtTime(Math.max(320, f * 1.7), t + 0.32);
    const g = c.createGain(); fl.connect(g); g.connect(out);
    const A = vel * 0.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(A, t + 0.007);
    g.gain.exponentialRampToValueAtTime(A * 0.42, t + 0.14); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    this._osc('stringQ', f, t, t + len, fl, -4 - Math.random() * 2); this._osc('string', f, t, t + len, fl, 4 + Math.random() * 2);   // a quarter-turn apart at first: the note blooms instead of snapping
  }
  // glassy sustained tone (moonlight): two pure tones a breath apart, one in each ear, slowly beating
  glass(m, o) {
    if (!this.live) return;
    o = o || {};
    const c = this.ctx, bus = o.bus || this.musicBus, t = Math.max(this.now, o.when || 0);
    const vel = this._vel(bus, o.vel === undefined ? 0.5 : o.vel), f = mtof(m), dur = o.dur || 0.5, pan = o.pan || 0;
    const g = c.createGain(); g.connect(bus);
    const end = this._env(g, t, vel * 0.1, 0.09, 0.2, 0.7, dur, 1.1);
    const wave = f * 3 < 9000 ? 'glass' : 'sine';
    const g2 = c.createGain(); g2.gain.value = 0.45;          // the second tone is the softer one: on a single speaker the pair shimmers but never cancels
    g2.connect(this._out(g, Math.min(1, pan + 0.45))); this._osc(wave, f * 1.0016, t, end, g2);
    this._osc(wave, f, t, end, this._out(g, Math.max(-1, pan - 0.2)));
  }
  // breathy little flute / ocarina
  flute(m, o) {
    if (!this.live) return;
    o = o || {};
    const c = this.ctx, bus = o.bus || this.musicBus, t = Math.max(this.now, o.when || 0);
    const vel = this._vel(bus, o.vel === undefined ? 0.5 : o.vel), f = mtof(m), dur = o.dur || 0.4, out = this._out(bus, o.pan);
    const g = c.createGain(); g.connect(out);
    const end = this._env(g, t, vel * 0.14, 0.055, 0.1, 0.8, dur, 0.24);
    const o1 = this._osc(f * 4 < 9000 ? 'flute' : 'sine', f, t, end, g);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 4.9 + Math.random() * 0.6; lg.gain.value = 0; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.32);
    lfo.connect(lg); lg.connect(o1.frequency); lfo.start(t); lfo.stop(end + 0.05);
    this.noise({ when: t, dur: dur + 0.15, type: 'bandpass', freq: Math.min(4200, f * 2), q: 1.6, vel: vel * 0.04, attack: 0.05, bus: out });
    this.noise({ when: t, dur: 0.06, type: 'bandpass', freq: Math.min(4200, f * 3), q: 1.4, vel: vel * 0.04, attack: 0.012, bus: out });   // the chiff of the breath
  }
  // warm chord bed: two slightly detuned layers, one towards each ear, opening and closing slowly
  pad(midis, o) {
    if (!this.live) return;
    o = o || {};
    const c = this.ctx, t = Math.max(this.now, o.when || 0), vel = o.vel === undefined ? 0.5 : o.vel, dur = o.dur || 2, bus = o.bus || this.musicBus;
    const cut = o.cut || 1150, att = o.attack || 0.9, rel = o.release || 1.7;
    for (const side of [-1, 1]) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.5;
      fl.frequency.setValueAtTime(cut * 0.72, t); fl.frequency.linearRampToValueAtTime(cut * 1.2, t + Math.max(att, dur * 0.55)); fl.frequency.linearRampToValueAtTime(cut * 0.75, t + dur + rel);
      const g = c.createGain(); fl.connect(g); g.connect(this._out(bus, side * 0.5));
      const end = this._env(g, t, vel * 0.021, att, 0.4, 0.85, Math.max(0.05, dur - 0.9), rel);
      midis.forEach((m, i) => { this._osc('warm', mtof(m), t, end, fl, side * (4 + i * 1.5)); });
    }
  }
  bass(m, o) {
    if (!this.live) return;
    o = o || {};
    const t = Math.max(this.now, o.when || 0), vel = o.vel === undefined ? 0.5 : o.vel, f = mtof(m), dur = o.dur || 0.8, out = o.bus || this.musicBus;
    const g = this.ctx.createGain(); g.connect(out);
    const end = this._env(g, t, vel * 0.125, 0.035, 0.25, 0.6, dur, 0.45);
    this._osc('bass', f, t, end, g);
  }
  // filtered noise burst. o: {when, dur, type, freq, freqTo, q, vel, attack, bus, pan, pink}
  noise(o) {
    if (!this.live) return;
    const t = Math.max(this.now, o.when || 0), dur = o.dur || 0.2, out = this._out(o.bus || this.sfxBus, o.pan);
    const src = this.ctx.createBufferSource(); src.buffer = o.pink ? this.pinkBuf : this.noiseBuf; src.loop = true;
    const fl = this.ctx.createBiquadFilter(); fl.type = o.type || 'bandpass'; fl.Q.value = o.q === undefined ? 1 : o.q;
    fl.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freqTo) fl.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
    const g = this.ctx.createGain(); src.connect(fl); fl.connect(g); g.connect(out);
    this._env(g, t, o.vel === undefined ? 0.1 : o.vel, o.attack || 0.005, Math.max(0.01, dur - (o.attack || 0.005)));
    src.start(t, (t * 0.37) % 1.5); src.stop(t + dur + 0.1);
  }
  // sine blip with pitch glide. o: {f0, f1, f2, glide, dur, vel, type, when, pan, attack, bus}
  blip(o) {
    if (!this.live) return;
    const t = Math.max(this.now, o.when || 0), dur = o.dur || 0.1, out = this._out(o.bus || this.sfxBus, o.pan);
    const g = this.ctx.createGain(); g.connect(out);
    const end = this._env(g, t, o.vel === undefined ? 0.1 : o.vel, o.attack || 0.006, dur);
    const osc = this._osc(o.type || 'sine', o.f0, t, end, g);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + dur * (o.glide || 1));
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    return osc;
  }
  // A small voice (meow, chirrup): a buzzy source through two moving formants.
  // p: {dur, f, F1, F2: [[0..1, hz], …], vel, q1, q2, g2, attack, vib, trem, breath, when, pan}
  _vox(p) {
    if (!this.live) return;
    const c = this.ctx, t = Math.max(this.now, p.when || 0), d = p.dur, out = this._out(p.bus || this.sfxBus, p.pan);
    const ride = (param, pts) => { param.setValueAtTime(pts[0][1], t); for (let i = 1; i < pts.length; i++) param.exponentialRampToValueAtTime(pts[i][1], t + pts[i][0] * d); };
    const o = c.createOscillator(); o.type = 'sawtooth'; ride(o.frequency, p.f);
    const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g2 = c.createGain(), g = c.createGain();
    f1.type = f2.type = 'bandpass'; f1.Q.value = p.q1 || 4; f2.Q.value = p.q2 || 6; ride(f1.frequency, p.F1); ride(f2.frequency, p.F2);
    g2.gain.value = p.g2 === undefined ? 0.5 : p.g2;
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g);
    const end = this._env(g, t, p.vel, p.attack || 0.04, d * 0.25, 0.8, d * 0.4, d * 0.35);
    let tail = g;
    if (p.trem) {            // a rolled "rr"
      const am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      am.gain.value = 0.62; lfo.frequency.value = p.trem; lg.gain.value = 0.38; lfo.connect(lg); lg.connect(am.gain); lfo.start(t); lfo.stop(end + 0.05);
      g.connect(am); tail = am;
    }
    tail.connect(out);
    if (p.vib) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 6; lg.gain.value = 0; lg.gain.setValueAtTime(0, t + d * 0.3); lg.gain.linearRampToValueAtTime(p.f[0][1] * p.vib, t + d * 0.7);
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end + 0.05);
    }
    if (p.breath) this.noise({ when: t, dur: d * 0.7, type: 'bandpass', freq: p.F2[0][1], freqTo: p.F2[p.F2.length - 1][1], q: 1.4, vel: p.vel * p.breath, attack: 0.03, bus: out });
    o.start(t); o.stop(end + 0.05);
  }

  // A purr: breath fluttering 25 times a second, over a low rumble. Returns {g, lfo, stop(when)}.
  _purr(t) {
    const c = this.ctx, g = c.createGain(), lfo = c.createOscillator(), src = c.createBufferSource();
    const fl = c.createBiquadFilter(), lp = c.createBiquadFilter(), am = c.createGain(), dep = c.createGain(), edge = c.createBiquadFilter(), body = c.createBiquadFilter(), bg = c.createGain();
    lfo.type = 'sawtooth'; lfo.frequency.value = 25; src.buffer = this.noiseBuf; src.loop = true;
    fl.type = 'bandpass'; fl.frequency.value = 430; fl.Q.value = 0.9; lp.type = 'lowpass'; lp.frequency.value = 950; lp.Q.value = 0.6; am.gain.value = 0.5; dep.gain.value = -0.5;     // each push of breath starts suddenly and dies away
    body.type = 'bandpass'; body.frequency.value = 120; body.Q.value = 0.7; bg.gain.value = 0.1;
    edge.type = 'lowpass'; edge.frequency.value = 140;
    src.connect(fl); fl.connect(lp); lp.connect(am); lfo.connect(dep); dep.connect(edge); edge.connect(am.gain); am.connect(g); lfo.connect(body); body.connect(bg); bg.connect(g);
    src.start(t, Math.random()); lfo.start(t);
    return { g, lfo, stop: (when) => { src.onended = () => { try { g.disconnect(); } catch (e) {} }; try { src.stop(when); lfo.stop(when); } catch (e) {} } };
  }

  // ── music ──
  // Start (or cross-fade to) a song. o: {intensity}
  play(name, o) {
    o = o || {};
    if (o.intensity !== undefined) this.intensity = o.intensity;
    if (!this.ready) { this._pendingSong = { name, o }; this.songName = name; return; }
    if (this.songName === name && this.song) return;
    const def = SONGS[name]; if (!def) return;
    const c = this.ctx, t = this.now;
    this.stopMusic(1.6);
    const bus = c.createGain(); bus.gain.setValueAtTime(0.0001, t); bus.gain.exponentialRampToValueAtTime(def.trim || 1, t + 1.4); bus.connect(this.musicBus);
    if (def.rev) { const s = c.createGain(); s.gain.value = def.rev; bus.connect(s); s.connect(this.rev); }     // some places are roomier than others
    const scale = SCALES[def.mode] || SCALES.major, up = (p, lo) => lo + pc(p - lo);
    const lo = def.padLo || 55, d1 = up(pc(def.key), lo), d5 = up(pc(def.key + 7), lo);
    this.song = { def, bus, form: buildForm(def), step: 0, next: t + 0.12, scale, cycle: 0, voi: new Map(), drone: [Math.min(d1, d5), Math.max(d1, d5), Math.min(d1, d5) + 12] };
    this.songName = name; this._player = 0;
  }
  stopMusic(fade) {
    if (!this.song) return;
    const s = this.song, t = this.now, f = fade === undefined ? 1.5 : fade;
    s.bus.gain.cancelScheduledValues(t); s.bus.gain.setValueAtTime(Math.max(0.0001, s.bus.gain.value), t);
    s.bus.gain.exponentialRampToValueAtTime(0.0001, t + f);
    const b = s.bus; this._after(t + f + 3.5, () => { try { b.disconnect(); } catch (e) {} });
    this.song = null; this.songName = null;
  }
  setIntensity(v) { this.intensity = v; }
  // the music steps back while a voice is reading the story aloud
  duck(on) {
    if (!this.ready) return;
    const t = this.now;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(on ? 0.24 : 0.62, t, on ? 0.12 : 0.6);
  }
  // Call regularly (every ~50 ms); schedules notes a little ahead.
  pump(horizon) {
    if (!this.live) return;
    const until = this.now + (horizon || 0.3);
    const s = this.song;
    if (s) {
      if (s.next < this.now - 0.5) s.next = this.now + 0.05;      // tab was asleep: don't burst-fire
      while (s.next < until) {
        this._step(s, s.next);
        const left = s.form.steps - 1 - s.step;                   // the last notes of the form slow a little, like a breath
        s.next += s.def.step * (left < 3 ? 1.2 - left * 0.065 : 1);
        s.step++;
        if (s.step >= s.form.steps) { s.step = 0; s.cycle++; }
      }
    }
    this._ambPump(until);
  }
  // Where each chord's notes lie: every voice keeps to its own register, so chords glide into
  // one another instead of jumping.
  _voicing(s, ch) {
    let v = s.voi.get(ch);
    if (!v) {
      const def = s.def, mid = ch.t.map((d) => degToMidi(def.key, s.scale, d)), pcs = mid.map(pc), up = (p, lo) => lo + pc(p - lo);
      const bass = up(pcs[0], def.bassLo || 43), pad = pcs.map((p) => up(p, def.padLo || 55)).sort((a, b) => a - b), arp = [];
      pad.push(pad[0] + 12);
      for (let m = def.arpLo || def.key - 3; arp.length < 5; m++) if (pcs.indexOf(pc(m)) >= 0) arp.push(m);
      v = { pcs, bass, alt: up(pcs[ch.alt], bass), pad, arp };
      s.voi.set(ch, v);
    }
    return v;
  }
  _bar(s) { const F = s.form, st = Math.min(F.steps - 1, s.step); return F.bars[Math.floor(st / 6)][st % 6 < 3 ? 0 : 1]; }
  // five rising tones of the chord sounding now, root first (for the notes the player sets off)
  _chord(s) {
    const t = this._bar(s).t, k = s.def.key, sc = s.scale;
    return [degToMidi(k, sc, t[0]), degToMidi(k, sc, t[1]), degToMidi(k, sc, t[2]), degToMidi(k, sc, t[0] + 7), degToMidi(k, sc, t[1] + 7)].sort((a, b) => a - b);
  }
  // nudge a note off a harsh rub (a semitone above a chord tone, or a tritone) with the chord sounding now
  _fit(m) {
    const s = this.song;
    if (!s) return m;
    const pcs = this._voicing(s, this._bar(s)).pcs, sc = s.scale.map((x) => pc(s.def.key + x));
    const bad = (x) => pcs.some((p) => { const d = pc(x - p); return d === 1 || d === 6; });
    if (!bad(m)) return m;
    for (const d of [-1, 1, -2, 2, -3, 3]) if (sc.indexOf(pc(m + d)) >= 0 && !bad(m + d)) return m + d;
    return m;
  }
  _step(s, t) {
    const def = s.def, F = s.form, I = this.intensity, step = def.step, bus = s.bus;
    const pos = s.step % 6, bar = Math.floor(s.step / 6), half = pos < 3 ? 0 : 1, B = F.bars[bar], split = B[0] !== B[1];
    const ch = this._voicing(s, B[half]), sec = F.sections[bar >> 3], lastBar = bar === F.bars.length - 1, drone = I < 0.15;
    const hum = () => 0.92 + Math.random() * 0.16, late = () => Math.random() * 0.009;
    const tag = (o, role) => { o.bus = bus; o.role = role; o.bar = bar; o.pos = pos; return o; };
    // pad (below 0.15 the harmony rests on an open fifth, so that anything the player plays over it is in tune)
    if (def.pad && (pos === 0 || (pos === 3 && split && !drone))) {
      this.pad(drone ? s.drone : ch.pad, tag({ when: t, dur: step * (split && !drone ? 3 : 6), vel: def.pad * (0.78 + 0.22 * I) }, 'pad'));
    }
    // bass
    if (def.bass && I > 0.15) {
      if (split && pos === 3) this.bass(ch.bass, tag({ when: t, dur: step * 2.6, vel: def.bass * 0.42 }, 'bass'));
      else for (const b of BASS[def.bassPat] || BASS.sway) {
        if (b[0] !== pos || (b[0] > 0 && (I <= 0.5 || split))) continue;
        this.bass(b[1] === 0 ? ch.bass : b[1] === 1 ? ch.alt : ch.bass + 12, tag({ when: t, dur: step * (split ? Math.min(b[2], 2.6) : b[2]), vel: def.bass * 0.5 * b[3] }, 'bass'));
      }
    }
    // arpeggio (a second shape in the B section and now and then elsewhere; the last bar settles)
    const aI = smooth(0.25, 0.5, I);
    if (def.arp && aI > 0.01) {
      const alt = def.arpAlt && (sec.name === 'B' ? (bar & 4) === 0 : (s.cycle + (bar >> 2)) % 4 === 3);
      const idx = (lastBar ? ARPS.settle : ARPS[alt ? def.arpAlt : def.arp])[pos];
      if (idx >= 0) {
        const v = def.arpGain * [0.68, 0.4, 0.42, 0.55, 0.4, 0.38][pos] * (0.6 + 0.4 * I) * aI * hum();
        const o = tag({ when: t + late(), vel: v, pan: pos % 2 ? 0.25 : -0.25 }, 'arp');
        if (def.arpInst === 'glass') { o.dur = step * 1.5; this.glass(ch.arp[idx] + 12, o); } else this.pluck(ch.arp[idx], o);
      }
    }
    // the tune
    const lI = smooth(0.55, 0.75, I), sings = def.lead && (def.leadEvery === 1 || s.cycle % (def.leadEvery || 1) === 0);
    if (sings && lI > 0.01 && F.leadAt[s.step]) {
      for (const n of F.leadAt[s.step]) {
        const m = degToMidi(def.key + 12, s.scale, n.deg);
        const o = tag({ when: t + late(), vel: def.leadGain * 0.8 * lI * (pos === 0 ? 1.04 : pos === 3 ? 0.98 : 0.9) * hum(), dur: n.len * step * 0.9, long: 0.9 + n.len * 0.07 }, 'lead');
        if (def.lead === 'box') this.box(m, o); else if (def.lead === 'flute') this.flute(m, o); else this.glass(m, o);
      }
    }
    // a second voice under the tune comes and goes: in every other section, and when the tune itself is resting
    const cn = def.counter && I > 0.7 && F.counterAt[s.step];
    if (cn && (def.lead ? (sings ? sec.index % 2 === 1 : true) : sec.index % 2 === 1)) {
      const o = tag({ when: t + late(), vel: def.counterGain * (sings ? 0.62 : 0.95) * hum(), dur: cn.len * step * 0.86 }, 'counter');
      if (def.counter === 'flute') this.flute(def.key + cn.semi, o); else this.glass(def.key + cn.semi, o);
    }
    // while the tune holds a long note, a little answer rises above it
    if (def.fill && I > 0.6 && sings && pos >= 3 && F.hold[bar] && !lastBar && (bar % 8 === 3 || (sec.index + s.cycle) % 2 === 0)) {
      const held = degToMidi(def.key + 12, s.scale, F.hold[bar]), tones = [];
      for (let m = held + 2; tones.length < 3 && m < held + 20; m++) if (ch.pcs.indexOf(pc(m)) >= 0) tones.push(m);
      const m = bar % 8 === 3 ? tones[pos - 3] : tones[[1, 2, 1][pos - 3]];
      if (m) this.box(m, tag({ when: t + late(), vel: def.fill * 0.55 * hum(), pan: 0.3 }, 'fill'));
    }
    // when everything is hushed, a far-off chime now and then keeps the quiet from being empty
    if (I >= 0.15 && I < 0.34 && pos === 0 && bar % 2 === 1) this.glass(ch.arp[3] + 12, tag({ when: t + late(), vel: 0.4 * hum(), dur: step * 3, pan: bar % 4 === 1 ? -0.3 : 0.3 }, 'arp'));
  }
  // The next note of the lullaby, played by the player's own actions (hops, taps, deliveries).
  playerNote(o) {
    o = o || {};
    const s = this.song, def = s ? s.def : SONGS.title, sc = s ? s.scale : SCALES.major;
    const seq = THEME_A.concat(THEME_B).filter((n) => n[0]);
    const n = seq[this._player % seq.length]; this._player++;
    const m = this._fit(degToMidi(def.key + 12 + (o.octave || 0) * 12, sc, n[0]));
    const inst = o.inst || 'box';
    this[inst](m, { vel: o.vel === undefined ? 0.7 : o.vel, bus: this.sfxBus, pan: o.pan, dur: 0.3 });
    return m;
  }
  // A note that fits the current harmony: i-th chord tone (0..4), octave shift.
  chordNote(i, o) {
    o = o || {};
    const s = this.song;
    let m;
    if (s) { const ch = this._chord(s); m = ch[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5); }
    else m = 62 + [0, 4, 7, 12, 16][((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
    this[o.inst || 'box'](m + (o.octave === undefined ? 12 : o.octave * 12), { vel: o.vel === undefined ? 0.6 : o.vel, bus: this.sfxBus, pan: o.pan, when: o.when, dur: o.dur || 0.3 });
    return m;
  }
  // i-th step of the song's scale (for rising runs: growing trees, filling saucers).
  scaleNote(i, o) {
    o = o || {};
    const s = this.song, key = s ? s.def.key : 62, sc = s ? s.scale : SCALES.major;
    const pent = [1, 2, 3, 5, 6];
    const deg = pent[((i % 5) + 5) % 5] + 7 * Math.floor(i / 5);
    const m = this._fit(degToMidi(key + (o.octave === undefined ? 12 : o.octave * 12), sc, deg));
    this[o.inst || 'pluck'](m, { vel: o.vel === undefined ? 0.6 : o.vel, bus: this.sfxBus, pan: o.pan, when: o.when, dur: o.dur || 0.3 });
    return m;
  }

  // ── ambience ──
  // A place is a bed of filtered noise or two, plus small events (crickets, an owl, birds, lapping water).
  ambience(name) {
    if (!this.ready) { this._pendingAmb = name; return; }
    if (name === this._ambName) return;
    this._ambName = name;
    const c = this.ctx, t = this.now;
    const defs = {   // [noise, filter, frequency, Q, slow swell depth]
      wind: ['white', 'bandpass', 460, 0.7, 0.45], leaves: ['white', 'bandpass', 2900, 0.6, 0.5], sea: ['pink', 'bandpass', 520, 0.5, 0.7],
      air: ['white', 'bandpass', 720, 0.6, 0.45], rain: ['white', 'bandpass', 2400, 0.35, 0.2]
    };
    const want = ({
      night: { wind: 0.008 }, dusk: { wind: 0.008, leaves: 0.004 }, day: { leaves: 0.009, wind: 0.006 }, water: { sea: 0.05, wind: 0.004 },
      sky: { air: 0.034 }, rain: { rain: 0.016, air: 0.012 }, room: { wind: 0.004 }, dream: { air: 0.02 }
    })[name] || {};
    for (const k in defs) {
      const lvl = want[k] || 0;
      let L = this._amb[k];
      if (!L && lvl <= 0) continue;
      if (!L) {
        // two unrelated stretches of the same noise, one towards each ear: the weather is all around
        const d = defs[k], g = c.createGain(), sum = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), srcs = [];
        g.gain.value = 0.0001; lfo.frequency.value = 0.07 + Math.random() * 0.07; lg.gain.value = d[4] / 2; sum.gain.value = 1 - d[4] / 2;
        for (const side of [-1, 1]) {
          const src = c.createBufferSource(); src.buffer = d[0] === 'pink' ? this.pinkBuf : this.noiseBuf; src.loop = true;
          const fl = c.createBiquadFilter(); fl.type = d[1]; fl.frequency.value = d[2] * (1 + side * 0.04); fl.Q.value = d[3];
          src.connect(fl); fl.connect(this._out(sum, side * 0.7)); src.start(t, side < 0 ? 0.13 : 1.07); srcs.push(src);
        }
        lfo.connect(lg); lg.connect(sum.gain); sum.connect(g); g.connect(this.ambBus); lfo.start(t);
        L = this._amb[k] = { g, srcs, lfo, lvl: 0 };
      }
      L.lvl = lvl;
      L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(Math.max(0.0001, lvl), t, 0.8);
      if (lvl <= 0) this._after(t + 6, () => {              // a bed that has faded away stops running
        if (L.lvl > 0 || this._amb[k] !== L) return;
        try { L.srcs.forEach((x) => x.stop()); L.lfo.stop(); L.g.disconnect(); } catch (e) {}
        delete this._amb[k];
      });
    }
    const r = Math.random, gen = (kind, first, o) => Object.assign({ kind, next: t + 0.8 + r() * first }, o || {});
    this._ambGen = ({
      night: [gen('cricket', 1, { f: 3900, every: 0.72, n: 3, pan: -0.55, v: 1 }), gen('cricket', 3, { f: 4350, every: 0.93, n: 2, pan: 0.6, v: 0.7 }), gen('owl', 9)],
      dusk: [gen('cricket', 2, { f: 3700, every: 1.05, n: 3, pan: 0.4, v: 0.8 }), gen('bird', 4, { rare: 2.2 })],
      day: [gen('bird', 1.5, { rare: 1 }), gen('bird', 4, { rare: 1.7, low: true }), gen('cuckoo', 12)],
      water: [gen('lap', 1.5)],
      sky: [gen('gust', 3)],
      rain: [gen('drop', 0.2)],
      room: [gen('cricket', 3, { f: 3800, every: 1.3, n: 2, pan: 0.5, v: 0.3 })],
      dream: [gen('chime', 2), gen('gust', 6)]
    })[name] || [];
  }
  _ambPump(until) {
    const r = Math.random, bus = this.ambBus;
    for (const g of this._ambGen) {
      let guard = 0;
      while (g.next < until && guard++ < 8) {
        const t = Math.max(g.next, this.now);
        if (g.kind === 'cricket') {
          // each cricket keeps its own steady beat, falls silent for a while, starts again
          if (g.rest > 0) { g.rest--; g.next = t + g.every; continue; }
          this._cricket(t, g.f * (1 + (r() - 0.5) * 0.01), g.n, 0.017 * g.v, g.pan);
          if (r() < 0.07) g.rest = 3 + Math.floor(r() * 7);
          g.next = t + g.every * (0.97 + r() * 0.06);
        } else if (g.kind === 'owl') {
          this._owl(t, r() - 0.5, bus);
          g.next = t + 16 + r() * 22;
        } else if (g.kind === 'bird') {
          if (g.low && r() < 0.5) { const f = 2300 + r() * 500; this.blip({ f0: f, f1: f * 0.99, dur: 0.11, vel: 0.016, when: t, pan: r() * 1.4 - 0.7, bus, attack: 0.02 }); this.blip({ f0: f * 0.8, f1: f * 0.79, dur: 0.16, vel: 0.016, when: t + 0.17, pan: r() * 1.4 - 0.7, bus, attack: 0.02 }); }
          else this._chirp(t, 2300 + r() * 1500, 0.017, r() * 1.6 - 0.8, bus);
          g.next = t + (1.4 + r() * 3.6) * g.rare;
        } else if (g.kind === 'cuckoo') {
          this._cuckoo(t, r() * 1.2 - 0.6, bus, 1, 2 + Math.floor(r() * 2));
          g.next = t + 22 + r() * 26;
        } else if (g.kind === 'lap') {
          const pan = r() * 1.6 - 0.8;
          this.noise({ type: 'lowpass', freq: 1500, freqTo: 500, q: 0.5, dur: 0.5 + r() * 0.4, vel: 0.02, attack: 0.18, when: t, pan, bus, pink: true });
          if (r() < 0.6) this.blip({ f0: 420 + r() * 380, f1: 900 + r() * 500, dur: 0.05, vel: 0.012, when: t + 0.2 + r() * 0.2, pan, bus });
          g.next = t + 1.3 + r() * 2.8;
        } else if (g.kind === 'gust') {
          this.noise({ type: 'bandpass', freq: 300 + r() * 120, freqTo: 560 + r() * 240, q: 1.3, dur: 2.6 + r() * 1.6, vel: 0.05, attack: 1.2, when: t, pan: r() * 1.2 - 0.6, bus, pink: true });
          g.next = t + 5 + r() * 8;
        } else if (g.kind === 'chime') {
          // a far wind-chime: one or two notes of the song's own scale
          const s = this.song, k = (s ? s.def.key : 62) + 24, sc = s ? s.scale : SCALES.major, pan = r() * 1.4 - 0.7, i = Math.floor(r() * 5);
          this.glass(this._fit(degToMidi(k, sc, [1, 2, 3, 5, 6][i])), { when: t, vel: 0.1, dur: 0.3, pan, bus });
          if (r() < 0.45) this.glass(this._fit(degToMidi(k, sc, [3, 5, 5, 8, 8][i])), { when: t + 0.22 + r() * 0.2, vel: 0.08, dur: 0.3, pan: -pan, bus });
          g.next = t + 2.4 + r() * 4.5;
        } else if (g.kind === 'drop') {
          this.blip({ f0: 900 + r() * 1100, f1: 1500 + r() * 1200, dur: 0.035, vel: 0.008, when: t, pan: r() * 1.8 - 0.9, bus });
          g.next = t + 0.08 + r() * 0.3;
        } else g.next = t + 2;
      }
    }
  }
  // n short pulses of one high tone: a cricket's chirp
  _cricket(t, f, n, vel, pan) {
    const c = this.ctx, g = c.createGain(), end = t + n * 0.034 + 0.03;
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < n; i++) { const a = t + i * 0.034; g.gain.setValueAtTime(0.0001, a); g.gain.linearRampToValueAtTime(vel * (i ? 1 : 0.7), a + 0.007); g.gain.exponentialRampToValueAtTime(0.0001, a + 0.03); }
    g.connect(this._out(this.ambBus, pan));
    this._osc('sine', f, t, end, g);
  }
  // "hoo … hoo-hoo", far away, on a note of the song's key
  _owl(t, pan, bus, k) {
    const s = this.song, key = s ? s.def.key : 62, v = 0.026 * (k || 1);
    let base = 0;                                  // the key-note or its fifth, whichever lies nearest an owl's voice
    for (const m of [key - 12, key - 5, key, key + 7]) { const f = mtof(m); if (!base || Math.abs(Math.log(f / 340)) < Math.abs(Math.log(base / 340))) base = f; }
    [[0, 0.5], [0.85, 0.2], [1.15, 0.42]].forEach((h) => {
      this.blip({ f0: base * 1.02, f1: base * 0.985, dur: h[1], vel: v, when: t + h[0], pan, bus, attack: 0.07 });
      this.noise({ type: 'bandpass', freq: base * 2, q: 2, dur: h[1], vel: v * 0.15, when: t + h[0], attack: 0.07, pan, bus, pink: true });
    });
  }
  // "cu-ckoo": the third and the key-note of the song, so it is always in tune with the music
  _cuckoo(t, pan, bus, k, n) {
    const s = this.song, key = (s ? s.def.key : 62) + 12, sc = s ? s.scale : SCALES.major, v = 0.02 * (k || 1);
    for (let i = 0; i < (n || 2); i++) {
      this.blip({ f0: mtof(degToMidi(key, sc, 3)), dur: 0.2, vel: v, when: t + i * 0.95, pan, bus, attack: 0.03 });
      this.blip({ f0: mtof(degToMidi(key, sc, 1)), dur: 0.32, vel: v, when: t + i * 0.95 + 0.3, pan, bus, attack: 0.03 });
    }
  }
  _chirp(t, f, vel, pan, bus) {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.blip({ f0: f * (1 + Math.random() * 0.1), f1: f * (1.25 + Math.random() * 0.25), f2: f * 1.05, glide: 0.5, dur: 0.07 + Math.random() * 0.05, vel, when: t + i * 0.11, pan, bus });
  }

  // continuous sounds: returns {set(level 0..1, pitch 0..1), stop()}
  loop(kind) {
    if (!this.ready) return { set() {}, stop() {} };
    const c = this.ctx, t = this.now, g = c.createGain(); g.gain.value = 0.0001; g.connect(this.sfxBus);
    // [filter, frequency, Q, level]
    const cfg = { pour: ['bandpass', 1700, 2.2, 0.07], zip: ['bandpass', 1150, 3.2, 0.09], rain: ['bandpass', 2100, 0.4, 0.075], wind: ['bandpass', 600, 1.2, 0.14], purr: ['bandpass', 430, 0.9, 0.24], scribble: ['bandpass', 2300, 0.8, 0.07] }[kind] || ['bandpass', 1000, 1, 0.1];
    if (kind === 'purr') {
      const v = this._purr(t); v.g.gain.value = 1; v.g.connect(g);
      const hp = {
        set: (level, pitch) => { const n = this.now; g.gain.setTargetAtTime(Math.max(0.0001, cfg[3] * Math.max(0, Math.min(1, level))), n, 0.06); if (pitch !== undefined) v.lfo.frequency.setTargetAtTime(21 + pitch * 8, n, 0.08); },
        stop: () => { if (!this._loops.has(hp)) return; const n = this.now; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0.0001, n, 0.08); v.stop(n + 0.5); this._after(n + 0.6, () => { try { g.disconnect(); } catch (e) {} }); this._loops.delete(hp); }
      };
      this._loops.add(hp);
      return hp;
    }
    const src = c.createBufferSource(); src.buffer = kind === 'wind' || kind === 'rain' ? this.pinkBuf : this.noiseBuf; src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = cfg[0]; fl.frequency.value = cfg[1]; fl.Q.value = cfg[2];
    src.connect(fl);
    const stops = [src];
    let tail = fl, osc = null;
    if (kind === 'scribble') {
      const am = c.createGain(); am.gain.value = 0.55; const lfo = c.createOscillator(), lg = c.createGain();
      lfo.type = 'triangle'; lfo.frequency.value = 23; lg.gain.value = 0.45; lfo.connect(lg); lg.connect(am.gain); lfo.start(t); stops.push(lfo);
      fl.connect(am); tail = am;
    } else if (kind === 'pour' || kind === 'zip') {
      const og = c.createGain(); osc = c.createOscillator(); osc.type = kind === 'zip' ? 'triangle' : 'sine'; osc.frequency.value = kind === 'zip' ? 300 : 500; og.gain.value = kind === 'zip' ? 0.045 : 0.055;
      osc.connect(og); og.connect(g); osc.start(t); stops.push(osc);
      if (kind === 'pour') { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 11; lg.gain.value = 260; lfo.connect(lg); lg.connect(fl.frequency); lfo.start(t); stops.push(lfo); }   // the gurgle
    }
    tail.connect(g);
    src.start(t);
    const h = {
      set: (level, pitch) => {
        const n = this.now;
        g.gain.setTargetAtTime(Math.max(0.0001, cfg[3] * Math.max(0, Math.min(1, level))), n, 0.06);
        if (pitch !== undefined) {
          fl.frequency.setTargetAtTime(cfg[1] * (0.6 + pitch * 1.2), n, 0.08);
          if (osc) osc.frequency.setTargetAtTime((kind === 'zip' ? 220 : 380) * Math.pow(2, pitch * (kind === 'zip' ? 1.6 : 1.3)), n, 0.06);
        }
      },
      stop: () => {
        if (!this._loops.has(h)) return;
        const n = this.now;
        g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0.0001, n, 0.08);
        src.onended = () => { try { g.disconnect(); } catch (e) {} };
        for (const s of stops) { try { s.stop(n + 0.5); } catch (e) {} }
        this._loops.delete(h);
      }
    };
    this._loops.add(h);
    return h;
  }
  stopLoops() { for (const h of Array.from(this._loops)) h.stop(); }

  // ── effects ──
  _makeSfx() {
    const A = this, r = Math.random;
    return {
      tick: () => A.blip({ f0: 1250, f1: 900, dur: 0.03, vel: 0.045 }),
      hop: (pan) => { A.blip({ f0: 290, f1: 570, dur: 0.12, vel: 0.085, pan, attack: 0.01 }); A.noise({ type: 'bandpass', freq: 850, freqTo: 2100, q: 1.2, dur: 0.17, vel: 0.075, pan, attack: 0.02 }); },
      land: (pan, soft) => {       // a soft pat and the leaves it stirs
        A.blip({ f0: 300, f1: 140, dur: 0.11, vel: soft ? 0.055 : 0.09, pan, type: 'triangle', attack: 0.008 });
        A.noise({ type: 'bandpass', freq: 1900, freqTo: 1200, q: 0.7, dur: 0.2, vel: soft ? 0.04 : 0.07, pan, attack: 0.012 });
      },
      step: (pan) => { A.noise({ type: 'lowpass', freq: 1100, q: 0.6, dur: 0.045, vel: 0.13, pan, attack: 0.006 }); A.blip({ f0: 230, f1: 130, dur: 0.05, vel: 0.05, pan, type: 'triangle' }); },
      thump: (pan) => { A.blip({ f0: 200, f1: 85, dur: 0.18, vel: 0.11, pan, type: 'triangle', attack: 0.01 }); A.noise({ type: 'lowpass', freq: 800, q: 0.5, dur: 0.12, vel: 0.07, pan, attack: 0.01 }); },
      knock: (pan) => { A.blip({ f0: 520, f1: 300, dur: 0.05, vel: 0.1, pan, type: 'triangle' }); A.blip({ f0: 1180, f1: 900, dur: 0.03, vel: 0.03, pan }); A.noise({ type: 'bandpass', freq: 1600, q: 3, dur: 0.04, vel: 0.05, pan }); },
      pop: (pan) => A.blip({ f0: 640, f1: 190, dur: 0.07, vel: 0.11, pan }),
      plip: (pan) => { A.blip({ f0: 560, f1: 1250, dur: 0.055, vel: 0.07, pan, glide: 0.7 }); A.blip({ f0: 900, f1: 500, dur: 0.02, vel: 0.02, pan }); },     // a drop: the pitch runs up
      whoosh: (dur, pan) => A.noise({ type: 'bandpass', freq: 380, freqTo: 2400, q: 1.1, dur: dur || 0.35, vel: 0.15, attack: (dur || 0.35) * 0.4, pan }),
      swish: (pan) => A.noise({ type: 'bandpass', freq: 2300, freqTo: 600, q: 1.1, dur: 0.22, vel: 0.15, attack: 0.03, pan }),
      rustle: (pan) => { for (let i = 0; i < 4; i++) A.noise({ type: 'bandpass', freq: 2100 + r() * 1700, q: 0.9, dur: 0.07 + r() * 0.06, vel: 0.05 + r() * 0.03, attack: 0.012, when: A.now + i * 0.055 + r() * 0.02, pan }); },
      chalk: (dur, pan) => { const d = dur || 0.3, n = Math.max(2, Math.round(d / 0.07)); for (let i = 0; i < n; i++) A.noise({ type: 'bandpass', freq: 2500 + r() * 1300, q: 1.1, dur: 0.05 + r() * 0.04, vel: 0.06 + r() * 0.04, when: A.now + i * (d / n), pan, attack: 0.008 }); },
      strike: () => {              // the scratch of a match, then the flame catching
        A.noise({ type: 'bandpass', freq: 3600, freqTo: 2200, q: 1.3, dur: 0.15, vel: 0.085, attack: 0.02 });
        A.noise({ type: 'bandpass', freq: 600, freqTo: 1500, q: 0.8, dur: 0.55, vel: 0.06, attack: 0.12, when: A.now + 0.08 });
        A.blip({ f0: 330, f1: 495, dur: 0.5, vel: 0.02, attack: 0.15, when: A.now + 0.1 });
      },
      blow: () => A.noise({ type: 'bandpass', freq: 900, freqTo: 400, q: 0.8, dur: 0.4, vel: 0.14, attack: 0.05 }),
      splash: (pan) => {
        A.noise({ type: 'lowpass', freq: 2400, freqTo: 500, q: 0.6, dur: 0.5, vel: 0.1, attack: 0.012, pan }); A.blip({ f0: 500, f1: 180, dur: 0.12, vel: 0.055, pan });
        for (let i = 0; i < 2; i++) A.blip({ f0: 600 + r() * 300, f1: 1300 + r() * 400, dur: 0.045, vel: 0.03, when: A.now + 0.16 + i * 0.11 + r() * 0.05, pan });
      },
      // voices
      purr: (dur) => {             // breathing in (higher, lighter) and out (lower, fuller), about a breath a second
        if (!A.live) return;
        const t = A.now, d = dur || 1.4, v = A._purr(t), g = v.g, lvl = A.ctx.createGain();
        lvl.gain.value = 0.24; g.connect(lvl); lvl.connect(A.sfxBus);
        g.gain.setValueAtTime(0.0001, t);
        let x = t, k = 0;
        while (x < t + d - 0.15) {
          const len = Math.min(t + d - x, (k % 2 ? 0.62 : 0.5) * (0.9 + r() * 0.2)), pk = k % 2 ? 1 : 0.7;
          v.lfo.frequency.setValueAtTime(k % 2 ? 23.5 : 27, x);
          g.gain.exponentialRampToValueAtTime(pk, x + len * 0.35); g.gain.exponentialRampToValueAtTime(pk * 0.65, x + len * 0.85); g.gain.exponentialRampToValueAtTime(pk * 0.14, x + len);
          x += len; k++;
        }
        g.gain.exponentialRampToValueAtTime(0.0001, x + 0.25);
        v.stop(x + 0.3);
      },
      meow: (kitten, pan) => {
        if (kitten) A._vox({ dur: 0.3, f: [[0, 760], [0.35, 1060], [1, 800]], F1: [[0, 850], [0.4, 1250], [1, 900]], F2: [[0, 2700], [0.4, 2400], [1, 1900]], vel: 0.11, g2: 0.55, breath: 0.1, pan });
        else A._vox({ dur: 0.52, f: [[0, 440], [0.3, 640], [0.7, 560], [1, 410]], F1: [[0, 520], [0.35, 1000], [1, 620]], F2: [[0, 2150], [0.35, 1750], [1, 1050]], vel: 0.13, vib: 0.012, breath: 0.12, pan });
      },
      mrrp: (kitten, pan) => { const b = kitten ? 640 : 400; A._vox({ dur: 0.2, f: [[0, b], [1, b * 1.55]], F1: [[0, 560], [1, 820]], F2: [[0, 1600], [1, 2150]], vel: 0.17, trem: 27, attack: 0.02, pan }); },
      giggle: (pan) => {           // "hee-hee-hee-hee": one small voice, four or five breaths
        if (!A.live) return;
        const c = A.ctx, t = A.now, n = 4 + (r() < 0.5 ? 1 : 0), out = A._out(A.sfxBus, pan);
        const o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g2 = c.createGain(), g = c.createGain();
        o.type = 'sawtooth'; f1.type = f2.type = 'bandpass'; f1.frequency.value = 950; f1.Q.value = 3.5; f2.frequency.value = 2000; f2.Q.value = 5; g2.gain.value = 0.5;
        o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g); g.connect(out);
        g.gain.setValueAtTime(0.0001, t);
        let x = t;
        for (let i = 0; i < n; i++) {
          const p = (760 - i * 44) * (1 + (r() - 0.5) * 0.04);
          o.frequency.setValueAtTime(p * 1.07, x); o.frequency.exponentialRampToValueAtTime(p * 0.93, x + 0.075);
          g.gain.setValueAtTime(0.0001, x); g.gain.linearRampToValueAtTime(0.17 * (1 - i * 0.1), x + 0.018); g.gain.exponentialRampToValueAtTime(0.0001, x + 0.088);
          A.noise({ type: 'bandpass', freq: 2100, q: 1, dur: 0.03, vel: 0.02, when: x, attack: 0.008, bus: out });
          x += 0.108 - i * 0.004;
        }
        o.start(t); o.stop(x + 0.1);
      },
      chirp: (pan, f) => A._chirp(A.now, f || 2400 + r() * 800, 0.06, pan, A.sfxBus),
      lap: (pan) => { for (let i = 0; i < 2; i++) { const w = A.now + i * 0.13; A.blip({ f0: 620 + i * 80, f1: 300 + i * 40, dur: 0.045, vel: 0.085 - i * 0.012, when: w, pan }); A.noise({ type: 'bandpass', freq: 1800, q: 1.5, dur: 0.03, vel: 0.02, when: w, pan, attack: 0.008 }); } },
      // musical
      bell: (pan) => { [0, 1, 2, 3].forEach((i) => A.chordNote(i, { when: A.now + i * 0.075, vel: 0.56 - i * 0.06, pan })); },
      chime: (n, pan) => { const k = n || 4; for (let i = 0; i < k; i++) A.scaleNote(5 + Math.floor(r() * 5), { inst: 'box', when: A.now + i * 0.06, vel: 0.28, octave: 1, pan }); },
      sparkle: (pan) => A.scaleNote(6 + Math.floor(r() * 4), { inst: 'box', vel: 0.35, octave: 1, pan }),
      rise: (pan) => { for (let i = 0; i < 6; i++) A.scaleNote(i, { inst: 'pluck', when: A.now + i * 0.07, vel: 0.26 + i * 0.012, pan }); },
      fall: (pan) => { for (let i = 0; i < 5; i++) A.scaleNote(8 - i, { inst: 'box', when: A.now + i * 0.11, vel: 0.37 - i * 0.015, pan }); },
      fanfare: () => { for (let i = 0; i < 5; i++) A.chordNote(i, { when: A.now + i * 0.1, vel: 0.42 + i * 0.02, inst: 'box' }); A.chordNote(5, { when: A.now + 0.62, vel: 0.54, inst: 'box' }); },
      // a few more, for whoever needs them
      shimmer: (pan) => { for (let i = 0; i < 5; i++) A.scaleNote(2 + i, { inst: 'glass', when: A.now + i * 0.09, vel: 0.3, dur: 0.5, pan }); },          // a soft rising glow of glass
      twinkle: (pan) => A.scaleNote(5 + Math.floor(r() * 5), { inst: 'glass', vel: 0.3, dur: 0.25, pan }),                                               // one small star
      goodnight: () => { if (!A.live) return; const s = A.song, k = (s ? s.def.key : 62) + 12, sc = s ? s.scale : SCALES.major; [5, 3, 1].forEach((d, i) => A.glass(A._fit(degToMidi(k, sc, d)), { when: A.now + i * 0.6, vel: 0.5, dur: 0.8, bus: A.sfxBus })); },
      paper: (pan) => { A.noise({ type: 'bandpass', freq: 2600, freqTo: 1500, q: 0.8, dur: 0.09, vel: 0.085, attack: 0.012, pan }); A.noise({ type: 'bandpass', freq: 1700, freqTo: 2500, q: 0.8, dur: 0.12, vel: 0.065, attack: 0.03, when: A.now + 0.07, pan }); },
      flutter: (pan) => { for (let i = 0; i < 5; i++) A.noise({ type: 'bandpass', freq: 1300 + i * 120, q: 1.2, dur: 0.045, vel: 0.085 - i * 0.01, attack: 0.012, when: A.now + i * 0.052, pan }); },   // wings
      yawn: (kitten, pan) => A._vox({ dur: kitten ? 0.6 : 0.85, f: kitten ? [[0, 620], [0.25, 760], [1, 520]] : [[0, 380], [0.25, 470], [1, 300]], F1: [[0, 600], [0.35, 950], [1, 650]], F2: [[0, 1500], [0.35, 1300], [1, 1000]], vel: 0.07, q1: 3, q2: 4, attack: 0.12, breath: 0.35, pan }),
      owl: (pan) => { if (A.live) A._owl(A.now, pan || 0, A.sfxBus, 1.5); },
      cuckoo: (pan) => { if (A.live) A._cuckoo(A.now, pan || 0, A.sfxBus, 1.6, 2); }
    };
  }
}

export { SONGS, mtof };
