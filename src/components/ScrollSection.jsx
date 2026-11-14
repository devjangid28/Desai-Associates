import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { TERMS, PROJECTS, LAST_ITEM } from '../data/scrollSectionContent.js'
import './ScrollSection.css'

gsap.registerPlugin(ScrollTrigger, SplitText)

/* ------------------------------------------------------------------
   Normal-is-Boring style sticky horizontal scroll section.

   Pattern A (GSAP official horizontal-scroll pattern):
   - one ScrollTrigger on the sticky wrapper's scroll range drives a
     tween of the track x (NO pin, NO spacer)
   - every reveal is its own ScrollTrigger using `containerAnimation`
     with start/end given in horizontal terms relative to the element
   Timing/easing values are copied from the reference site's own
   bundles (scroll.js / main.js / rollovers.js):
     https://normalisboring.es/
   ------------------------------------------------------------------ */

/* ---- last-item (project 05) vertical ending (measured on reference) ----
   All values below were measured on https://normalisboring.es/ at
   1440x900 and 1920x1080 (see qa/last-item-reference.json):
   - panel 05 shrinks 60vw -> 42.5vw while the white text block slides
     in from the right (40vw -> 57.5vw wide) and the carousel rises
   - the vertical phase takes an extra (measured) scroll length; the
     reference creates it with its pin element, here it is added to the
     scroll distance instead
   - the animation runs inside the SAME master timeline as the track
*/
const PANEL_FINAL_VW = 42.5
const CONTENT_FINAL_VW = 57.5
const EXTRA_VERTICAL_VW = 92.3 // measured last-phase scroll length (px / vw)
const START_LEFT_VW = 0 // panel 05 screen-left when the vertical phase starts (reference holds it at 0)

// Panels 01-04 grow from the LIVE left edge of each panel (measured on the
// reference, see qa/ref/projects-timings.md). Each panel starts growing at
// 80vw and finishes at 20vw; width 15 -> 60vw and image height 87 -> 66.66vh
// share one progress value eased with power1.inOut (quadratic). Text reveals
// scrub across the panel's travel: starts at 60vw, completes at 30vw (the
// panel is then mid-screen), so the characters rise slowly with the scroll.
const PANEL_START_VW = 80
const PANEL_END_VW = 20
const TEXT_START_VW = 60
const TEXT_END_VW = 30

const easePower1InOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

// Old track widths that no longer exist (last panel 42.5vw + closing
// panel 150vw). These are only used to remap the remaining animations'
// phases from the old, longer scroll distance onto the new one so every
// reveal still starts/ends at the same horizontal position on screen.
const OLD_EXTRA_VW = 42.5 + 150

function ProjectButton({ item }) {
  return (
    <span>
      <a
        href={item.href}
        className={`btn btn--bg btn--bg-inv ${item.bgBtn} f-edit t-parrafo-l ${item.disabled ? 'disabled' : ''}`}
      >
        <span>{item.btn}</span>
      </a>
    </span>
  )
}

