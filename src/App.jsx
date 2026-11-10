import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import Preloader from './components/Preloader.jsx'
import BrandLogo from './components/BrandLogo.jsx'
import HeroVideo from './components/HeroVideo.jsx'
import AboutSection from './components/AboutSection.jsx'
import MissionSection from './components/MissionSection.jsx'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  const pageRef = useRef(null)
  const lenisRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [short] = useState(() => Boolean(sessionStorage.getItem('hasVisited')))

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      syncTouch: true,
      touchMultiplier: 1.5,
      allowNestedScroll: true,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      infinite: false,
    })
    lenis.stop()
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)

    const raf = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [])

  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem('hasVisited', 'true')
    } catch {
      /* private mode */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) lenisRef.current?.start()
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => ScrollTrigger.refresh(), 100)
    return () => clearTimeout(t)
  }, [loaded])

  return (
    <>
      <Preloader
        logo={<BrandLogo />}
        pageRef={pageRef}
        short={short}
        onComplete={handleComplete}
        label="Desai Associates"
        image="/images/project-j-3.webp"
        shadowVideo="/videos/shadow_leaves.webm"
      />

      <div className="page" ref={pageRef} aria-hidden={!loaded}>
        <header className="demo-header">
          <div className="demo-header__logo">
            <BrandLogo />
          </div>
          <nav className="demo-header__nav">
            <span>About us</span>
            <span>Projects</span>
            <span>Contact</span>
          </nav>
        </header>

        <section className="demo-hero">
          <HeroVideo ready={loaded} />
        </section>

        <AboutSection />
        <MissionSection />
      </div>
    </>
  )
}
