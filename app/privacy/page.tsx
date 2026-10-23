import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What this site stores, what it does not, and the ad partners involved.',
}

/**
 * Privacy page.
 *
 * Written to match what the code actually does, since the consent gate points
 * here: watchlist and progress live in localStorage only, and no ad partner is
 * contacted before consent.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 leading-relaxed">
      <h1 className="text-2xl font-semibold">Privacy</h1>
      <p className="mt-4 text-sm text-white/70">
        Last updated {new Date().getFullYear()}. This page describes what the site stores and who
        else sees it.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Stored on your device</h2>
      <p className="mt-2 text-sm text-white/70">
        Your watchlist, episode progress, playback preferences and ad choice are kept in this
        browser&rsquo;s <code>localStorage</code>. They are not uploaded to us, and they are not tied
        to an account. Clearing site data removes them permanently.
      </p>

      <h2 className="mt-8 text-lg font-semibold">What the servers see</h2>
      <p className="mt-2 text-sm text-white/70">
        Catalogue data comes from the AniList API. Episode sources are resolved from third-party
        streaming providers at playback time, which necessarily sees the request. Standard server
        logs may record the pages requested.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Advertising</h2>
      <p className="mt-2 text-sm text-white/70">
        No ad partner is contacted until you choose &ldquo;Accept&rdquo; on the consent banner.
        Choosing &ldquo;Reject&rdquo; keeps them disabled for this browser.
      </p>

      <p className="mt-10 text-sm">
        <Link href="/" className="underline decoration-dotted">
          Back to browsing
        </Link>
      </p>
    </main>
  )
}
