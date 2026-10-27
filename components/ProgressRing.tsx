'use client'

interface Props {
  /** 0–1. Clamped, so a stale value cannot draw outside the circle. */
  value: number
  size?: number
  stroke?: number
  /** Shown in the middle; defaults to the rounded percentage. */
  label?: string
  className?: string
  /** Ring colour. Defaults to the accent gold. */
  tone?: 'accent' | 'signal'
}

/**
 * Small SVG progress ring.
 *
 * Used for the daily goal and the per-title completion badge. SVG rather than a
 * conic-gradient because the stroke can be rounded and animated on the same
 * element, and it stays crisp at the 40px sizes this is used at.
 */
export default function ProgressRing({
  value,
  size = 44,
  stroke = 3.5,
  label,
  className = '',
  tone = 'accent',
}: Props) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const dash = circumference * pct
  const color = tone === 'signal' ? '#4cc9a0' : '#c8a44d'

  return (
    <div className={`relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-500 ease-out"
        />
      </svg>
      <span className="absolute font-mono text-[0.6rem] font-semibold tabular-nums text-zinc-200">
        {label ?? `${Math.round(pct * 100)}%`}
      </span>
    </div>
  )
}
