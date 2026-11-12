# Magic Cats, pass 4 — the characters come alive

Date: 2026-11-11. Owner: Roman. Art direction and orchestration: Claude (Fable); implementation: Opus subagents.

Roman's request: "Further improve the magic cats page and the game. […] Consider using blender or
other similar tools to create more realistic characters and animations if needed."

## 1. What is wrong today (looked at, not guessed)

Screenshots and frame-by-frame filmstrips of all nine scenes at 1280×800, 390×844 and 844×390:

- The scenery, the sky, the sound design hooks, the pacing tools are in good shape. **The characters
  are the weakest part of the picture.** A cat is an ellipse with a round sticker face that always
  looks at the viewer, four straight tubes for legs and separate outlines around every part, so it
  reads as "assembled from parts". It never turns its head towards where it is going. Walking is two
  pairs of tubes swinging at a fixed rate that has nothing to do with the speed the cat is moved at
  (feet slide). Sitting is a bowling pin. Changing pose is a pop with a squash, not a movement.
- People are peg dolls: a circle, a trapezoid, straight tubes for limbs, no hands, no knees.
- **The characters are tiny on the screen.** The camera always frames a 640-unit-wide, 500-unit-tall
  "safe box" down to the ground. On a landscape phone a cat is ~29 CSS px long, on an upright phone
  ~40 px, on a laptop ~66 px. The key moments of the story (the kitten lapping moon milk, the bundle
  handed through the window) happen in a few dozen pixels. On an upright phone more than half of the
  screen is empty sky.
- Nothing was ever run outside headless Chrome.

## 2. Goals

1. **Cats that look drawn and move like cats** — a new articulated rig: one silhouette, a head that
   turns, real leg anatomy, a gait whose feet stay planted, leaps with anticipation and a
   front-paws-first landing, poses that are moved into, small feline acting.
2. **People and birds brought up to the same level.**
3. **A camera that looks at the characters**: a framing helper, and each scene directed with it
   (establishing shot, then closer shots at the moments that matter), on all three screen shapes.
4. **An acting pass over every scene** using the above, plus the pacing fixes left over from pass 3.
5. **Works in WebKit and Firefox**, verified by running it there.

Non-goals: rewording any story text; changing the sound engine (nobody has heard it yet — Roman's
ears are the test); new chapters; a build step or dependencies; committing or pushing.

Anti-goals (would make this a failure even if it "works"): characters that are more detailed but
less charming; a look that no longer belongs to the book's naive gouache-and-ink pictures; motion
that pops, slides or jitters; anything a small child can no longer tap; a heavier, slower game on
phones.

## 3. Blender: considered, not used for the game's characters

Blender is available here (`bpy` 5.3 installs from PyPI for Python 3.13 on this Mac), so this is a
judgement, not a constraint:

- The cats' motion is computed live: every leap goes to a different perch at a different distance
  and height, the walk follows whatever path a scene gives, eyes follow the finger, bundles swing
  with the real velocity, a held finger grows a crouch. Pre-rendered clips cannot adapt to any of
  that; the result would look *less* alive, not more.
- Four cats × ~20 actions × enough frames at retina size is tens of megabytes decoded on a phone,
  for a game that today downloads no art at all and paints crisp at any size.
- A toon-rendered 3D figure next to flat crayon scenery is a second art style in the same picture.
- What Blender would really buy — consistent volumes and good motion — comes from the *rig and the
  animation craft*, and both can be had in the game's own medium: a 2.5D vector rig with proper
  anatomy and a procedural gait, inked in the book's line.

If Roman still wants to see a Blender-rendered variant, the cleanest experiment is a pre-rendered
sprite cat behind the same `Cat` API; the lab (below) would show both side by side.

## 4. Ground rules for every workstream

- Story text in `_data/magic_cats.yml` is never reworded; beat markers stay where they are unless a
  scene needs one moved (then `ruby _tools/magic_cats_check.rb`).
- Plain ES modules, no dependencies, no build step, nothing sampled. `img/magic-cats/` filenames
  are a contract.
- Every required interaction stays an *expectation* (`currentExpect()`): the paw hint, the Space
  key, "watch the story" and the test tours all live off it. A target the player must touch must be
  on the screen and at least ~26 px in radius.
