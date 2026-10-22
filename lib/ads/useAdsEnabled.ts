'use client'

import { useEffect, useState } from 'react'
import { adsEnabled } from './config'

const STORAGE_KEY = 'crused:ads-off'

/**
 * Whether ads should render for this viewer.
 *
 * Ads are skipped for anyone who has a "do not track" signal set, and for
 * anyone who has opted out in settings. Both are cheap to honour and a viewer
 * who opts out is not going to click an ad anyway.
 */
export function useAdsEnabled() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!adsEnabled) return
    const optedOut = localStorage.getItem(STORAGE_KEY) === '1'
    const dnt =
      navigator.doNotTrack === '1' ||
      (window as unknown as { doNotTrack?: string }).doNotTrack === '1'
    if (!optedOut && !dnt) setEnabled(true)
  }, [])

  return enabled
}

export function setAdsOptOut(off: boolean) {
  if (off) localStorage.setItem(STORAGE_KEY, '1')
  else localStorage.removeItem(STORAGE_KEY)
}

export function adsOptedOut() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}
