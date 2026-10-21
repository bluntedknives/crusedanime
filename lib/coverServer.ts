import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { COVER_COOKIE, declassifyText } from './cover'

/**
 * Server-side cover state.
 *
 * The neutral <title>/description are emitted by the *server*, not patched in
 * the browser, so there is no race: a category filter reading the document at
 * `document_start` already sees the neutral version. Client-side rewriting
 * (see `components/CoverClient.tsx`) only handles text and later DOM updates.
 */
export async function isCovered(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(COVER_COOKIE)?.value === '1'
}

/**
 * Neutralise a Metadata object. Keywords are dropped outright because they are
 * the single highest-signal field a category classifier reads.
 */
export function coverMetadata(meta: Metadata, covered: boolean): Metadata {
  if (!covered) return meta
  const { keywords: _keywords, ...rest } = meta
  void _keywords
  return {
    ...rest,
    ...(typeof meta.title === 'string' ? { title: declassifyText(meta.title) } : {}),
    ...(typeof meta.description === 'string'
      ? { description: declassifyText(meta.description) }
      : {}),
    openGraph: undefined,
    twitter: undefined,
    other: undefined,
  }
}
