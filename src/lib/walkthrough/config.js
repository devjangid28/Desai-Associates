export const WALK_CONFIG = {
  ENTRANCE: '+z',
  MODEL_URL: '/assets/shop-small.glb',
  HIDE_MESHES: [],
  REPLACE_OR_HIDE: [],

  SHOP_NAME: 'Bluechip Computer System',
  TAGLINE: 'Computers. Service. Systems.',
  SCROLL_HEIGHT_VH: 1300,
  PIN_HEIGHT_VH: 1300,

  DOOR_X: null,
  ENTRY_OPENING: 0,

  CLAMP_INSET: 0.7,
  EYE_ENTER_Y: 1.55,
  GLASS_FADE_DIST: 2.0,
  GLASS_FADE_OPACITY: 0.15,
  P_SMOOTH_TAU: 0.12,
  P_DIRTY_EPS: 0.0002,

  ROOF_LIFT: 3.2,
  ROOF_RETURNS: true,
  ROOF_TILT_MAX_DEG: 5,
  ROOF_DRIFT: 1.0,

  PLAN_WALL_HEIGHT: 0.55,
  PLAN_PITCH_DEG: 66,
  PLAN_FOV_DEG: 32,
  PLAN_FIT_FRAC: 0.9,
  PLAN_VERTICAL_PCT: 47,
  PLAN_MARGIN_FRAC: 0.04,
  PLAN_PAN_M: 0.5,
  PLAN_LENS_SHIFT: 0,

  WALK_START_INSIDE: 1.2,
  WALK_MAX_DEPTH: 0.3,
  WALK_EASE_FRAC: 0.08,
  WALK_HEAD_TURN_DEG: 40,
  WALK_CAPTION_DEG: 15,

  REVERSE_END_DIST: 1.5,
  REVERSE_END_H_FRAC_D: 0.25,
  RELEASE_PUSH_FRAC: 0.05,

  NAME_CAM_OFF_DEG: 28,
  NAME_CAM_DIST_D: 2.58,
  NAME_CAM_DIST_D_MOBILE: 6.2,
  NAME_CAM_HEIGHT_D: 0.3,
  NAME_FOV_DEG: 34,
  NAME_LENS_SHIFT: -0.14,
  NAME_LENS_SHIFT_MOBILE: -0.08,

  LEVEL_CAM_DIST_D: 1.4,
  LEVEL_FOV_DEG: 34,
  APPROACH_END_FOV_DEG: 56,

  WALL_TINT_EXCLUDE_MATERIALS: [],
  WALL_TINT_COLOR: [0.15, 0.15, 0.17],
  WALL_TINT_STRENGTH: 0.92,
  WALL_TINT_MIN_Y: 2.0,
  WALL_TINT_TOP_BAND: 2.66,

  LABELS: [
    { id: 'display', text: 'DISPLAY UNIT', sub: 'auto', type: 'object', meshIndex: -1, offset: [0, 0, 0] },
    { id: 'billing', text: 'BILLING COUNTER', sub: 'auto', type: 'object', meshIndex: -1, offset: [0, 0, 0] },
    { id: 'components', text: 'COMPONENTS WALL', sub: 'auto', type: 'object', meshIndex: -1, offset: [0, 0, 0] },
    { id: 'service', text: 'SERVICE DESK', sub: 'auto', type: 'object', meshIndex: -1, offset: [0, 0, 0] },
    { id: 'seating', text: 'SEATING AREA', sub: 'auto', type: 'object', meshIndex: -1, offset: [0, 0, 0] },
  ],
  ZONES: [],
  ZONES_KMEANS_ITERATIONS: 12,
  ZONES_EDGE_MIN: 0.6,
  ZONES_CLAMP_MIN: 1.5,
  ZONES_CLAMP_MAX: 5,
  LABEL_SEP_PX: 12,
  OPENING_NEAR_FACADE: 0.6,
  OPENING_MIN_TOP: 1.8,

  PROPS_RISE: false,

  FX: {
    levels: { 0: 'none', 1: 'basic', 2: 'full' },
    autoDowngradeOrder: ['dust', 'shafts', 'glow'],
  },

  LIGHTS: {
    glassGlowOpacity: 0.18,
    shaftOpacity: 0.08,
    dustCount: 250,
    dustOpacity: 0.25,
  },

  CAPTIONS: [
    { text: 'Bluechip Computer System', from: 0.02, to: 0.07 },
    { text: 'The plan', from: 0.3, to: 0.36 },
    { text: 'Step inside', from: 0.6, to: 0.65 },
    { text: 'Until next time', from: 0.96, to: 1.0 },
  ],

  POINTS_OF_INTEREST: [
    { x: 0.09, y: 0.55, z: 0.32, caption: 'Laptops and displays' },
    { x: 0.47, y: 0.5, z: 0.38, caption: 'Components and graphics cards' },
    { x: 0.82, y: 0.55, z: 0.42, caption: 'Service and consultation' },
  ],

  HINT_AT_P: 0.66,
  HINT_KEEP_MS: 4000,

  DRAG: {
    outsideYaw: 15,
    insideYaw: 40,
    insidePitch: 20,
    releaseTau: 0.45,
  },

  MOOD: {
    hemiSkyExt: 0xeef3ff,
    hemiSkyInt: 0xffe9cf,
    hemiGround: 0x3a2f26,
    hemiIntensity: 1.3,
    dirColor: 0xfff1dc,
    dirIntensityExt: 1.6,
    dirIntensityIntFactor: 0.6,
    exposureExt: 0.68,
    exposureInt: 0.8,
    planHemiFactor: 1.4,
    planDirFactor: 0.6,
    planExposure: 0.95,
    insideFadeIn0: 0.38,
    insideFadeIn1: 0.52,
    insideTarget: 0.6,
    insideFadeOut0: 0.94,
    insideFadeOut1: 1.0,
    planIn0: 0.18,
    planIn1: 0.26,
    planOut0: 0.44,
    planOut1: 0.5,
    decalOpacity: 0.16,
    spillOpacity: 0.18,
  },
}

export const PHASES = WALK_CONFIG.CHAPTERS
  ? WALK_CONFIG.CHAPTERS.map((c) => ({ name: c.id, from: c.from, to: c.to }))
  : [
      { name: 'name', from: 0.0, to: 0.08 },
      { name: 'roof', from: 0.08, to: 0.3 },
      { name: 'walls', from: 0.18, to: 0.34 },
      { name: 'plan', from: 0.3, to: 0.38 },
      { name: 'lift', from: 0.38, to: 0.52 },
      { name: 'approach', from: 0.57, to: 0.66 },
      { name: 'walk', from: 0.66, to: 0.9 },
      { name: 'reverse', from: 0.9, to: 0.96 },
      { name: 'release', from: 0.96, to: 1.0 },
    ]

export const OUT_VECTORS = {
  '+z': { x: 0, y: 0, z: 1 },
  '-z': { x: 0, y: 0, z: -1 },
  '+x': { x: 1, y: 0, z: 0 },
  '-x': { x: -1, y: 0, z: 0 },
}

export const SIDE_VECTORS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
]

export const BUILD_STAMP = typeof __BUILD_STAMP__ !== 'undefined' ? __BUILD_STAMP__ : 'dev'

export const BG_COLOR = 0x090c10
export const ACCENT = '#c9a86a'
export const TEXT_COLOR = '#f3efe8'

export const phaseNameFor = (p) => {
  const ph = PHASES.find((x) => p >= x.from && p <= x.to)
  return ph ? ph.name : PHASES[0].name
}
