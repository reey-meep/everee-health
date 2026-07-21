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
  '.......KBBS...............',
  '......KBBBS...............',
  '......KBBSS...............',
  '......KBBSK...............',
  '......KBSSK...............',
  '.....KBBSSK...............',
  '.....KBBSPK...............',
  '.....KBSSPP...............',
  '.....KBSSPK...............',
  '......KKKKB...............',
]

const EAR_R = [
  '................KKK.......',
  '...........K...KBBBK......',
  '...........K..KBBPBK......',
  '...........K.KBBPPBK......',
  '.............KBBPBBK......',
  '............KBBPPBK.......',
  '............KBBPBBK.......',
  '............KBPPBK........',
  '...........KBBPBBK........',
  '...........BBPBBK.........',
  '...........BPBBK..........',
]

// Eyes are 2x2 blocks at rows 17-18, cols 2-3 and 8-9 in the source art.
const EYE_CELLS = [[2, 17], [3, 17], [8, 17], [9, 17]]
const EYE_ROW_TOP = 17

// Tail occupies the right edge; shifted down for the droopy pose.
const TAIL_MIN_COL = 21

// Ear offsets per pose: [dxLeft, dxRight, dy]. Down = lower and splayed wider.
const EAR_OFFSET = {
  up:   [0, 0, 0],
  mid:  [-1, 1, 3],
  down: [-2, 2, 6],
}

// 0 desaturated grey -> 5 warm. Keys match the sprite glyphs; the source
// palette is level 3, so her artwork is what shows at "on track".
const PALETTES = [
  { K: '#2E2C2E', B: '#BDBABC', S: '#A09B9D', P: '#948486', N: '#948486' },
  { K: '#2D2A2C', B: '#CCC6C6', S: '#AEA7A7', P: '#A38F91', N: '#A38F91' },
  { K: '#2B2729', B: '#DCD2D0', S: '#B9ACAB', P: '#AD9698', N: '#AD9698' },
  { K: '#000000', B: '#E9DDDB', S: '#C3B4B3', P: '#B7A0A1', N: '#B7A0A1' },
  { K: '#241F21', B: '#F0E2DA', S: '#CFBBAF', P: '#C79BA6', N: '#C79BA6' },
  { K: '#241F21', B: '#F8E9D6', S: '#DCC4A6', P: '#D497AE', N: '#D497AE' },
]

export { W, H, BASE_NO_EARS, EAR_L, EAR_R, EYE_CELLS, EYE_ROW_TOP, TAIL_MIN_COL, EAR_OFFSET, PALETTES }
