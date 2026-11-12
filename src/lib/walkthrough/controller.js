import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  WALK_CONFIG,
  PHASES,
  OUT_VECTORS,
  SIDE_VECTORS,
  BG_COLOR,
  phaseNameFor,
} from './config.js'

const UP = new THREE.Vector3(0, 1, 0)
const smootherstep = (t) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const damp = (cur, tgt, tau, dt) => cur + (tgt - cur) * (1 - Math.exp(-dt / Math.max(1e-4, tau)))
const DEG = Math.PI / 180
const lerpScalar = (a, b, t) => a + (b - a) * t

function makeRadialTexture(stops) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([pos, color, alpha]) => {
    g.addColorStop(pos, alpha === undefined ? color : `rgba(${color}, ${alpha})`)
  })
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeSoftGlowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 234, 200, 0.9)')
  g.addColorStop(0.18, 'rgba(255, 224, 180, 0.55)')
  g.addColorStop(0.55, 'rgba(255, 210, 160, 0.12)')
  g.addColorStop(1, 'rgba(255, 200, 150, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

const quatFromLook = (pos, target, up) => {
  const m = new THREE.Matrix4().lookAt(pos, target, up)
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

const quatFromBasis = (f, up) => {
  const right = new THREE.Vector3().crossVectors(f, up).normalize()
  const u = new THREE.Vector3().crossVectors(right, f).normalize()
  const m = new THREE.Matrix4().makeBasis(right, u, f.clone().negate())
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

export class WalkthroughController {
  constructor(stage, ui) {
    this.stage = stage
    this.ui = ui
    this.params = new URLSearchParams(window.location.search)
    this.debug = this.params.get('debug') === '1'
    this.test = this.params.get('test') === '1'
    this.qa = this.params.get('qa') === '1' || this.debug
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    this.labelsTool = this.params.get('labels') === '1'

    const fxq = parseInt(this.params.get('fx'), 10)
    this.fx = Number.isInteger(fxq) ? clamp(fxq, 0, 2) : this.reduced ? 0 : this.isTouch ? 1 : 2
    this.disabledFx = new Set()

    this.debugFieldEls = {}
    if (ui.debugFields) {
      ui.debugFields.querySelectorAll('[data-dbg]').forEach((el) => {
        this.debugFieldEls[el.dataset.dbg] = el
      })
    }

    this.entrance = WALK_CONFIG.ENTRANCE
    this.sideIndex = 0
    this.outV = new THREE.Vector3()
    this.sideV = new THREE.Vector3()

    this.started = false
    this.visible = false
    this.cancelled = false
    this.modelReady = false
    this.modelFailed = false
    this.lastError = null

    this.loadedBytes = 0
    this.totalBytes = 0

    this.originalBox = null
    this.box = null
    this.shopRoot = null
    this.H = 1
    this.hx = 1
    this.hz = 1
    this.D = 1
    this.meshes = []
    this.structure = null
    this.roofMesh = null
    this.roofGroup = null
    this.structureMesh = null
    this.props = []
    this.propBase = new Map()
    this.glassMeshes = []
    this.doorCandidates = []
    this.doorIndex = 0
    this.doorX = 0.5
    this.doorOff = 0

    this.cutUniformObj = { value: 999 }
    this.cutUniformWorld = { value: 999 }
    this.planUniform = { value: 0 }
    this.roofBaseTransform = null
    this.roofReport = null

    this.camera = null
    this.scene = null
    this.renderer = null
    this.controls = null
    this.lazyIO = null
    this.renderIO = null
    this.ro = null
    this.pinEl = null
    this.pinTop = 0
    this.pinHeight = 0

    this.pRaw = 0
    this.p = 0
    this.phase = PHASES[0].name
    this.inside = 0
    this.planAmt = 0
    this.hintShown = false
    this.lensShift = 0
    this.lastEffectsKey = ''

    this.look = { yaw: 0, pitch: 0, tarYaw: 0, tarPitch: 0 }
    this.dragging = false
    this.lastX = 0
    this.lastY = 0
    this.pointers = new Map()
    this.pinchDist = 0
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    this.fov = WALK_CONFIG.NAME_FOV_DEG
    this.fovTarget = WALK_CONFIG.NAME_FOV_DEG

    this.lastCamKey = ''
    this.renderCount = 0
    this.perfSamples = []
    this._raf = null
    this._lastTime = 0
    this._dbgLast = 0
    this._resizePending = false
    this._moodDirty = true
    this.baseQuat = new THREE.Quaternion()

    this.glassGlows = []
    this.shafts = []
    this.dust = null
    this.dustPos = null
    this.dustTime = 0

    this.pose = {}
    this.poiAnchors = []
    this.labelEls = []
    this.markerEl = null
    this.labelAnchors = []
    this.markerAnchor = null
    this.walkStart = new THREE.Vector3()
    this.walkEnd = new THREE.Vector3()
    this.entryEnd = new THREE.Vector3()
    this.reverseDist = 0
    this.walkEndTarget = null
    this.planDist = 0
    this.planHeight = 0
    this.planFitReport = null
    this.planOffset = { tx: 0, ty: 0 }
    this.labelLayout = null
    this.selectedZone = 0
    this.labelDragIndex = -1
    this.sFacade = 0
    this.sDoor = 0
    this.facadeReport = null
    this.walkLatEnd = 0
    this.labelFitReport = null

    this._onScroll = () => {
      this.pRaw = this.readProgress()
    }
    this._onResize = () => {
      this._resizePending = true
      this.measureContainer()
      if (this.modelReady && this.pose.plan) {
        this.fitPlanCamera()
        this.pose.plan.pos.copy(this.outV).multiplyScalar(this.planDist).addScaledVector(UP, this.planHeight)
        this.pose.plan.pos.addScaledVector(this.planRight, this.planOffset.tx)
        this.pose.plan.pos.addScaledVector(this.planUp, this.planOffset.ty)
        this.labelLayout = null
      }
    }
    this._onVisibility = () => {}
    this._onPointerDown = (e) => this.onPointerDown(e)
    this._onPointerMove = (e) => this.onPointerMove(e)
    this._onPointerUp = (e) => this.onPointerUp(e)
    this._onWheel = (e) => this.onWheel(e)
    this._onKeyDown = (e) => this.onKeyDown(e)
    this._onMouseMove = (e) => {
      this.mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
      this.mouse.ty = (e.clientY / window.innerHeight) * 2 - 1
    }
  }

  init() {
    this.pinEl = document.querySelector('.wt-pin')
    this.measureContainer()
    this.computeDirections()

    if (this.test || this.reduced) {
      this.maybeStart()
    } else {
      this.lazyIO = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            this.maybeStart()
            this.lazyIO.disconnect()
            this.lazyIO = null
          }
        },
        { rootMargin: '150% 0px 150% 0px', threshold: 0 }
      )
      this.lazyIO.observe(this.stage)
    }

    this.renderIO = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting
      },
      { rootMargin: '100% 0px 100% 0px', threshold: 0 }
    )
    this.renderIO.observe(this.stage)

    window.addEventListener('resize', this._onResize)
    window.addEventListener('scroll', this._onScroll, { passive: true })
    document.addEventListener('visibilitychange', this._onVisibility)
    const c = this.ui.canvas
    c.addEventListener('pointerdown', this._onPointerDown)
    c.addEventListener('pointermove', this._onPointerMove)
    c.addEventListener('pointerup', this._onPointerUp)
    c.addEventListener('pointercancel', this._onPointerUp)
    c.addEventListener('wheel', this._onWheel, { passive: false })
    if (!this.isTouch && this.fx >= 1) window.addEventListener('mousemove', this._onMouseMove)
    if (this.debug) window.addEventListener('keydown', this._onKeyDown)

    this.buildDomLayers()
    this.startLoop()
    if (this.qa) this.exposeQA()
  }

  buildDomLayers() {
    if (this.ui.typeEl) {
      const words = WALK_CONFIG.SHOP_NAME.split(' ')
      const line1 = words[0] || ''
      const line2 = words.slice(1).join(' ') || ''
      this.ui.typeEl.innerHTML = `
        <div class="wt-type-mask"><div class="wt-type-line1">${line1}</div></div>
        <div class="wt-type-mask"><div class="wt-type-line2">${line2}</div></div>
        <div class="wt-type-tagline">${WALK_CONFIG.TAGLINE}</div>`
    }
    if (this.ui.labelsEl) {
      this.ui.labelsEl.innerHTML = ''
      if (!this.labels || !this.labels.length) return
      this.labelEls = this.labels.map((label) => {
        const wrap = document.createElement('div')
        wrap.className = 'wt-label'
        const name = document.createElement('div')
        name.className = 'wt-label-name'
        name.textContent = label.text
        wrap.appendChild(name)
        const dims = document.createElement('div')
        dims.className = 'wt-label-dims'
        wrap.appendChild(dims)
        this.ui.labelsEl.appendChild(wrap)
        if (this.labelsTool) {
          wrap.addEventListener('pointerdown', (e) => this.onLabelPointerDown(e))
          wrap.addEventListener('pointermove', (e) => this.onLabelPointerMove(e))
          wrap.addEventListener('pointerup', () => this.onLabelPointerUp())
          wrap.addEventListener('pointercancel', () => this.onLabelPointerUp())
        }
        return { wrap, name, dims }
      })
      const marker = document.createElement('div')
      marker.className = 'wt-marker'
      marker.innerHTML = `<span class="wt-marker-tri"></span><span class="wt-marker-text">ENTRANCE</span>`
      this.ui.labelsEl.appendChild(marker)
      this.markerEl = marker
      if (this.labelsTool) this.buildLabelTool()
    }
  }

  computeMainFacadeExtent() {
    const o = this.outV
    const s = this.sideV
    const roofBox = new THREE.Box3()
    if (this.roofGroup) {
      this.roofGroup.updateWorldMatrix(true, false)
      roofBox.setFromObject(this.roofGroup, true)
    }
    let highMin = Infinity
    let highMax = -Infinity
    const structMesh = this.structureMesh || this.structure
    if (structMesh) {
      structMesh.updateWorldMatrix(true, false)
      const g = structMesh.geometry
      const posAttr = g.attributes.position
      const v = new THREE.Vector3()
      const yCut = 0.85 * this.H
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i).applyMatrix4(structMesh.matrixWorld)
        if (v.y > yCut) {
          const lat = v.dot(s)
          if (lat < highMin) highMin = lat
          if (lat > highMax) highMax = lat
        }
      }
    }
    const structMin = highMin === Infinity ? -this.hx : highMin
    const structMax = highMax === -Infinity ? this.hx : highMax
    let mainMin
    let mainMax
    let method
    if (highMin !== Infinity) {
      mainMin = highMin
      mainMax = highMax
      method = 'structure vertices above 0.85H (excludes low annex)'
    } else if (!roofBox.isEmpty()) {
      mainMin = roofBox.min.dot(s)
      mainMax = roofBox.max.dot(s)
      method = 'roof extent (fallback)'
    } else {
      mainMin = structMin
      mainMax = structMax
      method = 'full structure extent (fallback)'
    }
    const sFacade = (mainMin + mainMax) / 2
    this.sFacade = sFacade
    this.annex = {
      structMin: Number(structMin.toFixed(3)),
      structMax: Number(structMax.toFixed(3)),
      mainMin: Number(mainMin.toFixed(3)),
      mainMax: Number(mainMax.toFixed(3)),
      annexLowLateral: Number(Math.min(structMin, mainMin).toFixed(3)),
      annexHighLateral: Number(Math.max(structMax, mainMax).toFixed(3)),
      method,
    }
    if (this.debug) console.log('[walkthrough] S_FACADE', JSON.stringify({ sFacade: Number(sFacade.toFixed(3)), annex: this.annex }))
  }

  computeOpenings() {
    this.scene.updateMatrixWorld(true)
    const o = this.outV
    const s = this.sideV
    const planeT = this.hz
    const slab = WALK_CONFIG.OPENING_NEAR_FACADE
    const cands = []
    const box = new THREE.Box3()
    for (let i = 0; i < this.glassMeshes.length; i++) {
      const gl = this.glassMeshes[i]
      box.setFromObject(gl.mesh, true)
      const c = new THREE.Vector3()
      box.getCenter(c)
      const t = c.dot(o)
      if (Math.abs(t - planeT) > slab + Math.max(box.max.z - box.min.z, box.max.x - box.min.x) * 0.5 + 0.2) continue
      const latMin = box.min.dot(s)
      const latMax = box.max.dot(s)
      const width = latMax - latMin
      const height = box.max.y - box.min.y
      const top = box.max.y
      cands.push({
        meshIndex: this.meshes.indexOf(gl.mesh),
        matName: gl.mesh.material ? gl.mesh.material.name || '(unnamed)' : '(none)',
        boxMin: box.min.toArray().map((x) => Number(x.toFixed(3))),
        boxMax: box.max.toArray().map((x) => Number(x.toFixed(3))),
        latMin,
        latMax,
        width,
        height,
        top,
        centerS: (latMin + latMax) / 2,
      })
    }
    const openings = []
    const sorted = cands.slice().sort((a, b) => a.latMin - b.latMin)
    for (const c of sorted) {
      let placed = false
      for (const op of openings) {
        if (c.latMin <= op.latMax + 0.05 && c.latMax >= op.latMin - 0.05) {
          op.latMin = Math.min(op.latMin, c.latMin)
          op.latMax = Math.max(op.latMax, c.latMax)
          op.meshes.push(c.meshIndex)
          op.matNames.push(c.matName)
          op.top = Math.max(op.top, c.top)
          op.height = Math.max(op.height, c.height)
          placed = true
          break
        }
      }
      if (!placed) {
        openings.push({
          latMin: c.latMin,
          latMax: c.latMax,
          top: c.top,
          height: c.height,
          meshes: [c.meshIndex],
          matNames: [c.matName],
        })
      }
    }
    for (const op of openings) {
      op.width = op.latMax - op.latMin
      op.centerS = (op.latMin + op.latMax) / 2
    }
    openings.sort((a, b) => a.centerS - b.centerS)
    const mainMin = this.annex ? this.annex.mainMin : -this.hx
    const mainMax = this.annex ? this.annex.mainMax : this.hx
    const finalOpenings = openings.filter((op) => op.top >= WALK_CONFIG.OPENING_MIN_TOP && op.centerS >= mainMin - 0.1 && op.centerS <= mainMax + 0.1)
    finalOpenings.forEach((op, idx) => {
      op.index = idx
    })
    this.openings = finalOpenings
    const entryIdx = Math.max(0, Math.min(WALK_CONFIG.ENTRY_OPENING, finalOpenings.length - 1))
    this.entryIndex = entryIdx
    const entry = finalOpenings[entryIdx]
    this.entryOpening = entry
    this.sDoor = entry ? entry.centerS : this.doorOff
    this.entryWindow = entry
    if (this.debug) {
      console.log('[walkthrough] OPENINGS candidates', JSON.stringify(cands))
      console.log('[walkthrough] OPENINGS final', JSON.stringify(finalOpenings))
    }
  }

  computeLabels() {
    const cfg = WALK_CONFIG.LABELS
    const glassSet = new Set(this.glassMeshes.map((g) => g.mesh))
    const props = this.props.filter((m) => !glassSet.has(m))
    const interior = []
    const box = new THREE.Box3()
    const tmp = new THREE.Vector3()
    this.scene.updateMatrixWorld(true)
    for (let i = 0; i < props.length; i++) {
      const m = props[i]
      box.setFromObject(m, true)
      const c = new THREE.Vector3()
      box.getCenter(c)
      box.getSize(tmp)
      const matName = (m.material && m.material.name || '').toLowerCase()
      if (Math.abs(c.x) < this.hx - 0.15 && Math.abs(c.z) < this.hz - 0.15 && tmp.y >= 0.2 && !matName.includes('tile') && !matName.includes('floor')) {
        interior.push({ mesh: m, index: this.meshes.indexOf(m), cx: c.x, cz: c.z, area: tmp.x * tmp.z, box: box.clone() })
      }
    }
    interior.sort((a, b) => b.area - a.area)
    const chosen = []
    for (const p of interior) {
      if (chosen.length >= cfg.length) break
      let ok = true
      for (const c of chosen) {
        if (Math.hypot(c.cx - p.cx, c.cz - p.cz) < 1.2) {
          ok = false
          break
        }
      }
      if (ok) chosen.push(p)
    }
    chosen.sort((a, b) => a.cx - b.cx)
    const labels = cfg.map((l, i) => {
      const base = { ...l, meshIndex: l.meshIndex >= 0 ? l.meshIndex : chosen[i] ? chosen[i].index : -1 }
      return base
    })
    this.labels = labels
    this.labelReport = {
      chosen: chosen.map((c) => ({
        meshIndex: c.index,
        box: c.box.toArray ? c.box.min.toArray().map((x) => Number(x.toFixed(3))) : null,
        size: (() => {
          const s = new THREE.Vector3()
          c.box.getSize(s)
          return [s.x, s.y, s.z].map((x) => Number(x.toFixed(3)))
        })(),
        mat: c.mesh.material ? c.mesh.material.name || '(unnamed)' : '(none)',
      })),
    }
    if (this.debug) console.log('[walkthrough] LABELS', JSON.stringify(this.labelReport, null, 1))
  }

  labelAnchorFor(label) {
    if (label.type === 'zone') {
      return new THREE.Vector3(label.cx, 0.05, label.cz)
    }
    const meshIdx = label.meshIndex
    if (meshIdx < 0 || meshIdx >= this.meshes.length) {
      return new THREE.Vector3(0, 0.05, 0)
    }
    const mesh = this.meshes[meshIdx]
    const box = new THREE.Box3().setFromObject(mesh, true)
    const c = new THREE.Vector3()
    box.getCenter(c)
    const off = label.offset || [0, 0, 0]
    return new THREE.Vector3(c.x + off[0], box.max.y + off[1], c.z + off[2])
  }

  labelDimsText(label) {
    if (!label.sub || label.sub === 'none') return ''
    if (label.sub !== 'auto') return label.sub
    if (label.type === 'zone') {
      const w = (label.w || 0).toFixed(1)
      const d = (label.d || 0).toFixed(1)
      return `${w} x ${d} m`
    }
    const meshIdx = label.meshIndex
    if (meshIdx < 0 || meshIdx >= this.meshes.length) return ''
    const box = new THREE.Box3().setFromObject(this.meshes[meshIdx], true)
    const sz = new THREE.Vector3()
    box.getSize(sz)
    return `${sz.x.toFixed(1)} x ${sz.z.toFixed(1)} m`
  }

  labelMaxWidthPx(i) {
    const label = this.labels[i]
    if (label.type === 'zone') {
      const a = new THREE.Vector3(label.cx - (label.w || 2) / 2, 0.05, label.cz).project(this.camera)
      const b = new THREE.Vector3(label.cx + (label.w || 2) / 2, 0.05, label.cz).project(this.camera)
      const w = this.renderer.domElement.width
      return Math.abs((a.x - b.x) * 0.5 * w)
    }
    const meshIdx = label.meshIndex
    if (meshIdx < 0 || meshIdx >= this.meshes.length) return 200
    const box = new THREE.Box3().setFromObject(this.meshes[meshIdx], true)
    const a = new THREE.Vector3(box.min.x, 0.05, (box.min.z + box.max.z) / 2).project(this.camera)
    const b = new THREE.Vector3(box.max.x, 0.05, (box.min.z + box.max.z) / 2).project(this.camera)
    const w = this.renderer.domElement.width
    return Math.abs((a.x - b.x) * 0.5 * w)
  }

  testSideBasis() {
    if (!this.pose.level) return
    const cam = this.camera
    const savedPos = cam.position.clone()
    const savedQ = cam.quaternion.clone()
    const point = new THREE.Vector3(this.sFacade, 1.4, this.hz)
    cam.position.copy(this.pose.level.pos)
    cam.quaternion.copy(this.pose.level.q)
    cam.updateMatrixWorld(true)
    const before = point.clone().project(cam).x
    cam.position.addScaledVector(this.sideV, 0.1)
    cam.updateMatrixWorld(true)
    const after = point.clone().project(cam).x
    cam.position.copy(savedPos)
    cam.quaternion.copy(savedQ)
    const ok = after < before
    this.basisTest = { before: Number(before.toFixed(4)), after: Number(after.toFixed(4)), ok, side: this.sideV.toArray().map((x) => Number(x.toFixed(3))) }
    if (!ok) {
      this.sideV.multiplyScalar(-1)
      this.basisTest.fixed = true
    }
    if (this.debug) console.log('[walkthrough] side basis test', JSON.stringify(this.basisTest))
  }

  maybeStart() {
    if (this.started || this.cancelled) return
    this.started = true
    try {
      this.setupRenderer()
    } catch (err) {
      this.showError(`WebGL unavailable: ${err.message}`)
      return
    }
    this.setupScene()
    this.setupGround()
    this.setupFxMeshes()
    if (this.test) this.setupTestMode()
    else if (this.reduced) this.setupReducedMotion()
    this.loadModel()
  }

  setupRenderer() {
    const canvas = this.ui.canvas
    const dpr = window.devicePixelRatio || 1
    const cap = this.isTouch ? 1.0 : 1.25
    this.pixelRatio = Math.min(dpr, cap)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: this.fx >= 1, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(this.stage.clientWidth, this.stage.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = WALK_CONFIG.MOOD.exposureExt

    this.camera = new THREE.PerspectiveCamera(
      WALK_CONFIG.NAME_FOV_DEG,
      this.stage.clientWidth / Math.max(1, this.stage.clientHeight),
      0.05,
      300
    )
    this.camera.position.set(0, 3, -16)
    this.camera.lookAt(0, 0, 0)
  }

  setupScene() {
    const scene = new THREE.Scene()
    if (this.fx >= 1) {
      scene.background = null
    } else {
      scene.background = new THREE.Color(BG_COLOR)
      scene.fog = new THREE.Fog(BG_COLOR, 20, 60)
    }
    this.scene = scene

    this.hemi = new THREE.HemisphereLight(WALK_CONFIG.MOOD.hemiSkyExt, WALK_CONFIG.MOOD.hemiGround, WALK_CONFIG.MOOD.hemiIntensity)
    scene.add(this.hemi)

    this.dirLight = new THREE.DirectionalLight(WALK_CONFIG.MOOD.dirColor, WALK_CONFIG.MOOD.dirIntensityExt)
    this.dirLight.position.set(4, 7, 5)
    scene.add(this.dirLight)
    scene.add(this.dirLight.target)

    const fill = new THREE.PointLight(0xffd9a0, 0.6, 8)
    fill.position.set(0, 2.3, 0)
    scene.add(fill)
  }

  setupGround() {
    const discRadius = 3 * this.D || 30
    const groundTex = makeRadialTexture([
      [0, '13, 17, 23', 1],
      [0.55, '11, 14, 19', this.fx >= 1 ? 0.9 : 1],
      [0.85, '9, 12, 16', this.fx >= 1 ? 0.5 : 0.75],
      [1, '9, 12, 16', 0],
    ])
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(discRadius, 64),
      new THREE.MeshBasicMaterial({ map: groundTex, transparent: true, depthWrite: false })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.03
    this.scene.add(ground)

    const shadowSize = this.D * 1.15 || 11
    const shadowTex = makeRadialTexture([
      [0, '0, 0, 0', 0.55],
      [0.45, '0, 0, 0', 0.28],
      [1, '0, 0, 0', 0],
    ])
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(shadowSize, 64),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.015
    this.scene.add(shadow)
  }

  setupFxMeshes() {
    this.glassGlows = []

    this.shafts = []
    const shaftTex = makeRadialTexture([
      [0, '255, 224, 180', 0.85],
      [0.5, '255, 214, 170', 0.35],
      [1, '255, 204, 160', 0],
    ])
    for (let i = 0; i < 4; i++) {
      const x = (i % 2 === 0 ? -1 : 1) * (0.5 + i * 0.35) * this.hx * 0.4
      const len = this.hz * 1.5
      const sm = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, len),
        new THREE.MeshBasicMaterial({
          map: shaftTex,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
          renderOrder: 14,
        })
      )
      sm.position.set(x, 1.2, this.hz - len * 0.55)
      sm.rotation.x = -0.35
      sm.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.12
      this.scene.add(sm)
      this.shafts.push({ mesh: sm, base: WALK_CONFIG.LIGHTS.shaftOpacity })
    }

    const count = WALK_CONFIG.LIGHTS.dustCount
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * (this.hx - 0.6)
      pos[i * 3 + 1] = 0.3 + Math.random() * (this.H - 0.8)
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * (this.hz - 0.8)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const dustTex = makeSoftGlowTexture()
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: dustTex,
        size: 0.03,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
      })
    )
    this.scene.add(this.dust)
    this.dustPos = pos
  }

  updateMood() {
    const M = WALK_CONFIG.MOOD
    const expIn = smootherstep((this.p - M.insideFadeIn0) / (M.insideFadeIn1 - M.insideFadeIn0))
    const fadeOut = 1 - smootherstep((this.p - M.insideFadeOut0) / (M.insideFadeOut1 - M.insideFadeOut0))
    const insideTarget = clamp(Math.min(expIn, fadeOut), 0, 1) * M.insideTarget
    const planLen = smootherstep((this.p - M.planIn0) / (M.planIn1 - M.planIn0)) * (1 - smootherstep((this.p - M.planOut0) / (M.planOut1 - M.planOut0)))
    const changed = Math.abs(insideTarget - this.inside) > 0.004 || Math.abs(planLen - this.planAmt) > 0.004
    this.inside = insideTarget
    this.planAmt = planLen
    if (!changed) return false

    const sky = new THREE.Color()
    sky.copy(new THREE.Color(M.hemiSkyExt)).lerp(new THREE.Color(M.hemiSkyInt), this.inside / M.insideTarget)
    this.hemi.color.copy(sky)
    this.hemi.intensity = M.hemiIntensity * (1 + (M.planHemiFactor - 1) * this.planAmt)
    const dirPlan = 1 - (1 - M.planDirFactor) * this.planAmt
    const dirInside = 1 - (1 - M.dirIntensityIntFactor) * (this.inside / M.insideTarget)
    this.dirLight.intensity = M.dirIntensityExt * dirPlan * dirInside
    const expPlan = M.planExposure - M.exposureExt
    const expInside = M.exposureInt - M.exposureExt
    this.renderer.toneMappingExposure = M.exposureExt + expPlan * this.planAmt + expInside * (this.inside / M.insideTarget) * (1 - this.planAmt)

    const fxScale = (this.inside / M.insideTarget) * (1 - 0.8 * this.planAmt)
    for (const g of this.glassGlows) g.mesh.material.opacity = g.base * fxScale
    for (const sh of this.shafts) sh.mesh.material.opacity = sh.base * fxScale
    if (this.dust) this.dust.material.opacity = WALK_CONFIG.LIGHTS.dustOpacity * fxScale
    return true
  }

  computeDirections() {
    const o = OUT_VECTORS[this.entrance] || OUT_VECTORS['+z']
    this.outV.set(o.x, o.y, o.z)
    const side = this.pickSide()
    this.sideV.set(side.x, side.y, side.z)
  }

  pickSide() {
    const candidates = SIDE_VECTORS.filter((v) => Math.abs(v.x * this.outV.x + v.z * this.outV.z) < 0.01)
    const list = candidates.length ? candidates : SIDE_VECTORS
    return list[this.sideIndex % list.length]
  }

  cycleSide() {
    this.sideIndex++
    this.computeDirections()
    if (this.box) this.buildPathConstants()
    if (this.debug) console.log(`[walkthrough] side -> (${this.sideV.x},${this.sideV.y},${this.sideV.z})`)
  }

  cycleDoor() {
    if (!this.doorCandidates.length) return
    this.doorIndex = (this.doorIndex + 1) % this.doorCandidates.length
    this.applyDoorCandidate()
    if (this.debug) console.log(`[walkthrough] door -> x=${this.doorX.toFixed(3)} (candidate ${this.doorIndex})`)
  }

  applyDoorCandidate() {
    const cand = this.doorCandidates[this.doorIndex]
    this.doorX = cand ? cand.fraction : 0.5
    this.buildPathConstants()
  }

  measureContainer() {
    if (!this.pinEl) return
    this.pinTop = this.pinEl.offsetTop
    this.pinHeight = this.pinEl.offsetHeight
  }

  readProgress() {
    if (!this.pinHeight) return 0
    const range = this.pinHeight - window.innerHeight
    if (range <= 0) return 0
    return clamp((window.scrollY - this.pinTop) / range, 0, 1)
  }

  startLoop() {
    this._lastTime = performance.now()
    const loop = (time) => {
      if (this.cancelled) return
      this._raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (time - this._lastTime) / 1000)
      this._lastTime = time

      const lenis = window.__lenis
      if (lenis && !this.cancelled) lenis.raf(time * 1000)

      if (!this.started || !this.modelReady) return

      this.p = damp(this.p, this.pRaw, WALK_CONFIG.P_SMOOTH_TAU, dt)

      if (this.test) {
        if (this.controls) this.controls.update()
        this.phase = phaseNameFor(this.p)
        this.renderer.render(this.scene, this.camera)
        this.renderCount++
        this.syncDebug()
        return
      }

      this.phase = phaseNameFor(this.p)
      if (this.updateMood()) this.lastCamKey = ''
      this.updateEffects()
      this.updateCamera(dt)

      const key = this.camKey()
      let render = key !== this.lastCamKey
      this.lastCamKey = key
      if (this.dragging || this.pointers.size > 1) render = true
      if (!this.visible) render = false
      if (this._resizePending) {
        render = true
        this._resizePending = false
      }
      if (render) {
        if (this.dust && this.inside > 0.3 && this.visible) this.updateDust(dt)
        const t0 = performance.now()
        this.renderer.render(this.scene, this.camera)
        this.renderCount++
        this.perfSamples.push(performance.now() - t0)
        if (this.perfSamples.length > 600) this.perfSamples.shift()
        this.measureQuality(dt)
      }
      this.syncDebug()
    }
    this._raf = requestAnimationFrame(loop)
  }

  camKey() {
    const c = this.camera
    return [
      c.position.x.toFixed(3),
      c.position.y.toFixed(3),
      c.position.z.toFixed(3),
      c.quaternion.x.toFixed(4),
      c.quaternion.y.toFixed(4),
      c.quaternion.z.toFixed(4),
      c.quaternion.w.toFixed(4),
      c.fov.toFixed(1),
      this.lensShift.toFixed(4),
      this.lastEffectsKey,
      this.inside.toFixed(3),
      this.planAmt.toFixed(3),
    ].join('|')
  }

  cutYFor(p) {
    const H = this.H
    const P = WALK_CONFIG.PLAN_WALL_HEIGHT
    if (p < 0.18) return H
    if (p <= 0.34) return H - (H - P) * smootherstep((p - 0.18) / 0.16)
    if (p < 0.38) return P
    if (p <= 0.5) return P + (H - P) * smootherstep((p - 0.38) / 0.12)
    return H
  }

  glassPlanAmt(p) {
    if (p < 0.18) return 1
    if (p <= 0.28) return 1 - smootherstep((p - 0.18) / 0.1)
    if (p < 0.46) return 0
    if (p <= 0.52) return smootherstep((p - 0.46) / 0.06)
    return 1
  }

  roofState(p) {
    let liftT = 0
    let opacity = 1
    if (p >= 0.1 && p <= 0.26) {
      liftT = smootherstep((p - 0.1) / 0.16)
    } else if (p > 0.26 && p < 0.48) {
      liftT = 1
      opacity = 0
    } else if (p >= 0.48 && p <= 0.57) {
      opacity = smootherstep((p - 0.48) / 0.04)
      liftT = 1 - smootherstep((p - 0.48) / 0.09)
    } else if (p > 0.57) {
      liftT = 0
      opacity = 1
    }
    if (p > 0.16 && p <= 0.27) {
      opacity = 1 - smootherstep((p - 0.16) / 0.11)
    }
    return { liftT, opacity }
  }

  updateEffects() {
    const p = this.p
    const key = this.effectsKey(p)
    if (key !== this.lastEffectsKey) {
      this.lastEffectsKey = key

      const cutY = this.cutYFor(p)
      if (this.structureMesh) {
        const rootPosY = this.shopRoot ? this.shopRoot.position.y : 0
        this.cutUniformObj.value = (cutY - rootPosY - this.structureMesh.position.y) / Math.max(1e-6, this.structureMesh.scale.y)
      } else {
        this.cutUniformObj.value = cutY
      }
      this.cutUniformWorld.value = cutY
      const uPlan = clamp((this.H - cutY) / Math.max(0.001, this.H - WALK_CONFIG.PLAN_WALL_HEIGHT), 0, 1)
      this.planUniform.value = uPlan

      const rs = this.roofState(p)
      if (this.roofGroup) {
        const mat = this.roofMesh.material
        if (Math.abs(rs.opacity - mat.opacity) > 0.004) {
          mat.opacity = rs.opacity
          mat.transparent = true
          if (rs.opacity > 0.999) {
            mat.depthWrite = true
            this.roofMesh.renderOrder = 0
          } else {
            mat.depthWrite = false
            this.roofMesh.renderOrder = 20
          }
          this.roofGroup.visible = rs.opacity >= 0.01
        }
        const lift = rs.liftT
        const tilt = WALK_CONFIG.ROOF_TILT_MAX_DEG * DEG * lift
        const drift = WALK_CONFIG.ROOF_DRIFT * lift
        const base = this.roofBaseTransform
        if (lift < 0.001 || lift > 0.999) {
          this.roofGroup.position.copy(base.position)
          this.roofGroup.quaternion.copy(base.quaternion)
        } else {
          this.roofGroup.position
            .copy(base.position)
            .addScaledVector(UP, WALK_CONFIG.ROOF_LIFT * lift)
            .addScaledVector(this.outV, drift)
          const qTilt = new THREE.Quaternion().setFromAxisAngle(this.sideV, tilt)
          this.roofGroup.quaternion.copy(base.quaternion).multiply(qTilt)
        }
      }

      const gAmt = this.glassPlanAmt(p)
      for (const g of this.glassMeshes) {
        const target = g.base * gAmt
        if (Math.abs(g.mat.opacity - target) > 0.005) g.mat.opacity = target
        g.mesh.visible = gAmt > 0.01 || cutY >= 1.0
      }

      this.updateDomLayers(p)
    }
  }

  effectsKey(p) {
    return [p.toFixed(4), this.fx, [...this.disabledFx].sort().join(',')].join('|')
  }

  updateDomLayers(p) {
    const nameOp = p < 0.05 ? smootherstep(p / 0.05) : p > 0.08 ? 1 - smootherstep((p - 0.08) / 0.08) : 1
    const typeEl = this.ui.typeEl
    if (typeEl) {
      if (p <= 0.16) {
        typeEl.style.visibility = 'visible'
        typeEl.style.opacity = nameOp.toFixed(4)
        const tx = p > 0.08 ? -8 * smootherstep((p - 0.08) / 0.08) : 0
        typeEl.style.transform = `translate3d(-50%, calc(-50% + ${tx}vh), 0)`
        const l1 = typeEl.querySelector('.wt-type-line1')
        const l2 = typeEl.querySelector('.wt-type-line2')
        const tag = typeEl.querySelector('.wt-type-tagline')
        if (l1) {
          const t1 = smootherstep((p - 0.005) / 0.04)
          l1.style.transform = `translateY(${(1 - t1) * 115}%)`
          l1.style.opacity = t1.toFixed(4)
        }
        if (l2) {
          const t2 = smootherstep((p - 0.02) / 0.04)
          l2.style.transform = `translateY(${(1 - t2) * 115}%)`
          l2.style.opacity = t2.toFixed(4)
        }
        if (tag) {
          tag.style.opacity = smootherstep((p - 0.04) / 0.035).toFixed(4)
        }
      } else {
        typeEl.style.visibility = 'hidden'
      }
    }

    let labelsOp = 0
    if (p >= 0.31 && p <= 0.36) {
      const e = Math.min(1, (p - 0.31) / 0.02, (0.36 - p) / 0.02)
      labelsOp = smootherstep(e)
    }
    const w = this.renderer.domElement.width
    const h = this.renderer.domElement.height
    const cam = this.camera

    if (this.labelEls.length) {
      const wantLayout = labelsOp > 0.01 && (this.labelLayout === null || this.labelLayout.k !== this.labelLayoutKey())
      if (wantLayout) this.layoutLabels()
      const lay = this.labelLayout
      for (let i = 0; i < this.labelEls.length; i++) {
        const el = this.labelEls[i]
        const item = lay ? lay.items[i] : null
        let visible = labelsOp > 0.01 && item && !item.hidden
        if (visible) {
          const v = this.labelAnchors[i].clone().project(cam)
          visible = v.z < 1 && Math.abs(v.x) <= 1.2 && Math.abs(v.y) <= 1.2
          if (visible) {
            const x = (v.x + 1) * 0.5 * w
            const y = (1 - v.y) * 0.5 * h
            el.wrap.style.fontSize = `${item.fs}px`
            el.name.style.fontSize = `${item.fs}px`
            el.dims.style.fontSize = `${Math.round(item.fs * 0.85)}px`
            el.dims.style.display = item.showDims ? '' : 'none'
            el.dims.textContent = item.showDims ? item.dimsTxt : ''
            el.wrap.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + item.dy).toFixed(1)}px, 0) translate(-50%, -50%)`
            el.wrap.style.opacity = labelsOp.toFixed(4)
            el.wrap.dataset.z = String(i)
          }
        }
        if (!visible) el.wrap.style.opacity = '0'
      }
    }

    if (this.markerEl && this.markerAnchor) {
      const bob = 0.04 * Math.sin(p * 40)
      const a = this.markerAnchor.clone()
      a.y += bob
      let visible = labelsOp > 0.01
      if (visible) {
        const v = a.project(cam)
        visible = v.z < 1 && Math.abs(v.x) <= 1.2 && Math.abs(v.y) <= 1.2
        if (visible) {
          const x = (v.x + 1) * 0.5 * w
          const y = (1 - v.y) * 0.5 * h
          this.markerEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
          this.markerEl.style.opacity = labelsOp.toFixed(4)
        }
      }
      if (!visible) this.markerEl.style.opacity = '0'
    }

    const cap = this.ui.captionEl
    if (cap) {
      let text = ''
      let op = 1
      for (const c of WALK_CONFIG.CAPTIONS) {
        if (p >= c.from && p <= c.to) {
          text = c.text
          break
        }
      }
      if (p >= 0.66 && p <= 0.9) {
        const pos = this.camera.position
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
        let best = null
        let bestAng = Infinity
        for (let i = 0; i < this.poiAnchors.length; i++) {
          const d = new THREE.Vector3().subVectors(this.poiAnchors[i], pos).normalize()
          const ang = Math.acos(clamp(fwd.dot(d), -1, 1)) / DEG
          if (ang < bestAng) {
            bestAng = ang
            best = i
          }
        }
        if (best !== null && bestAng < WALK_CONFIG.WALK_CAPTION_DEG) {
          text = WALK_CONFIG.POINTS_OF_INTEREST[best].caption
          op = smootherstep(clamp(1 - (bestAng - 4) / 11, 0, 1))
        }
      }
      if (text !== cap.dataset.current) {
        cap.dataset.current = text
        if (text) {
          cap.innerHTML = `<span class="wt-caption-rule"></span><span class="wt-caption-text"></span>`
          cap.querySelector('.wt-caption-text').textContent = text
          cap.style.opacity = String(op)
        } else {
          cap.style.opacity = '0'
        }
      } else if (text) {
        const cur = Number(cap.style.opacity)
        if (Math.abs(cur - op) > 0.03) cap.style.opacity = String(op)
      }
    }

    const progress = this.ui.progressFill
    if (progress) progress.style.transform = `scaleY(${clamp(p, 0, 1).toFixed(4)})`

    const hint = this.ui.hintEl
    if (hint && !this.hintShown && p >= WALK_CONFIG.HINT_AT_P && p <= 0.94) {
      this.hintShown = true
      hint.classList.add('is-visible')
      this._hintTimer = setTimeout(() => hint.classList.remove('is-visible'), WALK_CONFIG.HINT_KEEP_MS)
    }

    const rel = this.ui.releaseEl
    if (rel) {
      const opRel = p > 0.96 ? smootherstep((p - 0.96) / 0.04) : 0
      const cur = Number(rel.dataset.op || 0)
      if (Math.abs(cur - opRel) > 0.01) {
        rel.dataset.op = String(opRel)
        rel.style.opacity = String(opRel)
      }
    }
  }

  textWidthPx(text, fsPx, lsEm) {
    const c = this._textCanvas || (this._textCanvas = document.createElement('canvas'))
    const ctx = c.getContext('2d')
    ctx.font = `${fsPx}px "Helvetica Now Display", Arial, sans-serif`
    const base = ctx.measureText(text).width
    return base + (lsEm || 0) * fsPx * Math.max(0, text.length - 1)
  }

  labelLayoutKey() {
    return `${this.renderer.domElement.width}x${this.renderer.domElement.height}|${this.labels.map((l) => `${l.id}|${l.text}|${l.sub}|${l.type}|${l.meshIndex}|${(l.offset || []).join(',')}|${l.cx || 0}|${l.cz || 0}|${l.w || 0}|${l.d || 0}`).join(';')}`
  }

  layoutLabels() {
    const w = this.renderer.domElement.width
    const h = this.renderer.domElement.height
    const cam = this.camera
    const items = []
    const baseFs = clamp(10, 0.85 * w / 100, 13)
    for (let i = 0; i < this.labelEls.length; i++) {
      const label = this.labels[i]
      const el = this.labelEls[i]
      const anchor = this.labelAnchors[i]
      const v = anchor.clone().project(cam)
      const x = (v.x + 1) * 0.5 * w
      const y = (1 - v.y) * 0.5 * h
      const zW = this.labelMaxWidthPx(i)
      const dimsTxt = this.labelDimsText(label)
      el.name.textContent = label.text
      el.dims.textContent = dimsTxt
      el.name.style.fontSize = `${baseFs}px`
      el.dims.style.fontSize = `${Math.round(baseFs * 0.85)}px`
      el.dims.style.display = dimsTxt ? '' : 'none'
      let fs = baseFs
      let showDims = !!dimsTxt
      let nameW = this.textWidthPx(label.text, baseFs, 0.12)
      let dimsW = showDims ? this.textWidthPx(dimsTxt, baseFs * 0.85, 0.08) : 0
      const maxW = Math.max(20, 0.9 * zW)
      let hidden = false
      if (nameW > maxW || dimsW > maxW) {
        fs = 9
        nameW = this.textWidthPx(label.text, 9, 0.12)
        dimsW = showDims ? this.textWidthPx(dimsTxt, 9 * 0.85, 0.08) : 0
      }
      if (nameW > maxW || dimsW > maxW) {
        showDims = false
        dimsW = 0
        if (nameW > maxW) hidden = true
      }
      const nameH = fs * 1.3
      const dimsH = showDims ? fs * 0.85 * 1.35 : 0
      items.push({ x, y, dy: 0, fs, showDims, hidden, w: Math.max(nameW, dimsW, 30), h: nameH + dimsH, zW, nameW, dimsTxt })
    }
    const sep = WALK_CONFIG.LABEL_SEP_PX
    for (let pass = 0; pass < 10; pass++) {
      let moved = false
      for (let i = 0; i < items.length; i++) {
        if (items[i].hidden) continue
        for (let j = i + 1; j < items.length; j++) {
          if (items[j].hidden) continue
          const ai = items[i]
          const aj = items[j]
          const dx = Math.max(0, Math.abs(ai.x - aj.x) - (ai.w + aj.w) / 2)
          const dy = Math.max(0, Math.abs(ai.y + ai.dy - (aj.y + aj.dy)) - (ai.h + aj.h) / 2)
          if (dx < sep && dy < sep) {
            aj.dy += sep - dy
            moved = true
          }
        }
      }
      if (!moved) break
    }
    this.labelLayout = { k: this.labelLayoutKey(), items }
    this.labelFitReport = {
      baseFs,
      items: items.map((it, i) => ({
        label: this.labels[i].text,
        fs: it.fs,
        showDims: it.showDims,
        hidden: it.hidden,
        maxWidthPx: Number(it.zW.toFixed(1)),
        labelWidthPx: Number(it.w.toFixed(1)),
        dy: Number(it.dy.toFixed(1)),
      })),
    }
    if (this.labelsTool) this.updateLabelPanel()
  }

  buildLabelTool() {
    if (!this.labelsTool) return
    if (this._labelPanel) return
    const panel = document.createElement('div')
    panel.className = 'wt-labels-panel'
    this._labelPanel = panel
    this.stage.appendChild(panel)
    panel.innerHTML = `
      <div class="wt-labels-info"></div>
      <label>Label text <input class="inp-text" type="text" /></label>
      <label>Sub (auto/none/text) <input class="inp-sub" type="text" /></label>
      <div class="btnrow">
        <button type="button" class="btn-attach">Attach label to this object</button>
        <button type="button" class="btn-del">Delete label</button>
        <button type="button" class="btn-copy">Copy config</button>
      </div>
      <div class="wt-labels-hint">hover object · click select · shift+click floor = zone label · drag label = move · arrows nudge</div>`
    panel.querySelector('.btn-attach').addEventListener('click', () => this.attachSelectedLabel())
    panel.querySelector('.btn-del').addEventListener('click', () => this.deleteSelectedLabel())
    panel.querySelector('.btn-copy').addEventListener('click', () => this.copyLabelsConfig())
    panel.querySelector('.inp-text').addEventListener('input', (e) => {
      const l = this.labels[this.selectedLabel]
      if (l) {
        l.text = e.target.value
        this.rebuildLabelsDom()
      }
    })
    panel.querySelector('.inp-sub').addEventListener('input', (e) => {
      const l = this.labels[this.selectedLabel]
      if (l) {
        l.sub = e.target.value
        this.rebuildLabelsDom()
      }
    })
    const helper = new THREE.Box3Helper(new THREE.Box3(), 0xc9a86a)
    helper.visible = false
    this.scene.add(helper)
    this._hoverHelper = helper
    const tip = document.createElement('div')
    tip.className = 'wt-labels-tip'
    this._hoverTip = tip
    this.stage.appendChild(tip)
    this.updateLabelPanel()
  }

  hoverObjectFromEvent(ev) {
    const now = performance.now()
    if (now - (this._lastHoverTime || 0) < 50) return
    this._lastHoverTime = now
    const rect = this.ui.canvas.getBoundingClientRect()
    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera)
    const glassSet = new Set(this.glassMeshes.map((g) => g.mesh))
    const targets = this.props.filter((m) => !glassSet.has(m))
    const hits = raycaster.intersectObjects(targets, false)
    const mesh = hits.length ? hits[0].object : null
    if (mesh && this._hoverHelper) {
      const b = new THREE.Box3().setFromObject(mesh, true)
      this._hoverHelper.box.copy(b)
      this._hoverHelper.visible = true
      const idx = this.meshes.indexOf(mesh)
      const sz = new THREE.Vector3()
      b.getSize(sz)
      this._hoverMesh = mesh
      this._hoverMeshIndex = idx
      if (this._hoverTip && this.visible) {
        const tip = this._hoverTip
        tip.style.display = 'block'
        tip.style.left = `${ev.clientX + 12}px`
        tip.style.top = `${ev.clientY + 12}px`
        tip.textContent = `index=${idx} size=${sz.x.toFixed(2)}x${sz.y.toFixed(2)}x${sz.z.toFixed(2)} mat=${mesh.material ? (mesh.material.name || '(unnamed)') : '(none)'}`
      }
    } else if (this._hoverHelper) {
      this._hoverHelper.visible = false
      if (this._hoverTip) this._hoverTip.style.display = 'none'
      this._hoverMesh = null
    }
  }

  selectHoverObject() {
    if (this._hoverMesh) {
      this.selectedMesh = this._hoverMesh
      this.selectedMeshIndex = this._hoverMeshIndex
      this.updateLabelPanel()
    }
  }

  attachSelectedLabel() {
    const l = this.labels[this.selectedLabel]
    if (l && this.selectedMeshIndex != null) {
      l.type = 'object'
      l.meshIndex = this.selectedMeshIndex
      l.offset = [0, 0.2, 0]
      delete l.cx
      delete l.cz
      this.rebuildLabelsDom()
    }
  }

  deleteSelectedLabel() {
    if (this.selectedLabel >= 0 && this.labels.length > 1) {
      this.labels.splice(this.selectedLabel, 1)
      this.selectedLabel = Math.max(0, this.selectedLabel - 1)
      this.rebuildLabelsDom()
    }
  }

  copyLabelsConfig() {
    const arr = this.labels.map((l) => ({
      id: l.id,
      text: l.text,
      sub: l.sub,
      type: l.type,
      meshIndex: l.meshIndex,
      offset: l.offset || [0, 0, 0],
      cx: l.cx,
      cz: l.cz,
      w: l.w,
      d: l.d,
    }))
    const text = `LABELS: ${JSON.stringify(arr, null, 2)},`
    try {
      navigator.clipboard.writeText(text)
    } catch { /* clipboard unavailable */ }
    if (this._labelPanel) this._labelPanel.dataset.copied = 'copied'
    console.log('[walkthrough] LABELS config:\n' + text)
  }

  rebuildLabelsDom() {
    this.labelAnchors = this.labels.map((l) => this.labelAnchorFor(l))
    this.labelLayout = null
    this.buildDomLayers()
    if (this.p >= 0.28 && this.p <= 0.42) this.layoutLabels()
    else this.updateLabelPanel()
  }

  updateLabelPanel() {
    if (!this._labelPanel) return
    const info = this._labelPanel.querySelector('.wt-labels-info')
    const l = this.labels[this.selectedLabel]
    info.innerHTML = l
      ? `selected: <b>${l.text}</b> (${l.type}, mesh ${l.meshIndex})<br/>object under cursor: ${this.selectedMeshIndex != null ? '#' + this.selectedMeshIndex : 'none'}`
      : 'selected: none'
  }

  pointerToFloorXZ(ev) {
    const rect = this.ui.canvas.getBoundingClientRect()
    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera)
    const dir = v.sub(this.camera.position).normalize()
    if (Math.abs(dir.y) < 1e-4) return null
    const t = -this.camera.position.y / dir.y
    if (t <= 0) return null
    const p = this.camera.position.clone().addScaledVector(dir, t)
    return { x: p.x, z: p.z }
  }

  onLabelPointerDown(ev) {
    const wrap = ev.currentTarget
    this.labelDragIndex = Number(wrap.dataset.z)
    this.selectedLabel = this.labelDragIndex
    const label = this.labels[this.labelDragIndex]
    this.dragBaseCenter = this.labelAnchorFor(label).clone()
    this.updateLabelPanel()
    wrap.setPointerCapture(ev.pointerId)
  }

  onLabelPointerMove(ev) {
    if (this.labelDragIndex < 0) return
    const pt = this.pointerToFloorXZ(ev)
    if (!pt) return
    const label = this.labels[this.labelDragIndex]
    const base = this.dragBaseCenter
    if (label.type === 'zone') {
      label.cx = Number(pt.x.toFixed(2))
      label.cz = Number(pt.z.toFixed(2))
    } else {
      const off = label.offset || [0, 0, 0]
      off[0] = Number((pt.x - base.x + off[0]).toFixed(3))
      off[2] = Number((pt.z - base.z + off[2]).toFixed(3))
      label.offset = off
    }
    this.labelAnchors[this.labelDragIndex] = this.labelAnchorFor(label)
    this.labelLayout = null
    if (this.p >= 0.28 && this.p <= 0.42) this.layoutLabels()
    else this.updateLabelPanel()
  }

  onLabelPointerUp() {
    this.labelDragIndex = -1
  }

  updateDust(dt) {
    this.dustTime += dt
    const pos = this.dustPos
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += Math.sin(this.dustTime * 0.4 + i) * 0.0008
      pos[i + 1] += Math.sin(this.dustTime * 0.5 + i * 0.7) * 0.0006 + 0.0004
      pos[i + 2] += Math.cos(this.dustTime * 0.35 + i * 0.5) * 0.0008
      if (pos[i + 1] > this.H - 0.3) pos[i + 1] = 0.3
      if (pos[i + 1] < 0.3) pos[i + 1] = this.H - 0.3
      if (pos[i] > this.hx - 0.6) pos[i] = -this.hx + 0.6
      if (pos[i] < -this.hx + 0.6) pos[i] = this.hx - 0.6
      if (pos[i + 2] > this.hz - 0.8) pos[i + 2] = -this.hz + 0.8
      if (pos[i + 2] < -this.hz + 0.8) pos[i + 2] = this.hz - 0.8
    }
    this.dust.geometry.attributes.position.needsUpdate = true
  }

  updateCamera(dt) {
    const D = WALK_CONFIG.DRAG
    const kDrag = this.dragging ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt / D.releaseTau)
    this.look.yaw += (this.look.tarYaw - this.look.yaw) * kDrag
    this.look.pitch += (this.look.tarPitch - this.look.pitch) * kDrag

    const pose = this.computePose(this.p)
    const pos = pose.pos
    this.fovTarget = pose.fov

    if (this.p >= 0.66 && this.p <= 0.9) {
      this.clampToInterior(pos)
    }

    this.camera.position.copy(pos)
    this.baseQuat.copy(pose.quat)

    const inside = this.p >= 0.66 && this.p <= 0.9
    const limYaw = (inside ? D.insideYaw : D.outsideYaw) * DEG
    const limPitch = (inside ? D.insidePitch : 4) * DEG
    this.look.yaw = clamp(this.look.yaw, -limYaw, limYaw)
    this.look.pitch = clamp(this.look.pitch, -limPitch, limPitch)
    const eul = new THREE.Euler(this.look.pitch, this.look.yaw, 0, 'YXZ')
    const q = new THREE.Quaternion().setFromEuler(eul)
    this.camera.quaternion.copy(this.baseQuat).multiply(q)

    this.lensShift = pose.lensShift
    const vw = this.renderer.domElement.width
    const vh = this.renderer.domElement.height
    if (Math.abs(this.lensShift) > 1e-4 && vw > 0 && vh > 0) {
      this.camera.setViewOffset(vw, vh, 0, this.lensShift * vh, vw, vh)
    } else {
      this.camera.clearViewOffset()
    }

    this.camera.fov = damp(this.camera.fov, this.fovTarget, 0.12, dt)
    this.camera.updateProjectionMatrix()

    this.updateGlassFade(pos)
    this.syncOverlays()
  }

  clampToInterior(pos) {
    if (!this.box) return
    const ix = this.hx - WALK_CONFIG.CLAMP_INSET
    const iz = this.hz - WALK_CONFIG.CLAMP_INSET
    pos.x = clamp(pos.x, -ix, ix)
    pos.z = clamp(pos.z, -iz, iz)
    pos.y = clamp(pos.y, 0.05, this.H - 0.2)
  }

  computePose(p) {
    const P = this.pose
    const C = WALK_CONFIG
    let pos
    let quat
    let fov
    let lensShift
    const lerpV = (a, b, t) => a.clone().lerp(b, t)
    const slerpQ = (a, b, t) => a.clone().slerp(b, t)
    const o = this.outV
    const s = this.sideV

    const nameShift = this.isTouch ? C.NAME_LENS_SHIFT_MOBILE : C.NAME_LENS_SHIFT
    if (p <= 0.08) {
      pos = P.name.pos.clone()
      quat = P.name.q.clone()
      fov = C.NAME_FOV_DEG
      lensShift = nameShift
    } else if (p <= 0.3) {
      const t = smootherstep((p - 0.1) / 0.2)
      pos = lerpV(P.name.pos, P.plan.pos, t)
      quat = slerpQ(P.name.q, P.plan.q, t)
      fov = C.NAME_FOV_DEG + (C.PLAN_FOV_DEG - C.NAME_FOV_DEG) * t
      lensShift = nameShift * (1 - t)
    } else if (p <= 0.38) {
      const t = (p - 0.3) / 0.08
      const pan = 0.5 * (1 - Math.cos(clamp(t, 0, 1) * Math.PI)) * C.PLAN_PAN_M
      pos = P.plan.pos.clone().addScaledVector(o, pan - C.PLAN_PAN_M / 2)
      quat = P.plan.q.clone()
      fov = C.PLAN_FOV_DEG
      lensShift = this.planLensY || 0
    } else if (p <= 0.52) {
      const t = smootherstep((p - 0.38) / 0.14)
      pos = lerpV(P.plan.pos, P.level.pos, t)
      quat = slerpQ(P.plan.q, P.level.q, t)
      fov = C.PLAN_FOV_DEG + (C.LEVEL_FOV_DEG - C.PLAN_FOV_DEG) * t
      lensShift = (this.planLensY || 0) * (1 - t)
    } else if (p <= 0.66) {
      const tD = clamp((p - 0.57) / 0.09, 0, 1)
      const tDS = smootherstep(tD)
      const depth = lerpScalar(C.LEVEL_CAM_DIST_D * this.D, this.hz - C.WALK_START_INSIDE, tDS)
      const latT = clamp((p - 0.52) / 0.08, 0, 1)
      const lat = lerpScalar(this.sFacade, this.sDoor, smootherstep(latT))
      pos = o.clone().multiplyScalar(depth).addScaledVector(UP, C.EYE_ENTER_Y).addScaledVector(s, lat)
      quat = P.level.q.clone()
      fov = C.LEVEL_FOV_DEG + (C.APPROACH_END_FOV_DEG - C.LEVEL_FOV_DEG) * tDS
      lensShift = 0
    } else if (p <= 0.9) {
      const walk = this.walkPose(p)
      pos = walk.pos
      quat = walk.quat
      fov = C.APPROACH_END_FOV_DEG
      lensShift = 0
    } else if (p <= 0.96) {
      const tIn = smootherstep((p - 0.9) / 0.05)
      const tOut = smootherstep((p - 0.95) / 0.01)
      let ppos
      if (p < 0.95) {
        ppos = this.walkEnd.clone().lerp(this.exitPoint, tIn)
      } else {
        ppos = this.exitPoint.clone().lerp(P.reverseOut.pos, tOut)
      }
      let lat
      if (p < 0.936) {
        lat = lerpScalar(this.walkLatEnd, this.sDoor, smootherstep((p - 0.9) / 0.036))
      } else {
        lat = lerpScalar(this.sDoor, this.sFacade, smootherstep((p - 0.936) / 0.024))
      }
      ppos.addScaledVector(s, lat - ppos.dot(s))
      const tgt = ppos.clone().addScaledVector(o, -3)
      tgt.y = ppos.y
      quat = quatFromLook(ppos, tgt, UP)
      const t = (p - 0.9) / 0.06
      fov = C.APPROACH_END_FOV_DEG + (C.LEVEL_FOV_DEG - C.APPROACH_END_FOV_DEG) * smootherstep(t)
      pos = ppos
      lensShift = 0
    } else {
      const t = smootherstep((p - 0.96) / 0.04)
      pos = lerpV(P.reverseOut.pos, P.releaseOut.pos, t)
      quat = P.level.q.clone()
      fov = C.LEVEL_FOV_DEG
      lensShift = 0
    }

    return { pos, quat, fov, lensShift }
  }

  walkPose(p) {
    const u = (p - 0.66) / 0.24
    const W = WALK_CONFIG.WALK_EASE_FRAC
    let adv
    if (u < W) adv = W * smootherstep(u / W)
    else if (u > 1 - W) adv = 1 - W + W * smootherstep((u - (1 - W)) / W)
    else adv = u
    const z = this.walkStart.z + (this.walkEnd.z - this.walkStart.z) * adv

    const targetLat = 0
    const desired = Math.abs(this.sDoor - targetLat) * smootherstep(clamp(u / 0.35, 0, 1))
    const budget = 0.08 * (p - 0.66) / 0.01
    const move = Math.min(desired, Math.max(0, budget))
    const lat = this.sDoor - Math.sign(this.sDoor - targetLat) * move
    this.walkLatEnd = lat
    const pos = new THREE.Vector3(lat, WALK_CONFIG.EYE_ENTER_Y, z)

    const anchors = this.poiAnchors
    let anchorT
    if (anchors.length < 2) anchorT = pos.clone().addScaledVector(this.outV, -2)
    else if (u < 0.4) anchorT = anchors[0].clone().lerp(anchors[1], smootherstep(u / 0.4))
    else if (u < 0.8) anchorT = anchors[1].clone().lerp(anchors[2], smootherstep((u - 0.4) / 0.4))
    else anchorT = anchors[anchors.length - 1].clone()

    const straight = pos.clone().addScaledVector(this.outV, -3)
    const g = Math.sin(Math.PI * clamp(u, 0, 1))
    const target = straight.lerp(anchorT, g)

    const fwd = new THREE.Vector3().subVectors(target, pos).normalize()
    const walkDir = this.outV.clone().negate()
    const yaw = Math.atan2(fwd.dot(this.sideV), fwd.dot(walkDir))
    const limYaw = WALK_CONFIG.WALK_HEAD_TURN_DEG * DEG
    if (Math.abs(yaw) > limYaw) {
      const signY = Math.sign(yaw)
      const excess = Math.abs(yaw) - limYaw
      const qFix = new THREE.Quaternion().setFromAxisAngle(UP, -signY * excess)
      fwd.applyQuaternion(qFix)
    }
    const q = quatFromBasis(fwd, UP)
    this.walkEndTarget = target.clone()
    return { pos, quat: q }
  }

  fovForP(p) {
    const C = WALK_CONFIG
    if (p <= 0.08) return C.NAME_FOV_DEG
    if (p <= 0.3) return C.NAME_FOV_DEG + (C.PLAN_FOV_DEG - C.NAME_FOV_DEG) * smootherstep((p - 0.1) / 0.2)
    if (p <= 0.38) return C.PLAN_FOV_DEG
    if (p <= 0.52) return C.PLAN_FOV_DEG + (C.LEVEL_FOV_DEG - C.PLAN_FOV_DEG) * smootherstep((p - 0.38) / 0.14)
    if (p <= 0.66) return C.LEVEL_FOV_DEG + (C.APPROACH_END_FOV_DEG - C.LEVEL_FOV_DEG) * smootherstep((p - 0.57) / 0.09)
    if (p <= 0.96) return C.APPROACH_END_FOV_DEG + (C.LEVEL_FOV_DEG - C.APPROACH_END_FOV_DEG) * smootherstep((p - 0.9) / 0.06)
    return C.LEVEL_FOV_DEG
  }

  updateGlassFade(pos) {
    if (!this.glassMeshes.length) return
    const along = pos.dot(this.outV)
    const near = Math.abs(along - this.hz) < WALK_CONFIG.GLASS_FADE_DIST
    const target = near ? WALK_CONFIG.GLASS_FADE_OPACITY : 1
    const gAmt = this.glassPlanAmt(this.p)
    let changed = false
    for (const g of this.glassMeshes) {
      const want = g.base * gAmt * target
      if (Math.abs(g.mat.opacity - want) > 0.01) {
        g.mat.opacity = want
        changed = true
      }
    }
    if (changed) this.lastCamKey = ''
  }

  syncOverlays() {
    const rel = this.ui.releaseEl
    if (rel) {
      const op = this.p > 0.96 ? smootherstep((this.p - 0.96) / 0.04) : 0
      const cur = Number(rel.dataset.op || 0)
      if (Math.abs(cur - op) > 0.01) {
        rel.dataset.op = String(op)
        rel.style.opacity = String(op)
      }
    }
  }

  measureQuality(dt) {
    if (this.qualityTimer === undefined) {
      this.qualityTimer = 0
      this.qualityLevel = 0
      this.qualitySamples = []
    }
    this.qualityTimer += dt
    this.qualitySamples.push(this.perfSamples[this.perfSamples.length - 1] || 0)
    if (this.qualityTimer >= 1 && this.qualitySamples.length) {
      const avg = this.qualitySamples.reduce((a, b) => a + b, 0) / this.qualitySamples.length
      this.qualitySamples = []
      this.qualityTimer = 0
      if (avg > 20) {
        if (this.pixelRatio > 0.75 && this.qualityLevel < 2) {
          this.qualityLevel++
          this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25)
          this.renderer.setPixelRatio(this.pixelRatio)
          if (this.debug) console.log('[walkthrough] quality scaled to', this.pixelRatio.toFixed(2))
        } else if (this.fx > 0) {
          const order = WALK_CONFIG.FX.autoDowngradeOrder
          const next = order.find((f) => !this.disabledFx.has(f) && this.fxEnabled(f))
          if (next) {
            this.disabledFx.add(next)
            this.applyFxDowngrade(next)
            if (this.debug) console.log('[walkthrough] fx downgrade ->', next)
          }
        }
      }
    }
  }

  fxEnabled(kind) {
    if (this.fx < 1) return false
    if (kind === 'shafts' || kind === 'dust') return this.fx >= 2
    if (kind === 'glow') return this.fx >= 1
    return true
  }

  applyFxDowngrade(kind) {
    if (kind === 'dust' && this.dust) this.dust.visible = false
    if (kind === 'shafts') for (const sh of this.shafts) sh.mesh.visible = false
    if (kind === 'glow') {
      for (const g of this.glassGlows) g.mesh.visible = false
    }
  }

  async loadModel() {
    const { loadBar, loadText, loadWrap } = this.ui
    try {
      const resp = await fetch(WALK_CONFIG.MODEL_URL)
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status} for ${WALK_CONFIG.MODEL_URL}`)
      this.totalBytes = Number(resp.headers.get('content-length')) || 0
      const reader = resp.body.getReader()
      const chunks = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        this.loadedBytes += value.length
        if (this.totalBytes) {
          loadBar.style.width = `${(this.loadedBytes / this.totalBytes) * 100}%`
          loadText.textContent = `Loading ${WALK_CONFIG.SHOP_NAME}… ${(this.loadedBytes / 1048576).toFixed(1)} MB`
        }
      }
      const bytes = new Uint8Array(this.loadedBytes)
      let off = 0
      for (const c of chunks) {
        bytes.set(c, off)
        off += c.length
      }
      const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
      if (magic !== 'glTF') {
        this.showError(`Wrong path: ${WALK_CONFIG.MODEL_URL} returned "${magic}" (Vite serves index.html for missing files)`)
        return
      }
      if (this.cancelled) return
      const gltf = await new Promise((resolve, reject) => {
        const loader = new GLTFLoader()
        loader.setMeshoptDecoder(MeshoptDecoder)
        loader.parse(bytes.buffer, '', resolve, reject)
      })
      if (this.cancelled) return
      this.acceptModel(gltf.scene)
    } catch (err) {
      this.showError(err.message)
    }
  }

  toLambert(material) {
    const out = new THREE.MeshLambertMaterial({
      map: material.map || null,
      color: material.color ? material.color.clone() : new THREE.Color(0xffffff),
      transparent: !!material.transparent,
      opacity: material.opacity ?? 1,
      alphaTest: material.alphaTest || 0,
      side: THREE.DoubleSide,
      depthWrite: material.transparent ? false : true,
      toneMapped: true,
    })
    if (out.map) out.map.colorSpace = THREE.SRGBColorSpace
    const name = (material.name || '').toLowerCase()
    if (name.includes('emissive') || name.includes('lamp') || name.includes('screen') || name.includes('glow')) {
      out.emissive = out.color.clone().multiplyScalar(0.6)
      out.emissiveIntensity = 1.2
    }
    return out
  }

  setAnisotropy() {
    const max = this.renderer.capabilities.getMaxAnisotropy()
    const aniso = Math.min(8, max)
    for (const m of this.meshes) {
      if (m.material && m.material.map) m.material.map.anisotropy = aniso
    }
  }

  acceptModel(root) {
    const hide = WALK_CONFIG.HIDE_MESHES.concat(WALK_CONFIG.REPLACE_OR_HIDE)
    root.traverse((obj) => {
      if (obj.isMesh) {
        const matName = obj.material && obj.material.name
        if (hide.includes(obj.name) || (matName && hide.includes(matName))) {
          obj.visible = false
          return
        }
        obj.frustumCulled = true
        const mat = this.toLambert(obj.material)
        if (mat.transparent) {
          mat.depthWrite = false
          obj.renderOrder = 10
        }
        obj.material = mat
        this.meshes.push(obj)
      }
    })

    let maxTris = 0
    for (const m of this.meshes) {
      const g = m.geometry
      const t = (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3
      if (t > maxTris) {
        maxTris = t
        this.structure = m
      }
    }
    for (const m of this.meshes) {
      if (m !== this.structure) {
        this.props.push(m)
        const base = new THREE.Vector3().copy(m.position)
        this.propBase.set(m, { y: base.y })
        if (m.material && m.material.transparent) {
          this.glassMeshes.push({ mesh: m, mat: m.material, base: m.material.opacity || 1 })
        }
      }
    }

    this.originalBox = new THREE.Box3().setFromObject(root)
    const center = new THREE.Vector3()
    this.originalBox.getCenter(center)
    const floorY = this.originalBox.min.y + 0.13

    const shopRoot = new THREE.Group()
    shopRoot.name = 'shopRoot'
    shopRoot.add(root)
    root.position.set(-center.x, -floorY, -center.z)
    this.scene.add(shopRoot)
    shopRoot.updateMatrixWorld(true)

    this.box = new THREE.Box3().setFromObject(shopRoot)
    const size = new THREE.Vector3()
    this.box.getSize(size)
    this.H = size.y
    this.hx = size.x / 2
    this.hz = size.z / 2
    this.D = Math.max(size.x, size.y, size.z)
    this.shopRoot = shopRoot

    this.setAnisotropy()
    this.splitRoof()
    this.detectDoors()
    this.buildPathConstants()

    this.modelReady = true
    this.ui.loadWrap.style.display = 'none'

    if (this.camera && this.scene) {
      this.renderer.compile(this.scene, this.camera)
    }
    this.measureContainer()

    if (this.test) {
      this.controls.target.set(0, this.H * 0.4, 0)
      this.setCameraOutside()
      this.controls.update()
    } else if (this.reduced) {
      this.setCameraOutside()
    }

    if (this.debug) {
      console.log('[walkthrough] model loaded', {
        bytes: this.loadedBytes,
        originalBox: this.originalBox,
        centeredBox: this.box,
        hx: this.hx,
        hz: this.hz,
        H: this.H,
        D: this.D,
        doorX: this.doorX,
        doorOff: this.doorOff,
        glass: this.glassMeshes.length,
        structureTris: Math.round(maxTris),
        props: this.props.length,
        fx: this.fx,
        roof: this.roofReport,
      })
    }
  }

  splitRoof() {
    const mesh = this.structure
    const geo = mesh.geometry
    const posAttr = geo.attributes.position
    const idxAttr = geo.index
    if (!idxAttr) {
      this.roofReport = { method: 'no-split (non-indexed)', roofTris: 0, totalTris: 0 }
      return
    }
    const triCount = idxAttr.count / 3
    const m = mesh.matrixWorld
    const va = new THREE.Vector3()
    const wpos = new Float32Array(posAttr.count * 3)
    for (let i = 0; i < posAttr.count; i++) {
      va.fromBufferAttribute(posAttr, i).applyMatrix4(m)
      wpos[i * 3] = va.x
      wpos[i * 3 + 1] = va.y
      wpos[i * 3 + 2] = va.z
    }

    const tris = []
    let yMax = -1e9
    for (let t = 0; t < triCount; t++) {
      const i0 = idxAttr.getX(t * 3)
      const i1 = idxAttr.getX(t * 3 + 1)
      const i2 = idxAttr.getX(t * 3 + 2)
      const y0 = wpos[i0 * 3 + 1]
      const y1 = wpos[i1 * 3 + 1]
      const y2 = wpos[i2 * 3 + 1]
      const ymin = Math.min(y0, y1, y2)
      const ymax = Math.max(y0, y1, y2)
      const e1x = wpos[i1 * 3] - wpos[i0 * 3]
      const e1y = y1 - y0
      const e1z = wpos[i1 * 3 + 2] - wpos[i0 * 3 + 2]
      const e2x = wpos[i2 * 3] - wpos[i0 * 3]
      const e2y = y2 - y0
      const e2z = wpos[i2 * 3 + 2] - wpos[i0 * 3 + 2]
      const nx = e1y * e2z - e1z * e2y
      const ny = e1z * e2x - e1x * e2z
      const nz = e1x * e2y - e1y * e2x
      const len = Math.hypot(nx, ny, nz) || 1e-9
      tris.push({ i0, i1, i2, ymin, ymax, ny: ny / len })
      if (ymax > yMax) yMax = ymax
    }

    const binW = 0.02
    const bins = new Map()
    for (let i = 0; i < posAttr.count; i++) {
      const y = wpos[i * 3 + 1]
      const k = Math.round(y / binW)
      bins.set(k, (bins.get(k) || 0) + 1)
    }
    let roofBottom = this.H - 0.15
    const topK = Math.round(yMax / binW)
    const peakCount = bins.get(topK) || 0
    let k = topK
    let gap = 0
    while (k - 1 > 0 && (k - 1) * binW > this.H - 0.6) {
      const n = bins.get(k - 1) || 0
      if (n > Math.max(10, peakCount * 0.15)) {
        k--
        gap = 0
      } else {
        gap++
        if (gap > 1 || n === 0) break
        k--
      }
    }
    roofBottom = k * binW - 0.03

    const TINT_TOP = WALK_CONFIG.WALL_TINT_TOP_BAND
    let tintMin = WALK_CONFIG.WALL_TINT_MIN_Y
    let roofIdx = []
    let structIdx = []
    let roofTris = 0
    let iter = 0
    while (iter++ < 6) {
      roofIdx = []
      structIdx = []
      roofTris = 0
      for (let t = 0; t < triCount; t++) {
        const tr = tris[t]
        let isRoof = false
        if (tr.ymin >= roofBottom - 0.05) {
          isRoof = true
        } else if (tr.ymin >= tintMin && tr.ymax <= TINT_TOP && Math.abs(tr.ny) > 0.7) {
          isRoof = true
        }
        if (isRoof) {
          roofIdx.push(tr.i0, tr.i1, tr.i2)
          roofTris++
        } else {
          structIdx.push(tr.i0, tr.i1, tr.i2)
        }
      }
      const check = this.checkRoofOpen(wpos, structIdx)
      if (!check || check.pctAbove2m <= 10 || tintMin <= 1.2) {
        this.roofRayCheck = check
        break
      }
      tintMin -= 0.1
    }
    this.roofTintMin = tintMin

    let rMinX = 1e9
    let rMinY = 1e9
    let rMinZ = 1e9
    let rMaxX = -1e9
    let rMaxY = -1e9
    let rMaxZ = -1e9
    for (let i = 0; i < roofIdx.length; i++) {
      const idx = roofIdx[i]
      const x = wpos[idx * 3]
      const y = wpos[idx * 3 + 1]
      const z = wpos[idx * 3 + 2]
      if (x < rMinX) rMinX = x
      if (y < rMinY) rMinY = y
      if (z < rMinZ) rMinZ = z
      if (x > rMaxX) rMaxX = x
      if (y > rMaxY) rMaxY = y
      if (z > rMaxZ) rMaxZ = z
    }

    const structureGeo = new THREE.BufferGeometry()
    const roofGeo = new THREE.BufferGeometry()
    for (const key of Object.keys(geo.attributes)) {
      structureGeo.setAttribute(key, geo.attributes[key])
      roofGeo.setAttribute(key, geo.attributes[key])
    }
    structureGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(structIdx), 1))
    roofGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(roofIdx), 1))

    const parent = mesh.parent
    const structureMesh = new THREE.Mesh(structureGeo, mesh.material)
    structureMesh.position.copy(mesh.position)
    structureMesh.quaternion.copy(mesh.quaternion)
    structureMesh.scale.copy(mesh.scale)
    structureMesh.name = 'structure'
    this.structureMesh = structureMesh

    const roofMat = mesh.material.clone()
    roofMat.transparent = true
    roofMat.opacity = 1
    roofMat.depthWrite = true
    const roofMesh = new THREE.Mesh(roofGeo, roofMat)
    roofMesh.position.copy(mesh.position)
    roofMesh.quaternion.copy(mesh.quaternion)
    roofMesh.scale.copy(mesh.scale)
    roofMesh.name = 'roof'
    this.roofMesh = roofMesh

    const roofGroup = new THREE.Group()
    roofGroup.name = 'roofGroup'
    roofGroup.add(roofMesh)
    this.roofGroup = roofGroup
    this.roofBaseTransform = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1),
    }

    parent.add(structureMesh)
    parent.add(roofGroup)
    mesh.visible = false
    this.structure = structureMesh

    this.injectSquashShader(structureMesh.material)

    const floorArea = 4 * this.hx * this.hz
    let roofArea = 0
    let skinArea = 0
    for (let t = 0; t < roofTris; t++) {
      const i0 = roofIdx[t * 3]
      const i1 = roofIdx[t * 3 + 1]
      const i2 = roofIdx[t * 3 + 2]
      const e1x = wpos[i1 * 3] - wpos[i0 * 3]
      const e1z = wpos[i1 * 3 + 2] - wpos[i0 * 3 + 2]
      const e2x = wpos[i2 * 3] - wpos[i0 * 3]
      const e2z = wpos[i2 * 3 + 2] - wpos[i0 * 3 + 2]
      const a = Math.abs(e1x * e2z - e1z * e2x) / 2
      roofArea += a
      const ymin = Math.min(wpos[i0 * 3 + 1], wpos[i1 * 3 + 1], wpos[i2 * 3 + 1])
      if (ymin >= roofBottom - 0.05) skinArea += a
    }

    const report = {
      method: 'shared-buffer split',
      totalTris: triCount,
      roofTris,
      structureTris: structIdx.length / 3,
      roofBottomY: Number(roofBottom.toFixed(3)),
      tintMinUsed: Number(tintMin.toFixed(2)),
      roofBox: {
        min: [rMinX, rMinY, rMinZ].map((v) => Number(v.toFixed(3))),
        max: [rMaxX, rMaxY, rMaxZ].map((v) => Number(v.toFixed(3))),
      },
      roofSize: [rMaxX - rMinX, rMaxY - rMinY, rMaxZ - rMinZ].map((v) => Number(v.toFixed(3))),
      roofThickness: Number((rMaxY - rMinY).toFixed(3)),
      topSlabThickness: Number((yMax - roofBottom + 0.05).toFixed(3)),
      footprintArea: Number(floorArea.toFixed(2)),
      roofArea: Number(roofArea.toFixed(2)),
      coveragePct: Number(((roofArea / floorArea) * 100).toFixed(1)),
      topSkinCoveragePct: Number(((skinArea / floorArea) * 100).toFixed(1)),
      modelTopY: Number(yMax.toFixed(3)),
      rayCheck: this.roofRayCheck || null,
    }
    this.roofReport = report
  }

  checkRoofOpen(wpos, structIdx) {
    const pos = new Float32Array(structIdx.length * 3)
    for (let i = 0; i < structIdx.length; i++) {
      const idx = structIdx[i]
      pos[i * 3] = wpos[idx * 3]
      pos[i * 3 + 1] = wpos[idx * 3 + 1]
      pos[i * 3 + 2] = wpos[idx * 3 + 2]
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    const rad = new THREE.Raycaster()
    const down = new THREE.Vector3(0, -1, 0)
    const H = this.H + 1
    const hit = []
    const n = 7
    for (let gx = 0; gx < n; gx++) {
      for (let gz = 0; gz < n; gz++) {
        const x = -this.hx + (2 * this.hx) * (gx + 0.5) / n
        const z = -this.hz + (2 * this.hz) * (gz + 0.5) / n
        rad.set(new THREE.Vector3(x, H, z), down)
        const hits = rad.intersectObject(mesh, false)
        hit.push(hits.length ? Number((H - hits[0].distance).toFixed(2)) : null)
      }
    }
    geo.dispose()
    const above2 = hit.filter((v) => v !== null && v > 2.0).length
    return {
      hits: hit,
      above2m: above2,
      total: hit.length,
      pctAbove2m: Number(((above2 / hit.length) * 100).toFixed(1)),
    }
  }

  injectSquashShader(material) {
    const ctl = this
    const tintColor = WALK_CONFIG.WALL_TINT_COLOR.join(',')
    const tintStrength = WALK_CONFIG.WALL_TINT_STRENGTH
    const excluded = WALK_CONFIG.WALL_TINT_EXCLUDE_MATERIALS.includes(material.name)
    ctl.squashHookStats = { vertexMin: false, fragmentTint: false, excluded }
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uCutYObj = ctl.cutUniformObj
      shader.uniforms.uCutYWorld = ctl.cutUniformWorld
      shader.uniforms.uPlan = ctl.planUniform
      const v = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uCutYObj;\nvarying vec3 vWYv;\nvarying float vNYv;'
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed.y = min(transformed.y, uCutYObj);
          vec4 wPos = modelMatrix * vec4(transformed, 1.0);
          vWYv = wPos.xyz;
          vNYv = normalize(mat3(normalMatrix) * normal).y;`
        )
      shader.vertexShader = v
      ctl.squashHookStats.vertexMin = v.includes('min(transformed.y, uCutYObj)')
      const fragCommon = excluded ? '#include <common>\nvarying vec3 vWYv;\nvarying float vNYv;' : `#include <common>
            uniform float uCutYWorld;
            uniform float uPlan;
            varying vec3 vWYv;
            varying float vNYv;`
      const f0 = shader.fragmentShader.replace('#include <common>', fragCommon)
      shader.fragmentShader = f0
      if (!excluded) {
        const f1 = f0.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
            float wallMask = (abs(vNYv) < 0.5 || (vNYv > 0.9 && vWYv.y > uCutYWorld - 0.03)) ? 1.0 : 0.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${tintColor}), uPlan * wallMask * ${tintStrength});`
        )
        shader.fragmentShader = f1
        ctl.squashHookStats.fragmentTint = f1.includes('wallMask')
      } else {
        ctl.squashHookStats.fragmentTint = true
      }
    }
  }

  detectDoors() {
    this.doorCandidates = []
    if (!this.structure) {
      this.doorCandidates.push({ mesh: null, fraction: 0.5, width: 0 })
      this.doorX = WALK_CONFIG.DOOR_X != null ? clamp(WALK_CONFIG.DOOR_X, 0, 1) : 0.5
      this.doorOff = (this.doorX * 2 - 1) * this.hx
      return
    }
    const mesh = this.structure
    const geo = mesh.geometry
    const posAttr = geo.attributes.position
    const idxAttr = geo.index
    if (!idxAttr) {
      this.doorCandidates.push({ mesh: null, fraction: 0.5, width: 0 })
      this.doorX = WALK_CONFIG.DOOR_X != null ? clamp(WALK_CONFIG.DOOR_X, 0, 1) : 0.5
      this.doorOff = (this.doorX * 2 - 1) * this.hx
      return
    }
    mesh.updateWorldMatrix(true, false)
    const m = mesh.matrixWorld
    const va = new THREE.Vector3()
    const triCount = idxAttr.count / 3
    const cols = {}
    const fr = this.hz - 0.9
    const to = this.hz + 0.1
    for (let t = 0; t < triCount; t++) {
      const i0 = idxAttr.getX(t * 3)
      const i1 = idxAttr.getX(t * 3 + 1)
      const i2 = idxAttr.getX(t * 3 + 2)
      va.fromBufferAttribute(posAttr, i0).applyMatrix4(m)
      const z0 = va.z
      va.fromBufferAttribute(posAttr, i1).applyMatrix4(m)
      const z1 = va.z
      va.fromBufferAttribute(posAttr, i2).applyMatrix4(m)
      const z2 = va.z
      const zc = (z0 + z1 + z2) / 3
      if (zc < fr || zc > to) continue
      const y0 = va.y
      va.fromBufferAttribute(posAttr, i0).applyMatrix4(m)
      const y1 = va.y
      void y0
      void y1
      const col = Math.floor((va.x + this.hx) / (2 * this.hx) * 32)
      cols[col] = (cols[col] || 0) + 1
    }
    let bestLen = 0
    let bestRun = null
    let curStart = null
    let run = 0
    for (let c = 0; c < 32; c++) {
      const n = cols[c] || 0
      if (n < 8) {
        if (curStart === null) curStart = c
        run++
        if (run > bestLen) {
          bestLen = run
          bestRun = [curStart, c]
        }
      } else {
        curStart = null
        run = 0
      }
    }
    if (this.debug) {
      console.log('[walkthrough] door scan cols', JSON.stringify(Object.keys(cols).map(Number).sort((a, b) => a - b).map((c) => c + ':' + (cols[c] || 0))))
    }
    if (bestRun) {
      const cMid = (bestRun[0] + bestRun[1]) / 2
      const frac = (cMid + 0.5) / 32
      this.doorCandidates.push({ mesh: null, fraction: clamp(frac, 0, 1), width: (bestLen / 32) * 2 * this.hx })
    }
    if (!this.doorCandidates.length) {
      this.doorCandidates.push({ mesh: null, fraction: 0.5, width: 0 })
    }
    this.doorIndex = 0
    if (WALK_CONFIG.DOOR_X != null) {
      this.doorX = clamp(WALK_CONFIG.DOOR_X, 0, 1)
    } else {
      this.doorX = this.doorCandidates[0].fraction
    }
    this.doorOff = (this.doorX * 2 - 1) * this.hx
  }

  buildPathConstants() {
    const o = this.outV
    const s = this.sideV
    const C = WALK_CONFIG
    const doorOff = (this.doorX * 2 - 1) * this.hx
    this.doorOff = doorOff

    this.computeMainFacadeExtent()
    this.computeOpenings()
    this.computeLabels()
    this.applyOpeningGlows()

    const nameDistD = this.isTouch ? C.NAME_CAM_DIST_D_MOBILE : C.NAME_CAM_DIST_D
    const namePos = o.clone().multiplyScalar(Math.cos(C.NAME_CAM_OFF_DEG * DEG) * nameDistD * this.D)
    namePos.addScaledVector(s, Math.sin(C.NAME_CAM_OFF_DEG * DEG) * nameDistD * this.D)
    namePos.y = C.NAME_CAM_HEIGHT_D * this.D
    const nameTarget = new THREE.Vector3(0, 0.25 * this.H, 0)
    const nameQ = quatFromLook(namePos, nameTarget, UP)
    this.pose.name = { pos: namePos, q: nameQ, target: nameTarget }

    const pitch = C.PLAN_PITCH_DEG * DEG
    const f = o.clone().multiplyScalar(-Math.cos(pitch)).addScaledVector(UP, -Math.sin(pitch)).normalize()
    const planQ = quatFromBasis(f, UP)
    this.pose.plan = { q: planQ }

    this.fitPlanCamera()
    this.pose.plan.pos = o.clone().multiplyScalar(this.planDist).addScaledVector(UP, this.planHeight)
    this.pose.plan.pos.addScaledVector(this.planRight, this.planOffset.tx)
    this.pose.plan.pos.addScaledVector(this.planUp, this.planOffset.ty)

    const levelPos = o.clone().multiplyScalar(C.LEVEL_CAM_DIST_D * this.D)
    levelPos.addScaledVector(s, this.sFacade)
    levelPos.y = C.EYE_ENTER_Y
    const levelQ = quatFromBasis(o.clone().negate(), UP)
    this.pose.level = { pos: levelPos, q: levelQ }
    this.testSideBasis()

    const approachEnd = o.clone().multiplyScalar(this.hz - C.WALK_START_INSIDE)
    approachEnd.addScaledVector(s, this.sDoor)
    approachEnd.y = C.EYE_ENTER_Y
    this.pose.approachEnd = { pos: approachEnd }

    this.walkStart = approachEnd.clone()
    this.walkEnd = o.clone().multiplyScalar(this.hz - C.WALK_MAX_DEPTH * 2 * this.hz)
    this.walkEnd.y = C.EYE_ENTER_Y
    this.entryEnd = approachEnd.clone()
    this.exitPoint = o.clone().multiplyScalar(this.hz)
    this.exitPoint.addScaledVector(s, this.sDoor)
    this.exitPoint.y = C.EYE_ENTER_Y

    const reverseOut = o.clone().multiplyScalar(C.REVERSE_END_DIST * this.D)
    reverseOut.addScaledVector(s, this.sFacade)
    reverseOut.y = C.REVERSE_END_H_FRAC_D * this.D
    this.pose.reverseOut = { pos: reverseOut }

    const releaseOut = o.clone().multiplyScalar(C.REVERSE_END_DIST * (1 + C.RELEASE_PUSH_FRAC) * this.D)
    releaseOut.addScaledVector(s, this.sFacade)
    releaseOut.y = C.REVERSE_END_H_FRAC_D * this.D
    this.pose.releaseOut = { pos: releaseOut }

    this.reverseDist = this.walkEnd.distanceTo(this.entryEnd) + this.entryEnd.distanceTo(reverseOut)

    this.poiAnchors = []
    for (const poi of C.POINTS_OF_INTEREST) {
      const x = -this.hx + poi.x * 2 * this.hx
      const z = -this.hz + poi.z * 2 * this.hz
      this.poiAnchors.push(new THREE.Vector3(x, 1.3, z))
    }

    this.labelAnchors = []
    if (this.labels && this.labels.length) {
      for (const label of this.labels) {
        this.labelAnchors.push(this.labelAnchorFor(label))
      }
    }

    const opening = this.entryOpening
    if (opening) {
      const glassMaxT = Math.max(...opening.meshes.map((mi) => {
        const mesh = this.meshes[mi]
        const b = new THREE.Box3().setFromObject(mesh, true)
        return Math.max(b.max.dot(o), b.min.dot(o))
      }))
      this.markerAnchor = o.clone().multiplyScalar(glassMaxT + 0.4)
      this.markerAnchor.addScaledVector(s, opening.centerS)
      this.markerAnchor.y = 0.4
    } else {
      this.markerAnchor = o.clone().multiplyScalar(this.hz + 0.45)
      this.markerAnchor.addScaledVector(s, doorOff)
      this.markerAnchor.y = 0.4
    }

    this.buildDomLayers()
  }

  applyOpeningGlows() {
    for (const g of this.glassGlows) {
      this.scene.remove(g.mesh)
      g.mesh.geometry.dispose()
      g.mesh.material.dispose()
    }
    this.glassGlows = []
    if (!this.openings || !this.openings.length) return
    const o = this.outV
    const glowTex = makeSoftGlowTexture()
    for (const op of this.openings) {
      const w = Math.max(0.4, op.width)
      const h = Math.max(0.6, Math.min(2.2, op.height))
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: glowTex,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
          renderOrder: 15,
        })
      )
      const glassBoxes = op.meshes.map((mi) => new THREE.Box3().setFromObject(this.meshes[mi], true))
      let tMax = -Infinity
      for (const b of glassBoxes) tMax = Math.max(tMax, b.max.dot(o))
      m.position.copy(o).multiplyScalar(tMax - 0.15)
      m.position.addScaledVector(this.sideV, op.centerS)
      m.position.y = (op.top - 0.2) / 2
      m.lookAt(m.position.clone().addScaledVector(o, 1))
      this.scene.add(m)
      this.glassGlows.push({ mesh: m, base: WALK_CONFIG.LIGHTS.glassGlowOpacity })
    }
    const spill = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(3, this.openings.reduce((a, b) => a + b.width, 0) + 2), 1.2),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        renderOrder: 12,
      })
    )
    spill.name = 'groundSpill'
    const spillLat = (this.openings[0].centerS + this.openings[this.openings.length - 1].centerS) / 2
    spill.position.copy(o).multiplyScalar(this.hz + 0.9)
    spill.position.addScaledVector(this.sideV, spillLat)
    spill.position.y = 0.012
    spill.rotation.x = -Math.PI / 2
    this.scene.add(spill)
    this.glassGlows.push({ mesh: spill, base: WALK_CONFIG.MOOD.spillOpacity })
  }

  probeOpeningPixels(p) {
    if (!this.entryOpening || !this.entryOpening.meshes.length) return null
    const meshes = this.entryOpening.meshes.map((mi) => this.meshes[mi])
    const saved = meshes.map((m) => ({ mesh: m, mat: m.material }))
    const magenta = new THREE.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false })
    for (const m of meshes) m.material = magenta
    this.p = p
    this.phase = phaseNameFor(p)
    this.updateMood()
    this.updateEffects()
    this.updateCamera(0.016)
    this.renderer.render(this.scene, this.camera)
    const gl = this.renderer.getContext()
    const w = this.renderer.domElement.width
    const h = this.renderer.domElement.height
    const buf = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    for (const s of saved) s.mesh.material = s.mat
    this.renderer.render(this.scene, this.camera)
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (buf[i] > 200 && buf[i + 1] < 80 && buf[i + 2] > 200) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    if (x0 === Infinity) return { p, measured: null, analytic: null }
    const measuredCx = ((x0 + x1) / 2 / w) * 100
    const measuredLeft = (x0 / w) * 100
    const measuredRight = (x1 / w) * 100
    this.camera.updateMatrixWorld(true)
    let aminX = Infinity
    let amaxX = -Infinity
    for (const mi of this.entryOpening.meshes) {
      const b = new THREE.Box3().setFromObject(this.meshes[mi], true)
      for (const c of [new THREE.Vector3(b.min.x, b.min.y, b.min.z), new THREE.Vector3(b.max.x, b.min.y, b.min.z), new THREE.Vector3(b.min.x, b.max.y, b.min.z), new THREE.Vector3(b.max.x, b.max.y, b.min.z), new THREE.Vector3(b.min.x, b.min.y, b.max.z), new THREE.Vector3(b.max.x, b.min.y, b.max.z), new THREE.Vector3(b.min.x, b.max.y, b.max.z), new THREE.Vector3(b.max.x, b.max.y, b.max.z)]) {
        const v = c.clone().project(this.camera)
        if (v.z > 1) continue
        const px = ((v.x + 1) / 2) * 100
        if (px < aminX) aminX = px
        if (px > amaxX) amaxX = px
      }
    }
    const analyticCx = (aminX + amaxX) / 2
    const result = {
      p,
      measured: {
        centerX: Number(measuredCx.toFixed(2)),
        leftMargin: Number(measuredLeft.toFixed(2)),
        rightMargin: Number(measuredRight.toFixed(2)),
      },
      analytic: {
        centerX: Number(analyticCx.toFixed(2)),
        left: Number(aminX.toFixed(2)),
        right: Number(amaxX.toFixed(2)),
      },
    }
    this.probeReport = result
    if (this.debug) console.log('[walkthrough] opening probe', JSON.stringify(result))
    return result
  }

  footprintCorners() {
    const box = new THREE.Box3()
    const tmp = new THREE.Box3()
    const glassSet = new Set(this.glassMeshes.map((g) => g.mesh))
    for (const m of this.meshes) {
      if (m === this.roofGroup || m === this.roofMesh) continue
      if (glassSet.has(m)) continue
      tmp.setFromObject(m)
      box.union(tmp)
    }
    let h = this.hx
    let hz = this.hz
    if (!box.isEmpty()) {
      h = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), this.hx)
      hz = Math.max(Math.abs(box.min.z), Math.abs(box.max.z), this.hz)
    }
    const pw = WALK_CONFIG.PLAN_WALL_HEIGHT
    return [
      [-h, 0, -hz], [h, 0, -hz], [-h, pw, -hz], [h, pw, -hz],
      [-h, 0, hz], [h, 0, hz], [-h, pw, hz], [h, pw, hz],
    ].map((c) => new THREE.Vector3(...c))
  }

  fitPlanCamera() {
    const C = WALK_CONFIG
    const pitch = C.PLAN_PITCH_DEG * DEG
    const fov = C.PLAN_FOV_DEG
    const corners = this.footprintCorners()
    const f = this.pose.plan.q
    this.planRight = new THREE.Vector3().crossVectors(f, UP).normalize()
    this.planUp = new THREE.Vector3().crossVectors(this.planRight, f).normalize()
    void this.planUp

    const measure = (d) => {
      const pos = this.outV.clone().multiplyScalar(d).addScaledVector(UP, d * Math.tan(pitch))
      this.camera.position.copy(pos)
      this.camera.quaternion.copy(f)
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
      this.camera.updateMatrixWorld(true)
      let x0 = 1e9
      let x1 = -1e9
      let y0 = 1e9
      let y1 = -1e9
      for (const c of corners) {
        const v = c.clone().project(this.camera)
        if (v.z > 1) continue
        x0 = Math.min(x0, v.x)
        x1 = Math.max(x1, v.x)
        y0 = Math.min(y0, v.y)
        y1 = Math.max(y1, v.y)
      }
      return { x0, x1, y0, y1 }
    }

    const targetY = 2 * (C.PLAN_VERTICAL_PCT / 100) - 1
    let fill = C.PLAN_FIT_FRAC + 0.04
    let dist = 0
    for (let pass = 0; pass < 8; pass++) {
      let lo = Math.max(0.4 * this.D, this.hz + 0.3)
      let hi = 7.0 * this.D
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2
        const r = measure(mid)
        const fillNow = Math.max(r.x1 - r.x0, r.y1 - r.y0) / 2
        if (fillNow > fill) lo = mid
        else hi = mid
      }
      dist = (lo + hi) / 2
      const r = measure(dist)
      const margin = Math.min(r.x0, 1 - r.x1, r.y0, 1 - r.y1) / 2
      if (margin >= C.PLAN_MARGIN_FRAC) break
      fill = Math.max(0.5, fill - 0.01)
    }
    this.planFill = fill
    this.planDist = dist
    this.planHeight = dist * Math.tan(pitch)
    this.planOffset.tx = 0
    this.planOffset.ty = 0
    const fin = measure(dist)
    const cy = (fin.y0 + fin.y1) / 2
    this.planLensY = Number((cy - targetY).toFixed(4))
    this.planFitReport = {
      dist: Number(dist.toFixed(3)),
      height: Number(this.planHeight.toFixed(3)),
      numericTX: 0,
      numericTY: 0,
      lensY: this.planLensY,
      widthFrac: Number(((fin.x1 - fin.x0) * 100).toFixed(1)),
      heightFrac: Number(((fin.y1 - fin.y0) * 100).toFixed(1)),
      leftPct: Number(((fin.x0 + 1) / 2 * 100).toFixed(1)),
      rightPct: Number(((fin.x1 + 1) / 2 * 100).toFixed(1)),
      topPct: Number(((1 - fin.y1) / 2 * 100).toFixed(1)),
      bottomPct: Number(((1 - fin.y0) / 2 * 100).toFixed(1)),
      axis: this.isTouch ? 'width' : 'height',
    }
    if (this.debug) {
      this.planFitReport.corners = corners.map((c) => c.toArray().map((v) => Number(v.toFixed(2))))
      this.planFitReport.cornerNdc = corners.map((c) => c.clone().project(this.camera).toArray().map((v) => Number(v.toFixed(3))))
    }
  }

  setCameraOutside() {
    const C = WALK_CONFIG
    if (!this.pose.level) return
    const pos = this.pose.level.pos.clone()
    this.camera.position.copy(pos)
    this.camera.quaternion.copy(this.pose.level.q)
    this.camera.fov = C.LEVEL_FOV_DEG
    this.camera.updateProjectionMatrix()
  }

  setCameraInside() {
    const pos = this.outV.clone().multiplyScalar(this.hz - 1.5)
    pos.y = 1.55
    this.camera.position.copy(pos)
    const tgt = pos.clone().addScaledVector(this.outV, 3)
    tgt.y = 1.35
    this.camera.lookAt(tgt)
  }

  setupTestMode() {
    this.controls = new OrbitControls(this.camera, this.ui.canvas)
    this.controls.target.set(0, 1, 0)
    this.controls.update()
    this.ui.testOutsideBtn.addEventListener('click', () => {
      if (!this.box) return
      this.controls.target.set(0, 0.05 * this.H, 0)
      this.setCameraOutside()
      this.controls.update()
    })
    this.ui.testInsideBtn.addEventListener('click', () => {
      if (!this.box) return
      this.controls.target.set(0, 1.35, 0)
      this.setCameraInside()
      this.controls.update()
    })
  }

  setupReducedMotion() {
    this.ui.enterBtn.style.display = 'inline-block'
    this.ui.enterBtn.addEventListener('click', () => this.setCameraInside())
  }

  onPointerDown(e) {
    if (this.labelsTool) {
      if (e.shiftKey) {
        const pt = this.pointerToFloorXZ(e)
        if (pt) {
          this.labels.push({
            id: 'zone' + this.labels.length,
            text: 'ZONE',
            sub: 'auto',
            type: 'zone',
            cx: Number(pt.x.toFixed(2)),
            cz: Number(pt.z.toFixed(2)),
            w: 2,
            d: 2,
          })
          this.rebuildLabelsDom()
        }
        return
      }
      this.hoverObjectFromEvent(e)
      this.selectHoverObject()
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      return
    }
    this.dragging = true
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.ui.canvas.style.cursor = 'grabbing'
    if (this.started) this.ui.canvas.setPointerCapture(e.pointerId)
  }

  onPointerMove(e) {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (this.pinchDist > 0) {
        this.fovTarget = clamp((this.fovTarget || 50) + (this.pinchDist - d) * 0.03, 30, 65)
      }
      this.pinchDist = d
      return
    }
    if (this.labelsTool && !this.dragging) {
      this.hoverObjectFromEvent(e)
    }
    if (!this.dragging || !this.started) return
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
    const inside = this.p >= 0.66 && this.p <= 0.9
    const D = WALK_CONFIG.DRAG
    const limYaw = (inside ? D.insideYaw : D.outsideYaw) * DEG
    const limPitch = (inside ? D.insidePitch : 4) * DEG
    this.look.tarYaw -= dx * 0.004
    this.look.tarYaw = clamp(this.look.tarYaw, -limYaw, limYaw)
    this.look.tarPitch = clamp(this.look.tarPitch + dy * 0.004, -limPitch, limPitch)
  }

  onPointerUp(e) {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) this.pinchDist = 0
    this.dragging = false
    this.ui.canvas.style.cursor = 'grab'
    this.look.tarYaw = 0
    this.look.tarPitch = 0
    try {
      this.ui.canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  onWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault()
      this.fovTarget = clamp((this.fovTarget || 50) - e.deltaY * 0.02, 30, 65)
    }
  }

  onKeyDown(e) {
    if (this.test) return
    if (e.key === 'd' || e.key === 'D') {
      if (this.openings && this.openings.length > 1) {
        this.entryIndex = (this.entryIndex + 1) % this.openings.length
        this.entryOpening = this.openings[this.entryIndex]
        this.sDoor = this.entryOpening.centerS
        this.buildPathConstants()
        if (this.debug) console.log('[walkthrough] ENTRY_OPENING ->', this.entryIndex, this.entryOpening)
      } else {
        this.cycleDoor()
      }
    } else if (e.key === 'e' || e.key === 'E') {
      this.cycleSide()
    } else if (this.debug && e.key === 'g') {
      this.probeOpeningPixels(this.p)
    } else if (this.labelsTool && e.key === 'p') {
      if (this.pinEl && this.pinHeight) {
        const range = this.pinHeight - window.innerHeight
        window.scrollTo(0, this.pinTop + 0.34 * range)
      }
    } else if (this.labelsTool && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const label = this.labels[this.selectedLabel]
      if (!label) return
      const step = e.shiftKey ? 0.5 : 0.1
      if (label.type === 'zone') {
        if (e.key === 'ArrowLeft') label.cx -= step
        else if (e.key === 'ArrowRight') label.cx += step
        else if (e.key === 'ArrowUp') label.cz -= step
        else if (e.key === 'ArrowDown') label.cz += step
        label.cx = Number(label.cx.toFixed(2))
        label.cz = Number(label.cz.toFixed(2))
      } else {
        const off = label.offset || [0, 0, 0]
        if (e.key === 'ArrowLeft') off[0] -= step
        else if (e.key === 'ArrowRight') off[0] += step
        else if (e.key === 'ArrowUp') off[2] -= step
        else if (e.key === 'ArrowDown') off[2] += step
        label.offset = off.map((x) => Number(x.toFixed(3)))
      }
      this.labelAnchors[this.selectedLabel] = this.labelAnchorFor(label)
      this.labelLayout = null
      if (this.p >= 0.28 && this.p <= 0.42) this.layoutLabels()
      else this.updateLabelPanel()
    }
  }

  syncDebug() {
    if (!this.debug) return
    const now = performance.now()
    if (now - this._dbgLast < 250) return
    this._dbgLast = now
    const f = this.debugFieldEls
    if (!f || !Object.keys(f).length) return
    const set = (key, val) => {
      if (f[key]) f[key].textContent = val
    }
    set('model', this.modelReady ? 'loaded' : this.modelFailed ? 'failed' : 'loading…')
    set('mb', this.modelReady ? `${(this.loadedBytes / 1048576).toFixed(2)} MB` : `${(this.loadedBytes / 1048576).toFixed(2)} / ${(this.totalBytes / 1048576).toFixed(1)} MB`)
    set('obox', this.originalBox ? this.fmtBox(this.originalBox) : '—')
    set('cbox', this.box ? this.fmtBox(this.box) : '—')
    set('entrance', `${this.entrance} (side ${this.sideV.x.toFixed(0)},${this.sideV.y.toFixed(0)},${this.sideV.z.toFixed(0)})`)
    set('door', `${this.doorX.toFixed(3)} (${this.doorIndex + 1}/${this.doorCandidates.length})`)
    set('p', this.p.toFixed(4))
    set('phase', this.phase)
    set('cam', `${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)}`)
    set('dist', this.camera.position.length().toFixed(2))
    set('inside', this.isInsideBox() ? 'yes' : 'no')
    set('fov', this.camera.fov.toFixed(1))
    set('shift', this.lensShift.toFixed(3))
    set('px', `${this.renderer.domElement.width}×${this.renderer.domElement.height}`)
    set('renders', String(this.renderCount))
    set('fx', String(this.fx) + (this.disabledFx.size ? ' (-' + [...this.disabledFx].join(',') + ')' : ''))
    set('err', this.lastError || '')
    set('pitch', `${this.pitchDeg().toFixed(1)}°`)
    set('roof', this.roofReport ? `lift ${WALK_CONFIG.ROOF_LIFT} m` : '—')
    set('cutY', this.cutYFor(this.p).toFixed(2))
    set('uplan', this.planUniform.value.toFixed(3))
    set('nameop', this.ui.typeEl ? this.ui.typeEl.style.opacity : '—')
    set('labop', this.labelEls.length && this.labelEls[0].wrap ? this.labelEls[0].wrap.style.opacity : '—')
  }

  pitchDeg() {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
    return Math.asin(clamp(fwd.y, -1, 1)) / DEG
  }

  fmtBox(b) {
    return `min(${b.min.x.toFixed(2)},${b.min.y.toFixed(2)},${b.min.z.toFixed(2)}) max(${b.max.x.toFixed(2)},${b.max.y.toFixed(2)},${b.max.z.toFixed(2)})`
  }

  isInsideBox() {
    if (!this.box) return false
    const p = this.camera.position
    return p.x > this.box.min.x && p.x < this.box.max.x && p.y > this.box.min.y && p.y < this.box.max.y && p.z > this.box.min.z && p.z < this.box.max.z
  }

  showError(message) {
    this.modelFailed = true
    this.lastError = message
    this.ui.errorEl.textContent = message
    this.ui.errorEl.style.display = 'block'
    this.ui.loadWrap.style.display = 'none'
    console.error('[walkthrough]', message)
  }

  dispose() {
    this.cancelled = true
    if (this._raf) cancelAnimationFrame(this._raf)
    if (this._hintTimer) clearTimeout(this._hintTimer)
    if (this.lazyIO) this.lazyIO.disconnect()
    if (this.renderIO) this.renderIO.disconnect()
    if (this.ro) this.ro.disconnect()
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('scroll', this._onScroll)
    document.removeEventListener('visibilitychange', this._onVisibility)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('mousemove', this._onMouseMove)
    const c = this.ui.canvas
    c.removeEventListener('pointerdown', this._onPointerDown)
    c.removeEventListener('pointermove', this._onPointerMove)
    c.removeEventListener('pointerup', this._onPointerUp)
    c.removeEventListener('pointercancel', this._onPointerUp)
    c.removeEventListener('wheel', this._onWheel)
    if (this.controls) this.controls.dispose()
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry && obj.geometry.dispose()
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          for (const m of mats) {
            if (!m) continue
            if (m.map) m.map.dispose()
            m.dispose()
          }
        }
      })
      this.scene.clear()
    }
    if (this.renderer) this.renderer.dispose()
    if (window.__QA && window.__QA.state) delete window.__QA
  }

  effectsState(p) {
    const cutY = this.cutYFor(p)
    const uPlan = clamp((this.H - cutY) / Math.max(0.001, this.H - WALK_CONFIG.PLAN_WALL_HEIGHT), 0, 1)
    const rs = this.roofState(p)
    const nameOp = p < 0.05 ? smootherstep(p / 0.05) : p > 0.08 ? 1 - smootherstep((p - 0.08) / 0.08) : 1
    let labelsOp = 0
    if (p >= 0.31 && p <= 0.36) {
      const e = Math.min(1, (p - 0.31) / 0.02, (0.36 - p) / 0.02)
      labelsOp = smootherstep(e)
    }
    return {
      p: Number(p.toFixed(3)),
      cutY: Number(cutY.toFixed(4)),
      uPlan: Number(uPlan.toFixed(4)),
      roofLiftT: Number(rs.liftT.toFixed(4)),
      roofOpacity: Number(rs.opacity.toFixed(4)),
      nameOpacity: Number(nameOp.toFixed(4)),
      labelsOpacity: Number(labelsOp.toFixed(4)),
      insideValue: Number(this.inside.toFixed(4)),
      planAmt: Number(this.planAmt.toFixed(4)),
    }
  }

  measureProjection() {
    const corners = this.footprintCorners()
    let x0 = 1e9
    let x1 = -1e9
    let y0 = 1e9
    let y1 = -1e9
    let behind = false
    const poly = []
    for (const c of corners) {
      const v = c.clone().project(this.camera)
      if (v.z > 1) {
        behind = true
        continue
      }
      x0 = Math.min(x0, v.x)
      x1 = Math.max(x1, v.x)
      y0 = Math.min(y0, v.y)
      y1 = Math.max(y1, v.y)
      poly.push({ x: v.x, y: v.y })
    }
    return {
      widthPct: Number((((x1 - x0) / 2) * 100).toFixed(1)),
      heightPct: Number((((y1 - y0) / 2) * 100).toFixed(1)),
      centerY: Number((((y1 + y0) / 2) * 100).toFixed(1)),
      centerX: Number((((x1 + x0) / 2) * 100).toFixed(1)),
      leftPct: Number(((x0 + 1) / 2 * 100).toFixed(1)),
      rightPct: Number(((x1 + 1) / 2 * 100).toFixed(1)),
      topPct: Number(((1 - y1) / 2 * 100).toFixed(1)),
      bottomPct: Number(((1 - y0) / 2 * 100).toFixed(1)),
      poly: this.convexHull(poly),
      behind,
    }
  }

  convexHull(pts) {
    const p = pts.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y))
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
    const lower = []
    for (const pt of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop()
      lower.push(pt)
    }
    const upper = []
    for (let i = p.length - 1; i >= 0; i--) {
      const pt = p[i]
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop()
      upper.push(pt)
    }
    lower.pop()
    upper.pop()
    return lower.concat(upper)
  }

  pointInPoly(px, py, poly) {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x
      const yi = poly[i].y
      const xj = poly[j].x
      const yj = poly[j].y
      const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  labelReportAt(p) {
    this.p = p
    this.phase = phaseNameFor(p)
    this.updateMood()
    this.updateEffects()
    this.updateCamera(0.016)
    this.renderer.render(this.scene, this.camera)
    this.camera.updateMatrixWorld(true)
    this.labelLayout = null
    this.layoutLabels()
    const proj = this.measureProjection()
    const poly = proj.poly
    const w = this.renderer.domElement.width
    const h = this.renderer.domElement.height
    const rows = []
    for (let i = 0; i < this.labelEls.length; i++) {
      const label = this.labels[i]
      const anchor = this.labelAnchors[i]
      const v = anchor.clone().project(this.camera)
      const axPct = Number(((v.x + 1) / 2 * 100).toFixed(1))
      const ayPct = Number(((1 - v.y) / 2 * 100).toFixed(1))
      const anchorInside = this.pointInPoly(v.x, v.y, poly)
      const item = this.labelLayout.items[i]
      const el = this.labelEls[i]
      el.wrap.style.fontSize = `${item.fs}px`
      el.name.style.fontSize = `${item.fs}px`
      el.dims.style.fontSize = `${Math.round(item.fs * 0.85)}px`
      el.dims.style.display = item.showDims ? '' : 'none'
      el.wrap.style.visibility = 'visible'
      el.wrap.style.opacity = '1'
      el.wrap.style.transform = `translate3d(${item.x.toFixed(1)}px, ${(item.y + item.dy).toFixed(1)}px, 0) translate(-50%, -50%)`
      const labelW = Math.max(el.name.offsetWidth, item.showDims ? el.dims.offsetWidth : 0)
      const labelH = el.name.offsetHeight + (item.showDims ? el.dims.offsetHeight : 0)
      const cxPx = item.x
      const cyPx = item.y + item.dy
      const left = (cxPx - labelW / 2) / w
      const right = (cxPx + labelW / 2) / w
      const top = (cyPx - labelH / 2) / h
      const bottom = (cyPx + labelH / 2) / h
      let insideCount = 0
      const S = 5
      let total = 0
      for (let gx = 0; gx < S; gx++) {
        for (let gy = 0; gy < S; gy++) {
          const nx = (0.5 + gx) / S
          const ny = (0.5 + gy) / S
          const px = left + (right - left) * nx
          const py = top + (bottom - top) * ny
          const ndcX = px * 2 - 1
          const ndcY = 1 - py * 2
          total++
          if (this.pointInPoly(ndcX, ndcY, poly)) insideCount++
        }
      }
      const insidePct = (insideCount / total) * 100
      rows.push({
        type: label.type,
        meshIndex: label.meshIndex,
        text: label.text,
        sub: label.sub,
        anchorWorld: anchor.toArray().map((x) => Number(x.toFixed(3))),
        anchorScreenPct: { x: axPct, y: ayPct },
        anchorInsideFootprint: anchorInside,
        labelRectPx: {
          left: Number((left * w).toFixed(1)),
          right: Number((right * w).toFixed(1)),
          top: Number((top * h).toFixed(1)),
          bottom: Number((bottom * h).toFixed(1)),
        },
        dimsBelowName: item.showDims ? (bottom - top) * h > el.name.offsetHeight + 1 : true,
        labelInsidePct: Number(insidePct.toFixed(0)),
      })
    }
    let minSep = Infinity
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i].labelRectPx
        const b = rows[j].labelRectPx
        const dx = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right))
        const dy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom))
        minSep = Math.min(minSep, Math.hypot(dx, dy))
      }
    }
    return {
      p,
      footprint: {
        leftPct: proj.leftPct,
        rightPct: proj.rightPct,
        topPct: proj.topPct,
        bottomPct: proj.bottomPct,
      },
      rows,
      minLabelSeparationPx: minSep === Infinity ? null : Number(minSep.toFixed(1)),
      fits: rows.every((r) => r.anchorInsideFootprint && r.labelInsidePct >= 80) && (minSep === Infinity || minSep >= 12),
    }
  }

  fixCTable() {
    const PTS = [0.44, 0.48, 0.52, 0.56, 0.6, 0.64, 0.66, 0.7, 0.8, 0.9, 0.93, 0.96]
    const rows = []
    let prevLat = null
    let prevP = null
    let maxStep = 0
    for (const p of PTS) {
      this.p = p
      this.phase = phaseNameFor(p)
      this.updateMood()
      this.updateEffects()
      this.updateCamera(0.016)
      this.camera.updateMatrixWorld(true)
      const cam = this.camera
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
      const lat = cam.position.dot(this.sideV)
      if (prevLat !== null && p > 0.6) {
        const step = Math.abs(lat - prevLat) / ((p - prevP) * 100)
        maxStep = Math.max(maxStep, step)
      }
      prevLat = lat
      prevP = p
      const yaw = Math.atan2(fwd.dot(this.sideV), fwd.dot(this.outV.clone().negate())) / DEG
      const pitch = Math.asin(clamp(fwd.y, -1, 1)) / DEG
      const w = this.renderer.domElement.width
      const proj2 = (point) => {
        const v = point.clone().project(cam)
        return Number(((v.x + 1) / 2 * 100).toFixed(1))
      }
      const facadeX = proj2(new THREE.Vector3(this.sFacade, 1.4, this.hz))
      const doorX = proj2(new THREE.Vector3(this.sDoor, 1.4, this.hz))
      rows.push({
        p,
        s: Number(lat.toFixed(3)),
        yawDeg: Number(yaw.toFixed(2)),
        pitchDeg: Number(pitch.toFixed(2)),
        facadeScreenXPct: facadeX,
        doorScreenXPct: doorX,
      })
    }
    return { rows, maxLateralStepPer001P: Number(maxStep.toFixed(3)) }
  }

  exposeQA() {
    const ctl = this
    const api = {
      step: (p) => {
        ctl.pRaw = p
        ctl.p = p
        ctl.phase = phaseNameFor(p)
        ctl.inside = 0
        ctl.planAmt = 0
        ctl.updateMood()
        ctl.updateEffects()
        ctl.updateCamera(0.016)
        const pose = ctl.computePose(p)
        ctl.camera.fov = pose.fov
        ctl.fovTarget = pose.fov
        ctl.camera.updateProjectionMatrix()
        ctl.renderer.render(ctl.scene, ctl.camera)
        ctl.renderCount++
        ctl.lastCamKey = ctl.camKey()
        ctl.syncOverlays()
        ctl.syncDebug()
      },
      stepMeasure: (p) => {
        api.step(p)
        return api.measure()
      },
      measure: () => ctl.measure(),
      measureProjection: () => ctl.measureProjection(),
      state: () => ({
        modelReady: ctl.modelReady,
        modelFailed: ctl.modelFailed,
        error: ctl.lastError,
        entrance: ctl.entrance,
        side: { x: ctl.sideV.x, y: ctl.sideV.y, z: ctl.sideV.z },
        originalBox: ctl.originalBox ? { min: ctl.originalBox.min.toArray(), max: ctl.originalBox.max.toArray() } : null,
        centeredBox: ctl.box ? { min: ctl.box.min.toArray(), max: ctl.box.max.toArray() } : null,
        loadedBytes: ctl.loadedBytes,
        totalBytes: ctl.totalBytes,
        doorX: ctl.doorX,
        doorCandidates: ctl.doorCandidates.map((c) => c.fraction),
        renderCalls: ctl.renderer ? ctl.renderer.info.render.calls : null,
        triangles: ctl.renderer ? ctl.renderer.info.render.triangles : null,
        fx: ctl.fx,
        disabledFx: [...ctl.disabledFx],
      }),
      setEntrance: (entrance) => {
        ctl.entrance = entrance
        ctl.computeDirections()
        if (ctl.box) ctl.buildPathConstants()
      },
      setSideIndex: (i) => {
        ctl.sideIndex = i
        ctl.computeDirections()
        if (ctl.box) ctl.buildPathConstants()
      },
      setDoorIndex: (i) => {
        ctl.doorIndex = i % Math.max(1, ctl.doorCandidates.length)
        ctl.applyDoorCandidate()
      },
      peekP: () => ctl.p,
      doorInfo: () => ({
        candidates: ctl.doorCandidates.map((c) => ({ fraction: c.fraction, width: c.width })),
        index: ctl.doorIndex,
        doorX: ctl.doorX,
        doorOff: ctl.doorOff,
      }),
      reportInfo: () => ({
        calls: ctl.renderer.info.render.calls,
        triangles: ctl.renderer.info.render.triangles,
        pixelRatio: ctl.renderer.getPixelRatio(),
        canvas: [ctl.renderer.domElement.width, ctl.renderer.domElement.height],
        programs: (ctl.renderer.info.programs || []).length,
      }),
      perfHarvest: () => {
        const s = ctl.perfSamples
        const sorted = [...s].sort((a, b) => a - b)
        const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0
        const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0
        return { n: s.length, avgMs: avg, p95Ms: p95, renderCount: ctl.renderCount }
      },
      jsFrameMs: () => {
        const n = 60
        const t0 = performance.now()
        for (let i = 0; i < n; i++) {
          const p = i / n
          ctl.p = p
          ctl.phase = phaseNameFor(p)
          ctl.updateMood()
          ctl.updateEffects()
          ctl.updateCamera(0.016)
        }
        return Number(((performance.now() - t0) / n).toFixed(3))
      },
      meshStats: () => {
        let tris = 0
        for (const m of ctl.meshes) {
          const g = m.geometry
          tris += (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3
        }
        return {
          meshes: ctl.meshes.length,
          triangles: Math.round(tris),
          glass: ctl.glassMeshes.length,
          props: ctl.props.length,
          structureTris: ctl.structure ? Math.round(ctl.structure.geometry.index.count / 3) : null,
          roofTris: ctl.roofReport ? ctl.roofReport.roofTris : null,
        }
      },
      roofInfo: () => {
        if (!ctl.roofReport) return null
        const report = { ...ctl.roofReport }
        const structureMat = ctl.structureMesh ? ctl.structureMesh.material : null
        report.structureMaterials = structureMat ? [structureMat.name || '(unnamed)'] : []
        report.tinted = []
        if (structureMat) {
          const excluded = WALK_CONFIG.WALL_TINT_EXCLUDE_MATERIALS.includes(structureMat.name)
          report.tinted.push({ name: structureMat.name || '(unnamed)', tinted: !excluded })
        }
        report.squashHook = ctl.squashHookStats || null
        return report
      },
      planFitInfo: () => ctl.planFitReport || null,
      facadeInfo: () => ({
        sFacade: Number(ctl.sFacade.toFixed(3)),
        sOpen: Number(ctl.sDoor.toFixed(3)),
        entryIndex: ctl.entryIndex,
        openings: ctl.openings,
        annex: ctl.annex,
        basisTest: ctl.basisTest,
      }),
      labelsInfo: () => ({
        labels: ctl.labels,
        report: ctl.labelReport,
      }),
      labelReport: () => ctl.labelReportAt(0.34),
      probe: (p) => ctl.probeOpeningPixels(p),
      planRects: () => {
        const out = []
        for (const p of [0.3, 0.34, 0.38]) {
          api.step(p)
          out.push({ p, proj: ctl.measureProjection() })
        }
        return out
      },
      fixCTable: () => ctl.fixCTable(),
      markerAtPlan: () => {
        api.step(0.34)
        const w = ctl.renderer.domElement.width
        const h = ctl.renderer.domElement.height
        const v = ctl.markerAnchor.clone().project(ctl.camera)
        return {
          anchor: ctl.markerAnchor.toArray().map((x) => Number(x.toFixed(3))),
          screenPct: {
            x: Number(((v.x + 1) / 2 * 100).toFixed(1)),
            y: Number(((1 - v.y) / 2 * 100).toFixed(1)),
          },
          doorX: ctl.doorX,
          sDoor: Number(ctl.sDoor.toFixed(3)),
        }
      },
      poseSeries: () => {
        const rows = []
        for (let i = 0; i <= 1000; i++) {
          const p = i / 1000
          const pose = ctl.computePose(p)
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quat)
          const pitch = Math.asin(clamp(fwd.y, -1, 1)) / DEG
          rows.push({
            p: Number(p.toFixed(3)),
            x: Number(pose.pos.x.toFixed(4)),
            y: Number(pose.pos.y.toFixed(4)),
            z: Number(pose.pos.z.toFixed(4)),
            fov: Number(pose.fov.toFixed(2)),
            pitchDeg: Number(pitch.toFixed(3)),
          })
        }
        return rows
      },
      effectsSeries: () => {
        const rows = []
        for (let i = 0; i <= 200; i++) {
          rows.push(ctl.effectsState(i / 200))
        }
        return rows
      },
      reversalCheck: () => {
        const cap = (p) => {
          api.step(p)
          const m = ctl.measure()
          return {
            cam: [m.camera.x, m.camera.y, m.camera.z],
            fov: m.fov,
            effects: ctl.effectsState(p),
          }
        }
        const fwd = cap(0.35)
        api.step(1)
        const back = cap(0.35)
        const same =
          fwd.cam.every((v, i) => Math.abs(v - back.cam[i]) < 1e-4) &&
          Math.abs(fwd.fov - back.fov) < 1e-4 &&
          Math.abs(fwd.effects.cutY - back.effects.cutY) < 1e-4 &&
          Math.abs(fwd.effects.roofOpacity - back.effects.roofOpacity) < 1e-4
        let maxCamDiff = 0
        fwd.cam.forEach((v, i) => (maxCamDiff = Math.max(maxCamDiff, Math.abs(v - back.cam[i]))))
        return { same, maxCamDiff, fwd, back }
      },
      continuity: () => ctl.continuity(),
      propOffsets: () => {
        let maxAbs = 0
        for (const prop of ctl.props) {
          const base = ctl.propBase.get(prop)
          maxAbs = Math.max(maxAbs, Math.abs(prop.position.y - base.y))
        }
        return maxAbs
      },
      depthRows: () => {
        const rows = []
        for (let i = 0; i <= 12; i++) {
          const p = 0.66 + i * 0.02
          api.step(p)
          const z = ctl.camera.position.z
          const depth = ((ctl.hz - z) / (2 * ctl.hz)) * 100
          rows.push({ p: Number(p.toFixed(2)), depthPct: Number(depth.toFixed(2)), z: Number(z.toFixed(3)) })
        }
        return { rows, maxDepth: 30 }
      },
      walkDepthRows: () => api.depthRows(),
      verifyTable: () => {
        const PTS = [0, 0.04, 0.08, 0.12, 0.18, 0.24, 0.28, 0.34, 0.38, 0.44, 0.5, 0.54, 0.58, 0.66, 0.78, 0.9, 0.96, 1]
        const rows = []
        for (const p of PTS) {
          api.step(p)
          const m = ctl.measure()
          const eff = ctl.effectsState(p)
          const proj = ctl.measureProjection()
          rows.push({
            p: Number(p.toFixed(2)),
            camera: { x: Number(m.camera.x.toFixed(3)), y: Number(m.camera.y.toFixed(3)), z: Number(m.camera.z.toFixed(3)) },
            pitchDeg: Number(ctl.pitchDeg().toFixed(2)),
            fov: Number(m.fov.toFixed(1)),
            roofLiftT: eff.roofLiftT,
            roofOpacity: eff.roofOpacity,
            cutY: eff.cutY,
            uPlan: eff.uPlan,
            nameOpacity: eff.nameOpacity,
            labelsOpacity: eff.labelsOpacity,
            footprintWidthPct: proj.widthPct,
            footprintHeightPct: proj.heightPct,
            inside: m.inside,
          })
        }
        return rows
      },
      passChecks: () => {
        const out = {}
        const v = (p) => {
          api.step(p)
          const m = ctl.measure()
          const eff = ctl.effectsState(p)
          const proj = ctl.measureProjection()
          return { m, eff, proj, pitch: ctl.pitchDeg() }
        }
        const a = v(0.34)
        const b = v(0.36)
        const pitchOk = (x) => x.pitch >= -72 && x.pitch <= -60
        out.planPitch = { p034: a.pitch, p036: b.pitch, pass: pitchOk(a) && pitchOk(b) }
        out.roofHidden = { opacity034: a.eff.roofOpacity, opacity036: b.eff.roofOpacity, pass: a.eff.roofOpacity < 0.01 && b.eff.roofOpacity < 0.01 }
        out.cutYPlan = { cutY034: a.eff.cutY, cutY036: b.eff.cutY, pass: Math.abs(a.eff.cutY - 0.55) <= 0.02 && Math.abs(b.eff.cutY - 0.55) <= 0.02 }
        out.footprint = {
          h034: a.proj.heightPct,
          h036: b.proj.heightPct,
          w034: a.proj.widthPct,
          w036: b.proj.widthPct,
          passDesktop: a.proj.heightPct >= 88 && b.proj.heightPct >= 88,
          passMobile: ctl.isTouch && a.proj.widthPct >= 88 && b.proj.widthPct >= 88,
        }
        api.step(0.52)
        const e52 = ctl.effectsState(0.52)
        out.wallsRestored = {
          cutY: e52.cutY,
          uPlan: e52.uPlan,
          pitch: ctl.pitchDeg(),
          glassVisible: ctl.glassMeshes.every((g) => g.mesh.visible),
          pass: e52.cutY >= ctl.H - 0.01 && e52.uPlan === 0 && Math.abs(ctl.pitchDeg()) <= 3 && ctl.glassMeshes.every((g) => g.mesh.visible),
        }
        api.step(0.57)
        const roofDiff = ctl.roofGroup ? ctl.roofGroup.position.distanceTo(ctl.roofBaseTransform.position) + ctl.roofGroup.quaternion.angleTo(ctl.roofBaseTransform.quaternion) : 0
        out.roofReturned = { diff: Number(roofDiff.toFixed(5)), pass: roofDiff < 0.001 }
        const dep = api.depthRows()
        out.walkDepth = {
          rows: dep.rows,
          maxDepth: Math.max(...dep.rows.map((r) => r.depthPct)),
          pass: dep.rows.every((r, i) => (i === 0 || r.depthPct >= dep.rows[i - 1].depthPct - 0.05) && r.depthPct <= 30.5),
        }
        api.step(0.96)
        out.outsideAt096 = { inside: ctl.isInsideBox(), pass: !ctl.isInsideBox() }
        api.step(0.66)
        out.insideAt066 = { inside: ctl.isInsideBox(), pass: ctl.isInsideBox() }
        return out
      },
      layeringTest: () => {
        const type = document.querySelector('.wt-type')
        const canvas = document.querySelector('.wt-canvas')
        const typeZ = type ? getComputedStyle(type).zIndex : null
        const canvasZ = canvas ? getComputedStyle(canvas).zIndex : null
        let alpha = null
        if (ctl.renderer) {
          const attrs = ctl.renderer.getContext().getContextAttributes()
          alpha = attrs ? attrs.alpha : null
        }
        return { typeZIndex: typeZ, canvasZIndex: canvasZ, canvasAlpha: alpha }
      },
      vertexDisplacementMax: () => {
        if (!ctl.structureMesh) return 0
        const g = ctl.structureMesh.geometry
        const posAttr = g.attributes.position
        let maxDisp = 0
        const cutY = ctl.cutUniformObj.value
        for (let i = 0; i < posAttr.count; i++) {
          const y = posAttr.getY(i)
          if (y > cutY) maxDisp = Math.max(maxDisp, y - cutY)
        }
        return Number(maxDisp.toFixed(4))
      },
    }
    window.__QA = api
  }

  measure() {
    const gl = this.renderer.getContext()
    const w = this.renderer.domElement.width
    const h = this.renderer.domElement.height
    const buf = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    let over = 0
    let total = 0
    const stride = 12
    for (let y = 0; y < h; y += stride) {
      for (let x = 0; x < w; x += stride) {
        const i = (y * w + x) * 4
        total++
        if (buf[i] > 245 || buf[i + 1] > 245 || buf[i + 2] > 245) over++
      }
    }
    return {
      p: this.p,
      phase: this.phase,
      camera: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      distToCentre: this.camera.position.length(),
      inside: this.isInsideBox(),
      over245Percent: (over / total) * 100,
      pixelSize: [w, h],
      fov: this.camera.fov,
      lensShift: this.lensShift,
      renderCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    }
  }

  continuity() {
    let maxInsideStep = 0
    let prev = null
    for (let i = 0; i <= 500; i++) {
      const p = i / 500
      this.p = p
      this.updateCamera(0.016)
      const pos = this.camera.position.clone()
      const insideHere =
        this.box &&
        pos.x > this.box.min.x && pos.x < this.box.max.x && pos.y > this.box.min.y && pos.y < this.box.max.y && pos.z > this.box.min.z && pos.z < this.box.max.z
      if (prev && insideHere) {
        const d = pos.distanceTo(prev)
        maxInsideStep = Math.max(maxInsideStep, d)
      }
      prev = pos
    }
    return { maxInsideStep }
  }
}
