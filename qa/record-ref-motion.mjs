// STEP 1b: continuous motion sample of the reference.
// Wheel at a constant 100px/16ms for 1.5s; rAF-log track x + a title char
// transform in page context. Output qa/ref/motion-<W>x<H>.json
import { writeFileSync, mkdirSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, wheel, sleep } from './lib/cdp.mjs'

const URL = 'https://normalisboring.es/'
const OUT_DIR = 'C:\\Users\\DK\\Desktop\\interior design\\qa\\ref'
mkdirSync(OUT_DIR, { recursive: true })
const VP = JSON.parse(process.env.VP_JSON || '{"w":1440,"h":900}')
const PORT = 9251 + (VP.w % 100)

const chrome = launchChrome(PORT, `ref-motion-${VP.w}`, { w: VP.w, h: VP.h })
const { ws, send } = await connectCDP(PORT)
try {
  await send('Runtime.enable')
  await setViewport(send, VP.w, VP.h)
  await send('Page.navigate', { url: URL })
  for (let i = 0; i < 220; i++) {
    const r = await evalJS(send, `(() => {
      const pre = document.querySelector('.preloader, .preloader-wrap, [class*=preload]')
      const preGone = !pre || getComputedStyle(pre).display === 'none'
      let lenisOk = false
      try { lenisOk = typeof lenis !== 'undefined' && lenis.isStopped === false } catch (e) {}
      return preGone && lenisOk && !!document.querySelector('.mod-scroll__projects__item__text__title .char')
    })()`).catch(() => null)
    if (r) break
    await sleep(350)
  }
  await evalJS(send, `(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
  await sleep(2000)

  // settle well into the horizontal phase where the track moves
  let guard = 0
  while (guard++ < 300) {
    const info = await evalJS(send, `(() => { const t = document.querySelector('.mod-scroll__projects'); const m = t ? new DOMMatrix(getComputedStyle(t).transform) : null; return JSON.stringify({ y: window.scrollY, x: m ? m.e : 0 }) })()`).catch(() => null)
    const o = JSON.parse(info)
    if (o.y > 1500 && o.x < -800) break
    await wheel(send, 120)
    await sleep(60)
  }
  await sleep(1200)

  // arm rAF logger
  await evalJS(send, `
  (() => {
    window.__MOTION__ = []
    const t = document.querySelector('.mod-scroll__projects')
    const ch = document.querySelector('.mod-scroll__projects__item__text__title .char')
    const log = () => {
      const m = t ? new DOMMatrix(getComputedStyle(t).transform) : null
      const cm = ch ? new DOMMatrix(getComputedStyle(ch).transform) : null
      window.__MOTION__.push({
        t: performance.now(),
        y: window.scrollY,
        x: m ? Math.round(m.e * 100) / 100 : null,
        chy: cm ? Math.round(cm.f * 100) / 100 : null,
      })
      window.__MOTION_RAF__ = requestAnimationFrame(log)
    }
    window.__MOTION_RAF__ = requestAnimationFrame(log)
    return true
  })()`)

  // wheel 100px every 16ms for 1.5s
  const t0 = Date.now()
  while (Date.now() - t0 < 1500) {
    await wheel(send, 100, VP.w / 2, VP.h / 2)
    await sleep(16)
  }
  await sleep(800)
  // stop logger
  await evalJS(send, `(() => { cancelAnimationFrame(window.__MOTION_RAF__); return true })()`).catch(() => {})
  const data = await evalJS(send, `JSON.stringify(window.__MOTION__)`)
  const arr = JSON.parse(data)
  writeFileSync(`${OUT_DIR}\\motion-${VP.w}x${VP.h}.json`, JSON.stringify({ viewport: VP, n: arr.length, samples: arr }, null, 1))
  console.log(`[motion ${VP.w}x${VP.h}] saved ${arr.length} frames, y0=${arr[0] && arr[0].y} y1=${arr[arr.length - 1] && arr[arr.length - 1].y} x0=${arr[0] && arr[0].x} x1=${arr[arr.length - 1] && arr[arr.length - 1].x}`)
} finally {
  ws.close()
  chrome.kill()
}
