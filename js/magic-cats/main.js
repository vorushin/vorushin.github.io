// Magic cats — the game shell: boot, main loop, scene switching, HUD, hints, saving.
// Scenes live in ./scenes/<name>.js (loaded on demand) and extend Scene from ./scene.js.

import { View } from './view.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Story, UI, LANGS } from './story.js';
import { Scene, ABORT } from './scene.js';
import { grainURL, drawSky, drawStars, makeStars, SKIES, chalk, INK, freeSprites, setStill } from './paint.js';
import { Cat } from './actors.js';
import { TAU, approach, clamp01, lerp, ease } from './util.js';

// index 0 is the title; 1..9 follow the nine paragraphs of the book.
export const SCENES = ['title', 'candle', 'treetops', 'kitten', 'moonmilk', 'library', 'noticing', 'towers', 'clouds', 'garden'];
const SAVE_KEY = 'magic-cats-play-v2';
const $ = (id) => document.getElementById(id);

// Shown if a scene module fails to load: the story stays readable from start to end.
class StubScene extends Scene {
  constructor(game, index) { super(game, index); this.stars = makeStars(index * 7 + 3, 120); }
  async run() { for (let i = 0; i < this.story.count(this.index); i++) await this.tell(i); }
  draw(ctx, view, t) { drawSky(ctx, view, SKIES.night); drawStars(ctx, view, this.stars, t, 1); }
}

class Game {
  constructor() {
    this.dom = {
      stage: $('mcp-stage'), canvas: $('mcp-canvas'), fade: $('mcp-fade'), title: $('mcp-title'), end: $('mcp-end'),
      stars: $('mcp-stars'), flies: $('mcp-flies'), fliesN: $('mcp-flies-n'), sound: $('mcp-sound'), home: $('mcp-home'), back: $('mcp-back'),
      begin: $('mcp-begin'), resume: $('mcp-resume'), again: $('mcp-again'), grain: $('mcp-grain'), top: $('mcp-top'),
      chapter: $('mcp-chapter'), chapterName: $('mcp-chapter-name'), chapterDots: $('mcp-chapter-dots')
    };
    this.params = new URLSearchParams(location.search);
    this._motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this._motionMq.matches;
    this.save = this.loadSave();
    this.view = new View(this.dom.canvas);
    this.audio = new AudioEngine({ enabled: this.save.sound });
    this.story = new Story(JSON.parse($('mcp-story').textContent), { caption: $('mcp-caption'), paper: $('mcp-paper'), text: $('mcp-text'), more: $('mcp-more'), hint: $('mcp-hint') });
    this.story.voiceOn = !!this.save.voice;
    this.story.onSpeak = (on) => this.audio.duck(on && this.save.sound);
    this.story.fast = this.params.has('fast');
    this.story.maxPaper = () => Math.max(64, this.view.paper - 8);          // the paper strip stays inside the band the camera keeps free
    this.scene = null; this.index = -1; this.switching = false; this.runToken = 0;
    this.t = 0; this.last = 0; this.paused = false; this.speed = Number(this.params.get('speed')) || 1;
    this.hintA = 0; this.hintT = 0; this.hintKey = ''; this.seenKinds = {};
    this.fps = 60; this.keyHeld = null;
    this.taps = [];
    this.auto = false; this.autoHold = null; this.autoLast = { kind: '', at: -9 };   // "watch the story": see autoPlay()
    this.touchedAt = -99;
    this._frame = this.frame.bind(this);
  }

