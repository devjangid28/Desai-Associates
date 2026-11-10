import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { setupReveals } from '../lib/scrollReveal.js'
import './AboutSection.css'

gsap.registerPlugin(ScrollTrigger)

export default function AboutSection({
  image = '/images/project-s-1.webp',
  label = 'About',
  title = 'Desai Associates crafts timeless interiors shaped by architecture, light and material with a deep understanding of contemporary living. Each space begins with a clear vision — to create environments that balance elegance, privacy and enduring comfort. The result is design that is timeless and quietly distinctive.',
  caption = 'To craft exceptional interiors and refined experiences.',
  description = 'Desai Associates combines meticulous detailing with a refined design vision to create exceptional residential and commercial interiors. Our projects embody quality, innovation, and enduring value.\n\nEvery space is approached with an uncompromising attention to detail and a commitment to creating landmark destinations. While our foundations are in India, our vision is global: to shape the world’s most sought-after spaces.',
  cta = 'Learn more',
  shadowVideo = '/videos/shadow_home.webm',
  shadowPoster = '/images/shadow_home_poster.webp',
}) {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => setupReveals(section), section)
    return () => ctx.revert()
  }, [])

  const descriptionBlocks = description.split('\n').filter(Boolean)

  return (
    <section id="about" className="section about theme-dark" ref={sectionRef}>
      <div className="container">
        <div className="about-w">
          <div className="about-s">
            <div className="u-128" />

            <div className="grid">
              <div className="about-s_img" data-reveal>
                <div className="img-w">
                  <img src={image} alt="" loading="eager" />
                </div>
                <div className="about-s_img_line b-mob">
                  <div className="line-t-b light" />
                </div>
              </div>

              <div className="about-s_lead w-clearfix">
                <div className="red-line_title">
                  <div className="l1 text-dark" data-reveal="p">{label}</div>
                </div>
                <h2 className="h2 text-dark text-pretty" data-reveal="p">{title}</h2>
                <div className="u-64" />
                <div className="b-mob">
                  <div className="page-divider"><div className="line-h" /></div>
                  <div className="u-8" />
                </div>
                <div className="about-s_lead_line b-mob">
                  <div className="line-lt-rb light" />
                </div>
              </div>

              <div className="about-s_content">
                <div className="grid _6-columns">
                  <div className="about-s_caption b-desk">
                    <p className="l1 med text-gray" data-reveal="p">{caption}</p>
                  </div>
                  <div className="about-s_desc">
                    <div className="u-16 b-mob" />
                    <p className="p1 text-dark" data-reveal="p">
                      {descriptionBlocks.map((block, i) => (
                        <span key={i}>
                          {i > 0 && <br />}
                          {block}
                        </span>
                      ))}
                    </p>
                    <div className="u-24" />
                    <div className="about-s_btn" data-reveal="ctn">
                      <div className="btn" hover-btn>
                        <div className="btn_label">
                          <a className="nav-item" href="#mission">
                            <div className="nav-item_label">
                              <div className="nav-item_label_text">
                                <div className="l1" hover="text">{cta}</div>
                              </div>
                              <div className="nav-item_label_text is-2">
                                <div className="l1" hover="text">{cta}</div>
                              </div>
                            </div>
                          </a>
                        </div>
                        <div className="btn_ico" hover="ico">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.6688 6.27614L4.93109 12.0139L3.98828 11.0711L9.72601 5.33333H4.66883V4H12.0021V11.3333H10.6688V6.27614Z" fill="currentColor" />
                          </svg>
                        </div>
                        <div className="btn_line" hover="line" />
                        <a className="btn_link" aria-label={cta} href="#mission" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="about-s_content_line b-mob">
                  <div className="line-t-b light" />
                </div>
              </div>
            </div>

            <div className="u-128" />
            <div className="b-mob">
              <div className="page-divider"><div className="line-h" /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="w_bg b-desk">
        <div className="w_bg_line">
          <div className="w_bg_line_100"><div className="line-t-b light" /></div>
          <div className="w_bg_line_l-50"><div className="line-lb-rt light" /></div>
        </div>
      </div>

      <div className="w_shadow about-w_shadow b-desk">
        <video className="video h-auto" autoPlay muted loop playsInline preload="auto" poster={shadowPoster}>
          <source src={shadowVideo} type="video/webm" />
        </video>
      </div>
    </section>
  )
}