- `prefers-reduced-motion`: no fidgeting, no line boil, no camera moves beyond cuts/short eases.
- Performance: no scene may cost noticeably more per frame than before (compare with the baseline
  checkout using `perf.js`; budget +15 % in the heaviest scene).
- The tree is uncommitted on purpose. No git command that changes state. Never push.
- Look at what you make. The art director reviews images: sheets and filmstrips from the lab,
  screenshots from the tours.

## 5. Workstreams

### 5.1 Split and lab (done first)

`actors.js` becomes a hub re-exporting `cat.js`, `people.js`, `birds.js`, `bundle.js`. Dev scenes
`lab-cat`, `lab-people`, `lab-birds` (on a small `lab.js` base) show any pose as a *sheet* and any
action as a deterministic *clip*; `book_cats/tools/lab.js` captures them as PNG sheets and
filmstrips. Reference captures of the old characters: `<scratch>/lab-before/`.

### 5.2 Cat rig v2 (`js/magic-cats/cat.js`)

**Look.** Still the book's cat: flat gouache colours, a plum ink line with a slow boil, big eyes,
simple shapes that read at 30 px. But drawn as *one animal*:

- *One silhouette.* Parts that belong together are stroked first (ink, double width) and then all
  filled, so the outline runs round the union — no line where the leg joins the body, the neck the
  head. Inner contour lines only where a draughtsman would put them (near legs over the body, the
  haunch curve, the far ear).
- *Anatomy* (papa, size 1, feet at y = 0, facing +x; a starting point to be tuned by eye):
  trunk about 50 long and 24–26 deep, chest deeper than the waist, a tucked-up belly line, the
  rump rounded; hip joint near (−17, −28), shoulder joint near (14, −27); back line ~−41, withers
  slightly higher. Hind leg in three bones with the *hock* (the backward-pointing joint) clearly
  visible: hip → stifle (forward-down) → hock (back-down) → paw; the thigh a broad mass that is part
  of the body silhouette. Foreleg: shoulder → elbow (close to the chest line, pointing back) →
  wrist → paw, the forearm nearly straight when standing. Round paws with a toe line. Far-side legs
  darker and slightly offset. Legs noticeably longer and the trunk slimmer than today (a cat, not a
  plush toy); the kitten keeps short legs, a big head, big paws.
- *Head*, 2.5D: a `turn` from profile (looking where the body faces) through three-quarters to full
  face and on to looking back over the shoulder. Skull, cheek ruff, a short muzzle that protrudes in
  profile, ears with depth (the far ear narrower and behind), features that slide across the skull
  with the turn and foreshorten; a `nod` (up/down) and a `tilt` (roll). Default idle ≈ three-quarters
  towards the viewer; walking and leaping ≈ looking ahead; `look` targets and the pointer steer it.
- *Eyes*: large, dark and glossy at small sizes; an iris ring by kind (papa green-gold, kitten
  kitten-blue, mama amber, the night cat gold) and pupils that widen at night and when excited,
  narrower by day; lids for blink, slow blink, sleepy, happy arcs, closed.
- *Coat*: papa a silver-lilac tabby (back stripes that bend with the body, tail rings, leg bars,
  the "M" on the brow, white muzzle, bib and mittens); the kitten ginger tabby; mama cream-white
  with soft points; the night cat dark plum with a paler muzzle. Existing palettes in `CAT_KINDS`
  are the base; `o.colors` overrides must keep working.
- *Tail*: a tapering chain with spring lag; up with a hooked tip when content, streaming in a leap,
  wrapped round the feet when sitting, low and twitching in a crouch.
- A small contact shadow under the feet; optionally a pale moon rim at night (cheap, clipped).

**Motion.**

- *Pose blending*: `mode` ('stand' | 'sit' | 'curl' | 'upright'), `crouch`, `headDown` and the idle
  acts are targets; the skeleton moves into them (rear end first when sitting down, front first
  when getting up), never pops. The old squash-pop goes.
- *Gait*: phase advances with the distance actually travelled (stride length from leg length), so
  feet do not slide whatever speed a scene tweens the cat at. Lateral-sequence walk (LH, LF, RH, RF
  a quarter apart, duty ≈ 0.65, each foot planted through stance, lifted and carried through swing
  with the paw trailing); above walking speed a trot (diagonal pairs, a little bounce), and for the
  kitten a scampering bound. Body: small bob twice per stride, shoulder blade of the weight-bearing
  foreleg rising above the back line, head counter-nodding, tail swaying with lag. Starting and
  stopping finish the step and gather the feet under the body. `walking` stays as the scenes'
  switch; `walk` (phase) is still accepted but distance wins when the cat moves.
