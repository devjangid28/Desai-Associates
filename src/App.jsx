import { useCallback, useRef, useState } from 'react'
import Preloader from './components/Preloader.jsx'
import BrandLogo from './components/BrandLogo.jsx'
import './App.css'

export default function App() {
  const pageRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [short] = useState(() => Boolean(sessionStorage.getItem('hasVisited')))

  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem('hasVisited', 'true')
    } catch {
      /* private mode */
    }
    setLoaded(true)
  }, [])

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
          <h1 className="h1 demo-hero__title">Creators of Refined Living & Iconic Spaces</h1>
          <span className="l1 demo-hero__scroll">scroll to explore</span>
        </section>

        <section className="demo-section">
          <div className="demo-section__img">
            <img src="/images/project-j-3.webp" alt="" />
          </div>
          <h2 className="h2 demo-section__title">
            Timeless architecture shaped by light, material and intention.
          </h2>
        </section>
      </div>
    </>
  )
}
