// Pixel-art bunny, rendered as SVG rects on a 24x34 grid.
//
// No idle animation by design. The only motion is a slow colour transition, so
// she visibly "warms up" as the day goes well rather than twitching constantly.
// Pose changes in three steps: droopy -> neutral -> perky.
//
// Glyphs:  . transparent   K outline   B body   S shade   P inner ear
//          N nose          E eye       W eye shine

const W = 24
const H = 34

// Head + body + haunch. Ears, eyes and tail are overlaid as separate sprites so
// each can change with mood independently.
const BODY = [
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........KKKKKK..........',
  '......KKBBBBBBKK........',
  '.....KBBBBBBBBBBK.......',
  '....KBBBBBBBBBBBBK......',
  '....KBBBBBBBBBBBBK......',
  '...KBBBBBBBBBBBBBBK.....',
  '...KBBBBBBBBBBBBBBK.....',
  '...KBBBBBBNNBBBBBBK.....',
  '....KBBBBBBBBBBBBK......',
  '.....KBBBBBBBBBBK.......',
  '......KKBBBBBBKK........',
  '.......KBBBBBBK.........',
  '......KBBBBBBBBK........',
  '.....KBBBBBBBBBBK.......',
  '....KBBBBBBBBBBBBK......',
  '...KBBBBBBBBBBBBBBK.....',
  '..KBBBBBBBBBBBBBBBBK....',
  '..KBBBBBBBBBBBBBBBBK....',
  '..KBBBKBBBBBBKBBBBBK....',
  '..KBBBKBBBBBBKBBBBBK....',
  '..KKBBBBBBBBBBBBBBKK....',
  '...KKKKKKKKKKKKKKKK.....',
]

// One ear, drawn upright. Mirrored for the right side.
const EAR_UP = [
  '.KK.',
  'KBPK',
  'KBPK',
  'KBPK',
  'KBPK',
  'KBPK',
  'KBPK',
  'KBPK',
  'KBBK',
  'KBBK',
  'KBBK',
  'KBBK',
]

// Half-mast: shorter and bent outward at the tip.
const EAR_MID = [
  '..KK..',
  '.KBPK.',
  '.KBPK.',
  '.KBPK.',
  'KBPK..',
  'KBPK..',
  'KBBK..',
  'KBBK..',
  'KBBK..',
  '.KK...',
]

// Fully drooped: folds down and out, hanging beside the face.
const EAR_DOWN = [
  '.KK...',
  'KBPK..',
  'KBPK..',
  '.KBPK.',
  '.KBPK.',
  '..KBPK',
  '..KBBK',
  '..KBBK',
  '...KBK',
  '...KK.',
]

const TAIL = ['.KK.', 'KBBK', 'KBBK', '.KK.']

const EYES_OPEN = ['EE', 'EW']
const EYES_MID = ['EE']
const EYES_SLIT = ['EE']

// 0 desaturated grey -> 5 warm cream. Outline stays near-black throughout.
const PALETTES = [
  { K: '#2B2B2E', B: '#B9B6BA', S: '#9E9BA0', P: '#A38F9C', N: '#9E8792', E: '#2B2B2E', W: '#6B6B70' },
  { K: '#2B2A2C', B: '#C7C0C0', S: '#ABA3A3', P: '#B995A8', N: '#B98CA0', E: '#2B2A2C', W: '#7A7476' },
  { K: '#2A2729', B: '#D8CECB', S: '#BCB0AC', P: '#C892B0', N: '#CE86A4', E: '#2A2729', W: '#FFFFFF' },
  { K: '#282426', B: '#E4D7D2', S: '#C8B8B1', P: '#D093B6', N: '#D97BA0', E: '#282426', W: '#FFFFFF' },
  { K: '#262224', B: '#EDDCD2', S: '#D2BCAC', P: '#D693BC', N: '#DE79A4', E: '#262224', W: '#FFFFFF' },
  { K: '#241F21', B: '#F6E4CE', S: '#DCC29F', P: '#DE96C2', N: '#E574A6', E: '#241F21', W: '#FFFFFF' },
]

// Three poses. Mood 0-1 droopy, 2-3 neutral, 4-5 perky.
function poseFor(mood) {
  if (mood <= 1) return 'down'
  if (mood <= 3) return 'mid'
  return 'up'
}

const POSES = {
  down: { ear: EAR_DOWN, earL: [0, 13], earR: [18, 13], eyes: EYES_SLIT, eyeY: 18, tailY: 30 },
  mid: { ear: EAR_MID, earL: [2, 6], earR: [16, 6], eyes: EYES_MID, eyeY: 17, tailY: 29 },
  up: { ear: EAR_UP, earL: [6, 0], earR: [14, 0], eyes: EYES_OPEN, eyeY: 17, tailY: 27 },
}

const mirror = rows => rows.map(r => [...r].reverse().join(''))

function blit(grid, sprite, ox, oy) {
  sprite.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return
      const gy = oy + y, gx = ox + x
      if (gy < 0 || gy >= H || gx < 0 || gx >= W) return
      grid[gy][gx] = ch
    })
  })
}

export default function RabbitPixel({ mood = 3, size = 176 }) {
  const lvl = Math.max(0, Math.min(5, Math.round(mood)))
  const pal = PALETTES[lvl]
  const pose = POSES[poseFor(lvl)]

  const grid = BODY.map(r => [...r])
  // Ears behind the head so the head silhouette stays clean.
  blit(grid, pose.ear, pose.earL[0], pose.earL[1])
  blit(grid, mirror(pose.ear), pose.earR[0], pose.earR[1])
  // Tail sits at the right haunch; drops lower when droopy.
  blit(grid, TAIL, 18, pose.tailY)
  // Eyes
  blit(grid, pose.eyes, 7, pose.eyeY)
  blit(grid, pose.eyes, 13, pose.eyeY)

  const px = size / W
  const rects = []
  grid.forEach((row, y) => {
    row.forEach((ch, x) => {
      if (ch === '.') return
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * px} y={y * px} width={px + 0.4} height={px + 0.4}
          fill={pal[ch] || pal.B}
          style={{ transition: 'fill 1.4s ease' }}
        />
      )
    })
  })

  return (
    <svg
      width={size} height={H * px}
      viewBox={`0 0 ${size} ${H * px}`}
      shapeRendering="crispEdges"
      style={{ display: 'block', margin: '0 auto' }}
      role="img"
      aria-label={`Pixel bunny, mood ${lvl} of 5`}
    >
      {rects}
    </svg>
  )
}
