import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

// Brand colours
const GRAY = '#D8DCDD'
const INDIGO = '#5251A7'
const GREEN = '#6AA136'
const BG = '#F7F6F3'

// Lerp between two hex colours via RGB
function lerpHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

function squareColor(progress: number): string {
  if (progress < 0.5) return lerpHex(GRAY, INDIGO, progress * 2)
  return lerpHex(INDIGO, GREEN, (progress - 0.5) * 2)
}

export function DataClarityComposition() {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  // Grid base params (left-side dense state)
  const BASE_SIZE = 10
  const BASE_GAP = 3
  const CELL = BASE_SIZE + BASE_GAP

  const cols = Math.ceil(width / CELL) + 2
  const rows = Math.ceil(height / CELL) + 2

  // Overall animation wave progress (0→1 over ~3 seconds then held)
  const waveProgress = interpolate(frame, [0, fps * 3], [0, 1], {
    extrapolateRight: 'clamp',
  })

  const squares: React.ReactNode[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Normalised x position 0 (left) → 1 (right)
      const xNorm = col / (cols - 1)

      // Each square has a "target progress" based on its x position
      // Right side squares are further along the gray→indigo→green journey
      const targetProgress = xNorm

      // Animate from 0 toward targetProgress, with a left-to-right wave delay
      const delay = xNorm * 0.6 // rightmost squares start animating later
      const localProgress = interpolate(
        waveProgress,
        [delay, Math.min(delay + 0.5, 1)],
        [0, targetProgress],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      )

      // Size: left squares stay small, right squares grow slightly
      const sizeFactor = interpolate(localProgress, [0, 1], [1, 1.7])
      const size = BASE_SIZE * sizeFactor

      // Spacing: right squares space out (cells grow)
      const spacingFactor = interpolate(localProgress, [0, 1], [1, 2.2])
      const effectiveCell = CELL * spacingFactor

      // Position with expanded spacing
      const cx = col * effectiveCell - (effectiveCell - CELL) * col * 0.5
      const cy = row * CELL

      // Spring entrance pop per square
      const entranceDelay = Math.round((xNorm * 0.4 + (row / rows) * 0.1) * fps)
      const pop = spring({
        frame: Math.max(0, frame - entranceDelay),
        fps,
        config: { stiffness: 180, damping: 22, mass: 0.6 },
      })
      const scale = interpolate(pop, [0, 1], [0.4, 1])

      // Opacity: right-side squares fade in a bit more clearly
      const opacity = interpolate(localProgress, [0, 0.15], [0.25, 1], {
        extrapolateRight: 'clamp',
      })

      const color = squareColor(localProgress)
      const radius = interpolate(localProgress, [0, 1], [2, 4])

      squares.push(
        <rect
          key={`${row}-${col}`}
          x={cx - size / 2}
          y={cy - size / 2}
          width={size}
          height={size}
          rx={radius}
          ry={radius}
          fill={color}
          opacity={opacity}
          transform={`translate(${size / 2 + cx - cx},${size / 2 + cy - cy}) scale(${scale}) translate(${-(size / 2 + cx - cx)},${-(size / 2 + cy - cy)})`}
          style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'fill-box' }}
        />,
      )
    }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: BG, display: 'block' }}
    >
      <defs>
        {/* Grain texture */}
        <filter id="grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blended" />
          <feComposite in="blended" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      <g filter="url(#grain)">
        {squares}
      </g>
    </svg>
  )
}
