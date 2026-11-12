// Central content file for the horizontal scroll section.
// Only English is used site-wide; swap these image URLs / texts for your own.

export const IMG = 'https://normalisboring.es/wp-content/uploads'

export const TERMS = [
  {
    num: '01',
    title: 'ELEGANCE',
    titleFont: 'f-edit',
    text: 'A sober and silent architecture and an aesthetic sensibility expressed in materials such as oak or limestone, accompanied by an earth-toned colour palette.',
    img: `${IMG}/2025/08/HOME_7_Elegancia.jpg`,
  },
  {
    num: '02',
    title: 'AUTHENTICITY',
    titleFont: 'f-regular',
    text: 'A combination of elegant, sustainable and serene architecture, creating refined, efficient and harmonious spaces that integrate with their surroundings and promote quiet luxury.',
    img: `${IMG}/2025/08/HOME_7_Autenticidad.jpg`,
  },
  {
    num: '03',
    title: 'FUNCTIONALITY',
    titleFont: 'f-izmir',
    text: 'Open, less hierarchical spaces with a more pragmatic approach. Multifunctional and flexible zones so they can serve more than one purpose.',
    img: `${IMG}/2025/08/HOME_7_Funcionalidad.jpg`,
  },
]

export const PROJECTS = [
  {
    num: '01',
    year: '2024',
    place: 'OLEIROS',
    title: 'La Solana',
    titleFont: 'f-regular',
    bg: 'bg-beige c-black',
    bgBtn: 'btn--bg-beige c-black',
    href: 'https://normalisboring.es/lasolana',
    btn: 'View project',
    ratio: '1500 / 750',
    img: `${IMG}/2026/04/HOME_8_PZE-1.jpg`,
  },
  {
    num: '02',
    year: '2024',
    place: 'OLEIROS',
    title: 'Plaza España',
    titleFont: 'f-izmir',
    bg: 'bg-grey',
    bgBtn: 'btn--bg-grey',
    href: 'https://normalisboring.es/plaza-espana',
    btn: 'View project',
    ratio: '2000 / 1000',
    img: `${IMG}/2025/08/HOME_8_PZE.jpg`,
  },
  {
    num: '03',
    year: '2023',
    place: 'OLEIROS',
    title: 'Rua Pexegueiro',
    titleFont: 'f-edit',
    bg: 'bg-blue',
    bgBtn: 'btn--bg-blue',
    href: 'https://normalisboring.es/rua-pexegueiro',
    btn: 'View project',
    ratio: '2000 / 1333',
    img: `${IMG}/2025/08/HOME_8_PXG.jpg`,
  },
  {
    num: '04',
    year: '2024',
    place: 'ICARIA IV',
    title: 'Juno',
    titleFont: 'f-regular',
    bg: 'bg-beige c-black',
    bgBtn: 'btn--bg-beige c-black',
    href: '',
    btn: 'Coming soon',
    disabled: true,
    ratio: '1956 / 1125',
    img: `${IMG}/2026/04/HOME_8_JUN-1.jpg`,
  },
]

export const LAST_PROJECT = {
  num: '05',
  year: '2024',
  place: 'MONTROVE',
  title: 'POL43',
  titleFont: 'f-izmir',
  bg: 'bg-grey',
  bgBtn: 'btn--bg-grey',
  href: '',
  btn: 'Coming soon',
  disabled: true,
  ratio: '2000 / 1414',
  img: `${IMG}/2026/04/HOME_8_POL-1.jpg`,
  carousel: [
    { ratio: '2000 / 1414', img: `${IMG}/2026/04/HOME_8_POghjL.jpg` },
    { ratio: '2000 / 1414', img: `${IMG}/2026/04/HOME_8_POLdfg.jpg` },
  ],
  titleLines: [
    { text: 'Who said', align: 't-left' },
    { text: 'that pleasure', align: 't-left' },
    { text: 'cannot be', align: 't-right' },
    { text: 'functional', align: 't-right' },
  ],
  text: 'We create spaces that do not bow to trends, but instead choose the path of craftsmanship, local workshops, sustainability and serving the enjoyment of their occupants. Spaces of calm, but also spaces to be shared.',
}

export const CIERRE = {
  down: `${IMG}/2026/04/Foto-08-scaled-1.jpg`,
  up: `${IMG}/2026/04/HOME_8_cierre2-1.jpg`,
}
