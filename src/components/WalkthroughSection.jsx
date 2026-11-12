import { useEffect, useRef, useState } from 'react'
import { WalkthroughController } from '../lib/walkthrough/controller.js'
import { BUILD_STAMP } from '../lib/walkthrough/config.js'
import './WalkthroughSection.css'

function modeFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return {
    debug: params.get('debug') === '1',
    test: params.get('test') === '1',
  }
}

export default function WalkthroughSection() {
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const loadBarRef = useRef(null)
  const loadTextRef = useRef(null)
  const loadWrapRef = useRef(null)
  const errorRef = useRef(null)
  const enterBtnRef = useRef(null)
  const testOutsideRef = useRef(null)
  const testInsideRef = useRef(null)
  const hintRef = useRef(null)
  const captionRef = useRef(null)
  const progressRef = useRef(null)
  const releaseRef = useRef(null)
  const typeRef = useRef(null)
  const labelsRef = useRef(null)

  const { debug, test } = modeFromUrl()
  const [pinned] = useState(() => {
    if (test) return false
    if (typeof window === 'undefined') return true
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const debugFieldsRef = useRef(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const controller = new WalkthroughController(stage, {
      canvas: canvasRef.current,
      loadWrap: loadWrapRef.current,
      loadBar: loadBarRef.current,
      loadText: loadTextRef.current,
      errorEl: errorRef.current,
      enterBtn: enterBtnRef.current,
      testOutsideBtn: testOutsideRef.current,
      testInsideBtn: testInsideRef.current,
      hintEl: hintRef.current,
      captionEl: captionRef.current,
      progressFill: progressRef.current,
      releaseEl: releaseRef.current,
      typeEl: typeRef.current,
      labelsEl: labelsRef.current,
      debugFields: debugFieldsRef.current,
    })
    controller.init()
    return () => controller.dispose()
  }, [])

  const handleSkip = (e) => {
    e.preventDefault()
    const target = document.getElementById('next-section')
    if (!target) return
    const lenis = window.__lenis
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(target, { offset: 0, duration: 1.6 })
    } else {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className={pinned ? 'wt-pin wt-pin-active' : 'wt-pin'}>
    <section ref={stageRef} className={`wt-stage${test ? ' wt-test-mode' : ''}`} aria-label="3D shop walkthrough">
      <canvas ref={canvasRef} className="wt-canvas" />

      <div ref={loadWrapRef} className="wt-load">
        <div className="wt-load-bar-track">
          <div ref={loadBarRef} className="wt-load-bar" />
        </div>
        <span ref={loadTextRef} className="wt-load-text">Loading…</span>
      </div>

      <div ref={errorRef} className="wt-error" style={{ display: 'none' }} />

      <button ref={enterBtnRef} type="button" className="wt-enter" style={{ display: 'none' }}>
        Enter the shop
      </button>

      <a href="#next-section" className="wt-skip" onClick={handleSkip}>Skip walkthrough</a>

      <div className="wt-progress"><div ref={progressRef} className="wt-progress-fill" /></div>

      <div className="wt-vignette" />
      <div className="wt-grain" aria-hidden="true" />
      <div ref={typeRef} className="wt-type" aria-hidden="true" />
      <div ref={labelsRef} className="wt-labels" aria-hidden="true" />
      <div ref={releaseRef} className="wt-release" data-op="0" />

      <div ref={hintRef} className="wt-hint">Drag to look around</div>

      <div ref={captionRef} className="wt-caption" />

      {test && (
        <div className="wt-test-actions">
          <button ref={testOutsideRef} type="button" className="wt-test-btn">Outside</button>
          <button ref={testInsideRef} type="button" className="wt-test-btn">Go inside</button>
        </div>
      )}

      {debug && (
        <div ref={debugFieldsRef} className="wt-debug">
          <div className="wt-debug-title">walkthrough debug — build {BUILD_STAMP}</div>
          <div><span className="k">model</span><span className="v" data-dbg="model" /></div>
          <div><span className="k">loaded</span><span className="v" data-dbg="mb" /></div>
          <div><span className="k">orig box</span><span className="v" data-dbg="obox" /></div>
          <div><span className="k">centred box</span><span className="v" data-dbg="cbox" /></div>
          <div><span className="k">entrance</span><span className="v" data-dbg="entrance" /></div>
          <div><span className="k">door (D)</span><span className="v" data-dbg="door" /></div>
          <div><span className="k">p</span><span className="v" data-dbg="p" /></div>
          <div><span className="k">phase</span><span className="v" data-dbg="phase" /></div>
          <div><span className="k">camera</span><span className="v" data-dbg="cam" /></div>
          <div><span className="k">dist to centre</span><span className="v" data-dbg="dist" /></div>
          <div><span className="k">inside box</span><span className="v" data-dbg="inside" /></div>
          <div><span className="k">pitch</span><span className="v" data-dbg="pitch" /></div>
          <div><span className="k">fov</span><span className="v" data-dbg="fov" /></div>
          <div><span className="k">roof</span><span className="v" data-dbg="roof" /></div>
          <div><span className="k">cutY</span><span className="v" data-dbg="cutY" /></div>
          <div><span className="k">uPlan</span><span className="v" data-dbg="uplan" /></div>
          <div><span className="k">name op</span><span className="v" data-dbg="nameop" /></div>
          <div><span className="k">labels op</span><span className="v" data-dbg="labop" /></div>
          <div><span className="k">canvas px</span><span className="v" data-dbg="px" /></div>
          <div><span className="k">renders</span><span className="v" data-dbg="renders" /></div>
          <div><span className="k">fx</span><span className="v" data-dbg="fx" /></div>
          <div><span className="k">error</span><span className="v wt-debug-err" data-dbg="err" /></div>
          <div className="wt-debug-hint">E cycle side · D cycle door · R raycast once</div>
        </div>
      )}
    </section>
    </div>
  )
}
