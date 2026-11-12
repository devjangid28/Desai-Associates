import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { TERMS, PROJECTS, LAST_PROJECT, CIERRE } from '../data/scrollSectionContent.js'
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

// final cierre content offset, measured from the reference final frame
// (the reference's own formula would fill the viewport; the measured
// final frame shows the content at 37.5% — reference fidelity wins)
const CIERRE_X_END = 37.5

function ProjectButton({ item }) {
  return (
    <span>
      <a
        href={item.href}
        className={`btn btn--bg btn--bg-inv ${item.bgBtn} f-edit t-parrafo-l ${item.disabled ? 'disabled' : ''}`}
      >
        <span className="btn--label">
          <span>{item.btn}</span>
          <span aria-hidden="true">{item.btn}</span>
        </span>
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
    const lastProject = sc.querySelector('.mod-scroll__projects__item.last-item')
    const cierre = sc.querySelector('.mod-scroll__cierre')

    const vw = () => window.innerWidth / 100
    let baseW = 0
    const measureFinalDist = () => {
      if (!baseW) {
        const termsW = termsEl ? termsEl.getBoundingClientRect().width : 0
        const wrapW = (sc.querySelector('.mod-scroll__projects__wrap-text') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width
        baseW = termsW + wrapW
      }
      const finalW = baseW + (4 * 60 + 42.5 + 150) * vw()
      finalDist = Math.max(finalW - window.innerWidth, 1)
      return finalDist
    }

    const ctx = gsap.context(() => {}, sc)

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
      const followMouse = termsEl.querySelector('.follow__mouse')
      const pointer = { x: -9999, y: -9999 }
      const inside = { v: false }

      gsap.set(followMouse, { xPercent: -50, yPercent: -50, x: 0, y: 0 })

      const xTo = gsap.quickTo(followMouse, 'x', { duration: 0.4, ease: 'power3.out' })
      const yTo = gsap.quickTo(followMouse, 'y', { duration: 0.4, ease: 'power3.out' })

      const onMove = (e) => {
        pointer.x = e.clientX
        pointer.y = e.clientY
      }
      window.addEventListener('mousemove', onMove, { passive: true })
      cleanups.push(() => window.removeEventListener('mousemove', onMove))

      const showFollow = () => {
        if (inside.v) return
        inside.v = true
        gsap.to(followMouse, { opacity: 1, duration: 0.33, ease: 'power2.out', overwrite: 'auto' })
      }
      const hideFollow = () => {
        if (!inside.v) return
        inside.v = false
        gsap.to(followMouse, { opacity: 0, duration: 0.33, ease: 'power2.out', overwrite: 'auto' })
      }

      const tickFollow = () => {
        const r = termsEl.getBoundingClientRect()
        const inBox = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom
        if (inBox && !inside.v) showFollow()
        if (!inBox && inside.v) hideFollow()
        if (!inBox) return
        const px = pointer.x - r.left
        const py = pointer.y - r.top
        xTo(px)
        yTo(py)
        const terms = termsEl.querySelectorAll('.mod-scroll__terms__term')
        for (let i = 0; i < terms.length; i++) {
          const t = terms[i].getBoundingClientRect()
          if (px >= t.left - r.left && px <= t.right - r.left) {
            setActiveTerm(i)
            return
          }
        }
      }
      gsap.ticker.add(tickFollow)
      cleanups.push(() => gsap.ticker.remove(tickFollow))

      window.__RESET_FOLLOW__ = () => {
        gsap.killTweensOf(followMouse)
        gsap.set(followMouse, { opacity: 0 })
        inside.v = false
        pointer.x = -9999
        pointer.y = -9999
      }
      cleanups.push(() => delete window.__RESET_FOLLOW__)
    }

    /* ---------------- project text timelines (copy of reference) -------- */
    const makeTextTl = (item) => {
      const textTitle = item.querySelector('.mod-scroll__projects__item__text__title')
      const dataTitle = item.querySelectorAll('.mod-scroll__projects__item__text__data > div:not(.data-number)')
      const linkTitle = item.querySelector('.mod-scroll__projects__item__text__data a.btn')
      const titleSplit = SplitText.create(textTitle, { type: 'chars', charsClass: 'char' })
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

    const makeLastContentTl = () => {
      const tl = gsap.timeline({ paused: true })
      const sectionEl = lastProject.querySelector('.last-item__content__section')
      const titleLines = lastProject.querySelectorAll('.last-item__content__title .line')
      const textSpans = lastProject.querySelectorAll('.last-item__content__text span')

      gsap.set(sectionEl, { opacity: 0, yPercent: 100 })
      titleLines.forEach((el, ind) => {
        const splitLine = SplitText.create(el, { type: 'chars', charsClass: 'char' })
        splits.push(splitLine)
        const posInit = ind % 2 === 0 ? 110 : -110
        gsap.set(splitLine.chars, { yPercent: posInit })
      })
      gsap.set(textSpans, { yPercent: 100 })

      tl.from(sectionEl, { opacity: 0, yPercent: 100, duration: 0.33 }, 0)
      titleLines.forEach((el, ind) => {
        const splitLine = SplitText.create(el, { type: 'chars', charsClass: 'char' })
        const posInit = ind % 2 === 0 ? 110 : -110
        tl.from(splitLine.chars, { yPercent: posInit, duration: 0.65, stagger: 0.03, ease: 'power3.out' }, '<+=0.2')
      })
      tl.from(textSpans, { yPercent: 100, duration: 0.5, stagger: 0.09, ease: 'power3.easeOut' }, '<+=0.33')
      return tl
    }

    /* ---------------- build (Pattern A) ---------------- */
    const build = () => {
      if (built) return
      built = true

      const sections = Array.from(sc.querySelectorAll(':scope > div'))
      measureFinalDist()
      wrap.style.height = `${window.innerHeight + finalDist}px`

      /* 1. main track tween + scrub trigger (no pin) */
      const trackTl = gsap.timeline({ paused: true })
      trackTl.to(sections, { x: -finalDist, duration: 100, ease: 'none' }, 0)
      ScrollTrigger.create({
        animation: trackTl,
        trigger: wrap,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.2,
        invalidateOnRefresh: true,
      })

      /* 2. VALUES track: term paddings + title color flip (driven by the
         same track timeline, positioned at the measured phase window) */
      if (termsEl) {
        const terms = termsEl.querySelectorAll('.mod-scroll__terms__term')
        const termsTl = gsap.timeline()
        termsTl.to(terms[0], { paddingLeft: '12vw', duration: 12, ease: 'power1.inOut' }, 3)
        termsTl.to(terms[1], { paddingRight: '3vw', duration: 12, ease: 'power1.inOut' }, 3)
        termsTl.to(terms[1].querySelector('.mod-scroll__terms__term__text'), { marginRight: '3vw', duration: 12, ease: 'power1.inOut' }, 3)
        termsTl.to(terms[2], { paddingLeft: '20vw', duration: 12, ease: 'power1.inOut' }, 3)
        // title color flips while the term crosses the viewport centre:
        // the .title__filter layer inverts, so animating the color to
        // white produces the measured reference curve (base #000 -> #fff)
        terms.forEach((term) => {
          const colorEl = term.querySelector('.mod-scroll__terms__term__title__color')
          if (colorEl) termsTl.to(colorEl, { color: '#ffffff', duration: 6, ease: 'none' }, 6)
        })
        trackTl.add(termsTl, 0)

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
          scrub: 0,
          invalidateOnRefresh: true,
        })
      }

      /* 4. project panels 1-4: width/image height + text reveals */
      if (projectItems.length) {
        const projectsTl = gsap.timeline({ paused: true })
        const H = 33.33
        projectItems.forEach((item, index) => {
          const textTl = makeTextTl(item)
          const media = item.querySelector('.media__source')
          const time = index * 1
          projectsTl.to(item, {
            opacity: 1,
            duration: 0.005,
            onComplete: () => {
              textTl.pause()
              textTl.play()
            },
            onReverseComplete: () => {
              textTl.pause()
              textTl.timeScale(-2.5)
              textTl.reverse()
            },
          }, time + 0.5)
          projectsTl.fromTo(item, { width: '15vw' }, { width: '60vw', duration: 1, ease: 'power1.inOut(1)' }, time)
          projectsTl.fromTo(media, { height: '87vh' }, { height: `${H * 2}vh`, duration: 1, ease: 'power1.inOut(.1)' }, time)
        })
        ScrollTrigger.create({
          animation: projectsTl,
          containerAnimation: trackTl,
          trigger: projectItems[0],
          start: '0% 80%',
          end: '+=240%',
          scrub: 0,
          invalidateOnRefresh: true,
        })
      }

      /* 5. last panel (Pol43): carousel + content reveals */
      if (lastProject) {
        const lastContentTl = makeLastContentTl()
        const lastCarousel = lastProject.querySelector('.last-item__carousel')
        const lastContent = lastProject.querySelector('.last-item__content')
        const lastItems = Array.from(lastProject.querySelectorAll('.last-item__carousel__item:not(.last-item__carousel__item--link)'))
        const numItem = lastProject.querySelectorAll('.last-item__carousel__item').length
        const H = 33.33
        const adjust = 50
        const widthPin = (numItem - 1) * 100
        const widthCarouselLast = 42.5
        const maxWidthItem = 60

        const lastTl = gsap.timeline({ paused: true })
        lastTl.to(lastProject, { x: `${widthPin - adjust}vw`, duration: 3, ease: 'none' }, 0)
        lastTl.fromTo(lastProject, { width: `${maxWidthItem}vw` }, { width: `${widthCarouselLast}vw`, duration: 1, ease: 'none' }, 0)
        lastTl.fromTo(lastContent, { width: `${100 - maxWidthItem}vw`, x: `${maxWidthItem}vw` },
          { width: `${100 - widthCarouselLast}vw`, x: `${widthCarouselLast}vw`, duration: 1, ease: 'none' }, 0)
        lastTl.fromTo(lastCarousel, { y: '100vh' }, { y: `${100 - H * (numItem - 1)}vh`, duration: 1, ease: 'none' }, 0)
        lastTl.fromTo(lastContent, { y: '0' }, { y: `-${H * (numItem - 2)}vh`, duration: 1, ease: 'none' }, 0)
        lastTl.from(lastItems, { height: '66vh', duration: 1, ease: 'none' }, 0)
        lastTl.to(lastCarousel, { y: `-${H * (numItem - 3)}vh`, duration: 0.75, ease: 'none' }, 1)
        lastTl.to(lastContent, { y: `-${H * (numItem - 1)}vh`, duration: 0.75, ease: 'none' }, 1)
        lastTl.to(lastItems, {
          height: '37.5vh',
          duration: 0.75,
          ease: 'power1.inOut',
          onStart: () => lastContentTl.play(),
          onReverseComplete: () => lastContentTl.reverse(),
        }, 1)

        ScrollTrigger.create({
          animation: lastTl,
          containerAnimation: trackTl,
          trigger: lastProject,
          start: 'left 0%',
          end: `left -${widthPin - adjust}%`,
          scrub: 0,
          invalidateOnRefresh: true,
        })
      }

      /* 6. closing panel: content to measured 37.5% + flipMedia parallax */
      if (cierre) {
        const cierreContent = cierre.querySelector('.mod-scroll__cierre__content')
        const cierreMedia = cierreContent.querySelector('.mod-scroll__cierre__content__image')

        const cierreTl = gsap.timeline({ paused: true })
        cierreTl.fromTo(cierreContent, { x: '0%' }, { x: `${CIERRE_X_END}%`, ease: 'none' }, 0)
        ScrollTrigger.create({
          animation: cierreTl,
          containerAnimation: trackTl,
          trigger: cierre,
          start: 'left 0%',
          end: `left -${CIERRE_X_END}%`,
          scrub: 0,
          invalidateOnRefresh: true,
        })

        // flipMedia upDown (reference main.js): up slides up, down media
        // source parallaxes; both also enter from x -100%
        const flipTl = gsap.timeline({ paused: true })
        const dur = 1.5
        flipTl.to(cierreMedia.querySelector('.flipMedia__media--up'), { y: '-105%', duration: dur, ease: 'power3.out' }, 0)
        flipTl.from(cierreMedia.querySelector('.flipMedia__media--down .media__source'), { y: '-10%', duration: dur + 0.5, ease: 'power3.out' }, 0)
        ScrollTrigger.create({
          animation: flipTl,
          containerAnimation: trackTl,
          trigger: cierreContent,
          start: 'left 100%',
          end: 'left 0%',
          scrub: 0.1,
          invalidateOnRefresh: true,
        })

        const parallaxTl = gsap.timeline({ paused: true })
        parallaxTl.from(cierreMedia.querySelectorAll(':scope > *'), { x: '-100%', ease: 'none' }, 0)
        ScrollTrigger.create({
          animation: parallaxTl,
          containerAnimation: trackTl,
          trigger: cierreContent,
          start: 'left 100%',
          end: 'left 0%',
          scrub: 0.1,
          invalidateOnRefresh: true,
        })
      }

      /* 7. button rollovers (JS-driven, deterministic + reversible) */
      const btns = Array.from(sc.querySelectorAll('a.btn:not(.disabled)'))
      btns.forEach((btn) => {
        const first = btn.querySelector('.btn--label > span:first-child')
        const second = btn.querySelector('.btn--label > span:last-child')
        if (!first || !second) return
        const over = () => {
          btn.classList.add('hover')
          gsap.to(first, { yPercent: -100, duration: 0.4, ease: 'power3.inOut' })
          gsap.to(second, { yPercent: 0, duration: 0.4, ease: 'power3.inOut' })
        }
        const out = () => {
          btn.classList.remove('hover')
          gsap.to(first, { yPercent: 0, duration: 0.4, ease: 'power3.inOut' })
          gsap.to(second, { yPercent: 100, duration: 0.4, ease: 'power3.inOut' })
        }
        btn.addEventListener('mouseenter', over)
        btn.addEventListener('mouseleave', out)
        cleanups.push(() => {
          btn.removeEventListener('mouseenter', over)
          btn.removeEventListener('mouseleave', out)
        })
      })

      const onResize = () => {
        measureFinalDist()
        wrap.style.height = `${window.innerHeight + finalDist}px`
        ScrollTrigger.refresh()
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
      }
    }

    const recalc = () => {
      if (!built) build()
      ScrollTrigger.refresh()
    }
    recalc()
    document.fonts.ready.then(recalc)

    const onLoad = () => recalc()
    window.addEventListener('load', onLoad)
    cleanups.push(() => window.removeEventListener('load', onLoad))

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
              style={i === 0 ? { paddingLeft: '6.05vw' } : i === 2 ? { paddingLeft: '10.09vw' } : { paddingRight: '1.51vw' }}
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
                className={i === 0 ? 'on' : i === 1 ? 'prev' : ''}
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
                    {p.title}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* last panel: carousel + text */}
          <div
            className={`mod-scroll__projects__item last-item ${LAST_PROJECT.bg}`}
            style={{ width: '60vw' }}
          >
            <div className="mod-scroll__projects__item__content">
              <div className="media mod-scroll__projects__item__image noAnimate no-general-anim" data-delay="">
                <div className="media__wrap-source image" style={{ aspectRatio: LAST_PROJECT.ratio }}>
                  <img
                    className="media__source w-100"
                    src={LAST_PROJECT.img}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>

              <div className="mod-scroll__projects__item__text">
                <div className="mod-scroll__projects__item__text__data">
                  <div className="f-edit t-parrafo-l"><span>{LAST_PROJECT.year}</span></div>
                  <div className="f-izmir t-parrafo-l"><span>{LAST_PROJECT.place}</span></div>
                  <div className="f-izmir t-parrafo data-number">{LAST_PROJECT.num}</div>
                  <ProjectButton item={LAST_PROJECT} />
                </div>
                <div className={`mod-scroll__projects__item__text__title t-upper ${LAST_PROJECT.titleFont} t-titulo-xxl`}>
                  {LAST_PROJECT.title}
                </div>
              </div>

              <div className="last-item__carousel" style={{ transform: 'translateY(100vh)' }}>
                {LAST_PROJECT.carousel.map((c, i) => (
                  <div key={i} className="last-item__carousel__item" style={{ height: '66vh' }}>
                    <div className="media last-item__carousel__item__image noAnimate no-general-anim" data-delay="">
                      <div className="media__wrap-source image" style={{ aspectRatio: c.ratio }}>
                        <img className="media__source w-100" src={c.img} alt="" loading="lazy" decoding="async" />
                      </div>
                    </div>
                  </div>
                ))}
                <a
                  href="https://normalisboring.es/proyectos/"
                  className="last-item__carousel__item last-item__carousel__item--link btn btn--bg btn--bg-inv btn--bg-blue bg-blue f-edit"
                >
                  <svg
                    className="last-item__carousel__item__arrow btn__image"
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="25.815"
                    viewBox="0 0 28 25.815"
                  >
                    <g id="Grupo_12667" data-name="Grupo 12667" transform="translate(-7871.062 19814.479)">
                      <path id="Línea_6" data-name="Línea 6" d="M16.962-.067H-1V-1H16.962Z" transform="translate(7881.317 -19813.479)" />
                      <path id="Línea_7" data-name="Línea 7" d="M-.067,17.665H-1V-1h.933Z" transform="translate(7899.129 -19813.479)" />
                      <path id="Línea_8" data-name="Línea 8" d="M-.045,24.641l-.633-.686L26.069-.735l.633.686Z" transform="translate(7871.74 -19813.305)" />
                    </g>
                  </svg>
                  <span className="last-item__carousel__item__text t-titulo-l">View all</span>
                </a>
              </div>

              <div className="last-item__content" style={{ width: '40vw', transform: 'translateX(60vw)' }}>
                <div className="last-item__content__wrap">
                  <div className="last-item__content__section f-edit t-parrafo">Projects</div>
                  <div className="last-item__content__title">
                    {LAST_PROJECT.titleLines.map((line, i) => (
                      <div key={i} className={`line f-regular t-titulo-xxl t-upper lh-less col-12 align-left ${line.align}`}>
                        {line.text}
                      </div>
                    ))}
                  </div>
                  <div className="last-item__content__text">
                    <p>{LAST_PROJECT.text}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- C) CLOSING PANEL ---------- */}
        <div className="mod-scroll__cierre bg-red c-black">
          <div className="mod-scroll__cierre__content">
            <div className="mod-scroll__cierre__content__image flipMedia flipMedia--upDown">
              <div className="media flipMedia__media flipMedia__media--down noAspect noAnimate no-general-anim" data-delay="">
                <div className="media__wrap-source image">
                  <img className="media__source w-100" src={CIERRE.down} alt="" loading="lazy" decoding="async" />
                </div>
              </div>
              <div className="media flipMedia__media flipMedia__media--up noAspect noAnimate no-general-anim" data-delay="">
                <div className="media__wrap-source image">
                  <img className="media__source w-100" src={CIERRE.up} alt="" loading="lazy" decoding="async" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
