'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SLOTS, HOUSE_ONLY } from '@/config/ads'
import { runWaterfall, type WaterfallAttempt } from '@/lib/ads/waterfall'
import { adsAllowed, hydrateConsent, subscribeConsent } from '@/lib/ads/consent'
import { adsOptedOut } from '@/lib/ads/useAdsEnabled'
import {
  recordAttempts,
  recordImpression,
  recordRequest,
  recordSkip,
  recordViewable,
} from '@/lib/ads/telemetry'
import type { AdFormat, AdSize } from '@/lib/ads/provider'

export interface AdSlotProps {
  /** Key into SLOTS. */
  slot: string
  /** Override the declared size. Reserved space always comes from one of these. */
  size?: AdSize
  /** Override the declared format. */
  format?: AdFormat
  className?: string
}

type Status = 'idle' | 'loading' | 'filled' | 'empty' | 'off'

/** Half the creative on screen, continuously, for this long = one viewable impression. */
const VIEWABLE_MS = 1000

export default function AdSlot({ slot, size, format, className = '' }: AdSlotProps) {
  const cfg = SLOTS[slot]
  const box = size ?? cfg?.size ?? { width: 300, height: 250 }
  const fmt: AdFormat = format ?? cfg?.format ?? 'banner'

  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [servedBy, setServedBy] = useState<string | null>(null)
  const [allowed, setAllowed] = useState(false)
  const [optedOut, setOptedOut] = useState(false)

  // Guards so each of these can only happen once per mount.
  const requested = useRef(false)
  const impressionSent = useRef(false)
  const viewableSent = useRef(false)
  const visibleSince = useRef<number | null>(null)

  /* ── consent ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    hydrateConsent()
    const sync = () => setAllowed(adsAllowed())
    sync()
    setOptedOut(adsOptedOut())
    return subscribeConsent(sync)
  }, [])

  /* ── the actual load ─────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (requested.current) return
    const host = hostRef.current
    if (!host || !cfg) return
    requested.current = true
    setStatus('loading')
    recordRequest(slot)

    // Before consent, and while the viewer has opted out, no network is
    // contacted. The house box keeps the space honest.
    const chain = allowed ? cfg.chain : HOUSE_ONLY
    if (!allowed) recordSkip(slot, 'awaiting consent')

    const result = await runWaterfall(host, { slot, format: fmt, size: box, consent: allowed, visible: true }, chain, {
      onAttempt: (a: WaterfallAttempt) => {
        host.dataset.lastAttempt = `${a.adapter}:${a.filled ? 'fill' : (a.reason ?? 'no')}`
      },
    })

    recordAttempts(slot, result.attempts, result.servedBy)

    if (result.filled) {
      setServedBy(result.servedBy)
      setStatus('filled')
      host.dataset.adapter = result.servedBy ?? ''
      // An impression means "a creative was rendered". Recorded once, here.
      if (!impressionSent.current) {
        impressionSent.current = true
        recordImpression(slot, result.servedBy)
      }
    } else {
      // Should not happen while `house` is in the chain, but if it does the box
      // still occupies its reserved height rather than collapsing.
      setStatus('empty')
      recordSkip(slot, 'no fill')
    }
  }, [allowed, box, cfg, fmt, slot])

  /* ── lazy: 200px before it would enter the viewport ──────────────────── */
  useEffect(() => {
    const host = hostRef.current
    if (!host || !cfg) return

    let cancelled = false
    const start = () => {
      if (cancelled) return
      // Defer past first paint so an ad never competes with LCP. requestIdle
      // is a hint; the timeout is the guarantee if the browser never idles.
      const go = () => void load()
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(go, { timeout: 2000 })
      } else {
        window.setTimeout(go, 200)
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          start()
        }
      },
      { rootMargin: '200px 0px', threshold: 0 },
    )
    io.observe(host)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [cfg, load])

  /* ── viewability: >=50% visible for >=1s ─────────────────────────────── */
  useEffect(() => {
    const host = hostRef.current
    if (!host || status !== 'filled') return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= 0.5) {
            if (visibleSince.current == null) visibleSince.current = Date.now()
          } else {
            visibleSince.current = null
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    )
    io.observe(host)

    // A ticker rather than a timer per intersection event, so "continuously"
    // really is continuous: any dip below 50% clears the start time.
    const tick = window.setInterval(() => {
      if (viewableSent.current) return
      const since = visibleSince.current
      if (since != null && Date.now() - since >= VIEWABLE_MS) {
        viewableSent.current = true
        recordViewable(slot)
        host.dataset.viewable = '1'
        window.clearInterval(tick)
      }
    }, 250)

    return () => {
      io.disconnect()
      window.clearInterval(tick)
    }
  }, [slot, status])

  /* ── opt-out removes the slot entirely ───────────────────────────────── */
  useEffect(() => {
    if (optedOut) setStatus('off')
  }, [optedOut])

  if (!cfg || status === 'off') return null

  // Reserved space. This is the whole anti-CLS story: the box exists at its
  // final size before a single byte of ad code runs.
  return (
    <div
      className={`ad-slot ${className}`}
      data-slot={slot}
      data-format={fmt}
      data-status={status}
      data-adapter={servedBy ?? ''}
      style={{
        // minHeight, not height: a responsive network may want more room, but
        // the reserved floor guarantees the layout below never moves up.
        minHeight: box.height,
        width: '100%',
        maxWidth: box.width,
        marginInline: 'auto',
      }}
    >
      <div ref={hostRef} className="ad-slot__host" style={{ minHeight: box.height }} />
      {status === 'loading' && <span className="ad-slot__label">Ad</span>}
    </div>
  )
}
