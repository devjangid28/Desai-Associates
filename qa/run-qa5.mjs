import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const QA_DIR = path.join(ROOT, 'qa')
const DEV_PORT = 5199
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const SHOT_FX2 = [0, 0.03, 0.06, 0.09, 0.12, 0.2, 0.27, 0.31, 0.35, 0.39, 0.43, 0.46, 0.5, 0.58, 0.68, 0.76, 0.84, 0.9, 1]
const SHOT_FX1 = [0.06, 0.35, 0.5]
const SHOT_MOBILE = [0.06, 0.35, 0.5, 0.7]
const PERF_P = [0.05, 0.1, 0.3, 0.5, 0.7, 0.88]
const CHAPTER_P = [0.06, 0.18, 0.32, 0.44, 0.51, 0.59, 0.74, 0.89, 0.97]

function waitForPort(url, timeoutMs = 60000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const r = await fetch(url)
        if (r.ok) return resolve()
      } catch {
        /* not up yet */
      }
      if (Date.now() - start > timeoutMs) return reject(new Error(`timeout waiting for ${url}`))
      setTimeout(check, 300)
    }
    check()
  })
}

function startServer(args) {
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), ...args], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })
  return { child }
}

async function waitModelReady(page) {
  for (let attempt = 0; attempt < 14; attempt++) {
    const ready = await page.evaluate(() => !!(window.__QA && window.__QA.state && window.__QA.state().modelReady === true))
    if (ready) return true
    await page.evaluate((o) => window.scrollTo(0, o), 1200 + attempt * 700)
    await new Promise((r) => setTimeout(r, 700))
  }
  return false
}

async function shots(page, dir, list, results) {
  mkdirSync(dir, { recursive: true })
  const out = []
  for (const p of list) {
    const m = await page.evaluate((pp) => window.__QA.stepMeasure(pp), p)
    const file = path.join(dir, `qa_p${String(Math.round(p * 100)).padStart(3, '0')}.png`)
    await page.screenshot({ path: file })
    out.push({ p, file, inside: m.inside, fov: +m.fov.toFixed(1), over245: +m.over245Percent.toFixed(2) })
  }
  results.shots = out
}

async function bench(page) {
  return page.evaluate(() => {
    const q = window.__QA
    const samples = []
    let i = 0
    const t0 = performance.now()
    while (performance.now() - t0 < 4000) {
      const base = window.__PERF_P[i % window.__PERF_P.length]
      const s = performance.now()
      q.step(base)
      q.step(Math.min(1, base + 0.002))
      samples.push(performance.now() - s)
      i++
    }
    const sorted = [...samples].sort((a, b) => a - b)
    return { frames: samples.length, avgMs: samples.reduce((a, b) => a + b, 0) / samples.length, p95Ms: sorted[Math.floor(sorted.length * 0.95)] || 0 }
  })
}

