import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './HeroVideo.css'

gsap.registerPlugin(SplitText, ScrollTrigger)

export default function HeroVideo({
  ready = false,
  title = 'Creators of Refined Living & Iconic Spaces',
  video = '/videos/project-j_src.mp4',
  poster = '/images/project-j_poster.webp',
  project = 'Project 01',
  projectName = 'Desai Associates',
  projectLocation = 'Interior Design Studio',
}) {
  const sectionRef = useRef(null)
  const titleRef = useRef(null)
  const metaRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const v = videoRef.current
    if (!section || !v) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        v,
        { yPercent: -6, translateZ: 10 },
        {
          yPercent: 10,
          translateZ: 10,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        },
      )
    }, section)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!ready) return
    const section = sectionRef.current
    if (!section) return

    const tl = gsap.timeline()

    const h = titleRef.current
    if (h && !h._split) {
      h._split = new SplitText(h, {
        type: 'lines,words',
        tag: 'span',
        linesClass: 'split-line',
        wordsClass: 'split-word',
        mask: 'lines',
      })
      h.querySelectorAll('.split-line').forEach((line) => {
        if (line.textContent.trim() === '') line.replaceWith(document.createElement('br'))
      })
    }
    if (h?._split) {
      tl.fromTo(
        h._split.words,
        { yPercent: 135 },
        { yPercent: 0, duration: 1.2, stagger: 0.1, ease: 'Out', overwrite: true },
        0.1,
      )
    }

    tl.fromTo(
      section.querySelectorAll('[data-hero-fade]'),
      { opacity: 0, y: '2rem' },
      { opacity: 1, y: '0rem', duration: 1.2, stagger: 0.1, ease: 'Out', overwrite: true },
      0.5,
    )

    const v = videoRef.current
    if (v) {
      tl.fromTo(
        v,
        { scale: 1.1 },
        { scale: 1, duration: 1.6, ease: 'Out' },
        0,
      )
    }
  }, [ready])

  return (
    <section className="hero" ref={sectionRef}>
      <video
        className="hero__video"
        ref={videoRef}
        src={video}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="hero__grad hero__grad--top" />
      <div className="hero__grad hero__grad--bottom" />

      <div className="hero__content">
        <h1 className="h1 hero__title" ref={titleRef}>{title}</h1>

        <div className="hero__meta" ref={metaRef} data-hero-fade>
          <div className="l1 hero__meta-index">{project}</div>
          <div className="hero__meta-name">
            <div className="l1">{projectName}</div>
            <div className="h3 s">{projectLocation}</div>
          </div>
        </div>

        <div className="hero__scroll" data-hero-fade>
          <span className="l1">scroll to explore</span>
        </div>
      </div>
    </section>
  )
}
