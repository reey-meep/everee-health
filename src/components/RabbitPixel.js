import {
  W, H, BASE_NO_EARS, EAR_L, EAR_R,
  EYE_CELLS, EYE_ROW_TOP, TAIL_MIN_COL, EAR_OFFSET, PALETTES,
} from './bunnySprite'

// Renders Ree's transcribed pixel bunny as SVG rects.
//
// No idle animation by request -- the only motion is a slow colour transition,
// so she warms up gradually instead of twitching. Pose changes in three steps.

function poseFor(mood) {
  if (mood <= 1) return 'down'
  if (mood <= 3) return 'mid'
  return 'up'
}

function blit(grid, sprite, dx, dy) {
  sprite.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return
      const gy = y + dy, gx = x + dx
      if (gy < 0 || gy >= H || gx < 0 || gx >= W) return
      grid[gy][gx] = ch
    })
  })
}

export default function RabbitPixel({ mood = 3, size = 168 }) {
  const lvl = Math.max(0, Math.min(5, Math.round(mood)))
  const pal = PALETTES[lvl]
  const pose = poseFor(lvl)
  const [dxL, dxR, dy] = EAR_OFFSET[pose]

  // Ears first, then the head/body on top, so the ears sit behind the head
  // exactly as they do in the source art.
  const grid = Array.from({ length: H }, () => Array(W).fill('.'))
  blit(grid, EAR_L, dxL, dy)
  blit(grid, EAR_R, dxR, dy)
  blit(grid, BASE_NO_EARS, 0, 0)

  if (pose === 'down') {
    // Sleepy slits: drop the upper half of each 2x2 eye.
    EYE_CELLS.forEach(([x, y]) => {
      if (y === EYE_ROW_TOP) grid[y][x] = 'B'
    })
    // Tail sags: shift the right-edge column block down two rows.
    for (let y = H - 1; y >= 2; y--) {
      for (let x = TAIL_MIN_COL; x < W; x++) {
        grid[y][x] = grid[y - 2][x]
      }
    }
  }

  const px = size / W
  const rects = []
  grid.forEach((row, y) => {
    row.forEach((ch, x) => {
      if (ch === '.') return
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * px} y={y * px} width={px + 0.5} height={px + 0.5}
          fill={pal[ch] || pal.B}
          style={{ transition: 'fill 1.4s ease' }}
        />
      )
    })
  })

  return (
    <svg
      width={size} height={H * px}
      viewBox={`0 0 ${W * px} ${H * px}`}
      shapeRendering="crispEdges"
      style={{ display: 'block', margin: '0 auto' }}
      role="img"
      aria-label={`Pixel bunny, mood ${lvl} of 5`}
    >
      {rects}
    </svg>
  )
}
