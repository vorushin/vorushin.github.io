// Magic cats — narration. The story text lives in _data/magic_cats.yml; the page emits it as
// JSON, already split into small "beats" (one or two sentences) aligned across EN / DE / RU.
// This module shows one beat at a time on a little strip of paper, word by word — and, if the
// player asks for it, reads it aloud with the device's own voice (the Web Speech API; nothing
// is recorded or downloaded, so how it sounds depends on the device).

import { rng } from './util.js';

export const LANGS = ['en', 'de', 'ru'];

// Interface strings (story text is never here — only chrome and gesture hints).
export const UI = {
  begin: { en: 'Begin', de: 'Los geht’s', ru: 'Начать' },
  resume: { en: 'Continue', de: 'Weiter', ru: 'Продолжить' },
  restart: { en: 'Start over', de: 'Von vorn', ru: 'Сначала' },
  book: { en: 'Read the book', de: 'Das Buch lesen', ru: 'Читать книжку' },
  full: { en: 'Full screen', de: 'Vollbild', ru: 'На весь экран' },
  language: { en: 'Language', de: 'Sprache', ru: 'Язык' },
  again: { en: 'Play again', de: 'Noch einmal', ru: 'Ещё раз' },
  theEnd: { en: 'Good night', de: 'Gute Nacht', ru: 'Спокойной ночи' },
  delivered: { en: 'All the tales are delivered.', de: 'Alle Märchen sind ausgetragen.', ru: 'Все сказки разнесены.' },
  home: { en: 'Back to the start', de: 'Zum Anfang', ru: 'В начало' },
  goOn: { en: 'Tap to go on', de: 'Tippe, dann geht es weiter', ru: 'Нажми — и читаем дальше' },
  sound: { en: 'Sound', de: 'Ton', ru: 'Звук' },
  speak: { en: 'Read aloud', de: 'Vorlesen', ru: 'Читать вслух' },
  autoOff: { en: 'Let the story play by itself', de: 'Die Geschichte von selbst spielen lassen', ru: 'Пусть сказка идёт сама' },
  autoOn: { en: 'The story is playing by itself — tap to play it yourself', de: 'Die Geschichte spielt von selbst — tippe, um selbst zu spielen', ru: 'Сказка идёт сама — нажми, чтобы играть самому' },
  tales: { en: 'Tales', de: 'Märchen', ru: 'Сказки' },
  intro: {
    en: 'A bedtime story to play. Touch, hold and drag — the cats will show you how.',
    de: 'Eine Gutenachtgeschichte zum Spielen. Tippen, halten, ziehen — die Katzen zeigen dir, wie.',
    ru: 'Сказка на ночь, в которую можно играть. Нажимай, держи, тяни — коты покажут как.'
  },
  scenes: [
    { en: '', de: '', ru: '' },
    { en: 'Evening', de: 'Abend', ru: 'Вечер' },
    { en: 'The treetop road', de: 'Der Wipfelweg', ru: 'Дорога по вершинам' },
    { en: 'The kitten', de: 'Das Kätzchen', ru: 'Котёнок' },
    { en: 'Moon milk', de: 'Mondmilch', ru: 'Лунное молоко' },
    { en: 'The tree library', de: 'Die Baumbibliothek', ru: 'Библиотека на дереве' },
    { en: 'Learning to notice', de: 'Sehen lernen', ru: 'Учимся замечать' },
    { en: 'The world of towers', de: 'Die Welt der Türme', ru: 'Мир башен' },
    { en: 'The world of clouds', de: 'Die Welt der Wolken', ru: 'Мир облаков' },
    { en: 'The garden of tales', de: 'Der Garten der Märchen', ru: 'Сад сказок' }
  ]
};

// Voices that read a story well, by language, best first (names as the systems report them);
// the novelty and "eloquence" voices some systems list alongside are avoided.
const VOICES = {
  en: ['Serena', 'Daniel', 'Kate', 'Martha', 'Samantha', 'Karen', 'Moira', 'Tessa', 'Google UK English Female', 'Sonia', 'Libby', 'Aria', 'Jenny', 'Google US English', 'Zira'],
  de: ['Anna', 'Petra', 'Helena', 'Katja', 'Google Deutsch', 'Hedda', 'Markus'],
  ru: ['Milena', 'Katya', 'Svetlana', 'Dariya', 'Google русский', 'Irina', 'Yuri']
};
const NOT_FOR_STORIES = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|eddy|flo\b|grandma|grandpa|reed|rocko|sandy|shelley/i;

