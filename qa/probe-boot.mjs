import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9241, 'probe-boot', { w: 1917, h: 916 })
const { ws, send } = await connectCDP(9241)
await send('Runtime.enable')
await setViewport(send, 1917, 916)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 40; i++) {
  const r = await evalJS(send, `(() => ({
    body: !!document.body,
    rootKids: document.querySelector('#root') ? document.querySelector('#root').children.length : -1,
    url: location.href,
    scrollSection: !!document.querySelector('.mod-scroll'),
    pre: !!document.querySelector('.preloader'),
  }))()`).catch((e) => ({ err: String(e) }))
  console.log(i, JSON.stringify(r))
  if (r && r.scrollSection) { console.log('section present'); break }
  await sleep(500)
}
ws.close()
chrome.kill()
