import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(SplitText, ScrollTrigger)

const splitText = (el) => {
  if (!el._split) {
    el._split = new SplitText(el, {
      type: 'lines,words',
      tag: 'span',
      linesClass: 'split-line',
      wordsClass: 'split-word',
      mask: 'lines',
    })
    el.querySelectorAll('.split-line').forEach((line) => {
      if (line.textContent.trim() === '') line.replaceWith(document.createElement('br'))
    })
  }
  return el._split
}

/**
 * Section-level scroll reveal, mirroring the reference behaviours:
 *  - data-reveal="h"   -> animateTextH: words yPercent 135 -> 0
 *  - data-reveal="p"   -> animateTextP: lines yPercent 110 -> 0
 *  - data-reveal="ctn" -> animateCtn: opacity 0 -> 1, y 3.333rem -> 0
 *  - no value           -> fade-up container reveal
 *
 * One trigger per section plays the full sequence once the section enters
 * the viewport, so reveals always complete regardless of scroll speed.
 */
export function setupReveals(section, { stagger = 0.1, delay = 0.3 } = {}) {
  const items = Array.from(section.querySelectorAll('[data-reveal]'))
  if (!items.length) return

  const tl = gsap.timeline({ paused: true })

  items.forEach((el, i) => {
    const offset = i * stagger
    const mode = el.dataset.reveal

    if (mode === 'h' || mode === 'p') {
      const split = splitText(el)
      const targets = mode === 'h' ? split.words : split.lines
      const from = mode === 'h' ? 135 : 110
      gsap.set(targets, { yPercent: from })
      tl.to(targets, {
        yPercent: 0,
        duration: 1.2,
        delay: delay + offset,
        stagger,
        ease: 'Out',
        overwrite: true,
      }, 0)
      return
    }

    gsap.set(el, { opacity: 0, y: '3.333rem' })
    tl.to(el, {
      opacity: 1,
      y: '0rem',
      duration: 1.2,
      delay: delay + offset,
      ease: 'Out',
      overwrite: true,
    }, 0)
  })

  ScrollTrigger.create({
    trigger: section,
    start: 'top 72%',
    once: true,
    onEnter: () => tl.play(),
  })
}
