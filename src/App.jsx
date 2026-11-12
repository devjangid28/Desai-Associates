import { Component, useCallback, useEffect, useRef, useState } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import Preloader from './components/Preloader.jsx'
import BrandLogo from './components/BrandLogo.jsx'
import HeroVideo from './components/HeroVideo.jsx'
import AboutSection from './components/AboutSection.jsx'
import MissionSection from './components/MissionSection.jsx'
import WalkthroughSection from './components/WalkthroughSection.jsx'
import ScrollSection from './components/ScrollSection.jsx'
import DebugOverlay from './lib/debugOverlay.jsx'
import './App.css'

class SectionBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[SectionBoundary] scroll section failed', error, info)
  }

  render() {
    if (this.state.hasError) {
      const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
      if (debug) {
        return (
          <div style={{ padding: '2rem', fontFamily: 'monospace', fontSize: 12, color: '#b00020' }}>
            <strong>ScrollSection crashed</strong>
            <pre>{String(this.state.error && this.state.error.stack ? this.state.error.stack : this.state.error)}</pre>
          </div>
        )
      }
      return null
    }
    return this.props.children
  }
}

const readVisited = () => {
  try {
    return Boolean(sessionStorage.getItem('hasVisited'))
  } catch {
    return false
  }
}

export default function App() {
  const pageRef = useRef(null)
  const lenisRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [short] = useState(readVisited)
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
  const noSection = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nosection')

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 0.8,
      syncTouch: false,
      touchMultiplier: 1,
      allowNestedScroll: true,
    })
    lenis.stop()
    lenisRef.current = lenis
    window.__lenis = lenis
    lenis.on('scroll', ScrollTrigger.update)

    return () => {
      if (window.__lenis === lenis) delete window.__lenis
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
      {debug && <DebugOverlay />}

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
        <WalkthroughSection />
        <section id="next-section" className="next-section" aria-label="Next section" />
        {!noSection && (
          <SectionBoundary>
            <ScrollSection />
          </SectionBoundary>
        )}
      </div>
    </>
  )
}
