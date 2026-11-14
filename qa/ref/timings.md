# Reference timings — https://normalisboring.es/ (theme normalisboring25 v905)

Extracted from the live bundles (checked 2026-11-13):
- wp-content/themes/normalisboring25/js/scroll.js?ver=621
- wp-content/themes/normalisboring25/js/main.js?ver=701
- wp-content/themes/normalisboring25/js/root.js?ver=380
- wp-content/themes/normalisboring25/js/rollovers.js?ver=783
- wp-content/themes/normalisboring25/css/main.css?ver=905
- GSAP 3.12.7, ScrollTrigger 3.12.7, SplitText, Lenis 1.3.1

## Smoothing used by the reference
- Lenis (`new Lenis()` defaults: lerp 0.1, smoothWheel true, wheelMultiplier 1)
  wired into GSAP's ticker: `gsap.ticker.add(t => lenis.raf(t*1000))`,
  `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.lagSmoothing(0)`.
- ScrollSmoother is loaded but never instantiated (ScrollSmoother.get() ->
  null). Lenis does the smoothing.
- `lenisStop = true` -> Lenis starts only after the intro timeline completes
  (restInit -> lenis.start()).

## Main horizontal track (scroll.js `setScrollH`)
- `scroll_tl = gsap.timeline({paused:true})`
- `scroll_tl.to(sections, {x: (scrollH_width - adjust_width) * -1, duration:100, ease:"none"})`
  where sections = `.mod-scroll > div` (all slides), scrollH_width = .mod-scroll
  offsetWidth, adjust_width = 0.2 * innerWidth when a `.last-item` exists
  (else 1.2 * innerWidth).
- Trigger: `ScrollTrigger.create({animation: scroll_tl, trigger: scrollH,
  pin: "main", scrub: 1, start: "top top", end: "+=" + (scrollH_width*100/innerWidth) + "%"})`
- So vertical scroll distance = scrollH_width*100/innerWidth (% of viewport).
- Speed: horizontal travel is linear (ease none, duration 100) over the whole
  pinned range.

## VALUES (`.mod-scroll__terms`)
- Wrapper width is FIXED by JS at build time: `gsap.set(elem, {width: elem.offsetWidth})`.
- Timeline (scrub 1, start "0% 100%", end "100% 0%", containerAnimation: scroll_tl):
  - terms[0] paddingLeft -> 12vw
  - terms[1] paddingRight -> 3vw
  - terms[1] .mod-scroll__terms__term__text marginRight -> 3vw
  - terms[2] paddingLeft -> 20vw
  - All four at position 0 (same tween time), ease default (linear), no duration
    (scrub-driven). CSS has NO starting paddings -> start = 0 (verified in the
    state recordings: padding 0 before the window).
- Term title effect (CSS): `.mod-scroll__terms__term__title { mix-blend-mode:
  difference; z-index: 20 }`, `__title__filter { filter: invert(100%) }`,
  `__title__color { color: black }`. Same as my build.
- Follow mouse (main.js setFollow + scroll.js terms):
  - Enter `.mod-scroll__terms`: `#mouse` scales/opacity -> 0 (0.33s,
    power2.out), then `cursor = .follow__mouse` scales/opacity -> 1
    (0.33s, power2.out).
  - Leave: reverse.
  - Position: ticker interpolation `pos += (mouse - pos) * (1 - (1-speed)^deltaRatio)`;
    speed 0.1 inside terms, 0.2 outside; mouse coords are relative to the terms
    rect inside terms (x = e.x - termsRect.left, y = e.y - termsRect.top).
    Applied via quickSetter x/y px on top of CSS translate(-50%,-50%).
  - `.follow__mouse` CSS: width 18em, aspect-ratio 1/1, overflow clip,
    transform-origin bottom center, opacity 0, z-index 10.
  - Term switch (mouseenter per term): old `.on` img -> class `prev`; new img
    gets `.on`; `gsap.from(img, {'--clipPath':'100% 0% 0% 0%', duration:1.25,
    ease:'power3.out'})` and `gsap.from(img, {scale:2, duration:2, delay:-0.75,
    ease:'power2.out'})`.
  - Mobile text crossfade (`.mod-scroll__terms__term__text-group` singles):
    old -> {opacity:0, y:'-50%', duration:0.33, ease:'power2.in'};
    new -> fromTo {opacity:0, y:'50%'} -> {opacity:1, y:'0%', duration:0.33,
    ease:'power2.out'} at '<+=0.33'.
  - Touch (is_mobile): follow mouse disabled (display:none <=950px), term
    switching via the term hover code does not run (guarded by !is_mobile).

