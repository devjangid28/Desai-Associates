import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 4174

const preview = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })

const waitPort = async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}`)
      if (r.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview not reachable')
}
await waitPort()

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(`http://127.0.0.1:${PORT}/?qa=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
for (let i = 0; i < 15; i++) {
  const ok = await page.evaluate(() => !!(window.__QA && window.__QA.state && window.__QA.state().modelReady))
  if (ok) break
  await page.evaluate((o) => window.scrollTo(0, o), i * 800)
  await new Promise((r) => setTimeout(r, 700))
}

const out = await page.evaluate(() => ({
  modelReady: window.__QA ? window.__QA.state().modelReady : false,
  error: window.__QA ? window.__QA.state().error : null,
  calls: window.__QA ? window.__QA.reportInfo().calls : null,
  triangles: window.__QA ? window.__QA.reportInfo().triangles : null,
}))
const glb = await fetch(`http://127.0.0.1:${PORT}/assets/shop-small.glb`)
const buf = new Uint8Array(await glb.arrayBuffer())
out.glb = { status: glb.status, magic: String.fromCharCode(buf[0], buf[1], buf[2], buf[3]), bytes: buf.length }
out.errors = errors
console.log(JSON.stringify(out, null, 1))

await browser.close()
preview.kill()
