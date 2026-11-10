import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { setupReveals } from '../lib/scrollReveal.js'
import './MissionSection.css'

gsap.registerPlugin(ScrollTrigger)

export default function MissionSection({
  image = '/images/project-s-9.webp',
  titleLeft = 'Exceptional',
  titleRightLines = ['Spaces', 'for Refined', 'Living'],
  titleOffsetWidth = '69px',
  missionLabel = 'Mission',
  missionText = 'To deliver a seamless alignment of investment intellect and high-design sophistication — controlling the narrative from conceptual strategy to spatial execution to cultivate global masterpieces of enduring relevance.',
}) {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => setupReveals(section), section)
    return () => ctx.revert()
  }, [])

  return (
    <section id="mission" className="section mission theme-dark" ref={sectionRef}>
      <div className="container">
        <div className="mission-w">
          <div className="mission-s">
            <div className="u-8" />

            <h3 className="grid h1">
              <span className="mission-s_title-l b-desk">
                <span className="mission-s_title_line" data-reveal="h">{titleLeft}</span>
              </span>
              <span className="mission-s_title-r w-clearfix">
                <span className="mission-s_title_line" data-reveal="h">{titleRightLines[0]}</span>
                <span className="mission-s_title_line">
                  <span id="" className="mission-s_title_offset" style={{ width: titleOffsetWidth }} />
                  <span data-reveal="h">{titleRightLines[1]}</span>
                </span>
                <span className="mission-s_title_line" data-reveal="h">{titleRightLines[2]}</span>
              </span>
            </h3>

            <div className="u-48" />

            <div className="grid">
              <div className="mission-s_img" data-reveal>
                <div className="img-w">
                  <img src={image} alt="" loading="eager" />
                </div>
              </div>
              <div className="mission-s_content">
                <div className="u-16" />
                <div className="grid _4-columns">
                  <div className="mission-s_title">
                    <h2 className="p1 bold" data-reveal="p">{missionLabel}</h2>
                    <div className="u-8" />
                  </div>
                  <div className="mission-s_desc">
                    <p className="p1" data-reveal="p">{missionText}</p>
                    <div className="u-128 b-mob" />
                  </div>
                </div>
              </div>
            </div>

            <div className="u-8" />
          </div>
        </div>
      </div>

      <div className="w_bg">
        <div className="w_bg_line b-desk">
          <div className="w_bg_line_100"><div className="line-t-b light" /></div>
          <div className="w_bg_line_r-50"><div className="line-lb-rt light" /></div>
        </div>
        <div className="w_bg_line b-mob">
          <div className="w_bg_line_100"><div className="line-lb-rt light" /></div>
        </div>
      </div>
    </section>
  )
}