export class Story {
  constructor(data, els) {
    this.data = data;                    // {langs, title, byline, scenes: [{id, beats: {en: [...], de: [...], ru: [...]}}]}
    this.el = els.caption; this.paper = els.paper; this.text = els.text; this.moreEl = els.more; this.hintEl = els.hint;
    this.lang = document.documentElement.getAttribute('data-lang') || 'en';
    this.cur = null;                     // {scene, i}
    this.shownAt = 0; this.minRead = 0;  // ms
    this.fast = false;
    this.readK = 1;                      // reading-time multiplier (longer while the story plays by itself)
    this._hint = null;
    this._epoch = 0; this._chain = Promise.resolve();
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null;
    this.voiceOn = false;                // read the captions aloud
    this.speaking = false;
    this.onSpeak = null;                 // (on) => … lets the music step back while the voice reads
    this._utter = null; this._primed = false;
    for (const s of data.scenes) {
      const n = s.beats.en.length;
      for (const l of LANGS) if (s.beats[l].length !== n) console.warn('magic-cats: beat count mismatch in', s.id, l);
    }
  }
  count(scene) { const s = this.data.scenes[scene - 1]; return s ? s.beats.en.length : 0; }
  beat(scene, i, lang) { const s = this.data.scenes[scene - 1]; return s ? (s.beats[lang || this.lang][i] || '') : ''; }
  t(obj) { return typeof obj === 'string' ? obj : (obj && (obj[this.lang] || obj.en)) || ''; }

