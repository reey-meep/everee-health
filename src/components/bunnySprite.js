// Pixel bunny transcribed directly from Ree's reference PNG
// (image-1784594905946.png, 26x38 cells at 14.58px, 5-colour palette).
//
// Extracted by sampling the modal colour of each grid cell and snapping to the
// source palette -- this is her artwork, not a redraw of it.
//
// Mood poses move HER ear pixels rather than substituting invented ones:
// the ear layer is lifted out, shifted down/outward, and the head is composited
// back on top so the ears sit behind it.
//
// Glyphs: . transparent   K outline   B body   S shade   P inner-ear pink

const W = 26
const H = 38

const BASE_NO_EARS = [
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '....KKBBBBBPBBK...........',
  '...KBBBBBBBBBK............',
  '..KBBBBBBBBBBBK...........',
  '.KBBBBBBBBBBBBSK..........',
  '.KBBBBBBBBBBBBSK..........',
  '.KBBBBBBBBBBBBSK..........',
  'KBKKBBBBKKBBBSSK..........',
  'KBKKBBBBKKBBBSSK..........',
  'KBBBBBBBBBBBBSSK..........',
  '.KBBPPBBBBBBSSSK..........',
  '.KSBBBBBBBBSSSK...........',
  '..KSSSSSSSSPSSK...........',
  '...KKKPPPPPSSSPKK......K..',
  '..KBSSSSSSSSSSSPPKK...KSK.',
  '..KSSSSSSSSSSSSSSSPK.KBSK.',
  '.KBSSBBBBBBBBSSSSSSPKBBSPK',
  '.KSSBBBBBBBBBBSSSSSPKBSSPK',
  '.KSBBBBBBBBBBSSBBSSSPKSSPK',
  '.KSBBBBBBBBBSSBBBBBBSKSPK.',
  '..KBBBSKBBBBSBBBBBBBSKPK..',
  '..KBBBSKBBBSSKBBBBBSSPK...',
  '..KBBBSKBBBSKKBBBBBSSPK...',
  '..KBBBSKBBSSKBBBBBSSSPK...',
  '...KBBSKBBSKBBBBSSSSSPK...',
  '...KSBSKBBSKBBBSSSSSPK....',
  '....KSPKSSPKSSSSSSSPK.....',
  '.....KK.KKK.KKKKKKKK......',
]

const EAR_L = [
  '........KKK...............',
  '.......KBBSK..............',
  '......KBBBSK..............',
  '......KBBSSK..............',
  '......KBBSK...............',
  '......KBSSK...............',
  '.....KBBSSK...............',
  '.....KBBSPK...............',
  '.....KBSSPP...............',
  '.....KBSSPK...............',
  '......KKKK................',
]

const EAR_R = [
  '................KKK.......',
  '...............KBBBK......',
  '..............KBBPBK......',
  '.............KBBPPBK......',
  '.............KBBPBBK......',
  '............KBBPPBK.......',
  '............KBBPBBK.......',
  '............KBPPBK........',
  '...........KBBPBBK........',
  '...........BBPBBK.........',
  '..........BBPBBK..........',
]

// Eyes are 2x2 blocks at rows 17-18, cols 2-3 and 8-9 in the source art.
const EYE_CELLS = [[2, 17], [3, 17], [8, 17], [9, 17]]
const EYE_ROW_TOP = 17

// Tail occupies the right edge; shifted down for the droopy pose.
const TAIL_MIN_COL = 21

// Ear offsets per state: [dxLeft, dxRight, dy]. Critical droops lowest and
// splays widest; flourishing sits at the source art's own position.
const EAR_OFFSET = [
  [-2, 2, 7],   // critical
  [-1, 1, 4],   // poor
  [0, 0, 1],    // healthy
  [0, 0, 0],    // flourishing
]

// One palette per state. Level 2 (healthy) is the source art's own palette,
// so her artwork is what shows when she's on track.
const PALETTES = [
  { K: '#2E2C2E', B: '#BDBABC', S: '#A09B9D', P: '#948486', N: '#948486' }, // critical
  { K: '#2C2829', B: '#D2C8C6', S: '#B2A6A4', P: '#A68F92', N: '#A68F92' }, // poor
  { K: '#000000', B: '#E9DDDB', S: '#C3B4B3', P: '#B7A0A1', N: '#B7A0A1' }, // healthy (source art)
  { K: '#241F21', B: '#F8E9D6', S: '#DCC4A6', P: '#D497AE', N: '#D497AE' }, // flourishing
]

export { W, H, BASE_NO_EARS, EAR_L, EAR_R, EYE_CELLS, EYE_ROW_TOP, TAIL_MIN_COL, EAR_OFFSET, PALETTES }
