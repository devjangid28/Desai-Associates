import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { Flip } from 'gsap/Flip'
import { CustomEase } from 'gsap/CustomEase'
import './Preloader.css'

gsap.registerPlugin(SplitText, Flip, CustomEase)

const DUR_S = 0.4
const DUR_M = 0.8
const DUR_L = 1.2
const STAGGER = 0.1
const DELAY_REVEAL = 0.3

const CLIP_OPEN =
  'polygon(0% 0%, 0% 100%, 45% 100%, 45% 50%, 55% 50%, 55% 50%, 45% 50%, 45% 100%, 100% 100%, 100% 0%)'
const CLIP_CLOSED =
  'polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 100%, 100% 100%, 100% 0%)'

export default function Preloader({
  logo,
  titleWords = ['A New', 'Standard', 'Of', 'Living'],
  label = 'Lenval Properties',
  sublabel = 'Boutique Developer of Private Residences',
  loaderLabel = 'Loading',
  image = '/images/project-j-3.webp',
  shadowVideo = '/videos/shadow_leaves.webm',
  shadowPoster = '',
  showShadow = true,
  pageRef,
  onComplete,
  short = false,
}) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const el = (sel) => root.querySelector(sel)
    const els = (sel) => Array.from(root.querySelectorAll(sel))

    const hEl = el('[data-el="h"]')
    const pEls = els('[data-el="p"]')
    const ctnEls = els('[data-el="ctn"]')
    const words = els('[class*="preloader__title_w"]')
    const logoCtn = el('[data-preloader-logo]')
    const imgWrap = el('.preloader__img')
    const img = el('.preloader__img img')
    const loader = el('.preloader__loader')
    const percent = el('[data-percent]')

    const page = pageRef?.current

    if (!CustomEase.get('loaderEase')) {
      CustomEase.create(
        'loaderEase',
        'M0,0,C0,0,0.13,0.34,0.238,0.442,0.305,0.506,0.322,0.514,0.396,0.54,0.478,0.568,0.468,0.56,0.522,0.584,0.572,0.606,0.61,0.719,0.714,0.826,0.79,0.904,0.86,1,1,1',
      )
    }

    const lockScroll = () => {
      document.documentElement.style.overflow = 'hidden'
    }
    const unlockScroll = () => {
      document.documentElement.style.overflow = ''
    }

    const revealTextH = () => {
      if (!hEl || !hEl.textContent.trim()) return
      if (!hEl._split) {
        hEl._split = new SplitText(hEl, {
          type: 'lines,words',
          tag: 'span',
          linesClass: 'split-line',
          wordsClass: 'split-word',
          mask: 'lines',
        })
        hEl.querySelectorAll('.split-line').forEach((line) => {
          if (line.textContent.trim() === '') line.replaceWith(document.createElement('br'))
        })
      }
      gsap.fromTo(
        hEl._split.words,
        { yPercent: 135 },
        { yPercent: 0, duration: DUR_L, delay: DELAY_REVEAL, stagger: STAGGER, ease: 'Out', overwrite: true },
      )
    }

    const revealTextP = () => {
      pEls.forEach((p, i) => {
        if (!p.textContent.trim()) return
        if (!p._split) {
          p._split = new SplitText(p, {
            type: 'lines,words',
            tag: 'span',
            linesClass: 'split-line',
            wordsClass: 'split-word',
            mask: 'lines',
          })
          p.querySelectorAll('.split-line').forEach((line) => {
            if (line.textContent.trim() === '') line.replaceWith(document.createElement('br'))
          })
        }
        gsap.fromTo(
          p._split.lines,
          { yPercent: 110 },
          {
            yPercent: 0,
            duration: DUR_L,
            delay: DELAY_REVEAL + i * STAGGER,
            stagger: STAGGER,
            ease: 'Out',
            overwrite: true,
          },
        )
      })
    }

    const revealCtn = () => {
      if (!ctnEls.length) return
      gsap.fromTo(
        ctnEls,
        { opacity: 0, y: '3.333rem' },
        { opacity: 1, y: '0rem', duration: DUR_L, delay: DELAY_REVEAL, stagger: STAGGER, ease: 'Out', overwrite: true },
      )
    }

    // ---------- short (returning visitor) variant ----------
    if (short) {
      if (page) gsap.fromTo(page, { opacity: 0 }, { opacity: 1, duration: DUR_L, ease: 'Out' })
      gsap.set(root, { display: 'none' })
      onComplete?.()
      return
    }

    // ---------- full intro ----------
    lockScroll()
    gsap.set([hEl, ...pEls, ...ctnEls], { visibility: 'visible' })
    gsap.set([...words, logoCtn], { translateZ: 10 })
    gsap.set(imgWrap, { clipPath: 'inset(50% 0% 50% 0%)' })
    gsap.set(img, { scale: 1.2, translateZ: 10 })

    const flipTo = (cellPrefix, logoCell, withScale, moveLogo = true) => {
      const targets = [...words]
      if (moveLogo) targets.push(logoCtn)
      const state = Flip.getState(targets)
      words.forEach((w, i) => {
        root.querySelector(`.preloader__title-${cellPrefix}_c${i + 1}`).appendChild(w)
      })
      if (moveLogo) {
        root.querySelector(`.preloader__logo_${logoCell}`).appendChild(logoCtn)
      }
      Flip.from(state, {
        duration: DUR_L,
        ease: 'InOut',
        stagger: STAGGER,
        scale: withScale,
        overwrite: true,
      })
    }

    const intro = gsap.timeline()
      .add(() => flipTo('p2', 'p2', true))
      .to({}, { duration: DUR_L + 4 * STAGGER })
      .add(() => flipTo('p3', 'p3', true))
      .fromTo(
        imgWrap,
        { clipPath: 'inset(50% 0% 50% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: DUR_L - 0.2, ease: 'InOut' },
        '<+=0.2',
      )
      .fromTo(
        img,
        { scale: 1.2, translateZ: 10 },
        { scale: 1, translateZ: 10, duration: DUR_L - 0.2, ease: 'InOut' },
        '<',
      )
      .to({}, { duration: DUR_S })
      .add(() => flipTo('p2', 'p2', false, false))
      .to(imgWrap, { clipPath: 'inset(50% 0% 50% 0%)', duration: DUR_L - 0.4, ease: 'InOut' }, '<')
      .to(img, { scale: 1.2, translateZ: 10, duration: DUR_L - 0.4, ease: 'InOut' }, '<')

    const counter = gsap.timeline()
      .add(() => {
        revealTextH()
        revealTextP()
        revealCtn()
      })
      .to({}, { duration: DUR_L })
      .to(
        { val: 0 },
        {
          val: 100,
          duration: 3,
          ease: 'loaderEase',
          onUpdate: function () {
            const v = this.targets()[0].val
            if (percent) percent.textContent = `${String(Math.round(v)).padStart(2, '0')}%`
            if (loader) loader.style.setProperty('--progress', v / 100)
          },
        },
      )
      .add(intro, '<')
      .fromTo(root, { clipPath: CLIP_OPEN }, { clipPath: CLIP_CLOSED, duration: 1.5 * DUR_L, ease: 'InOut' })
      .fromTo(
        page,
        { scale: 0.5, translateZ: 10, transformOrigin: 'center 50vh' },
        { scale: 1, translateZ: 10, duration: 1.5 * DUR_L, ease: 'InOut' },
        '<',
      )
      .add(() => {
        gsap.set(root, { display: 'none' })
        if (page) gsap.set(page, { clearProps: 'scale,transformOrigin' })
        unlockScroll()
        onComplete?.()
      })

    return () => {
      intro.kill()
      counter.kill()
      unlockScroll()
    }
  }, [short, onComplete, pageRef])

  return (
    <div className="preloader" data-preloader ref={rootRef} aria-hidden="true">
      <div className="preloader__bg">
        <div className="grid preloader__bg-grid">
          <div className="preloader__bg-line is-1"><div className="line-v" /></div>
          <div className="preloader__bg-line is-2"><div className="line-v" /></div>
          <div className="preloader__bg-line is-3"><div className="line-v" /></div>
        </div>
      </div>

      {showShadow && (
        <div className="preloader__shadow">
          <video className="preloader__shadow-video" autoPlay muted loop playsInline preload="auto" poster={shadowPoster}>
            <source src={shadowVideo} type="video/webm" />
          </video>
        </div>
      )}

      <div className="preloader__c">
        <div className="preloader__t" />

        <div className="grid preloader__logo-row">
          <div className="preloader__logo_p2" />
          <div className="preloader__logo_p3" />
        </div>

        <div className="preloader__c_c h1">
          <div className="preloader__u" />
          <div className="preloader__cell is-top">
            <div className="grid"><span className="preloader__title-p3_c4" /></div>
          </div>
          <div className="preloader__cell">
            <div className="grid"><span className="preloader__title-p3_c1" /></div>
          </div>
          <div className="preloader__cell">
            <div className="grid">
              <span className="preloader__title-p1" data-el="h" data-prevent-flicker>
                {titleWords.map((w, i) => (
                  <span key={i} className={`preloader__title_w${i + 1}`}>{w}</span>
                ))}
              </span>

              <div className="preloader__logo_p1">
                <div className="preloader__logo_c" data-preloader-logo data-el="ctn" data-prevent-flicker>
                  {logo}
                </div>
              </div>

              <span className="preloader__title-p2_c1" />
              <span className="preloader__title-p2_c2" />
              <span className="preloader__title-p2_c3" />
              <span className="preloader__title-p2_c4" />

              <span className="preloader__title-p3_c2" />

              <div className="preloader__img-w">
                <div className="preloader__img">
                  <div className="preloader__img-inner">
                    <img src={image} alt="" loading="eager" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="preloader__cell" />
          <div className="preloader__cell is-bot">
            <div className="grid"><span className="preloader__title-p3_c3" /></div>
          </div>
          <div className="preloader__u" />
        </div>

        <div className="preloader__b">
          <div className="grid">
            <div className="preloader__desc">
              <div className="l1 text-cream" data-el="p" data-prevent-flicker>{label}</div>
              <div className="h3 s text-cream" data-el="p" data-prevent-flicker>{sublabel}</div>
            </div>
          </div>
          <div className="preloader__u" />
        </div>

        <div className="preloader__loader">
          <div className="grid">
            <div className="preloader__loader_label">
              <div className="h3 text-cream" data-el="p" data-prevent-flicker>{loaderLabel}</div>
            </div>
            <div className="preloader__loader_percent">
              <div className="h3 text-cream" data-el="p" data-prevent-flicker data-percent>00%</div>
            </div>
          </div>
          <div className="preloader__loader-line"><div className="line-h" /></div>
        </div>
      </div>
    </div>
  )
}
