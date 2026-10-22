'use client'

import { useEffect, useState } from 'react'
import AdSlot from '@/components/ads/AdSlot'
import { SLOTS } from '@/config/ads'
import { snapshot, subscribe, resetStats, type SlotStats } from '@/lib/ads/telemetry'
import { ADAPTERS } from '@/lib/ads/provider'
import { CONSENT_REQUIRED, getConsent } from '@/lib/ads/consent'
import { clickAdState, resetClickAdState } from '@/lib/ads/clickMonetization'

interface Row extends SlotStats {
  slot: string
  viewabilityRate: number
}

/**
 * Live fill status for every slot.
 *
 * This page exists because "ads barely show" is not a thing you can diagnose by
 * looking at the site. You need to know, per slot: did it get asked for, did a
 * creative land, which adapter served it, and did it pass the viewability
 * threshold. All of that is here, and it updates as you watch.
 *
 * Every slot is rendered live below the table, so a slot that fails in the
 * table is visibly failing on the page too.
 */
export default function DebugAdsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [consent, setConsentState] = useState<string>('loading')

  useEffect(() => {
    const sync = () => setRows(snapshot())
    sync()
    setConsentState(getConsent() ?? 'unanswered')
    const unsub = subscribe(sync)
    const t = window.setInterval(() => {
      sync()
      setConsentState(getConsent() ?? 'unanswered')
    }, 1000)
    return () => {
      unsub()
      window.clearInterval(t)
    }
  }, [])

  const configured = Object.values(ADAPTERS).map((a) => ({
    name: a.name,
    configured: a.configured,
    formats: a.supportedFormats.join(', '),
  }))

  return (
    <div className="container-page pt-6">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Debug</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">Ads</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Fill and viewability per slot, live. A slot with 0 requests has not been reached yet —
          slots load lazily, 200px before they enter the viewport. Scroll down to trigger them.
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="surface p-4">
          <p className="eyebrow mb-1">Consent</p>
          <p className="font-mono text-sm text-zinc-200">{consent}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {CONSENT_REQUIRED ? 'Required — networks blocked until granted' : 'Not required'}
          </p>
        </div>
        <div className="surface p-4 sm:col-span-2">
          <p className="eyebrow mb-1">Click-anywhere</p>
          <ClickAdPanel />
        </div>
        <div className="surface p-4 sm:col-span-2">
          <p className="eyebrow mb-1">Adapters</p>
          <ul className="space-y-1">
            {configured.map((a) => (
              <li key={a.name} className="flex items-center gap-2 font-mono text-xs">
                <span className={a.configured ? 'text-emerald-400' : 'text-zinc-600'}>
                  {a.configured ? '●' : '○'}
                </span>
                <span className="text-zinc-300">{a.name.padEnd(10)}</span>
                <span className="text-zinc-500">{a.configured ? 'configured' : 'no id — skipped'}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-10 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
              <th className="py-2 pr-4">Slot</th>
              <th className="py-2 pr-4">Requests</th>
              <th className="py-2 pr-4">Impressions</th>
              <th className="py-2 pr-4">Viewable</th>
              <th className="py-2 pr-4">Rate</th>
              <th className="py-2 pr-4">Served by</th>
              <th className="py-2">Last attempt trace</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(SLOTS).map((cfg) => {
              const r = rows.find((x) => x.slot === cfg.name)
              return (
                <tr key={cfg.name} className="border-b border-white/[0.05] align-top">
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-zinc-200">{cfg.name}</span>
                    <span className="mt-0.5 block font-mono text-[0.6rem] text-zinc-600">
                      {cfg.format} {cfg.size.width}×{cfg.size.height}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-zinc-300">{r?.requests ?? 0}</td>
                  <td className="py-2.5 pr-4 font-mono text-zinc-300">{r?.impressions ?? 0}</td>
                  <td className="py-2.5 pr-4 font-mono text-zinc-300">{r?.viewables ?? 0}</td>
                  <td className="py-2.5 pr-4 font-mono">
                    <span
                      className={
                        (r?.viewabilityRate ?? 0) >= 0.5 ? 'text-emerald-400' : 'text-zinc-500'
                      }
                    >
                      {((r?.viewabilityRate ?? 0) * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-zinc-400">{r?.servedBy ?? '—'}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(r?.lastAttempts ?? []).map((a, i) => (
                        <span
                          key={i}
                          className={`rounded px-1.5 py-0.5 font-mono text-[0.58rem] ${
                            a.filled
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-white/[0.05] text-zinc-500'
                          }`}
                        >
                          {a.adapter}
                          {a.filled ? ' ✓' : ` ${a.reason ?? 'no'}`} {a.ms}ms
                        </span>
                      ))}
                      {!r?.lastAttempts?.length && <span className="text-zinc-700">not requested</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button type="button" className="btn-ghost mt-4 h-9 px-4 text-xs" onClick={resetStats}>
          Reset counters
        </button>
      </section>

      <section className="space-y-8">
        <h2 className="section-title">Live slots</h2>
        {Object.values(SLOTS).map((cfg) => (
          <div key={cfg.name}>
            <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-wider text-zinc-500">
              {cfg.name} · {cfg.note}
            </p>
            <AdSlot slot={cfg.name} />
          </div>
        ))}
      </section>
    </div>
  )
}

/**
 * Live pacing state for the click-anywhere trigger.
 *
 * The cooldown and session cap are the two settings most likely to be wrong on
 * launch — too tight and the slot earns nothing, too loose and the traffic looks
 * like a burst. This shows both counters and offers a reset so the pacing can be
 * re-tested without clearing site data.
 */
function ClickAdPanel() {
  const [state, setState] = useState(clickAdState)

  return (
    <>
      <p className="font-mono text-xs text-zinc-200">
        {state.enabled ? (state.mode === 'redirect' ? 'redirect' : 'new tab') : 'disabled'}
        {state.mode === 'redirect' && state.enabled ? ' — current tab' : ''}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {Math.round(state.cooldownMs / 1000)}s cooldown · {state.countThisSession}/{state.sessionCap} this
        session · {Math.round(state.armDelayMs / 1000)}s arm delay
      </p>
      <p className="mt-1 font-mono text-[0.65rem] text-zinc-600">
        last: {state.lastFire ? new Date(state.lastFire).toLocaleTimeString() : 'never'}
      </p>
      <p className="mt-1 text-[0.7rem] leading-relaxed text-zinc-600">
        Skipped on {state.blockedRoutes.join(', ')}
      </p>
      <button
        type="button"
        className="btn-ghost mt-3 h-8 px-3 text-[0.7rem]"
        onClick={() => {
          resetClickAdState()
          setState(clickAdState())
        }}
      >
        Reset pacing
      </button>
    </>
  )
}