- *Leap*: gather (weight back, butt wiggle when held), launch off the hind legs along the take-off
  direction, forelegs tucked then reaching, full stretch near the top, hind legs brought forward for
  the landing, forepaws touch first, the spine and legs absorb, the tail whips for balance; the head
  looks at the landing point throughout. Short hops stay compact. `leapTo()`, `jump`, `air`,
  `pitch`, `land()`, `hopInPlace()` keep their contracts (duration returned, `done` callback).
- *Turning round*: the body foreshortens through the turn while the head passes through full face,
  instead of the whole cat flipping flat.
- *Acting*: looks about (head turns, not only pupils), ear flicks and swivels, slow blink, yawn
  with tongue, licking a paw, a play-bow stretch, kneading, the kitten's pounce; sits down by itself
  where a scene allows (`idleSit`); `meow()`; lapping with a tongue; purring squint when petted.
  A public `act(kind)` so scenes and the lab can ask for one. `Cat.still` switches fidgeting off.
- *Upright mode* (the dream garden): a proper little biped — torso, two hind legs that walk, arms
  that swing or gesture, the bindle over the shoulder; anchors exported for scarf, bow, apron,
  flower (`garden-art.js` draws these today at hard-coded offsets through `cat.frame(ctx)`).

**Contract.** Everything scenes use today keeps working: constructor options, `x y dir size mode
crouch air pitch headDown walk walking eyes look carry bundleSize bindle glowing tongue hidden
fidget idleSit sq jump c`, `leapTo land hopInPlace meow wake frame update draw`, `Cat.still`,
`Cat.onAct`, `CAT_KINDS`, growing a kitten by changing `c.head`/`c.leg`/`size`. New: `anchor(name)`
→ world point for `mouth`, `headTop`, `nose`, `neck`, `back`, `pawFront`, `hand` (upright), and
`act(kind)`. Bounding dimensions stay close to today's so that perches, sills (46 units wide),
hearts, bundles and hit areas still fit.

**Stages**, each ending with images for review: (A) design — pose sheet for the four kinds, incl.
tiny sizes; (B) motion — clips: walk, trot, leap far/up/down, hop, sit, curl, drink, turn, idle
acts, carry, upright walk, follow; (C) integration — the nine scenes play, couplings fixed, pops
and performance checked.

### 5.3 People v2 (`js/magic-cats/people.js`)

The book's children (the pigtailed girl in the window, the boy with spiky hair reading in the
tree), drawn as children rather than pegs: a head with a chin, ears, hair with shape, brows, eyes
that blink and look, a mouth that smiles, sings, yawns; a neck and shoulders; arms with elbows and
mitten hands; legs with knees and shoes; clothes with one or two details. Head `turn` like the
cats'. Grown-ups (papa, mama, grandma with her bun, grandpa with his cap) are taller and look
their age. Poses are moved into. Acting: wave from the elbow, cheer, lean on the sill, read (eyes
travel, a page turns), fall asleep on folded arms, yawn and rub an eye, walk with arms swinging,
sit with legs dangling, hang from the rope-slide belt with the body trailing behind the speed,
lie in a hammock breathing. `Kid`'s API (`kind colors x y size dir mood pose look walk joy hidden`,
`cheer update drawBust drawFull`) is kept; a `drawHead`-level helper is exported so scenes that
paint their own people (the bedroom) can match.

### 5.4 Birds v2 (`js/magic-cats/birds.js`)

Songbirds with a body, a head that turns, a wing that folds; a flap cycle with the body bobbing,
a swooping flight path with a flared landing, hops, pecking, preening, singing with the beak open
and the throat puffed. Butterflies and fireflies with less mechanical paths. API kept.

### 5.5 Director's camera (`scene.js`, `view.js`, `paint.js`)

- `shotFor(box, o)` → the camera `{x, y, zoom}` that shows a world box as large as possible in the
  free part of the screen (below the bar and a top caption, above a bottom caption or hint line);
  `shot(box, dur, o)` eases there; `track(fn)` follows a moving box with damping and a dead zone so
  the zoom does not breathe. Zoom limits, optional ground anchoring, reduced-motion cuts.
