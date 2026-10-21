'use client'

import { useEffect, useState } from 'react'
import { COVER_COOKIE, COVER_BRAND, declassifyText } from '@/lib/cover'

/**
 * Restricted mode.
 *
 * Two jobs, both purely cosmetic to the DOM:
 *  1. Relabel every visible text node through `declassifyText`, so a classifier
 *     matching a word list sees neutral vocabulary while a human reads the app
 *     normally.
 *  2. Neutralise the identity markers: `document.title`, and `href`s pointing
 *     at the content-bearing routes.
 *
 * Runs on a rAF-coalesced MutationObserver because Next re-renders after
 * hydration and on navigation; a one-shot pass would be undone within a frame.
 * Nodes are recorded so a rewritten label is never rewritten twice.
 *
 * It starts only after the `load` event, and it only touches nodes React has
 * already hydrated.
 *
 * Both guards are load-bearing. Mutating React-owned text while hydration is
 * still in flight triggers "server rendered text didn't match the client", and
 * `load` is *not* a safe boundary on its own: React streams Suspense content
 * and keeps committing after it, so a pass fired on a late mutation can land in
 * the middle of hydration. React marks each DOM node it has hydrated with a
 * `__reactFiber$…` / `__reactProps$…` key, and it only compares a node at the
 * moment it hydrates it — so a node that already carries a key is finished with,
 * and rewriting it afterwards is safe. Gating on that key makes the rewrite
 * correct by construction rather than by timing.
 *
 * The highest-signal surfaces (nav labels, headings, <title>) are relabelled on
 * the server anyway, so the deferral costs nothing visible.
 */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA'])

/**
 * True once React has hydrated this element. React attaches its internal keys
 * during hydration, so their absence means the node is still pending and must
 * not be mutated.
 */
function hydrated(el: Element | null): boolean {
  if (!el) return false
  for (const k in el) {
    if (k.startsWith('__reactFiber$') || k.startsWith('__reactProps$')) return true
  }
  return false
}

export function useCovered(): boolean {
  const [covered, setCovered] = useState(false)
  useEffect(() => {
    setCovered(document.cookie.split('; ').some((c) => c.startsWith(`${COVER_COOKIE}=1`)))
  }, [])
  return covered
}

export default function CoverClient() {
  const covered = useCovered()

  useEffect(() => {
    if (!covered) return

    const done = new WeakSet<Text>()
    let queued = false

    const rewriteNode = (node: Text) => {
      if (done.has(node)) return
      const parent = node.parentElement
      if (!parent || SKIP_TAGS.has(parent.tagName) || parent.isContentEditable) return
      // Still hydrating: leave it alone and let a later pass pick it up.
      if (!hydrated(parent)) return
      const next = declassifyText(node.nodeValue ?? '')
      done.add(node)
      if (next !== node.nodeValue) node.nodeValue = next
    }

    const rewriteLinks = () => {
      for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        const href = a.getAttribute('href')
        if (!href) continue
        // Same hydration guard: a link React has not claimed yet is off limits.
        if (!hydrated(a)) continue
        if (href.startsWith('/anime/') || href.startsWith('/movies/')) {
          a.setAttribute('href', '/item/' + href.replace(/^\/(anime|movies)\//, ''))
        } else if (href.startsWith('/watch/')) {
          a.setAttribute('href', '/view/' + href.slice(7))
        }
      }
    }

    const pass = () => {
      queued = false
      // The document title carries the current route's label; regenerate it.
      if (document.title) document.title = declassifyText(document.title)
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          (n.nodeValue ?? '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
      })
      const batch: Text[] = []
      let current: Node | null
      while ((current = walker.nextNode())) batch.push(current as Text)
      batch.forEach(rewriteNode)
      rewriteLinks()
    }

    const schedule = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(pass)
    }

    let observer: MutationObserver | null = null
    const start = () => {
      schedule()
      observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })
      window.addEventListener('popstate', schedule)
    }

    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })

    return () => {
      window.removeEventListener('load', start)
      observer?.disconnect()
      window.removeEventListener('popstate', schedule)
    }
  }, [covered])

  return null
}

/**
 * Toggle for restricted mode. Setting the cookie then reloading is deliberate:
 * the neutral <title> is emitted by the server, so the state must round-trip
 * before it can be trusted.
 */
export function CoverToggle() {
  const covered = useCovered()
  const set = (on: boolean) => {
    document.cookie = `${COVER_COOKIE}=${on ? '1' : '0'};path=/;max-age=${
      on ? 31536000 : 0
    };samesite=lax`
    window.location.reload()
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={covered}
      onClick={() => set(!covered)}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className="min-w-0">
        <span className="block text-sm text-zinc-200">Restricted mode</span>
        <span className="mt-0.5 block text-xs text-zinc-500">
          Neutral labels, neutral addresses, no identifying metadata. Reloads the app.
        </span>
      </span>
      <span
        className={[
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          covered ? 'bg-accent' : 'bg-white/15',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            covered ? 'translate-x-[1.15rem]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

/** Shown while the cover is active so the state is never ambiguous. */
export function CoverBadge({ className = '' }: { className?: string }) {
  const covered = useCovered()
  if (!covered) return null
  return (
    <span
      className={`rounded border border-white/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-zinc-500 ${className}`}
    >
      {COVER_BRAND}
    </span>
  )
}
