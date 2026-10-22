'use client'

import SmartLink from './SmartLink'

/**
 * The in-grid slot: one card shaped like a poster, sitting inside a grid of
 * results. It is deliberately a normal grid cell rather than an overlay, so it
 * pushes content instead of covering it and nothing becomes unclickable — the
 * same class of bug that broke the skip button.
 */
export default function AdRail({ className = '' }: { className?: string }) {
  return (
    <SmartLink
      slot="grid"
      className={className}
      headline="Skip the ads for a month"
      body="One partner offer, no subscription."
    />
  )
}