- Sprite resolution follows the largest scale the device will show (trees and houses must not turn
  to mush next to crisp cats), within a memory budget; the cached sky/far layers are verified under
  zoom.
- Nothing changes for a scene that does not call it. Reference adoption: `treetops`.

### 5.6 Scene acting and camera passes (one agent per scene or pair of scenes)

For each scene: open wide, then direct — closer shots where the story has a moment; the cats look
at what matters, walk at a walking pace, sit and get up, carry and hand over the bundle like cats;
children react. Check every expectation is reachable in every shot on all three screen shapes.
Pass-3 leftovers go here: a shorter kitten chapter (it has ~27 gestures), forgiving saucer drops.

### 5.7 Other engines

Playwright WebKit and Firefox against the baseline, then again against the result; fixes.

### 5.8 Wrap-up

Reading page: the little cats of the "delivery round", the invitation window and "The End" follow
the new design where it shows. New social card. `CLAUDE.md`, the tools README and the memory notes
updated. Full verification: tours in three viewports × three languages, keys, watch, pops,
canvases, layers, perf, both extra engines.

## 6. What happened (written at the end of the day)

**Built as designed:** 5.1–5.5 (the split and the lab; the cat, people and bird rigs on a shared
`rig.js`; the director's camera with `shotFor` / `shot` / `track`, sprite resolution per device and,
later, `view.closeK` for phones held sideways), 5.6 for all nine scenes and the title (the kitten
chapter went from 27 to 17 gestures; saucer drops are forgiving), 5.7 (Playwright WebKit and Firefox:
an audio suspend/resume race, the stereo bus, a Firefox-only grain rule, conditional modulepreload,
a sub-stepped update), 5.8 (the page's cats redrawn; this document; `CLAUDE.md`; the tools README).

**Not in the design, and the larger half of the day: review.** With everything merged and every
scripted tour passing, three find-only reviewers played each scene as a hesitant child, as a quick
one and in "watch the story", on an upright phone, a phone held sideways and a laptop. They found no
story-breaking defect and well over a hundred visible ones that no tour can see:

- characters standing inside each other (a rider landing in the waiting child, the kitten in Papa,
  town cats in a heap), heroes hidden behind extras;
- the zoom "breathing" on a landscape phone wherever a frame box changed with an expectation;
- things cut in half by a screen edge or lying under the caption, the hint line or the star bar;
- positions assigned without a movement (a follower overtaken by the leader), a pose and a position
  changing in different ticks (one frame 60 units off at every rope grab and landing), a hop racing a
  follow on slow frames;
- a brown rectangle painted over the girl who hugs the tree (and, behind it, a `ctx.save()` leaked
  every frame); a look-around that needed two swipes after the camera came closer;
- in the shell: a resting thumb blocking every other touch, buttons deaf to a second finger, "Good
  night" starting the next chapter for 0.7 s, the ninth star never earned without "Play again";
- on the reading page: pictures missing in print, six nearly empty printed pages, the RU button off
  the bar at 320 px, the angel as a dark ghost on the night page.

Each scene then went through one to seven fix rounds, each re-checked on the final file. The rules
that came out of it are in `CLAUDE.md` under "The director's camera".

**Left in on purpose** (Roman froze scene 9 in the evening): on slow frames the kitten pops about 59
units after its hop at the start of the tale-picking; on the phone the kitten at the basket is out of
the picture while Papa is at the far right tale. Smaller accepted items are listed in the reviewers'
reports (`book_cats/pass4/reports/`).

**The morning after** (12 November, after the first push): two of the known defects were fixed. The
kitten's pop: the hop round Papa switched between two targets, a snapshot and the live spot, and a
long frame could flip the choice; it now always aims at the live spot, and a change of lane waits for
a hop to finish (seven slowed runs clean; the shipped version popped in one of three). And in scene 5
on a landscape phone the first branch of the climb lay under a chapter star for ten frames while the
camera left the ground shot; it is now offered once it is in the picture.

**Still unverified:** the sound by ear; any real phone or tablet (the iPhone's silent switch, real
two-hand touch, frame rate on a slow device); a real print dialog.