  // Show beat i of scene. `sc` (the Scene) lets the waits run on the scene clock so they abort cleanly.
  // Calls are queued: every beat gets its turn on the paper (and its reading time) even when a
  // script fires several without awaiting them — a beat is never dropped.
  show(scene, i, o, sc) {
    const epoch = this._epoch;
    const run = () => (epoch === this._epoch ? this._show(scene, i, o || {}, sc, epoch) : undefined);
    const p = this._chain.then(run, run);
    this._chain = p.catch(() => {});
    return p;
  }
  async _show(scene, i, o, sc, epoch) {
    const wait = (ms) => (sc ? sc.wait(ms / 1000) : new Promise((r) => setTimeout(r, ms)));
    if (this.cur && !o.now && !this.fast) {
      const left = this.shownAt + this.minRead * this.readK - performance.now();
      if (left > 0) await wait(left);
      for (let k = 0; this.speaking && k < 300; k++) await wait(100);        // the voice finishes its sentence first
    }
    if (this.cur) { this.paper.classList.remove('mcp-in'); await wait(this.fast ? 10 : 170); }
    if (epoch !== this._epoch) return;
    this.cur = { scene, i };
    this.el.hidden = false;                              // visible before it is measured (the paper is still faded out)
    const words = this._render();
    this._cut(scene * 131 + i * 17);
    void this.paper.offsetWidth;
    this.paper.classList.add('mcp-in');
    if (this.onShow) this.onShow();
    if (this.voiceOn && !this.fast) this.speak(this.beat(scene, i));
    const reveal = this.fast ? 10 : Math.min(2200, 260 + words * 62);
    this.shownAt = performance.now();
    this.minRead = this.fast ? 0 : Math.min(9000, reveal + 600 + words * 260);   // long enough to read aloud
    await wait(o.block === false ? 0 : reveal);
  }
  _render() {
    if (!this.cur) return 0;
    const txt = this.beat(this.cur.scene, this.cur.i);
    const words = txt.split(/\s+/).filter(Boolean);
    const step = Math.min(62, 1900 / Math.max(1, words.length));
    this.text.textContent = '';
    this.text.setAttribute('lang', this.lang);
    let prev = null;
    words.forEach((w, k) => {
      if (prev && /^[—–-]$/.test(w)) { prev.textContent += ' ' + w; return; }   // a dash stays with the word before it, never starts a line
      const s = document.createElement('span');
      s.className = 'mcp-w';
      s.style.animationDelay = (this.fast ? 0 : Math.round(120 + k * step)) + 'ms';
      s.textContent = w;
      if (prev) this.text.appendChild(document.createTextNode(' '));
      this.text.appendChild(s);
      prev = s;
    });
    this._fit();
    return words.length;
  }
  _fit() {
    // shrink the type a little if a long beat would not fit the strip on a small screen
    this.text.style.fontSize = '';
    const max = this.maxPaper ? this.maxPaper() : Math.max(70, window.innerHeight * (window.innerHeight > window.innerWidth ? 0.24 : 0.3));
    let size = parseFloat(getComputedStyle(this.text).fontSize), guard = 0;
    while (this.paper.offsetHeight > max && size > 13 && guard++ < 12) { size -= 1; this.text.style.fontSize = size + 'px'; }
  }
  // hand-cut paper edge, different for every beat
  _cut(seed) {
    const r = rng(seed), pts = [], j = () => (r() * 3.2).toFixed(1);
    const top = 5 + Math.floor(r() * 3), side = 2;
    for (let k = 0; k <= top; k++) pts.push((k / top * 100).toFixed(1) + '% ' + j() + 'px');
    for (let k = 1; k <= side; k++) pts.push('calc(100% - ' + j() + 'px) ' + (k / (side + 1) * 100).toFixed(1) + '%');
    for (let k = top; k >= 0; k--) pts.push((k / top * 100).toFixed(1) + '% calc(100% - ' + j() + 'px)');
    for (let k = side; k >= 1; k--) pts.push(j() + 'px ' + (k / (side + 1) * 100).toFixed(1) + '%');
    this.paper.style.clipPath = 'polygon(' + pts.join(',') + ')';
    this.paper.style.setProperty('--tilt', ((r() - 0.5) * 1.4).toFixed(2) + 'deg');
  }
  // ── reading aloud ──
  voiceFor(lang) {
    if (!this.synth) return null;
    let all = [];
    try { all = this.synth.getVoices() || []; } catch (e) { return null; }
    const mine = all.filter((v) => v && v.lang && v.lang.toLowerCase().indexOf(lang) === 0);
    if (!mine.length) return null;
    const list = VOICES[lang] || [];
    const score = (v) => {
      let s = v.localService ? 3 : 0;
      const k = list.findIndex((n) => v.name.indexOf(n) >= 0);
      if (k >= 0) s += 30 - k;
      if (/enhanced|premium|natural|neural/i.test(v.name)) s += 6;
      if (NOT_FOR_STORIES.test(v.name)) s -= 40;
      if (v.default) s += 1;
      return s;
    };
    return mine.slice().sort((a, b) => score(b) - score(a))[0];
  }
  canSpeak() { return !!this.voiceFor(this.lang); }
  setVoice(on, now) {
    this.voiceOn = !!on;
    if (!on) this.hush();
    else if (now && this.cur) this.speak(this.beat(this.cur.scene, this.cur.i));
  }
  // call once from a real tap: some browsers only let a page speak after the user has asked it to
  prime() {
    if (this._primed || !this.synth || !this.voiceOn) return;
    this._primed = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; this.synth.speak(u); } catch (e) {}
  }
  speak(text) {
    const v = this.voiceFor(this.lang);
    if (!v || !text) return;
    this._primed = true;
    const synth = this.synth, u = new SpeechSynthesisUtterance(text), busy = synth.speaking || synth.pending;
    u.voice = v; u.lang = v.lang; u.rate = 0.9; u.pitch = 1;
    const done = () => { if (this._utter !== u) return; this._utter = null; this.speaking = false; clearTimeout(this._voiceT); if (this.onSpeak) this.onSpeak(false); };
    u.onend = done; u.onerror = done;
    this._utter = u; this.speaking = true;
    if (this.onSpeak) this.onSpeak(true);
    clearTimeout(this._voiceT);
    this._voiceT = setTimeout(done, 4000 + text.length * 130);          // (should an engine never report the end)
    try {
      if (busy) { synth.cancel(); setTimeout(() => { if (this._utter === u) synth.speak(u); }, 90); }
      else synth.speak(u);
    } catch (e) { done(); }
  }
  hush() {
    const was = this._utter;
    this._utter = null; this.speaking = false; clearTimeout(this._voiceT);
    if (this.synth && (was || this.synth.speaking || this.synth.pending)) { try { this.synth.cancel(); } catch (e) {} }
    if (was && this.onSpeak) this.onSpeak(false);
  }

  clear() {
    this.hush();
    this._epoch++; this._chain = Promise.resolve();
    this.cur = null; this.minRead = 0;
    this.paper.classList.remove('mcp-in');
    this.more(false); this.hint(null);
  }
  more(on) { this.moreEl.classList.toggle('mcp-on', !!on); }
  // hint: {en, de, ru} | string | null
  hint(h) {
    const s = h ? this.t(h) : '';
    this._hint = h || null;
    if (s === this.hintEl.textContent && this.hintEl.classList.contains('mcp-on') === !!h) return;   // a live region is only touched when the words change
    this.hintEl.textContent = s;
    this.hintEl.classList.toggle('mcp-on', !!h);
  }
  // the screen changed shape: the caption on it is measured again
  refit() { if (this.cur) this._fit(); }
  setLang(l) {
    if (l !== this.lang) this.hush();
    this.lang = l;
    if (this.cur) { this._render(); for (const s of this.text.children) s.style.animationDelay = '0ms'; }
    if (this._hint) this.hintEl.textContent = this.t(this._hint);
  }
  caption() { return this.cur ? this.beat(this.cur.scene, this.cur.i) : ''; }
}
