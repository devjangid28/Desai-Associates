// Summarize a recorded states file for fitting: pad curves, panel width/
// height/text vs trackX, media positions.
import { readFileSync } from 'node:fs'
const file = process.argv[2] || 'C:\\Users\\DK\\Desktop\\interior design\\qa\\ref\\states-1440x900.json'
const d = JSON.parse(readFileSync(file, 'utf8'))
const s = d.samples
const iw = d.viewport.w
const out = []
out.push(`file=${file} n=${s.length} iw=${iw} yStart=${d.yStart} yEnd=${d.yEnd}`)
const prev = (arr, i) => arr[Math.max(0, i - 1)]
out.push('--- terms pad (px) ---')
for (let i = 0; i < s.length; i += Math.max(1, Math.floor(s.length / 30))) {
  const p = s[i]
  out.push(`x=${p.trackX} pad0=${p.terms[0] && p.terms[0].pl} pad1=${p.terms[1] && p.terms[1].pr} pad2=${p.terms[2] && p.terms[2].pl}`)
}
out.push('--- panels (width, imgH, char0.f, btnOp), last.l ---')
for (let i = 0; i < s.length; i += Math.max(1, Math.floor(s.length / 60))) {
  const p = s[i]
  const parts = p.panels.map((pl, k) => {
    const c = pl.chars[0]
    return `P${k}:w=${pl.w},imgH=${pl.imgH},c0=${c ? c.f : '-'},b=${pl.btn ? pl.btn.op : '-'}`
  }).join(' | ')
  out.push(`x=${p.trackX} ${parts} last.l=${p.last ? p.last.l : '-'}`)
}
out.push('--- follow/mobile at first/last ---')
out.push('first ' + JSON.stringify(s[0].follow) + ' mobile=' + JSON.stringify(s[0].mobile))
out.push('last ' + JSON.stringify(s[s.length - 1].follow) + ' mobile=' + JSON.stringify(s[s.length - 1].mobile))
console.log(out.join('\n'))