export default function ScrollSection() {
  const rootRef = useRef(null)
  const scRef = useRef(null)

  useLayoutEffect(() => {
    const sc = scRef.current
    if (!sc) return

    // prefers-reduced-motion -> normal vertical stack
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sc.classList.add('ms-stack')
      return
    }

    ScrollTrigger.config({ ignoreMobileResize: true })
    gsap.ticker.lagSmoothing(0)

    const debug = new URLSearchParams(window.location.search).has('debug')
    const touchMode = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768

    const wrap = rootRef.current
    const cleanups = []
    const splits = []
    let built = false
    let finalDist = 0

    const termsEl = sc.querySelector('.mod-scroll__terms')
    const projectItems = Array.from(sc.querySelectorAll('.mod-scroll__projects__item:not(.last-item)'))

    const vw = () => window.innerWidth / 100
    let lastNatX = 0
    let lastTermsW = 0
    let phaseStartLeft = 0
    let phaseStartTime = 0
    const restoreStyle = (el, saved) => {
      if (saved === null || saved === undefined) el.removeAttribute('style')
      else el.setAttribute('style', saved)
    }
    const measureFinalDist = () => {
      // The values block's width changes while its term paddings animate
      // (6.05/1.51/10.09vw -> 12/3/20vw), so measure the whole track in its
      // FINAL state: force the end paddings and panel widths, measure,
      // then restore the original inline styles (GSAP still owns them).
      const terms = termsEl ? Array.from(termsEl.querySelectorAll('.mod-scroll__terms__term')) : []
      const items = Array.from(sc.querySelectorAll('.mod-scroll__projects__item'))
      const savedTerms = terms.map((t) => t.getAttribute('style'))
      const savedItems = items.map((it) => it.getAttribute('style'))
      terms.forEach((t, i) => {
        if (i === 1) t.style.paddingRight = '3vw'
        else t.style.paddingLeft = i === 0 ? '12vw' : '20vw'
      })
      const lastItem = sc.querySelector('.mod-scroll__projects__item.last-item')
      items.forEach((it) => {
        if (it.classList.contains('last-item')) it.style.setProperty('--panel-w', `${PANEL_FINAL_VW}vw`)
        else it.style.width = '60vw'
      })
      // use layout-only sizes: getBoundingClientRect() is affected by ancestor
      // transforms (e.g. the preloader's scale), which would corrupt the
      // measured distance while the preloader is still animating
      // natural (untransformed) left edge of the last-item group inside the track
      let natX = 0
      if (lastItem) natX = lastItem.offsetLeft
      let termsW = 0
      if (termsEl) termsW = termsEl.offsetWidth
      terms.forEach((t, i) => restoreStyle(t, savedTerms[i]))
      items.forEach((it, i) => restoreStyle(it, savedItems[i]))
      lastNatX = natX
      lastTermsW = termsW
      // Total track travel must bring the group (natural offset = termsW + natX
      // inside .mod-scroll) to x = 0 on screen at the end. The group drifts
      // from START_LEFT_VW to 0 while the track keeps moving during the
      // vertical phase, so split travel into pre-phase + phase.
      const finalTravel = termsW + natX
      phaseStartLeft = Math.min(START_LEFT_VW * vw(), Math.max(finalTravel * 0.2, 1))
      const preTravel = Math.max(finalTravel - phaseStartLeft, 1)
      const extraPx = EXTRA_VERTICAL_VW * vw()
      finalDist = preTravel + extraPx
      phaseStartTime = (preTravel / finalDist) * 100
      return finalDist
    }

    // Remap a timeline time (in units of the 100-unit master timeline) from
    // the old scroll distance to the new one, preserving the fraction of the
    // horizontal phase (everything before the vertical phase starts).
    const remapTime = (t) => {
      if (!phaseStartTime) return t
      return (t * phaseStartTime) / 100
    }

    const ctx = gsap.context(() => {}, sc)

    // animate the panel width through --panel-w via a proxy object (GSAP's
    // direct custom-property tweening is flaky for this element/flow)
    const lastItemEl = () => sc.querySelector('.mod-scroll__projects__item.last-item')
    const setPanelW = (v) => {
      const el = lastItemEl()
      if (el) el.style.setProperty('--panel-w', `${v}vw`)
    }
    const panelWTween = (tl, fromVw, toVw, duration, ease, position) => {
      const st = { v: fromVw }
      setPanelW(fromVw)
      return tl.to(st, {
        v: toVw,
        duration,
        ease,
        onUpdate: () => setPanelW(st.v),
      }, position)
    }

    /* ---------------- terms: active-term image/text swap ----------------
       Works on hover (desktop) and from scroll position (touch). The
       pointer is tracked in viewport coordinates; every frame the term
       under the pointer is re-evaluated so it keeps updating while the
       track moves under a stationary pointer.
    */
    let termIndex = -1
    const termImages = termsEl ? Array.from(termsEl.querySelectorAll('.follow__mouse > img')) : []
    const mobileGroup = termsEl ? termsEl.querySelector('.mod-scroll__terms__term__text-group') : null
    const mobileTermText = mobileGroup
      ? Array.from(mobileGroup.querySelectorAll('.mod-scroll__terms__term__text__single'))
      : []

    const setActiveTerm = (index) => {
      if (!termsEl || termIndex === index) return
      termIndex = index
      const prevImg = termsEl.querySelector('.follow__mouse > img.prev')
      if (prevImg) prevImg.classList.remove('prev')
      const onImg = termsEl.querySelector('.follow__mouse > img.on')
      if (onImg) {
        onImg.classList.add('prev')
        onImg.classList.remove('on')
      }
      const img = termImages[index]
      if (img) {
        img.classList.add('on')
        gsap.from(img, { '--clipPath': '100% 0% 0% 0%', duration: 1.25, ease: 'power3.out' })
        gsap.from(img, { scale: 2, duration: 2, delay: -0.75, ease: 'power2.out' })
      }
      if (mobileGroup && mobileTermText.length) {
        const oldText = mobileTermText[termIndex === 0 ? 2 : termIndex - 1]
        const newText = mobileTermText[index]
        if (oldText) gsap.to(oldText, { opacity: 0, y: '-50%', duration: 0.33, ease: 'power2.in' })
        if (newText) {
          gsap.fromTo(newText, { opacity: 0, y: '50%' }, { opacity: 1, y: '0%', duration: 0.33, ease: 'power2.out' }, '<+=0.33')
        }
      }
    }

    if (termsEl && !touchMode) {
      const mouseEl = document.getElementById('mouse')
      const followMouse = termsEl.querySelector('.follow__mouse')
      const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const pos = { x: pointer.x, y: pointer.y }
      let speed = 0.2
      let mode = 'cursor'
      const inside = { v: false }

      gsap.set(followMouse, { x: 0, y: 0, scale: 0, opacity: 0 })

      const setCX = gsap.quickSetter(mouseEl, 'x', 'px')
      const setCY = gsap.quickSetter(mouseEl, 'y', 'px')
      const setFX = gsap.quickSetter(followMouse, 'x', 'px')
      const setFY = gsap.quickSetter(followMouse, 'y', 'px')
      setCX(pos.x)
      setCY(pos.y)

      const onMove = (e) => {
        pointer.x = e.clientX
        pointer.y = e.clientY
      }
      window.addEventListener('mousemove', onMove, { passive: true })
      cleanups.push(() => window.removeEventListener('mousemove', onMove))

      const enterFollow = () => {
        if (mode === 'follow') return
        mode = 'follow'
        inside.v = true
        speed = 0.1
        gsap.to(mouseEl, { scale: 0, opacity: 0, duration: 0.33, ease: 'power2.out', overwrite: 'auto' })
        gsap.fromTo(followMouse, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.33, ease: 'power2.out', overwrite: 'auto' })
      }
      const leaveFollow = () => {
        if (mode !== 'follow') return
        mode = 'cursor'
        inside.v = false
        speed = 0.2
        gsap.to(followMouse, { scale: 0, opacity: 0, duration: 0.33, ease: 'power2.out', overwrite: 'auto' })
        gsap.fromTo(mouseEl, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.33, ease: 'power2.out', overwrite: 'auto' })
      }

      const tickFollow = () => {
        const dt = 1 - Math.pow(1 - speed, gsap.ticker.deltaRatio())
        pos.x += (pointer.x - pos.x) * dt
        pos.y += (pointer.y - pos.y) * dt
        const r = termsEl.getBoundingClientRect()
        const inBox = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom
        if (inBox && !inside.v) enterFollow()
        if (!inBox && inside.v) leaveFollow()
        if (mode === 'cursor') {
          setCX(pos.x)
          setCY(pos.y)
          return
        }
        // inside terms: follow position is relative to the terms box
        const px = pos.x - r.left
        const py = pos.y - r.top
        setFX(px)
        setFY(py)
        const terms = termsEl.querySelectorAll('.mod-scroll__terms__term')
        for (let i = 0; i < terms.length; i++) {
          const t = terms[i].getBoundingClientRect()
          if (
            px >= t.left - r.left && px <= t.right - r.left &&
            py >= t.top - r.top && py <= t.bottom - r.top
          ) {
            setActiveTerm(i)
            return
          }
        }
      }
      gsap.ticker.add(tickFollow)
      cleanups.push(() => gsap.ticker.remove(tickFollow))

      window.__RESET_FOLLOW__ = () => {
        gsap.killTweensOf(followMouse)
        gsap.killTweensOf(mouseEl)
        gsap.set(followMouse, { scale: 0, opacity: 0 })
        gsap.set(mouseEl, { scale: 1, opacity: 1 })
        inside.v = false
        mode = 'cursor'
        speed = 0.2
        pointer.x = window.innerWidth / 2
        pointer.y = window.innerHeight / 2
      }
      cleanups.push(() => delete window.__RESET_FOLLOW__)
    }

    /* ---------------- project text timelines (copy of reference) -------- */
    const makeTextTl = (item) => {
      const textTitleEl = item.querySelector('.mod-scroll__projects__item__text__title')
      const textTitle = textTitleEl.firstElementChild || textTitleEl
      const dataTitle = item.querySelectorAll('.mod-scroll__projects__item__text__data > div:not(.data-number)')
      const linkTitle = item.querySelector('.mod-scroll__projects__item__text__data a.btn')
      const titleSplit = SplitText.create(textTitle, { type: 'chars' })
      splits.push(titleSplit)
      const d0 = dataTitle[0]?.querySelector('span')
      const d1 = dataTitle[1]?.querySelector('span')

      gsap.set([d0, d1], { yPercent: 100 })
      gsap.set(linkTitle, { yPercent: 100, opacity: 0 })
      gsap.set(titleSplit.chars, { yPercent: 100 })

      const tl = gsap.timeline({ paused: true, delay: 0.1 })
      tl.fromTo(d0, { yPercent: 100 }, { yPercent: 0, duration: 0.33, ease: 'power2.out' }, 0)
      tl.fromTo(d1, { yPercent: 100 }, { yPercent: 0, duration: 0.33, ease: 'power2.out' }, 0.2)
      tl.fromTo(linkTitle, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.33, ease: 'power2.out' }, 0.4)
      tl.fromTo(titleSplit.chars, { yPercent: 100 }, { yPercent: 0, duration: 0.25, ease: 'power2.out', stagger: 0.05 }, 0.5)
      return tl
    }

    /* ---------------- build (Pattern A) ---------------- */
    const build = () => {
      if (built) return
      built = true

      const sections = Array.from(sc.querySelectorAll(':scope > div'))
      measureFinalDist()
      // reference: the values wrapper width is fixed by JS at refresh time
      // (gsap.set(elem, {width: elem.offsetWidth})); here we fix it to the
      // measured final width so the track geometry stays identical
      if (termsEl) gsap.set(termsEl, { width: lastTermsW })
      wrap.style.height = `${window.innerHeight + finalDist}px`

      /* 1. main track tween + scrub trigger (no pin).
         The track moves the whole pinned section; its horizontal travel ends
         exactly when the last-item group reaches x = 0 on screen (finalTravel),
         then it keeps moving slowly during the vertical phase so the group is
         glued to panel 04 the whole time (no compensation hack). */
      const trackTl = gsap.timeline({ paused: true })
      const finalTravel = lastTermsW + lastNatX
      const preTravel = Math.max(finalTravel - phaseStartLeft, 1)
      trackTl.to(sections, { x: () => -preTravel, duration: phaseStartTime, ease: 'none' }, 0)
      trackTl.to(sections, { x: () => -finalTravel, duration: 100 - phaseStartTime, ease: 'none' }, phaseStartTime)
      ScrollTrigger.create({
        animation: trackTl,
        trigger: wrap,
        start: 'top top',
        end: () => '+=' + Math.max(wrap.offsetHeight - window.innerHeight, 1),
        scrub: 1,
        invalidateOnRefresh: true,
      })

      /* 2. VALUES track: term paddings scrubbed over the terms block
          crossing the viewport. Reference: containerAnimation trigger
          start "0% 100%" end "100% 0%", scrub 1; paddings start at 0
          (no initial padding) and end at 12/3/20vw. It is driven here by
          the master track timeline at the exact times the block crosses
          the viewport (left edge at the right edge -> right edge at the
          left edge), which is equivalent and deterministic. The wrapper
          width is fixed by JS at build time (reference: gsap.set(elem,
          {width: elem.offsetWidth})) so the paddings do not reflow the
          track; here it is fixed to the measured final width so the track
          geometry (and the last-item phase) stays untouched. */
      if (termsEl) {
        const terms = termsEl.querySelectorAll('.mod-scroll__terms__term')
        const tl = termsEl.offsetLeft
        const tw = termsEl.offsetWidth
        const iw = window.innerWidth
        const tAtX = (absX) => Math.min(Math.max((absX / preTravel), 0), 1) * phaseStartTime
        const t0 = tAtX(tl + tw - iw)
        const t1 = tAtX(tl + tw)
        const termsTl = gsap.timeline({ paused: true })
        const seg = (t1 - t0) / 4
        termsTl.to(terms[0], { paddingLeft: '12vw', duration: seg, ease: 'none' }, 0)
        termsTl.to(terms[1], { paddingRight: '3vw', duration: seg, ease: 'none' }, 0)
        termsTl.to(terms[1].querySelector('.mod-scroll__terms__term__text'), { marginRight: '3vw', duration: seg, ease: 'none' }, 0)
        termsTl.to(terms[2], { paddingLeft: '20vw', duration: seg, ease: 'none' }, 0)
        trackTl.add(termsTl, t0)

        // active term on touch/scroll: closest to viewport centre
        if (touchMode) {
          const centres = () => {
            const centre = window.innerWidth / 2
            let best = 0
            let bestDist = Infinity
            terms.forEach((el, i) => {
              const r = el.getBoundingClientRect()
              const dq = Math.abs(r.left + r.width / 2 - centre)
              if (dq < bestDist) {
                bestDist = dq
                best = i
              }
            })
            setActiveTerm(best)
          }
          gsap.ticker.add(centres)
          cleanups.push(() => gsap.ticker.remove(centres))
        }
      }

      /* 3. projects intro: line-by-line reveal + label slide-up */
      const wrapText = sc.querySelector('.mod-scroll__projects__text')
      if (wrapText) {
        const split = SplitText.create(wrapText, { type: 'lines', linesClass: 'line' })
        splits.push(split)
        split.lines.forEach((line) => {
          const content = line.innerHTML
          line.innerHTML = `<span class="w-100">${content}</span>`
        })
        gsap.set(wrapText.querySelectorAll('span'), { yPercent: 100 })
        const introLabel = sc.querySelector('.mod-scroll__projects__section')
        if (introLabel) gsap.set(introLabel, { yPercent: 100 })
        const tl = gsap.timeline({ paused: true })
        tl.fromTo(wrapText.querySelectorAll('span'), { yPercent: 100 }, { yPercent: 0, duration: 0.5, stagger: 0.09, ease: 'power3.easeOut' }, 0)
        if (introLabel) tl.fromTo(introLabel, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'power3.out' }, 0.2)
        ScrollTrigger.create({
          animation: tl,
          containerAnimation: trackTl,
          trigger: wrapText,
          start: 'left 75%',
          toggleActions: 'play none none none',
          invalidateOnRefresh: true,
        })
      }

      /* 4. project panels 1-4: width/image height + text reveals.
          Driven from each panel's LIVE left edge every frame (see step 3 of
          the task): p_i = clamp((START_VW - left_i/vw) / (START_VW -
          END_VW)), eased with power1.inOut, shared by width and image height.
          Evaluated in panel order so a panel's width never feeds back into
          its own left edge; fully reversible and scroll-speed independent.
          Text reveals scrub as one sub-timeline per panel over its measured
          left-edge window. Panels 1-4 no longer live in the master track
          timeline. */
      if (projectItems.length) {
        const panelText = projectItems.map((item) => ({
          item,
          media: item.querySelector('.media__source'),
          textTl: makeTextTl(item),
        }))
        const lastItemEl = sc.querySelector('.mod-scroll__projects__item.last-item')
        const lastTextTl = lastItemEl ? makeTextTl(lastItemEl) : null
        const lastMedia = lastItemEl ? lastItemEl.querySelector('.last-item__panel .media__source') : null
        const updatePanels = () => {
          const iw = window.innerWidth
          const applyLeft = (item, media, textTl, setWidth) => {
            const leftVw = (item.getBoundingClientRect().left / iw) * 100
            const raw = (PANEL_START_VW - leftVw) / (PANEL_START_VW - PANEL_END_VW)
            const p = Math.min(Math.max(raw, 0), 1)
            const ep = easePower1InOut(p)
            setWidth(15 + 45 * ep)
            if (media) media.style.height = `${87 - 20.34 * ep}vh`
            const tRaw = (TEXT_START_VW - leftVw) / (TEXT_START_VW - TEXT_END_VW)
            const tp = Math.min(Math.max(tRaw, 0), 1)
            if (textTl) textTl.totalProgress(tp)
          }
          for (let i = 0; i < panelText.length; i++) {
            const { item, media, textTl } = panelText[i]
            applyLeft(item, media, textTl, (w) => { item.style.width = `${w}vw` })
          }
          // panel 05 (last-item group): drive its width via --panel-w, then
          // stop once it is fully grown (vertical phase owns it from there)
          if (lastItemEl) {
            const leftVw = (lastItemEl.getBoundingClientRect().left / iw) * 100
            if (leftVw > PANEL_END_VW) {
              applyLeft(lastItemEl, lastMedia, lastTextTl, (w) => {
                lastItemEl.style.setProperty('--panel-w', `${w}vw`)
              })
            }
          }
        }
        gsap.ticker.add(updatePanels)
        cleanups.push(() => gsap.ticker.remove(updatePanels))
        if (debug) {
          window.__PROJ_TRIGGERS__ = () => []
        }
      }

      /* 4a. panel 05 (last-item) width/image/text reveal: driven from its
         LIVE left edge like panels 01-04 (see updatePanels below), so it
         expands while entering the viewport from the right and its text
         scrubs over the same left-edge window. The vertical last-item phase
         (below) is untouched and takes over once the group reaches 0. */

      /* 4b. LAST-ITEM vertical phase (same master timeline as the track).
          Mirrors the reference's lastProject_tl + lastProject_content_tl:
          - the group (panel 05 + carousel + white block) moves only with the
            track; its left edge stays glued to panel 04's right edge
          - t 0..1: the panel narrows 60vw -> 42.5vw (--panel-w); the
            carousel (CSS: left 0, width = --panel-w) and the white block
            (CSS: left = --panel-w, width = 100vw - --panel-w) follow by
            construction; the carousel rises 100vh -> 33.34vh, items shrink
            66vh -> 33.33vh, the panel's inner content rises
          - t 1..1.75: carousel -> 0, items -> 37.5vh (power1.inOut), text
            block reveals play (time-based, as in the reference) */
      const lastItem = sc.querySelector('.mod-scroll__projects__item.last-item')
      if (lastItem) {
        const carousel = lastItem.querySelector('.last-item__carousel')
        const sectionEl = lastItem.querySelector('.last-item__content__section')
        const titleEl = lastItem.querySelector('.last-item__content__title')
        const textEl = lastItem.querySelector('.last-item__content__text')
        const carItems = Array.from(carousel.querySelectorAll('.last-item__carousel__item:not(.last-item__carousel__item--link)'))
        const innerContent = lastItem.querySelector('.mod-scroll__projects__item__content')

        // text-block reveal timeline (plays on stage-2 start, time-based)
        const titleSplit = SplitText.create(titleEl, { type: 'chars', charsClass: 'char' })
        splits.push(titleSplit)

        // paragraph: split into lines dynamically (word-by-word grouping by
        // offsetTop) after fonts are ready; re-split on resize / font load
        const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const splitParagraphLines = () => {
          const p = textEl.querySelector('p')
          if (!p) return []
          // Always split from the authored source, never from rebuilt DOM:
          // textContent of sibling line divs has no boundary whitespace, so a
          // re-split would weld words together.
          const words = LAST_ITEM.paragraph.trim().split(/\s+/).filter(Boolean)
          p.innerHTML = words.map((w) => `<span class="par-word">${escHtml(w)}</span>`).join(' ')
          const ws = Array.from(p.querySelectorAll('.par-word'))
          const lineGroups = []
          let cur = []
          let lastTop = null
          for (const el of ws) {
            const top = Math.round(el.offsetTop)
            if (cur.length && top !== lastTop) {
              lineGroups.push(cur)
              cur = []
            }
            lastTop = top
            cur.push(el)
          }
          if (cur.length) lineGroups.push(cur)
          p.innerHTML = lineGroups
            .map((ln) => `<div class="line"><span class="w-100">${ln.map((el) => el.outerHTML).join(' ')}</span></div>`)
            .join('')
          return Array.from(p.querySelectorAll('.line'))
        }

        let contentTl = null
        const buildContentTl = () => {
          if (contentTl) {
            contentTl.kill()
            contentTl = null
          }
          const lineEls = splitParagraphLines()
          const textSpans = lineEls.map((l) => l.querySelector('span'))
          gsap.set(textSpans, { yPercent: 100 })
          contentTl = gsap.timeline({ paused: true })
          contentTl.fromTo(sectionEl, { opacity: 0, y: '100%' }, { opacity: 1, y: '0%', duration: 0.33 })
          Array.from(titleEl.querySelectorAll('.line')).forEach((el, ind) => {
            const posInit = ind % 2 !== 0 ? '-110%' : '110%'
            contentTl.fromTo(el.querySelectorAll('.char'), { y: posInit }, { y: '0%', duration: 0.65, stagger: 0.03, ease: 'power3.out' }, '<+=0.2')
          })
          contentTl.fromTo(textSpans, { yPercent: 100 }, { yPercent: 0, duration: 0.5, stagger: 0.09, ease: 'power3.easeOut' }, '<+=0.33')
          return contentTl
        }
        buildContentTl()

        const u1 = (100 - phaseStartTime) / 3.75
        const u2 = 0.75 * u1
        const lastTl = gsap.timeline()
        if (debug) {
          window.__LAST_TL__ = lastTl
          window.__CONTENT_TL__ = () => contentTl
        }
        // panel narrows; carousel left/width and content left/width follow via
        // --panel-w (CSS). No separate x transforms on carousel/content.
        // Driven deterministically by the master timeline time (the reveal
        // tween already handles the 15 -> 60vw phase before this).
        const phasePanelTicker = () => {
          const t = trackTl.time()
          if (t < phaseStartTime) return
          const pLocal = Math.min((t - phaseStartTime) / (100 - phaseStartTime), 1)
          setPanelW(60 + (PANEL_FINAL_VW - 60) * pLocal)
        }
        gsap.ticker.add(phasePanelTicker)
        cleanups.push(() => gsap.ticker.remove(phasePanelTicker))
        // carousel / items / inner content rise
        lastTl.fromTo(carousel, { y: '100vh' }, { y: `${100 - 33.33 * 2}vh`, duration: u1, ease: 'none' }, 0)
        lastTl.fromTo(innerContent, { y: 0 }, { y: '-33.33vh', duration: u1, ease: 'none' }, 0)
        lastTl.from(carItems, { height: '66vh', duration: u1, ease: 'none' }, 0)
        // stage 2: settle into the final frame
        lastTl.to(carousel, { y: '0vh', duration: u2, ease: 'none' }, u1)
        lastTl.to(innerContent, { y: '-66.66vh', duration: u2, ease: 'none' }, u1)
        lastTl.to(carItems, {
          height: '37.5vh',
          duration: u2,
          ease: 'power1.inOut',
          onStart: () => contentTl && contentTl.play(),
          onReverseComplete: () => {
            if (contentTl) {
              contentTl.pause()
              contentTl.reverse()
            }
          },
        }, u1)

        const syncContentAfterRebuild = () => {
          buildContentTl()
          if (lastTl.time() >= u1 && contentTl) contentTl.play(0)
        }
        window.__REBUILD_CONTENT__ = syncContentAfterRebuild

        trackTl.add(lastTl, phaseStartTime)
      }

      /* 5. button rollovers (reference rollovers.js setRolloverBtnBg:
          directional, entered-edge aware; --posX/--posY drive the ::before
          fill, the label span slides 200% along the entry axis) */
      const btns = Array.from(sc.querySelectorAll('a.btn:not(.disabled)'))
      btns.forEach((btn) => {
        const sp = btn.querySelector(':scope > span')
        if (!sp) return
        const colorEnd = btn.classList.contains('btn--bg-inv') ? 'white' : 'black'
        const dir = (e) => {
          const rect = btn.getBoundingClientRect()
          const fromLeft = e.clientX - rect.left
          const fromRight = rect.right - e.clientX
          const fromTop = e.clientY - rect.top
          const fromBottom = rect.bottom - e.clientY
          const minDistance = Math.min(fromLeft, fromRight, fromTop, fromBottom)
          if (minDistance === fromLeft) return { pos: ['-102%', '102%', 0, 0], spanPos: ['200%', '-200%', 0, 0] }
          if (minDistance === fromRight) return { pos: ['102%', '-102%', 0, 0], spanPos: ['-200%', '200%', 0, 0] }
          if (minDistance === fromTop) return { pos: [0, 0, '-102%', '102%'], spanPos: [0, 0, '200%', '-200%'] }
          return { pos: [0, 0, '102%', '-102%'], spanPos: [0, 0, '-200%', '200%'] }
        }
        const over = (e) => {
          const { pos, spanPos } = dir(e)
          const dur = 0.33
          const dur2 = 0.25
          gsap.killTweensOf(btn)
          gsap.killTweensOf(sp)
          gsap.fromTo(sp, { x: 0, y: 0 }, { x: spanPos[0], y: spanPos[2], duration: dur, ease: 'power3.in' })
          gsap.to(sp, { color: colorEnd, duration: dur, ease: 'power3.in' })
          gsap.fromTo(btn, { '--posX': pos[0], '--posY': pos[2] }, { '--posX': '0%', '--posY': '0%', duration: dur2, delay: 0.1, ease: 'power3.in' })
          gsap.fromTo(sp, { x: spanPos[1], y: spanPos[3] }, { x: 0, y: 0, duration: dur, delay: dur2, ease: 'power3.out' })
        }
        const out = (e) => {
          const { pos, spanPos } = dir(e)
          const dur = 0.33
          const dur2 = 0.25
          gsap.killTweensOf(btn)
          gsap.killTweensOf(sp)
          gsap.fromTo(sp, { x: 0, y: 0, color: colorEnd }, { x: spanPos[0], y: spanPos[2], duration: dur, ease: 'power3.in' })
          gsap.to(sp, { color: '', duration: dur, ease: 'power3.in' })
          gsap.fromTo(btn, { '--posX': '0%', '--posY': '0%' }, { '--posX': pos[1], '--posY': pos[3], duration: dur2, delay: 0.1, ease: 'power3.in' })
          gsap.fromTo(sp, { x: spanPos[1], y: spanPos[3] }, { x: 0, y: 0, duration: dur, delay: dur2, ease: 'power3.out' })
        }
        btn.addEventListener('mouseenter', over)
        btn.addEventListener('mouseleave', out)
        cleanups.push(() => {
          btn.removeEventListener('mouseenter', over)
          btn.removeEventListener('mouseleave', out)
        })
      })

      // "See all" tile: arrow animation (fills white + grows) on hover
      const seeAll = Array.from(sc.querySelectorAll('.last-item__carousel__item--link'))[0]
      if (seeAll) {
        const arrow = seeAll.querySelector('.last-item__carousel__item__arrow')
        const paths = arrow ? Array.from(arrow.querySelectorAll('path')) : []
        const overA = () => {
          gsap.to(paths, { fill: '#FFF', duration: 0.33, ease: 'power3.in' })
          gsap.to(arrow, { scale: 2, x: '-8px', y: '8px', duration: 0.33, ease: 'power3.in' })
        }
        const outA = () => {
          gsap.to(paths, { fill: '#000', duration: 0.33, ease: 'power3.in' })
          gsap.to(arrow, { scale: 1.5, x: '0px', y: '0px', duration: 0.33, ease: 'power3.in' })
        }
        seeAll.addEventListener('mouseenter', overA)
        seeAll.addEventListener('mouseleave', outA)
        cleanups.push(() => {
          seeAll.removeEventListener('mouseenter', overA)
          seeAll.removeEventListener('mouseleave', outA)
        })
      }

      // In-place relayout after a significant resize would require rebuilding
      // the whole GSAP master timeline / trigger network; the safe, exact
      // approach is a controlled reload that resumes at the same scroll
      // progress (used by the resize acceptance test as well).
      const onResize = () => {
        if (!built) return
        const prev = (() => {
          try {
            const s = window.__SCROLL_P__ ? window.__SCROLL_P__() : null
            return s && Number.isFinite(s.p) ? s.p : null
          } catch {
            return null
          }
        })()
        try {
          if (prev !== null) sessionStorage.setItem('interiorResume', String(prev))
          else sessionStorage.removeItem('interiorResume')
        } catch {
          /* private mode */
        }
        window.location.reload()
      }
      window.addEventListener('resize', onResize)
      cleanups.push(() => window.removeEventListener('resize', onResize))

      if (debug) {
        window.__M_FD__ = measureFinalDist
        window.__ST__ = ScrollTrigger
        window.__GSAP__ = gsap
        window.__MS_REDUCED__ = false
        window.__SCROLL_P__ = () => {
          const r = wrap.getBoundingClientRect()
          const top = r.top + window.scrollY
          return {
            p: (window.scrollY - top) / finalDist,
            dist: finalDist,
            wrapH: wrap.offsetHeight,
          }
        }
        window.__TRACK_TL__ = trackTl
        window.__FINAL_DIST__ = () => finalDist
        window.__NAT_X__ = () => lastNatX
      }
    }

    const recalc = () => {
      if (!built) build()
      measureFinalDist()
      if (termsEl) gsap.set(termsEl, { width: lastTermsW })
      wrap.style.height = `${window.innerHeight + finalDist}px`
      ScrollTrigger.refresh()
      if (typeof window.__REBUILD_CONTENT__ === 'function') window.__REBUILD_CONTENT__()
    }
    // resume a previous scroll progress after a resize/reload (see onResize)
    const resumeP = (() => {
      try {
        const v = sessionStorage.getItem('interiorResume')
        sessionStorage.removeItem('interiorResume')
        return v !== null && Number.isFinite(Number(v)) ? Number(v) : null
      } catch {
        return null
      }
    })()
    let resumeApplied = false
    const applyResume = () => {
      if (resumeP === null || resumeApplied) return
      resumeApplied = true
      setTimeout(() => {
        try {
          const w = document.querySelector('.mod-scroll-wrap')
          if (!w) return
          const r = w.getBoundingClientRect()
          const top = r.top + window.scrollY
          const rng = { start: top, end: top + (w.offsetHeight - window.innerHeight) }
          const y = Math.round(rng.start + resumeP * (rng.end - rng.start))
          const L = window.__lenis
          if (L) L.stop()
          window.scrollTo(0, y)
        } catch (e) {
          /* ignore */
        }
      }, 400)
    }
    // re-run until the measured distance stabilizes (fonts/images can still
    // settle after the first recalc and change the track's final width)
    const stabilize = (remaining = 6) => {
      const before = finalDist
      recalc()
      applyResume()
      if (remaining > 0 && Math.abs(finalDist - before) > 0.5) {
        setTimeout(() => stabilize(remaining - 1), 300)
      }
    }
    recalc()
    document.fonts.ready.then(() => stabilize())
    const onLoad = () => stabilize()
    window.addEventListener('load', onLoad)
    cleanups.push(() => window.removeEventListener('load', onLoad))

    // The preloader animates `.page` with a scale transform; any
    // ScrollTrigger.refresh() that runs while that transform is active
    // measures corrupt start/end values that never recover. Wait until the
    // transform is cleared, then run one final refresh so the trigger
    // geometry is rebuilt from clean layout.
    let pageCleanTimer = null
    const tryPageCleanRefresh = () => {
      const pg = document.querySelector('.page')
      if (!pg) return
      const t = getComputedStyle(pg).transform
      if (t === 'none' || t === '') {
        ScrollTrigger.refresh()
        if (typeof window.__REBUILD_CONTENT__ === 'function') window.__REBUILD_CONTENT__()
        return
      }
      pageCleanTimer = setTimeout(tryPageCleanRefresh, 400)
    }
    tryPageCleanRefresh()
    cleanups.push(() => clearTimeout(pageCleanTimer))

    return () => {
      cleanups.forEach((fn) => fn())
      splits.forEach((s) => s.revert())
      ctx.revert()
      gsap.killTweensOf(sc)
    }
  }, [])

  return (
    <div className="mod-scroll-wrap" ref={rootRef}>
      <div className="mod-scroll" ref={scRef}>
        {/* ---------- A) VALUES ---------- */}
        <div className="mod-scroll__terms follow__wrap bg-blue before-bg-blue">
          {TERMS.map((term, i) => (
            <div
              key={term.num}
              className="mod-scroll__terms__term"
            >
              {/* per-term paragraph: shown on desktop (>=950) */}
              <div className="mod-scroll__terms__term__text f-izmir t-parrafo d-none d-md-block">
                <div className="mod-scroll__terms__term__text__single">{term.text}</div>
              </div>

              {/* stacked text group (inline cross-fade): mobile only */}
              {i === 1 && (
                <div className="mod-scroll__terms__term__text mod-scroll__terms__term__text-group f-izmir t-parrafo d-md-none">
                  {TERMS.map((t) => (
                    <div key={t.num} className="mod-scroll__terms__term__text__single">{t.text}</div>
                  ))}
                </div>
              )}

              <div className="mod-scroll__terms__term__wrap-title">
                <div className="mod-scroll__terms__term__num f-edit t-parrafo">{term.num}</div>
                <div className={`mod-scroll__terms__term__title t-supertitulo-l ${term.titleFont} lh-less2`}>
                  <span className="mod-scroll__terms__term__title__filter">
                    <span className="mod-scroll__terms__term__title__color">{term.title}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* floating image that follows the cursor */}
          <div className="follow__mouse">
            {TERMS.map((term, i) => (
              <img
                key={term.num}
                src={term.img}
                alt=""
                decoding="async"
              />
            ))}
          </div>
        </div>

        {/* ---------- B) PROJECTS ---------- */}
        <div className="mod-scroll__projects">
          <div className="mod-scroll__projects__wrap-text">
            <div className="mod-scroll__projects__section mod-scroll__section t-parrafo-l f-edit">
              Projects
            </div>
            <div className="mod-scroll__projects__text f-izmir t-parrafo">
              <p>
                Luxury does not shout, nor does it follow banal aesthetic trends: it is silent,
                imperceptible, playful and stimulating. We do not want to create only homes, but a
                lifestyle.
              </p>
            </div>
          </div>

          {PROJECTS.map((p) => (
            <div key={p.num} className={`mod-scroll__projects__item ${p.bg}`} style={{ width: '15vw' }}>
              <div className="mod-scroll__projects__item__content">
                <div className="media mod-scroll__projects__item__image noAnimate no-general-anim" data-delay="">
                  <div className="media__wrap-source image" style={{ aspectRatio: p.ratio }}>
                    <img
                      className="media__source w-100"
                      src={p.img}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ height: '87vh' }}
                    />
                  </div>
                </div>

                <div className="mod-scroll__projects__item__text">
                  <div className="mod-scroll__projects__item__text__data">
                    <div className="f-edit t-parrafo-l"><span>{p.year}</span></div>
                    <div className="f-izmir t-parrafo-l"><span>{p.place}</span></div>
                    <div className="f-izmir t-parrafo data-number">{p.num}</div>
                    <ProjectButton item={p} />
                  </div>
                  <div className={`mod-scroll__projects__item__text__title t-upper ${p.titleFont} t-titulo-xxl`}>
                    <div>{p.title}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* ---------- panel 05 (Pol43) + vertical ending ---------- */}
          {(() => {
            const p = LAST_ITEM.panel
            return (
              <div
                key={p.num}
                className={`mod-scroll__projects__item last-item last-item-group ${p.bg}`}
                style={{ '--panel-w': '15vw' }}
              >
                <div className="last-item__panel">
                  <div className="mod-scroll__projects__item__content">
                    <div className="media mod-scroll__projects__item__image noAnimate no-general-anim" data-delay="">
                      <div className="media__wrap-source image" style={{ aspectRatio: p.ratio }}>
                        <img
                          className="media__source w-100"
                          src={p.img}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={{ height: '87vh' }}
                        />
                      </div>
                    </div>

                    <div className="mod-scroll__projects__item__text">
                      <div className="mod-scroll__projects__item__text__data">
                        <div className="f-edit t-parrafo-l"><span>{p.year}</span></div>
                        <div className="f-izmir t-parrafo-l"><span>{p.place}</span></div>
                        <div className="f-izmir t-parrafo data-number">{p.num}</div>
                        <ProjectButton item={p} />
                      </div>
                      <div className={`mod-scroll__projects__item__text__title t-upper ${p.titleFont} t-titulo-xxl`}>
                        <div>{p.title}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* carousel: two project images + "See all" link tile */}
                <div className="last-item__carousel">
                  {LAST_ITEM.carouselImgs.map((src) => (
                    <div key={src} className="last-item__carousel__item">
                      <div className="media last-item__carousel__item__image noAnimate no-general-anim" data-delay="">
                        <div className="media__wrap-source image">
                          <img
                            className="media__source w-100"
                            src={src}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <a
                    href={LAST_ITEM.linkHref}
                    className="last-item__carousel__item last-item__carousel__item--link btn btn--bg btn--bg-inv btn--bg-blue bg-blue f-edit"
                  >
                    <svg
                      className="last-item__carousel__item__arrow btn__image"
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="25.815"
                      viewBox="0 0 28 25.815"
                    >
                      <g transform="translate(-7871.062 19814.479)">
                        <path d="M16.962-.067H-1V-1H16.962Z" transform="translate(7881.317 -19813.479)" />
                        <path d="M-.067,17.665H-1V-1h.933Z" transform="translate(7899.129 -19813.479)" />
                        <path d="M-.045,24.641l-.633-.686L26.069-.735l.633.686Z" transform="translate(7871.74 -19813.305)" />
                      </g>
                    </svg>
                    <span className="btn--label">
                      <span className="last-item__carousel__item__text t-titulo-l">{LAST_ITEM.linkLabel}</span>
                      <span aria-hidden="true" className="last-item__carousel__item__text t-titulo-l">{LAST_ITEM.linkLabel}</span>
                    </span>
                  </a>
                </div>

                {/* white text block (label, 4-line title, paragraph) */}
                <div className="last-item__content">
                  <div className="last-item__content__wrap">
                    <div className="last-item__content__section f-edit t-parrafo">Projects</div>
                    <div className="last-item__content__title">
                      {LAST_ITEM.titleLines.map((line, i) => (
                        <div
                          key={i}
                          className={`line f-regular t-titulo-xxl t-upper lh-less w-100 align-left ${i > 1 ? 't-right' : 't-left'}`}
                        >
                          {i === 1 ? <>THAT <span /><span /><span /><span /> PLEASURE</> : line}
                        </div>
                      ))}
                    </div>
                    <div className="last-item__content__text">
                      <p>{LAST_ITEM.paragraph}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
