'use client'

import AdSlot from './AdSlot'
import { SLOTS } from '@/config/ads'

/**
 * The sticky sidebar slot. Desktop only — it hides below 1280px via CSS, so it
 * never crowds a narrow layout or a phone.
 *
 * 300x600 is the highest-value display size that fits a sidebar, and because it
 * stays on screen while the viewer scrolls it accumulates viewable time, which
 * is the metric that actually gets paid.
 */
export default function AdSidebar() {
  return (
    <aside className="ad-sidebar" aria-label="Advertisement">
      <p className="mb-2 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-zinc-600">
        Sponsored
      </p>
      <AdSlot slot="sidebar-sticky" size={SLOTS['sidebar-sticky'].size} />
    </aside>
  )
}