async function runFx(browser, fx, results) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  await page.evaluateOnNewDocument(() => {
    window.__PERF_P = [0.05, 0.1, 0.3, 0.5, 0.7, 0.88]
    window.__LONGTASKS = []
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__LONGTASKS.push(e.duration)
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      /* noop */
    }
  })
  await page.goto(`http://127.0.0.1:${DEV_PORT}/?fx=${fx}&debug=1&qa=1`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = await waitModelReady(page)
  if (!ready) {
    results[`fx${fx}`] = { loaded: false }
    await page.close()
    return
  }

  const r = { loaded: true }
  r.state = await page.evaluate(() => window.__QA.state())

  const csvRows = await page.evaluate(() => window.__QA.poseSeries())
  const fxRows = await page.evaluate(() => window.__QA.effectsSeries())
  if (fx === 2) {
    writeFileSync(path.join(QA_DIR, 'velocity.csv'), 'p,cameraX,cameraY,cameraZ,fov,pitchDeg,speed\n' + csvRows.map((v) => `${v.p},${v.x},${v.y},${v.z},${v.fov},${v.pitchDeg},${v.speed}`).join('\n'))
    writeFileSync(path.join(QA_DIR, 'effects.csv'), 'p,clipPlaneRevealY,clipPlaneRoofY,propsRiseAverage,insideValue,labelsOpacity\n' + fxRows.map((v) => `${v.p},${v.clipPlaneRevealY},${v.clipPlaneRoofY},${v.propsRiseAverage},${v.insideValue},${v.labelsOpacity}`).join('\n'))
  }

  r.perf = {}
  r.perf.unthrottled = await bench(page)
  const client = await page.target().createCDPSession()
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  r.perf.throttled4x = await bench(page)
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  await page.evaluate(() => {
    window.__LONGTASKS = []
  })
  const pin = await page.evaluate(() => {
    const el = document.querySelector('.wt-pin')
    return { top: el.offsetTop, range: el.offsetHeight - window.innerHeight }
  })
  for (let i = 0; i <= 120; i++) {
    await page.mouse.wheel({ deltaY: (pin.range / 120) * (i < 60 ? 1 : -1) })
    await new Promise((res) => setTimeout(res, 45))
  }
  await new Promise((res) => setTimeout(res, 600))
  r.longtasks = await page.evaluate(() => window.__LONGTASKS || [])

  r.programsBefore = await page.evaluate(() => window.__QA.reportInfo().programs)
  await page.evaluate(() => {
    const q = window.__QA
    for (let i = 0; i <= 500; i++) q.step(i / 500)
  })
  r.programsAfter = await page.evaluate(() => window.__QA.reportInfo().programs)

  r.chapters = []
  for (const p of CHAPTER_P) {
    const info = await page.evaluate((pp) => {
      window.__QA.step(pp)
      return window.__QA.reportInfo()
    }, p)
    r.chapters.push({ p, calls: info.calls, triangles: info.triangles })
  }

  await page.evaluate(() => window.__QA.step(0.5))
  const rc0 = await page.evaluate(() => window.__QA.perfHarvest().renderCount)
  await new Promise((res) => setTimeout(res, 2000))
  const rc1 = await page.evaluate(() => window.__QA.perfHarvest().renderCount)
  r.idleRendersPerSecond = (rc1 - rc0) / 2

  r.reversal = await page.evaluate(() => window.__QA.reversalCheck())
  r.clipAt48 = await page.evaluate(() => {
    const s = window.__QA.effectsSeries()
    const row = s.find((v) => Math.abs(v.p - 0.48) < 1e-4)
    return row
  })
  r.propsAt46 = await page.evaluate(() => {
    window.__QA.step(0.46)
    const offs = window.__QA.state() && window.__QA.propOffsets ? window.__QA.propOffsets() : null
    return offs
  })
  r.outsideAt94 = await page.evaluate(() => {
    const rows = window.__QA.poseSeries()
    return rows.find((v) => Math.abs(v.p - 0.94) < 1e-4)
  })

  results[`fx${fx}`] = r

  if (fx === 2) await shots(page, path.join(QA_DIR, 'fx2'), SHOT_FX2, r)
  if (fx === 1) await shots(page, path.join(QA_DIR, 'fx1'), SHOT_FX1, r)
  await page.close()
}

async function runMobile(browser, results) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
  await page.goto(`http://127.0.0.1:${DEV_PORT}/?fx=1&debug=1&qa=1`, { waitUntil: 'networkidle0', timeout: 90000 })
  await waitModelReady(page)
  const r = {}
  await shots(page, path.join(QA_DIR, 'mobile'), SHOT_MOBILE, r)
  results.mobile = r
  await page.close()
}

async function main() {
  const results = {}
  const dev = startServer(['--host', '127.0.0.1', '--port', String(DEV_PORT), '--strictPort'])
  await waitForPort(`http://127.0.0.1:${DEV_PORT}`)

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  })
  try {
    for (const fx of [0, 1, 2]) await runFx(browser, fx, results)
    await runMobile(browser, results)
  } finally {
    await browser.close()
    dev.child.kill()
  }

  writeFileSync(path.join(QA_DIR, 'results5.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
