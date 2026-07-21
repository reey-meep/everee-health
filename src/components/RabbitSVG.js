import { useMemo } from 'react'

// Holland Lop, side profile, sitting -- original geometry, styled after the
// classic bold-vector lop pose: heavy rounded haunch, compact chest, one long
// ear hanging past the jaw.
//
// Every animated part is its own layer with a transform-origin at its pivot, so
// mood drives transforms on static artwork rather than redrawing shapes. That's
// the whole reason this replaced the Canvas version.

const COATS = [
  { coat: '#9A9AA0', shade: '#7E7E86', belly: '#C3C3C8', line: '#5E5E66' }, // 0 desaturated
  { coat: '#A99C93', shade: '#8B8079', belly: '#D2C8C2', line: '#6B615B' },
  { coat: '#CBB694', shade: '#AE9A7B', belly: '#EADCC8', line: '#7E6E58' },
  { coat: '#C08F5C', shade: '#A2764A', belly: '#EFD9BF', line: '#6F5232' },
  { coat: '#BC8449', shade: '#9C6A38', belly: '#F3DCBE', line: '#67482A' },
  { coat: '#CE9750', shade: '#AE7B3B', belly: '#F8E4C4', line: '#6E4F26' },
]

const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a, b, t) => {
  const A = hex2rgb(a), B = hex2rgb(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}

export default function RabbitSVG({ mood = 3, size = 176, reduced = false }) {
  const lvl = Math.max(0, Math.min(5, mood))
  const i0 = Math.floor(lvl), i1 = Math.min(5, i0 + 1), t = lvl - i0
  const c = useMemo(() => ({
    coat: mix(COATS[i0].coat, COATS[i1].coat, t),
    shade: mix(COATS[i0].shade, COATS[i1].shade, t),
    belly: mix(COATS[i0].belly, COATS[i1].belly, t),
    line: mix(COATS[i0].line, COATS[i1].line, t),
  }), [i0, i1, t])

  const lift = lvl / 5                    // 0 sad, 1 perky
  // Ear: hangs straight and long when sad, swings outward and shortens when perky.
  const nearEarRot = 12 - lift * 26       // +12deg inward/down  ->  -14deg outward
  const farEarRot = 8 - lift * 20
  const earScaleY = 1.06 - lift * 0.10
  const eyeOpen = 0.42 + lift * 0.58
  const headTilt = -2 + lift * 5
  const bodyLift = lift * 2.5

  // Idle motion speeds up with mood; nose twitch is the clearest "alive" signal.
  const swayDur = `${(3.4 - lift * 1.4).toFixed(2)}s`
  const breatheDur = `${(3.0 - lift * 1.1).toFixed(2)}s`
  const twitchDur = `${(1.9 - lift * 1.1).toFixed(2)}s`
  const anim = reduced ? 'none' : undefined

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      <style>{`
        @keyframes lopSway   { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(3.2deg) } }
        @keyframes lopSwayF  { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-2.4deg) } }
        @keyframes lopBreathe{ 0%,100% { transform: translateY(0) scaleY(1) } 50% { transform: translateY(-1.6px) scaleY(1.018) } }
        @keyframes lopTwitch { 0%,88%,100% { transform: translateY(0) } 92% { transform: translateY(-1.1px) } 96% { transform: translateY(.5px) } }
        @keyframes lopBlink  { 0%,94%,100% { transform: scaleY(var(--open)) } 97% { transform: scaleY(.08) } }
        @keyframes lopFloat  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @media (prefers-reduced-motion: reduce) { svg * { animation: none !important } }
      `}</style>

      {/* ground shadow */}
      <ellipse cx="104" cy="180" rx="64" ry="8.5" fill={c.line} opacity=".13" />

      <g style={{ animation: anim ?? `lopFloat ${breatheDur} ease-in-out infinite`, transformOrigin: '104px 150px' }}>

        {/* ── FAR EAR (behind head) ── */}
        <g style={{ transform: `rotate(${farEarRot}deg) scaleY(${earScaleY})`, transformOrigin: '110px 54px' }}>
          <g style={{ animation: anim ?? `lopSwayF ${swayDur} ease-in-out infinite`, transformOrigin: '110px 54px' }}>
            <path
              d="M110 54 c 11 7 16 27 14 50 c -2 18 -9 28 -16 28 c -8 0 -13 -11 -13 -29 c 0 -22 4 -42 15 -49 z"
              fill={c.shade} stroke={c.line} strokeWidth="2.4" strokeLinejoin="round" />
          </g>
        </g>

        {/* ── TAIL ── */}
        <circle cx="171" cy="128" r="13" fill={c.belly} stroke={c.line} strokeWidth="2.4" />

        {/* ── BODY: haunch + chest ── */}
        <g style={{ animation: anim ?? `lopBreathe ${breatheDur} ease-in-out infinite`, transformOrigin: '110px 168px' }}
           transform={`translate(0 ${-bodyLift})`}>
          <path
            d="M70 150
               c -6 -20 -2 -44 10 -58
               c 14 -16 38 -22 60 -14
               c 24 9 34 32 32 56
               c -2 22 -18 36 -42 39
               c -26 3 -54 -1 -60 -23 z"
            fill={c.coat} stroke={c.line} strokeWidth="2.6" strokeLinejoin="round" />
          {/* haunch shading */}
          <path d="M120 96 c 20 6 30 26 28 48 c -1 16 -11 27 -27 32 c 14 -20 16 -56 -1 -80 z"
                fill={c.shade} opacity=".55" />
          {/* chest / belly */}
          <path d="M74 154 c -5 -18 -1 -38 9 -50 c 9 -11 22 -16 34 -14 c -16 8 -26 26 -27 46 c -1 14 2 24 8 32 c -12 2 -21 -3 -24 -14 z"
                fill={c.belly} opacity=".8" />
          {/* hind foot */}
          <ellipse cx="146" cy="172" rx="24" ry="10" fill={c.belly} stroke={c.line} strokeWidth="2.4" />
          {/* front paw */}
          <ellipse cx="78" cy="172" rx="17" ry="9" fill={c.belly} stroke={c.line} strokeWidth="2.4" />
        </g>

        {/* ── HEAD ── */}
        <g style={{ transform: `rotate(${headTilt}deg)`, transformOrigin: '80px 100px' }}>
          {/* skull + muzzle as one silhouette */}
          <path
            d="M76 48
               c 20 0 34 15 34 34
               c 0 14 -7 25 -18 30
               c -8 4 -18 5 -27 3
               c -10 -2 -18 -7 -22 -14
               c -6 -3 -9 -8 -8 -13
               c 1 -6 6 -9 12 -9
               c -1 -18 12 -31 29 -31 z"
            fill={c.coat} stroke={c.line} strokeWidth="2.6" strokeLinejoin="round" />
          {/* cheek/muzzle lighter mass */}
          <path d="M55 76 c 8 -2 15 2 17 9 c 2 8 -3 15 -12 17 c -9 2 -16 -2 -18 -9 c -2 -8 4 -15 13 -17 z"
                fill={c.belly} opacity=".85" />

          {/* rosy cheek from mood 4 */}
          {lvl > 3.4 && (
            <ellipse cx="62" cy="90" rx="9" ry="6" fill="#F0468A" opacity={(lvl - 3.4) * 0.28} />
          )}

          {/* eye */}
          <g style={{ '--open': eyeOpen, transform: `scaleY(${eyeOpen})`, transformOrigin: '70px 74px',
                      animation: anim ?? `lopBlink ${(5.5 - lift).toFixed(1)}s ease-in-out infinite` }}>
            <ellipse cx="70" cy="74" rx="7" ry="8" fill="#2A2530" />
            {lvl > 2.2 && <circle cx="72.4" cy="71" r="2.5" fill="#fff" opacity={Math.min((lvl - 2.2) / 2, .9)} />}
          </g>

          {/* nose + mouth */}
          <g style={{ animation: anim ?? `lopTwitch ${twitchDur} ease-in-out infinite`, transformOrigin: '44px 84px' }}>
            <path d="M40 82 c 4 -2 8 -2 9 1 c 1 3 -2 5 -5 5 c -3 0 -5 -3 -4 -6 z" fill="#E8899C" stroke={c.line} strokeWidth="1.4" />
            <path d="M44.5 88 v 4" stroke={c.line} strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <path d={lvl > 2.5
              ? 'M39 92 q 5.5 5 11 0'      // smile
              : 'M39 93.5 q 5.5 -3 11 0'}  // flat / downturned
              stroke={c.line} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>

          {/* whiskers -- droop when sad, forward when perky */}
          <g stroke={c.line} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity={.45 + lift * .3}>
            <path d={`M38 86 q -12 ${6 - lift * 9} -22 ${8 - lift * 12}`} />
            <path d={`M38 89 q -13 ${2 - lift * 6} -24 ${2 - lift * 7}`} />
            <path d={`M39 92 q -12 ${-1 - lift * 3} -22 ${-3 - lift * 4}`} />
          </g>
        </g>

        {/* ── NEAR EAR (in front, the primary mood signal) ── */}
        <g style={{ transform: `rotate(${nearEarRot}deg) scaleY(${earScaleY})`, transformOrigin: '94px 50px' }}>
          <g style={{ animation: anim ?? `lopSway ${swayDur} ease-in-out infinite`, transformOrigin: '94px 50px' }}>
            <path
              d="M94 50
                 c -13 8 -19 31 -17 58
                 c 2 22 10 34 20 34
                 c 10 0 16 -13 16 -35
                 c 0 -27 -5 -49 -19 -57 z"
              fill={c.coat} stroke={c.line} strokeWidth="2.6" strokeLinejoin="round" />
            <path
              d="M94 63 c -8 7 -12 25 -11 44 c 1 16 6 24 12 24 c 7 0 10 -9 10 -25 c 0 -19 -4 -36 -11 -43 z"
              fill="#E9A9B4" opacity=".55" />
          </g>
        </g>

        {/* ── GLOW: orbiting hearts at top mood ── */}
        {lvl > 4.5 && !reduced && [0, 1, 2].map(k => (
          <g key={k} style={{ animation: `lopFloat ${1.6 + k * 0.4}s ease-in-out infinite`, transformOrigin: '100px 40px' }}>
            <path
              d={`M${52 + k * 44} ${30 + (k % 2) * 12} c -3 -4 -9 -1 -9 4 c 0 5 9 10 9 10 c 0 0 9 -5 9 -10 c 0 -5 -6 -8 -9 -4 z`}
              fill="#F0468A" opacity={0.25 + 0.2 * ((lvl - 4.5) / 0.5)} />
          </g>
        ))}
      </g>
    </svg>
  )
}
