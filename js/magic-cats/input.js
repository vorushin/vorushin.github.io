// Magic cats — pointer + keyboard input, translated to world coordinates.
//
// One pointer is followed at a time (`active`). A second finger that comes down takes over — the old
// pointer gets its `up` where it last was, then the new one's `down` — unless the first is in the
// middle of something: a hold or a drag the scene says lasts (`h.busy()`), or it has moved more than
// MOVED px within the last BUSY_MS (a stroke, a pan, a swipe). So a thumb resting on the screen (the hand
// that holds the phone) never blocks the other hand, quick taps with two fingers in turn all count, and a
// palm or a stray finger cannot break a drag, a hold or a drawn stroke. Events of a pointer that was taken
// over from are ignored.
// A touch that is not busy and has rested still for REST_MS is let go of as well (the scene gets its `up`
// there, as for a tap): a thumb that holds the phone must not keep a press open for ever — the paw can play
// on, "tap to go on" turns the page. The let-go finger is then ignored until it lifts.

// A let-go finger that then moves decidedly (more than WAKE px within BUSY_MS) is alive again — a child who
// hesitated before a stroke or a swipe — and becomes a new press from where the movement began, as long
// as no other finger is active and the story is not playing by itself. A thumb that only creeps stays let go.

const MOVED = 12, BUSY_MS = 500, REST_MS = 3000, WAKE = 24;

export class Input {
  constructor(el, view, h) {
    this.el = el; this.view = view; this.h = h;
    this.active = null;       // id of the pointer we follow
    this.pos = null;          // last pointer position (world), for hover effects
    this.last = null;         // last position of the active pointer
    this._ref = { x: 0, y: 0 }; this._movedAt = -1e9;     // (screen px; when the active pointer last moved more than MOVED)
    this.dropped = new Set();  // pointers let go of (taken over from, or rested): ignored until they lift
    this._restT = 0;
    const letGo = () => {      // the active press has rested: end it where it is, unless it is busy
      this._restT = 0;
      if (this.active === null) return;
      const now = performance.now(), quiet = now - Math.max(this._movedAt, this._downAt);
      if ((h.busy && h.busy()) || quiet < REST_MS - 30) { this._restT = setTimeout(letGo, Math.max(200, REST_MS - quiet)); return; }
      const old = this.last;
      this.dropped.add(this.active);
      if (old) this.rested.set(this.active, { sx: old.sx, sy: old.sy, t: now });    // (it may wake up again: see pointermove)
      this.active = null; this.last = null;
      if (old) h.up(Object.assign({}, old, { t: now }));
    };
    this.rested = new Map();   // let-go (rested) pointers: where their latest movement began {sx, sy, t}
    this._arm = () => { clearTimeout(this._restT); this._restT = setTimeout(letGo, REST_MS); };
    const pt = (e) => {
      const r = el.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, w = view.toWorld(sx, sy);
      return { x: w.x, y: w.y, sx, sy, id: e.pointerId, t: performance.now() };
    };
    const start = (e, p) => {
      this.active = e.pointerId; this.last = p; this.dropped.delete(e.pointerId); this.rested.delete(e.pointerId);
      this._ref.x = p.sx; this._ref.y = p.sy; this._movedAt = -1e9; this._downAt = p.t;
      if (e.pointerType !== 'mouse') this._arm(); else clearTimeout(this._restT);     // (a mouse button is held on purpose)
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      h.down(p);
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.active === e.pointerId) return;
      const p = pt(e);
      if (this.active !== null) {
        const now = performance.now();
        if ((h.busy && h.busy()) || now - this._movedAt < BUSY_MS) return;     // the first finger is in the middle of something
        const old = this.last;                                                   // take over: the old press ends where it was
        this.dropped.add(this.active); this.active = null;
        if (old) h.up(Object.assign({}, old, { t: now }));
      }
      e.preventDefault();
      this.pos = p;
      start(e, p);
    });
    el.addEventListener('pointermove', (e) => {
      const p = pt(e);
      if (this.active === e.pointerId) {
        this.pos = p; this.last = p;
        if (Math.hypot(p.sx - this._ref.x, p.sy - this._ref.y) > MOVED) { this._ref.x = p.sx; this._ref.y = p.sy; this._movedAt = p.t; }
        h.move(p);
      } else if (this.rested.has(e.pointerId)) {
        const q = this.rested.get(e.pointerId);
        if (p.t - q.t > BUSY_MS) { q.sx = p.sx; q.sy = p.sy; q.t = p.t; return; }                 // (slow: the window starts again here)
        const watching = !!(el.closest && el.closest('.mcp-watching'));
        if (this.active !== null || watching || Math.hypot(p.sx - q.sx, p.sy - q.sy) <= WAKE) return;
        // alive again: a new press where this movement began, then the move to here
        const w = view.toWorld(q.sx, q.sy), p0 = { x: w.x, y: w.y, sx: q.sx, sy: q.sy, id: e.pointerId, t: p.t };
        this.pos = p0;
        start(e, p0);
        this.pos = p; this.last = p; this._ref.x = p.sx; this._ref.y = p.sy; this._movedAt = p.t;
        h.move(p);
      } else if (this.active === null && !this.dropped.has(e.pointerId)) { this.pos = p; if (h.hover) h.hover(p); }
    });
    const end = (e) => {
      this.rested.delete(e.pointerId);
      if (this.dropped.delete(e.pointerId)) return;
      if (this.active !== e.pointerId) return;
      this.active = null; this.last = null; clearTimeout(this._restT);
      h.up(pt(e));
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if ((tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') && e.key !== 'Escape') return;   // (Space / Enter belong to the focused button; Escape always reaches the game)
      if (h.key && h.key(e.key, true)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { if (h.key) h.key(e.key, false); });
  }
}
