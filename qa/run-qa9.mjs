import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const QA_DIR = path.join(ROOT, 'qa')
const DEV_PORT = 5196
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const DESK_P = [0.34, 0.38, 0.52, 0.56, 0.6, 0.64, 0.66, 0.7, 0.8, 0.93]
const MOB_P = [0.34, 0.52, 0.6]

function waitForPort(url, timeoutMs = 60000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = async () => {
      try { const r = await fetch(url); if (r.ok) return resolve() } catch { /* */ }
      if (Date.now() - start > timeoutMs) return reject(new Error(`timeout ${url}`))
      setTimeout(check, 300)
    }
    check()
  })
}
function startServer(args) {
  return spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: false })
}
async function waitModelReady(page) {
  for (let a = 0; a < 18; a++) {
    const r = await page.evaluate(() => !!(window.__QA && window.__QA.state && window.__QA.state().modelReady === true))
    if (r) break
    await page.evaluate((o) => window.scrollTo(0, o), 1200 + a * 700)
    await new Promise((r) => setTimeout(r, 700))
  }
  return page.evaluate(() => !!(window.__QA && window.__QA.state && window.__QA.state().modelReady === true))
}
async function shots(page, dir, list, results) {
  mkdirSync(dir, { recursive: true })
  const out = []
  for (const p of list) {
    const m = await page.evaluate((pp) => window.__QA.stepMeasure(pp), p)
    const file = path.join(dir, `qa_p${String(Math.round(p * 100)).padStart(3, '0')}.png`)
    await page.screenshot({ path: file })
    out.push({ p, file, inside: m.inside, fov: +m.fov.toFixed(1) })
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
    return { frames: samples.length, avgMs: +samples.reduce((a, b) => a + b, 0) / samples.length, p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2) }
  })
}

async function runDesktop(browser, results) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.evaluateOnNewDocument(() => {
    window.__PERF_P = [0.05, 0.25, 0.34, 0.45, 0.6, 0.8]
    window.__LONGTASKS = []
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__LONGTASKS.push(e.duration) }).observe({ type: 'longtask', buffered: true })
    } catch { /* */ }
  })
  await page.goto(`http://127.0.0.1:${DEV_PORT}/?fx=2&debug=1&qa=1&labels=1`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = await waitModelReady(page)
  const r = { loaded: ready, pageErrors: errors }
  if (!ready) { results.desktop = r; await page.close(); return }
  r.roof = await page.evaluate(() => window.__QA.roofInfo())
  r.labels = await page.evaluate(() => window.__QA.labelsInfo())
  r.facade = await page.evaluate(() => window.__QA.facadeInfo())
  r.planFit = await page.evaluate(() => window.__QA.planFitInfo())
  r.planRects = await page.evaluate(() => window.__QA.planRects())
  r.labelReport = await page.evaluate(() => window.__QA.labelReport())
  r.marker = await page.evaluate(() => window.__QA.markerAtPlan())
  r.fixC = await page.evaluate(() => window.__QA.fixCTable())
  r.probes = {}
  for (const p of [0.52, 0.56, 0.6, 0.64, 0.66]) r.probes[p] = await page.evaluate((pp) => window.__QA.probe(pp), p)
  r.passChecks = await page.evaluate(() => window.__QA.passChecks())
  r.depth = await page.evaluate(() => window.__QA.depthRows())
  r.reversal = await page.evaluate(() => window.__QA.reversalCheck())
  r.perf = {}
  r.perf.jsOnlyMs = await page.evaluate(() => window.__QA.jsFrameMs())
  r.perf.unthrottled = await bench(page)
  const client = await page.target().createCDPSession()
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  r.perf.throttled4x = await bench(page)
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  r.programsBefore = await page.evaluate(() => window.__QA.reportInfo().programs)
  await page.evaluate(() => { const q = window.__QA; for (let i = 0; i <= 1000; i++) q.step(i / 1000) })
  r.programsAfter = await page.evaluate(() => window.__QA.reportInfo().programs)
  await page.evaluate(() => window.__QA.step(0.5))
  const rc0 = await page.evaluate(() => window.__QA.perfHarvest().renderCount)
  await new Promise((res) => setTimeout(res, 2000))
  const rc1 = await page.evaluate(() => window.__QA.perfHarvest().renderCount)
  r.idleRendersPerSecond = (rc1 - rc0) / 2
  await page.evaluate(() => { window.__LONGTASKS = [] })
  const pin = await page.evaluate(() => { const el = document.querySelector('.wt-pin'); return { top: el.offsetTop, range: el.offsetHeight - window.innerHeight } })
  for (let i = 0; i <= 90; i++) {
    await page.mouse.wheel({ deltaY: (pin.range / 90) * (i < 45 ? 1 : -1) })
    await new Promise((res) => setTimeout(res, 25))
  }
  await new Promise((res) => setTimeout(res, 500))
  r.longtasks = await page.evaluate(() => window.__LONGTASKS || [])
  await shots(page, path.join(QA_DIR, 'desktop9'), DESK_P, r)
  results.desktop = r
  await page.close()
}

async function runMobile(browser, results) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
  await page.goto(`http://127.0.0.1:${DEV_PORT}/?fx=1&debug=1&qa=1`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = await waitModelReady(page)
  const r = { loaded: ready }
  if (!ready) { results.mobile = r; await page.close(); return }
  r.planFit = await page.evaluate(() => window.__QA.planFitInfo())
  r.planRects = await page.evaluate(() => window.__QA.planRects())
  r.labelReport = await page.evaluate(() => window.__QA.labelReport())
  r.fixC = await page.evaluate(() => window.__QA.fixCTable())
  await shots(page, path.join(QA_DIR, 'mobile9'), MOB_P, r)
  results.mobile = r
  await page.close()
}

async function main() {
  const results = {}
  const dev = startServer(['--host', '127.0.0.1', '--port', String(DEV_PORT), '--strictPort'])
  await waitForPort(`http://127.0.0.1:${DEV_PORT}`)
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--force-color-profile=srgb'] })
  try {
    await runDesktop(browser, results)
    await runMobile(browser, results)
  } finally {
    await browser.close()
    dev.kill()
  }
  writeFileSync(path.join(QA_DIR, 'results9.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}
main().catch((err) => { console.error(err); process.exit(1) })
