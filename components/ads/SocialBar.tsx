'use client'

import { useEffect } from 'react'
import { ADS } from '@/lib/ads/config'
import { useAdsEnabled } from '@/lib/ads/useAdsEnabled'

/**
 * Loads Adsterra's own Social Bar / Popunder script, if one is configured.
 *
 * These placements are injected by Adsterra's script, not by us, so this only
 * exists to load it once and only when ads are enabled. Nothing is configured
 * by default: the dashboard row for this site is a Smartlink, which has no
 * script tag. Set NEXT_PUBLIC_ADS_SOCIAL_BAR_SRC (or _POPUNDER_SRC) to enable.
 *
 * The script is loaded after the page has settled so it cannot delay first
 * paint, and never on the watch page — a popunder fired at someone mid-episode
 * is how you lose the viewer.
 */
export default function SocialBar() {
  const enabled = useAdsEnabled()

  useEffect(() => {
    if (!enabled) return
    const src = ADS.socialBar || ADS.popunder
    if (!src) return
    if (document.querySelector(`script[data-adsterra="${src}"]`)) return

    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.adsterra = src
    document.body.appendChild(s)
  }, [enabled])

  return null
}