## PROJECTS intro (`.mod-scroll__projects__text`)
- SplitText line -> `<span class="w-100">`; timeline `from(spans, {y:'100%',
  duration:0.5, stagger:0.09, ease:'power3.easeOut'})`.
- Trigger: containerAnimation scroll_tl, start "left 75%", no end, no scrub
  (plays once on enter, default toggleActions).

## Project panels 01-04 (`.mod-scroll__projects__item:not(.last-item)`)
- ONE master trigger for all panels:
  `ScrollTrigger.create({containerAnimation: scroll_tl, animation: projects_tl,
  trigger: projectsAll[0], start: "0% 80%", end: "+=" + (60*items.length) + "%",
  scrub: 0})` -> end "+=240%" for 4 panels.
- `projects_tl` (paused), per panel index i:
  - `to(elem, {opacity:1, duration:0.005, onComplete: play textProject_tl,
    onReverseComplete: textProject_tl.timeScale(-2.5).reverse()}, i+0.5)`
  - `fromTo(elem, {width:'15vw'}, {width:'60vw', duration:1,
    ease:'power1.inOut(1)'}, i)`
  - `fromTo(media, {height:'87vh'}, {height:'66.66vh', duration:1,
    ease:'power1.inOut(.1)'}, i)`
  - => width/height share one 1-unit tween from i to i+1; text plays at i+0.5
    (50% of the panel's growth window) — matches the fixture (panel 03 at
    22% growth has hidden text).
- Text timeline `textProject_tl` (paused, delay 0.1):
  - dataTitle[0] span: fromTo y '100%' -> '0%', 0.33s, power2.out @ 0
  - dataTitle[1] span: same @ 0.2
  - link (button): fromTo y '100%' opacity 0 -> y '0%' opacity 1, 0.33s,
    power2.out @ 0.4
  - title chars (SplitText chars): fromTo y '100%' -> '0%', 0.25s, power2.out,
    stagger 0.05 @ 0.5
- Buttons: `setRolloverBtnBg` (rollovers.js) directional (entered-edge aware):
  - dur 0.33 (power3.in / power3.out), dur2 0.25 delay 0.1 power3.in.
  - Span slides via x/y (200%); `--posX/--posY` drive the ::before fill
    (background: black/white via .btn--bg-inv colorEnd). Uses CSS vars, not
    label yPercent.
- Disabled buttons: pointer-events none, opacity .5 (CSS), no rollover handlers.

## Cursor
- `#mouse` (main.js): fixed, 0.75rem, z-index 10000, pointer-events none,
  mix-blend-mode difference, inner div background var(--red) round,
  span text opacity 0 (yellow bg), hidden <=950px. Position via the same
  ticker interpolation (speed 0.2). On entering terms it is hidden and the
  follow__mouse replaces it.
- Native cursor stays visible (no cursor:none found; verify with hover
  recording cursors).

## Last item / cierre (unchanged from my build constraints)
- lastProject_tl: panel 60vw -> 42.5vw (duration 1, ease none), content
  (100-60)vw -> (100-42.5)vw with x 60vw -> 42.5vw, carousel y 100vh ->
  (100 - 33.33*(n-1))vh, content y 0 -> -(33.33*(n-2))vh, carousel items
  height 66vh -> 33.33vh (all duration 1, ease none @0); then second stage @1:
  carousel y -> -(33.33*(n-3))vh, content y -> -(33.33*(n-1))vh, items height
  -> 37.5vh (duration 0.75, power1.inOut) and lastProject_content_tl plays.
- Trigger: start "left 0%", end "left -(widthPin-adjust)%", scrub 0, with pin
  width = (numItem-1)*100vw.