  // ── persistence ──
  loadSave() {
    const d = { v: 2, reached: 1, done: [], flies: 0, sound: true, tree: null, voice: false };
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.v === 2) Object.assign(d, s); } catch (e) {}
    // whatever storage held is checked before it is trusted: a chapter index out of range or a list that is
    // not a list would otherwise throw inside go() and leave the curtain down
    d.reached = Math.min(9, Math.max(1, Math.round(Number(d.reached)) || 1));
    if (!Array.isArray(d.done)) d.done = [];
    d.flies = Math.min(999, Math.max(0, Math.round(Number(d.flies)) || 0));       // (the book has a few dozen to give: a wild number is a broken save)
    const done = []; for (let i = 1; i <= 9; i++) if (d.done[i] === true) done[i] = true; d.done = done;    // only chapters 1–9, only `true`
    d.sound = d.sound !== false; d.voice = !!d.voice;
    if (d.tree !== null && (typeof d.tree !== 'object' || Array.isArray(d.tree))) d.tree = null;
    if (d.tree) { try { if (JSON.stringify(d.tree).length > 200000) d.tree = null; } catch (e) { d.tree = null; } }   // (a drawing is a few kB)
    return d;
  }
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) {} }

  // ── boot ──
  boot() {
    document.body.classList.add('mcp-ready');
    setStill(this.reduced); Cat.still = this.reduced;          // reduced motion: no wind, no fidgeting
    const onMotion = (e) => { this.reduced = e.matches; setStill(e.matches); Cat.still = e.matches; if (this.scene) this.scene.reduced = e.matches; };
    if (this._motionMq.addEventListener) this._motionMq.addEventListener('change', onMotion); else if (this._motionMq.addListener) this._motionMq.addListener(onMotion);
    // a cat that yawns can be heard yawning, a caption arrives with a rustle of paper
    // (a yawn is heard now and then, not every time: a street full of cats must not turn into a chorus)
    Cat.onAct = (cat, kind) => {
      if (kind !== 'yawn' || this.switching || !this.view.visible(cat.x, 0) || this.t - (this._yawnAt || -99) < 20) return;
      this._yawnAt = this.t;
      this.audio.sfx.yawn(cat.c.head > 1.1, clamp01((cat.x - this.view.left) / Math.max(1, this.view.width)) * 1.4 - 0.7);
    };
    this.story.onShow = () => this.audio.sfx.paper();
    this.dom.grain.style.backgroundImage = 'url(' + grainURL(200) + ')';
    this.view.resize();
    window.addEventListener('resize', () => { this.view.resize(); this.layout(); this.story.refit(); if (this.scene && this.scene.onResize) this.scene.onResize(); });
    this.input = new Input(this.dom.canvas, this.view, {
      // (a touch that lands on the bar's empty space is a miss at a button, not a poke at the scene)
      down: (p) => { this.takeOver(); this.unlock(); this.tap(p); this.touchedAt = this.t; this.noteHinted(); this._barTap = this.index > 0 && p.sy < this.view.hud; if (this.scene && !this.switching && !this._barTap) this.scene._down(p); },
      // (while the paw performs a drag or a hold, a real finger's moves and lift are not mixed into it)
      move: (p) => { if (this.scene && !this.switching && !this._barTap && !this._dragging && !this.autoHold) this.scene._move(p); },
      up: (p) => { const skip = this._barTap || this._dragging || this.autoHold; this._barTap = false; if (this.scene && !this.switching && !skip) this.scene._up(p); },
      hover: (p) => { if (this.scene && this.scene.onHover) this.scene.onHover(p); },
      busy: () => !!(this.scene && !this.switching && this.scene._lasting),     // a second finger may not take over from this press
      key: (k, down) => this.key(k, down)
    });
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => this.unlock(), { passive: true });
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (document.hidden) { this._hiddenAt = performance.now(); this.audio.suspend(); this.story.hush(); }
      else {
        this.last = 0; this.audio.resume();
        if (this._hiddenAt) { this.story.shownAt += performance.now() - this._hiddenAt; this._hiddenAt = 0; }   // time away was not reading time
        if (this._wantAwake) { this._lock = null; this.keepAwake(true); }
      }
    });
    setInterval(() => { if (!this.paused) this.audio.pump(); }, 60);
    this.initHud();
    this.initLang();
    this.secondTouchClicks();
    this.initCurtain();
    const q = this.params.get('scene');
    let start = 0;
    if (q) {
      const n = SCENES.indexOf(q), k = Math.round(Number(q));
      if (n >= 0) start = n;
      else if (Number.isFinite(k)) start = Math.min(9, Math.max(0, k));     // a mistyped number lands on the nearest chapter, never on nothing
      else this.devScene = q;
    }
    this.go(this.devScene ? -1 : start);
    requestAnimationFrame(this._frame);
  }
  // A touch that is not the primary pointer (a second finger, while a thumb rests on the canvas) gets no
  // `click` from the browser. For the page's own controls it is made here: down and up on the same
  // button, link or role=button → el.click(). Primary touches, the mouse and keys keep the browser's click
  // (and a native click that follows a made one on the same element is swallowed, in case a browser does both).
  secondTouchClicks() {
    const SEL = 'button, a[href], [role="button"], #mcp-hint', pend = new Map();     // (the hint pill is a live region that can be tapped)
    let made = null, madeAt = 0;
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || e.isPrimary) return;
      const el = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (el) pend.set(e.pointerId, el);
    }, true);
    const up = (e) => {
      const el = pend.get(e.pointerId);
      if (!el) return;
      pend.delete(e.pointerId);
      if (e.type !== 'pointerup' || el.disabled || el.closest('[inert]')) return;
      const at = document.elementFromPoint(e.clientX, e.clientY), hit = at && at.closest ? at.closest(SEL) : null;
      if (hit !== el) return;
      made = el; madeAt = performance.now();
      el.click();
    };
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('click', (e) => {
      if (made && e.isTrusted && performance.now() - madeAt < 600 && e.target && e.target.closest && e.target.closest(SEL) === made) { e.preventDefault(); e.stopPropagation(); made = null; }
    }, true);
  }
  // The curtain between chapters: a tap anywhere on it (but the night button) lifts it once the chapter's
  // name has been readable for a moment.
  initCurtain() {
    const f = this.dom.fade;
    if (!f) return;
    f.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.closest && e.target.closest('#mcp-night')) return;
      if (!this._chapterSkip) { if (this.switching) this._earlyTap = true; return; }    // (still fading in: lift it once the card has been up 1.2 s)
      const wait = Math.max(0, 1200 - (performance.now() - this._chapterAt)), skip = this._chapterSkip;
      setTimeout(() => { if (this._chapterSkip === skip) skip(); }, this.params.has('fast') ? 0 : wait);
    });
  }
  unlock() { if (this.dozing) this.rouse(); this.story.prime(); if (this.audio.unlock() && !this._unlocked) { this._unlocked = true; if (this.scene && this.scene.onAudio) this.scene.onAudio(); } }
  // A touch that comes while the paw is showing teaches the gesture: later paws of that kind wait longer.
  noteHinted() {
    const sc = this.scene, e = sc && !this.switching ? sc.currentExpect() : null;
    if (e && this.hintA > 0.5) this.seenKinds[e.kind] = (this.seenKinds[e.kind] || 0) + 1;
  }
  // While the story plays by itself the phone lies on the pillow untouched: keep the screen from going dark.
  // (The browser lets go of the lock whenever the page is hidden; it is asked for again on return.)
  keepAwake(on) {
    this._wantAwake = !!on;
    const wl = navigator.wakeLock;
    if (!wl || !wl.request) return;
    if (on) {
      if (this._lock || document.hidden) return;
      let p;
      p = wl.request('screen').then((s) => {
        if (!this._wantAwake) { s.release().catch(() => {}); return null; }
        s.addEventListener('release', () => { if (this._lock === s) this._lock = null; });
        return s;
      }).catch(() => null);
      this._lock = p;
      p.then((s) => { if (this._lock === p) this._lock = s; });
    } else if (this._lock) {
      const l = this._lock; this._lock = null;
      Promise.resolve(l).then((s) => { if (s && !s.released) return s.release(); }).catch(() => {});
    }
  }

  // ── language ──
  initLang() {
    const apply = (l) => {
      const root = document.documentElement;
      root.setAttribute('data-lang', l); root.setAttribute('lang', l);
      try { localStorage.setItem('magic-cats-lang', l); } catch (e) {}
      document.querySelectorAll('[data-set-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l)));
      this.story.setLang(l);
      document.title = this.story.data.title[l] + ' — ' + ({ en: 'play the story', de: 'die Geschichte spielen', ru: 'сыграть в сказку' })[l];
      this.updateHud();
      if (this.scene && this.scene.onLang) this.scene.onLang(l);
    };
    document.querySelectorAll('[data-set-lang]').forEach((b) => b.addEventListener('click', () => { apply(b.getAttribute('data-set-lang')); this.audio.sfx.tick(); }));
    apply(LANGS.indexOf(this.story.lang) >= 0 ? this.story.lang : 'en');
  }

  // ── HUD ──
  initHud() {
    const d = this.dom;
    for (let i = 1; i <= 9; i++) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.dataset.scene = String(i);
      b.addEventListener('click', () => {
        if (i === this.index && !this.switching) return;                    // the chapter being played: a stray tap must not start it over
        if (i <= this.save.reached || this.params.has('debug')) { this.audio.sfx.tick(); this.go(i); }
      });
      li.appendChild(b); d.stars.appendChild(li);
    }
    d.sound.addEventListener('click', () => {
      this.save.sound = !this.save.sound; this.persist();
      this.audio.unlock(); this.audio.setEnabled(this.save.sound);
      if (this.save.sound) this.audio.sfx.bell();
      this.updateHud();
    });
    d.home.addEventListener('click', () => { this.audio.sfx.tick(); this.go(0); });
    // read aloud: the little button on the caption (there only if this device has a voice for the language)
    const speak = $('mcp-speak');
    if (speak) {
      speak.addEventListener('click', () => {
        this.save.voice = !this.save.voice; this.persist();
        this.story.setVoice(this.save.voice, true);
        this.audio.sfx.tick(); this.updateHud();
      });
      if (this.story.synth && this.story.synth.addEventListener) this.story.synth.addEventListener('voiceschanged', () => this.updateHud());
      window.addEventListener('pagehide', () => this.story.hush());
    }
    const full = $('mcp-full'), root = document.documentElement;
    if (full && root.requestFullscreen && document.fullscreenEnabled) {
      full.hidden = false;
      full.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen().catch(() => {}); });
    }
    d.begin.addEventListener('click', () => { this.unlock(); this.audio.sfx.bell(); this.setAuto(false); this.go(1); });
    d.resume.addEventListener('click', () => { this.unlock(); this.audio.sfx.bell(); this.setAuto(false); this.go(Math.min(9, Math.max(1, this.save.reached))); });
    const watch = $('mcp-watch');
    if (watch) watch.addEventListener('click', () => { this.unlock(); this.audio.sfx.bell(); this.setAuto(true); this.go(1); });
    const auto = $('mcp-auto');
    if (auto) auto.addEventListener('click', () => { this.unlock(); this.audio.sfx.tick(); this.touchedAt = -99; this.setAuto(!this.auto); });
    if (this.params.has('watch')) d.title.classList.add('mcp-prefer-watch');
    d.again.addEventListener('click', () => { this.audio.sfx.tick(); if (this._endResolve) this._endResolve(); });
    // the hint can be asked to do it: a tap on the words performs the gesture, like the Space key
    const hint = $('mcp-hint');
    if (hint) hint.addEventListener('click', () => { if (!this.auto && !this.switching) { this.unlock(); this.doExpect(); } });
    const night = $('mcp-night');
    if (night) night.addEventListener('click', () => { this.audio.sfx.tick(); this.goodnight(); });
    // "read it to me" on the title: the same voice as the little button on the caption, found before the story starts
    const readme = $('mcp-readme');
    if (readme) readme.addEventListener('click', () => { this.save.voice = !this.save.voice; this.persist(); this.story.setVoice(this.save.voice, true); this.unlock(); this.audio.sfx.tick(); this.updateHud(); });
    this.updateHud();
  }
  // Do whatever the scene expects right now, with the paw showing it (the hint pill, the Space key).
  doExpect() {
    const sc = this.scene;
    if (!sc || this.switching || this._dragging || this.autoHold) return;
    const e = sc.currentExpect();
    if (!e) return;
    if (e.kind === 'drag') { this.autoDrag(sc, e, e.slow ? e.slow * 0.6 : 0.35); return; }
    const p = e.kind === 'continue' ? { x: this.view.cam.x, y: this.view.cam.y - 100 } : { x: e.x, y: e.y };
    this.showPaw(this.view.sx(p.x), this.view.sy(p.y), 0.28);
    if (e.kind === 'hold') { this.autoHold = { p, t: 0, max: (e.dur || 1) + 1.5 }; sc._down(this.pt(p)); }
    else { sc._down(this.pt(p)); sc._up(this.pt(p)); }
  }
  // "Good night" on the curtain: back to the title, where the lights go down and the music fades out.
  goodnight() { this._nightQueued = true; this.go(0); }      // (during the curtain: go() cuts the chapter short, see there)
  // ── dozing ──
  // Left alone for a long while (the story playing by itself with nobody touching, or the closing
  // card up with nobody there), the picture dims and the music fades, like a night-light going
  // down. The next touch wakes everything again.
  doze() {
    if (this.dozing) return;
    this.dozing = true;
    this._dozed = { song: this.audio.songName, amb: this.audio._ambName, intensity: this.audio.intensity };
    this.dom.stage.classList.add('mcp-dozing');
    this.audio.stopMusic(16);
    this._dozeTimer = setTimeout(() => { if (this.dozing) this.audio.ambience('none'); }, 12000);
    this.story.hush();
    this.keepAwake(false);
  }
  rouse() {
    if (!this.dozing) return;
    this.dozing = false; clearTimeout(this._dozeTimer);
    this.dom.stage.classList.remove('mcp-dozing');
    const s = this._dozed; this._dozed = null;
    if (s && s.song) this.audio.play(s.song, { intensity: s.intensity });
    if (s && s.amb && s.amb !== 'none') this.audio.ambience(s.amb);
    this.touchedAt = this.t;
    this.keepAwake(this.auto && this.index > 0);
  }
  watchSleep() {
    if (this.dozing || this.index <= 0 || this.params.has('fast')) return;
    const quiet = this.t - Math.max(this.touchedAt, this.watchedAt || 0);
    if ((this.auto && quiet > 25 * 60) || (!this.dom.end.hidden && this.t - (this._endAt || this.t) > 180)) this.doze();
  }
  updateHud() {
    const d = this.dom, s = this.save, l = this.story.lang;
    d.stars.querySelectorAll('button').forEach((b) => {
      const i = Number(b.dataset.scene);
      const locked = i > s.reached && i !== this.index && !this.params.has('debug');   // the chapter being played is never shown locked
      b.className = (s.done[i] ? 'mcp-done ' : '') + (i === this.index ? 'mcp-cur ' : '') + (locked ? 'mcp-locked' : '');
      if (i === this.index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-label', i + '. ' + UI.scenes[i][l]);
      b.title = UI.scenes[i][l];
      b.disabled = locked;
    });
    d.sound.setAttribute('aria-pressed', String(!!s.sound));
    const auto = $('mcp-auto');
    if (auto) {
      auto.hidden = this.index <= 0;
      auto.setAttribute('aria-pressed', String(!!this.auto));
      const lbl = this.auto ? UI.autoOn[l] : UI.autoOff[l];
      auto.setAttribute('aria-label', lbl); auto.title = lbl;
    }
    const speak = $('mcp-speak');
    if (speak) {
      speak.hidden = !this.story.canSpeak();
      speak.setAttribute('aria-pressed', String(!!s.voice));
      speak.setAttribute('aria-label', UI.speak[l]); speak.title = UI.speak[l];
    }
    const readme = $('mcp-readme');
    if (readme) { readme.hidden = !this.story.canSpeak(); readme.setAttribute('aria-pressed', String(!!s.voice)); }
    d.sound.setAttribute('aria-label', UI.sound[l]);
    d.back.setAttribute('aria-label', UI.book[l]); d.back.title = UI.book[l];
    const full = $('mcp-full'), langs = document.querySelector('.mcp-langs');
    if (full) { full.setAttribute('aria-label', UI.full[l]); full.title = UI.full[l]; }
    if (langs) langs.setAttribute('aria-label', UI.language[l]);
    d.home.hidden = this.index <= 0; d.back.hidden = this.index > 0;
    d.top.classList.toggle('mcp-playing', this.index > 0);
    d.home.setAttribute('aria-label', UI.home[l]);
    d.flies.hidden = !(s.flies > 0); d.fliesN.textContent = String(s.flies || 0);
    d.resume.hidden = !(s.reached > 1);
    const intro = $('mcp-intro'), replay = $('mcp-replay');
    if (intro && replay) { intro.hidden = s.reached > 1; replay.hidden = !(s.reached > 1); }
    if (this.index > 0 && d.chapterName) d.chapterName.textContent = UI.scenes[this.index][l];
  }
  // a tiny tap on the fingertips (phones that support it)
  buzz(ms) { if (this.save.sound && !this.reduced && navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} } }
  catchFly(n) {
    this.save.flies = (this.save.flies || 0) + (n || 1); this.persist();
    this.dom.flies.hidden = false; this.dom.fliesN.textContent = String(this.save.flies);
    this.dom.flies.classList.remove('mcp-pop'); void this.dom.flies.offsetWidth; this.dom.flies.classList.add('mcp-pop');
  }

  // the caption's place follows the shape of the screen (see view.js)
  layout() { this.view.update(); this.dom.stage.classList.toggle('mcp-captop', this.view.captionTop); }

  // ── scene switching ──
  fade(on) {
    const f = this.dom.fade;
    f.classList.toggle('mcp-on', on);
    return new Promise((r) => setTimeout(r, this.params.has('fast') ? 30 : on ? 520 : 380));
  }
  // Between scenes the curtain carries the chapter: nine stars, the one we are at, and its name.
  chapter(i) {
    const d = this.dom, fast = this.params.has('fast');
    if (!d.chapter || i <= 0 || !UI.scenes[i]) return Promise.resolve();
    d.chapterName.textContent = UI.scenes[i][this.story.lang];
    const night = $('mcp-night'), stop = i >= 2 && !this.auto && !fast;     // between chapters a parent may call it a night
    if (night) night.hidden = !stop;
    d.chapterDots.querySelectorAll('i').forEach((el, k) => { el.className = k + 1 === i ? 'mcp-now' : this.save.done[k + 1] || k + 1 < i ? 'mcp-was' : ''; });
    d.chapter.classList.remove('mcp-show'); void d.chapter.offsetWidth; d.chapter.classList.add('mcp-show');
    if (!fast) this.audio.sfx.shimmer();
    this._chapterAt = performance.now();
    // (with the night button offered, the curtain stays long enough for a parent to see it: about 2.5 s fully shown)
    return new Promise((r) => {
      const done = () => { clearTimeout(tm); if (this._chapterSkip === done) this._chapterSkip = null; r(); };
      const tm = setTimeout(done, fast ? 30 : stop ? 3300 : this.reduced ? 1100 : 1650);
      this._chapterSkip = done;
      // asked for before the card was up (during the curtain's fade-in): a switch cuts at once, a tap lifts at 1.2 s
      if (this._queued !== undefined) done();
      else if (this._earlyTap) setTimeout(() => { if (this._chapterSkip === done) done(); }, fast ? 0 : 1200);
      this._earlyTap = false;
    });
  }
  async go(i) {
    if (i > 0 && !SCENES[i]) i = 0;
    if (this.switching) { this._queued = i; if (this._chapterSkip) this._chapterSkip(); return; }   // (a chapter card still up is cut short)
    this.switching = true; this._earlyTap = false; this._target = i;
    const token = ++this.runToken;
    if (this.scene) await this.fade(true); else this.dom.fade.classList.add('mcp-on');
    if (this.scene) { this.scene._abort(); this.scene = null; }
    freeSprites();                       // each scene paints its own props; don't let them pile up in memory
    this.story.clear(); this.audio.stopLoops(); this.audio.stopMusic(0.9); this.audio.setIntensity(1);
    this.dom.title.hidden = true; this.dom.end.hidden = true;
    this.dom.end.classList.remove('mcp-on'); this._endResolve = null; this.modal(false);   // (Escape may have left the end card half-open)
    this.view.resetSafe(); this.view.cam.x = 0; this.view.cam.y = 0; this.view.cam.zoom = 1;
    this.index = i;
    this.hintA = 0; this.autoHold = null; this.keyHeld = null; this.autoPaw = null;
    let Cls = StubScene;
    const file = i < 0 ? this.devScene : SCENES[i];
    const shown = this.chapter(i);
    try { Cls = (await import('./scenes/' + file + '.js')).default || StubScene; }
    catch (e) { console.error('magic-cats: could not load scene "' + file + '"', e); }
    await shown;
    if (this._queued !== undefined && token === this.runToken) {
      // somewhere else was asked for while the chapter card was up ("Good night", the house, a star): go
      // there straight from the curtain — not one frame of this chapter, not one note of its music
      const q = this._queued; this._queued = undefined;
      if (this.dom.chapter) this.dom.chapter.classList.remove('mcp-show');
      this.switching = false;
      return this.go(q);
    }
    let sc;
    try { sc = new Cls(this, i); } catch (e) { console.error('magic-cats: scene "' + file + '" failed to start', e); sc = new StubScene(this, i); }
    this.scene = sc;
    this.view.update();
    this.layout();
    this.updateHud();
    this.keepAwake(this.auto && i > 0);
    // fetch the scene that comes next while this one is being played, so the change is instant
    const ahead = i === 0 ? [1, this.save.reached] : i > 0 && i < 9 ? [i + 1] : [];
    setTimeout(() => { for (const n of ahead) if (SCENES[n]) import('./scenes/' + SCENES[n] + '.js').catch(() => {}); }, 2500);
    const running = (async () => { try { await sc.run(); return true; } catch (e) { if (e === ABORT) return false; console.error('magic-cats: scene error', e); return 'failed'; } })();   // (a failed chapter still moves on)
    await this.fade(false);
    if (this.dom.chapter) this.dom.chapter.classList.remove('mcp-show');
    this.switching = false;
    if (this._queued !== undefined) { const q = this._queued; this._queued = undefined; return this.go(q); }
    if (i === 0 && this._nightQueued) { this._nightQueued = false; this.doze(); }
    if (this._focusTitle) {
      this._focusTitle = false;
      const b = i === 0 ? (this.dom.resume.hidden ? this.dom.begin : this.dom.resume) : null;
      if (b && document.activeElement && (document.activeElement === document.body || !document.activeElement.offsetParent)) { try { b.focus({ preventScroll: true }); } catch (e) {} }
    }
    const ok = await running;
    if (ok && this.scene === sc && token === this.runToken) this.sceneDone(i);
  }
  sceneDone(i) {
    if (i <= 0) return;
    this.save.done[i] = true;
    this.save.reached = Math.max(this.save.reached, Math.min(9, i + 1));
    this.persist();
    this.updateHud();
    const star = this.dom.stars.querySelector('button[data-scene="' + i + '"]');
    if (star) { star.classList.remove('mcp-won'); void star.offsetWidth; star.classList.add('mcp-won'); }
    if (i < 9) this.audio.sfx.chime(5);
    const token = this.runToken;       // (…unless the player has gone somewhere else in the meantime)
    setTimeout(() => { if (token === this.runToken && !this.switching) this.go(i < 9 ? i + 1 : 0); }, this.params.has('fast') ? 30 : i < 9 ? 650 : 0);
  }
  // The last scene shows the closing card; resolves when "Play again" is pressed.
  endCard() {
    this._endAt = this.t;
    // the book is finished now, however the evening ends (Escape, "Read the book", closing the tab)
    if (!this.save.done[9]) { this.save.done[9] = true; this.persist(); this.updateHud(); }
    const tree = $('mcp-end-tree');
    if (tree) tree.hidden = !this.save.tree;
    this.audio.sfx.goodnight();
    this.keepAwake(false);
    this.dom.end.hidden = false;
    void this.dom.end.offsetWidth;
    this.dom.end.classList.add('mcp-on');
    this.modal(true);                                            // the card is the only thing to talk to now
    try { this.dom.again.focus({ preventScroll: true }); } catch (e) {}
    return new Promise((r) => { this._endResolve = () => { this.dom.end.classList.remove('mcp-on'); this.modal(false); this._endResolve = null; r(); }; });
  }
  // The end card is modal: everything else on the stage is inert (out of Tab's way and of screen readers),
  // the corner ▶ switch is hidden; when the card goes, focus goes to the title's first button (or nowhere in particular).
  modal(on) {
    const st = this.dom.stage;
    if (!!on === !!this._modal) return;
    this._modal = !!on;
    st.classList.toggle('mcp-modal', !!on);
    for (const el of st.children) if (el !== this.dom.end && el.tagName !== 'NOSCRIPT') el.inert = !!on;
    if (!on) this._focusTitle = true;
  }

  // ── watching: the story plays by itself, like a film ──
  // Whatever the scene expects (the same expectation that drives the paw hint and the Space key) is
  // simply done after the paw has shown it. A touch takes over at once, and somebody who is
  // playing along is given plenty of time before the cats carry on by themselves again.
  // The little button in the corner switches it on and off at any moment.
  setAuto(on) {
    if (!on && this.autoHold && this.scene && !this.switching) this.scene._up(this.pt(this.autoHold.p));   // a hold the paw was doing lets go
    if (on) { this.touchedAt = -99; this.watchedAt = this.t; }     // starting to watch: the cats need not wait for a player
    this.auto = !!on; this.autoHold = null;
    this.story.readK = on ? 1.6 : 1;                       // time to read every caption aloud
    this.dom.stage.classList.toggle('mcp-watching', this.auto);
    this.keepAwake(this.auto && this.index > 0);
    this.updateHud();
  }
  autoPlay(sc, dt) {
    if (this.switching || this._dragging || this.keyHeld) return;
    const h = this.autoHold;
    if (h) {                                               // holding: let go once it is done
      h.t += dt;
      const e = sc.currentExpect();
      const moved = e && e.kind === 'hold' && Math.hypot(e.x - h.p.x, e.y - h.p.y) > (e.r || 46);   // the next hold is somewhere else: let go here
      if (!e || e.kind !== 'hold' || moved || h.t > h.max) { this.autoHold = null; sc._up(this.pt(h.p)); }
      else this.showPaw(this.view.sx(h.p.x), this.view.sy(h.p.y));
      return;
    }
    if (sc._pointer) return;                               // a finger is on the screen: hands off
    const e = sc.currentExpect();
    if (!e || e.quiet) return;
    if (e.kind === 'continue') {
      if (sc.idle < 1.2 || this.story.speaking || performance.now() < this.story.shownAt + this.story.minRead * this.story.readK + 500) return;
      const p = { x: this.view.cam.x, y: this.view.cam.y - 100 };
      sc._down(this.pt(p)); sc._up(this.pt(p));
      return;
    }
    // (a run of the same gesture — seven stars, three saucers — goes a little quicker)
    const again = this.autoLast.kind === e.kind && this.t - this.autoLast.at < 5;
    const patience = this.t - this.touchedAt < 25 ? 6 : again ? 1.25 : 1.9;
    if (sc.idle < patience || this.hintA < 0.9) return;
    this.autoLast = { kind: e.kind, at: this.t };
    const p = { x: e.x, y: e.y };
    this.showPaw(this.view.sx(p.x), this.view.sy(p.y), 0.28);
    if (e.kind === 'tap') { sc._down(this.pt(p)); sc._up(this.pt(p)); }
    else if (e.kind === 'hold') { this.autoHold = { p, t: 0, max: (e.dur || 1) + 1.5 }; sc._down(this.pt(p)); }
    else if (e.kind === 'drag') this.autoDrag(sc, e, e.slow || 0.7);
  }

  // ── keyboard: Space / Enter does whatever the scene currently expects ──
  key(k, down) {
    const sc = this.scene;
    if (down && k === 'Escape' && this.switching && this._target > 0) { this.go(0); return true; }   // (during a chapter card: like the house button, it cuts the card)
    if (!sc || this.switching) return false;
    if (k === ' ' || k === 'Enter') {
      if (down) {
        this.unlock();
        const e = sc.currentExpect();
        if (!e) { if (sc.onKey) sc.onKey('action', true); return true; }
        if (e.kind === 'drag') { this.autoDrag(sc, e, e.slow ? e.slow * 0.6 : 0.35); return true; }
        const p = e.kind === 'continue' ? { x: this.view.cam.x, y: this.view.cam.y - 100 } : { x: e.x, y: e.y };
        this.keyHeld = p; sc._down(this.pt(p));
      } else if (this.keyHeld) { const p = this.keyHeld; this.keyHeld = null; sc._up(this.pt(p)); }
      return true;
    }
    if (down && (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowDown')) { if (sc.onKey) sc.onKey(k, true); return true; }
    if (down && k === 'Escape') { if (this.index > 0) this.go(0); return true; }
    if (down && (k === 'm' || k === 'M')) { this.dom.sound.click(); return true; }
    return false;
  }
  // A real finger comes down: whatever is being done for the player (a performed drag, a performed hold,
  // a Space key held down) lets go first, where it is — a dragged thing is dropped there and goes home by
  // the scene's own rules, a hold's progress is kept by holdOn while the finger's own press continues it —
  // and only then does the finger's touch reach the scene. (Never two pointers in one scene at once.)
  takeOver() {
    const sc = this.scene, live = sc && !sc.dead && !this.switching;
    if (this._dragging) {
      const d = this._drag;
      this._dragN = (this._dragN || 0) + 1;               // the drag's timer stops at its next tick
      this._dragging = false; this._drag = null;
      if (d && live && d.sc === sc) sc._up(d.at(d.px, d.py));
    }
    if (this.autoHold) { const h = this.autoHold; this.autoHold = null; if (live) sc._up(this.pt(h.p)); }
    if (this.keyHeld) { const p = this.keyHeld; this.keyHeld = null; if (live) sc._up(this.pt(p)); }
    this.autoPaw = null;
  }
  pt(p) { return { x: p.x, y: p.y, sx: this.view.sx(p.x), sy: this.view.sy(p.y), id: -1, t: performance.now() }; }
  // A drag performed for the player (Space key, watching): the pointer travels across the *screen*
  // as a finger would, towards wherever the thing may be dropped right now. An expectation may ask
  // for an unhurried gesture (`slow`: seconds) or a path of its own (`via(u)` → world point).
  autoDrag(sc, e, dur) {
    if (this._dragging) return;
    this._dragging = true;
    const v = this.view, at = (sx, sy) => { const w = v.toWorld(sx, sy); return { x: w.x, y: w.y, sx, sy, id: -1, t: performance.now() }; };
    const s0 = { x: v.sx(e.x), y: v.sy(e.y) };
    let s1 = { x: v.sx(e.x2), y: v.sy(e.y2) }, k = 0, px = s0.x, py = s0.y;
    const n = Math.max(8, Math.round(((dur || 0.35) * 1000) / 22)), id = (this._dragN = (this._dragN || 0) + 1);
    const d = this._drag = { sc, at, px, py };            // (where the paw is: takeOver() lets go there)
    sc._down(at(s0.x, s0.y));
    const tick = () => {
      if (id !== this._dragN) return;                      // a finger took over (takeOver has already let go)
      if (sc.dead || sc !== this.scene) { this._dragging = false; this._drag = null; return; }
      k++;
      const live = sc.currentExpect();
      if (live && live.kind === 'drag' && live.x2 !== undefined) s1 = { x: v.sx(live.x2), y: v.sy(live.y2) };
      const u = ease.inOutQuad(k / n);
      if (e.via) { const q = e.via(u); px = v.sx(q.x); py = v.sy(q.y); } else { px = lerp(s0.x, s1.x, u); py = lerp(s0.y, s1.y, u); }
      d.px = px; d.py = py;
      sc._move(at(px, py));
      this.showPaw(px, py);
      if (k < n) setTimeout(tick, 22); else { sc._up(at(px, py)); this._dragging = false; this._drag = null; }
    };
    setTimeout(tick, 22);
  }

  // ── loop ──
  frame(ts) {
    requestAnimationFrame(this._frame);
    const now = ts / 1000;
    // (story time keeps pace with the clock down to ~8 fps: tick() sub-steps the update, ≤ 0.034 s a step;
    // only a longer stall — a debugger, a frozen tab — is cut short)
    const dt = this.last ? Math.min(0.12, now - this.last) : 0.016;
    this.last = now;
    if (this.manual) return;             // tests step the clock themselves (see __mc.step)
    this.tick(dt);
  }
  tick(dt) {
    if (this.paused || !this.scene) return;
    this.fps = lerp(this.fps, 1 / Math.max(dt, 0.001), 0.05);
    // If the device cannot keep up, paint fewer pixels rather than drop frames (never raised again).
    if (!this.switching && this.fps < 26) this.lowT = (this.lowT || 0) + dt; else this.lowT = Math.max(0, (this.lowT || 0) - dt * 2);
    if (this.lowT > 3 && this.view.maxPx > 1.1e6) {
      this.lowT = 0; this.view.maxPx *= 0.62; this.view.resize();
      if (this.scene && this.scene.onResize) this.scene.onResize();
    }
    dt *= this.speed;
    this.t += dt;
    const sc = this.scene, ctx = this.view.ctx, view = this.view;
    // no single step longer than ~1/30 s: the springs (util.js spring) go unstable on long steps — a slow frame times ?speed
    const n = Math.max(1, Math.ceil(dt / 0.034)), h = dt / n;
    try { for (let i = 0; i < n; i++) sc._step(h); this._stepErr = 0; }
    catch (e) { if (!this._stepErr) console.error('magic-cats: update error', e); this._stepErr = (this._stepErr || 0) + 1; if (this._stepErr > 40) this.letGo(sc); }
    if ((this.auto && !this.dozing) || this.autoHold) this.autoPlay(sc, dt);
    this.watchSleep();
    view.update();
    ctx.save();
    view.apply(ctx);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    try { sc.draw(ctx, view, sc.t); this._drawErr = 0; }
    catch (e) { if (!this._drawErr) console.error('magic-cats: draw error', e); this._drawErr = (this._drawErr || 0) + 1; if (this._drawErr > 40) this.letGo(sc); }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    this.drawHint(ctx, sc, dt);
    this.drawTaps(ctx, dt);
    this.drawAutoPaw(ctx);
    if (sc.drawOver) { view.apply(ctx); try { sc.drawOver(ctx, view, sc.t); } catch (e) { if (!this._drawErr) { this._drawErr = true; console.error(e); } } }
    ctx.restore();
  }

  // A chapter that keeps failing (an error in every frame) is let go of: the story moves on rather than freezing.
  letGo(sc) {
    this._stepErr = 0; this._drawErr = 0;
    if (sc._letGo || this.switching || sc !== this.scene || this.index <= 0) return;
    sc._letGo = true;
    console.error('magic-cats: leaving the chapter after repeated errors');
    sc._abort(); this.scene = sc; this.sceneDone(this.index);
  }
  // Every touch leaves a small chalk ripple: even a stray little finger gets an answer.
  tap(p) { if (this.reduced || this.switching) return; this.taps.push({ x: p.sx, y: p.sy, t: 0, seed: (Math.random() * 1e4) | 0 }); if (this.taps.length > 6) this.taps.shift(); }
  drawTaps(ctx, dt) {
    if (!this.taps.length) return;
    this.view.screen(ctx);
    for (let i = this.taps.length - 1; i >= 0; i--) {
      const q = this.taps[i];
      q.t += dt;
      const u = q.t / 0.5;
      if (u >= 1) { this.taps.splice(i, 1); continue; }
      const r = 7 + 24 * ease.outCubic(u), pts = [];
      for (let k = 0; k <= 14; k++) pts.push([q.x + Math.cos((k / 14) * TAU) * r, q.y + Math.sin((k / 14) * TAU) * r]);
      chalk(ctx, pts, { width: 2.2, alpha: 0.65 * (1 - u), color: '#fff7d6', seed: q.seed });
    }
  }

  // Pulsing chalk ring + a little paw that shows the gesture, once the player has been idle a moment.
  drawHint(ctx, sc, dt) {
    const e = sc.currentExpect(), view = this.view;
    // The hint starts afresh when the gesture or its words change, or when the target has moved far
    // (a new thing to point at) — not while a house drifts on its cloud or a letter sways: the paw reads
    // the live position every frame anyway, so it keeps tracking and still gets to press and slide.
    const text = e && e.text ? this.story.t(e.text) : '';
    const key = e ? e.kind + ':' + text : '';
    const far = e && e.x !== undefined && this.hintAt && Math.hypot(e.x - this.hintAt.x, e.y - this.hintAt.y) > 220;
    if (key !== this.hintKey || far) {
      this.hintKey = key; this.hintT = 0; this.hintAt = e && e.x !== undefined ? { x: e.x, y: e.y } : null;
      this.story.hint(e && e.text ? e.text : null);
    }
    if (e && e.kind === 'continue') {
      // nothing to point at — but if nobody taps for a while, say what to do
      const want = sc.idle > Math.max(4, (this.story.minRead * this.story.readK) / 1000 + 2) && !this.auto;
      if (want !== this._goOn) { this._goOn = want; this.story.hint(want ? UI.goOn : null); }
    } else this._goOn = false;
    // (while the paw is doing a gesture for the player, the hint stands aside: one paw at a time; it comes back
    // when the performed gesture is over and something is still expected — autoPlay waits for it)
    if (!e || e.kind === 'continue' || e.quiet || this._dragging || this.autoHold) { this.hintA = approach(this.hintA, 0, 8, dt); return; }
    const delay = this.auto && this.t - this.touchedAt > 25 ? 0.45 : e.delay !== undefined ? e.delay
      : !this.seenKinds[e.kind] && this.index <= 2 ? 0.5 : this.seenKinds[e.kind] > 2 ? 3.2 : 1.1;   // a brand-new gesture in the first chapters is shown almost at once
    this.hintA = approach(this.hintA, sc.idle > delay ? 1 : 0, sc.idle > delay ? 4 : 10, dt);
    if (this.hintA < 0.02) { this.hintT = 0; return; }
    this.hintT += dt;
    const a = this.hintA, T = this.hintT;
    view.screen(ctx);
    const x = view.sx(e.x), y = view.sy(e.y), r = Math.max(22, (e.r || 40) * view.scale * 0.8);
    const ring = (rx, ry, rr, al) => {
      const pts = [];
      for (let i = 0; i <= 26; i++) pts.push([rx + Math.cos(i / 26 * TAU + T * 0.6) * rr, ry + Math.sin(i / 26 * TAU + T * 0.6) * rr]);
      chalk(ctx, pts, { width: 2.4, alpha: al, color: '#fff3b8', seed: Math.floor(T * 6) });
    };
    let px = x, py = y, press = 0;
    if (e.kind === 'tap') { const c = (T % 1.4) / 1.4; press = c > 0.55 && c < 0.8 ? 1 : 0; ring(x, y, r * (1 + 0.08 * Math.sin(T * 5)), 0.8 * a); }
    else if (e.kind === 'hold') {
      const c = (T % 2.6) / 2.6; press = c > 0.15 && c < 0.9 ? 1 : 0;
      ring(x, y, r, 0.5 * a);
      if (press) { ctx.beginPath(); ctx.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01((c - 0.15) / 0.7)); ctx.strokeStyle = 'rgba(255,227,110,' + (0.9 * a).toFixed(2) + ')'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke(); }
    } else if (e.kind === 'drag') {
      const x2 = view.sx(e.x2), y2 = view.sy(e.y2), c = (T % 2.4) / 2.4, u = ease.inOutQuad(clamp01((c - 0.2) / 0.55));
      press = c > 0.12 && c < 0.85 ? 1 : 0; px = lerp(x, x2, u); py = lerp(y, y2, u);
      ring(x2, y2, Math.max(20, r * 0.8), 0.7 * a);
      const pts = []; for (let i = 0; i <= 12; i++) pts.push([lerp(x, x2, i / 12), lerp(y, y2, i / 12) - Math.sin(i / 12 * Math.PI) * 14]);
      ctx.setLineDash([3, 9]); chalk(ctx, pts, { width: 2, alpha: 0.5 * a, color: '#fff3b8', rough: 0 }); ctx.setLineDash([]);
    }
    this.paw(ctx, px, py, press, a);
  }
  // the little paw that points (screen px; its toes touch the spot)
  paw(ctx, px, py, press, a) {
    const s = (press ? 0.86 : 1) * Math.max(0.8, Math.min(1.25, this.view.W / 900 + 0.55));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(px + 16 * s, py + 22 * s + (press ? 0 : -7));
    ctx.rotate(-0.3); ctx.scale(s, s);
    ctx.fillStyle = '#fbfbf6'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.ellipse(0, 6, 11, 9.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (const [tx, ty] of [[-11, -6], [-4, -11.5], [4, -11.5], [11, -6]]) { ctx.beginPath(); ctx.ellipse(tx, ty, 4.2, 5.2, tx * 0.03, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#f3a9b8'; ctx.beginPath(); ctx.ellipse(0, 7, 5.5, 4.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // …and while something is being done for the player (watching, the Space key), the paw is seen doing it
  showPaw(sx, sy, secs) { this.autoPaw = { x: sx, y: sy, until: this.t + (secs || 0.15) * this.speed }; }
  drawAutoPaw(ctx) {
    const q = this.autoPaw;
    if (!q) return;
    const left = q.until - this.t;
    if (left <= -0.2 * this.speed) { this.autoPaw = null; return; }
    this.view.screen(ctx);
    this.paw(ctx, q.x, q.y, left > 0 ? 1 : 0, left > 0 ? 1 : clamp01(1 + left / (0.2 * this.speed)));
  }
}

const game = new Game();
// Debug / test hooks (read-mostly).
window.__mc = {
  game,
  state: () => {
    const sc = game.scene, e = sc && !game.switching ? sc.currentExpect() : null, v = game.view;
    return {
      scene: game.index, name: SCENES[game.index] || game.devScene, t: sc ? +sc.t.toFixed(2) : 0, switching: game.switching, fps: Math.round(game.fps),
      caption: game.story.caption(), done: game.save.done.slice(), reached: game.save.reached, end: !game.dom.end.hidden, title: !game.dom.title.hidden,
      expect: e ? { kind: e.kind, x: e.x === undefined ? null : Math.round(v.sx(e.x)), y: e.y === undefined ? null : Math.round(v.sy(e.y)), x2: e.x2 === undefined ? null : Math.round(v.sx(e.x2)), y2: e.y2 === undefined ? null : Math.round(v.sy(e.y2)), dur: e.dur || 0 } : null
    };
  },
  go: (i) => game.go(i),
  // deterministic clock for filmstrips: __mc.manual(true), then __mc.step(1 / 30) per frame
  manual: (on) => { game.manual = !!on; game.last = 0; },
  step: (dt, n) => { for (let i = 0; i < (n || 1); i++) game.tick(dt || 1 / 60); },
  skip: () => { const sc = game.scene; if (sc && game.index > 0) { sc._abort(); game.scene = sc; game.sceneDone(game.index); } }
};
game.boot();

export { game };
