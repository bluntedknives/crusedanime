'use client'

import { useEffect, useState } from 'react'
import { hydrateConsent, setConsent, shouldAskConsent, subscribeConsent } from '@/lib/ads/consent'
import Link from 'next/link'

/**
 * The consent gate.
 *
 * Nothing is requested from an ad network until this is answered, so the choice
 * is real rather than decorative. Rejecting is exactly as easy as accepting —
 * same size, same prominence — because a consent dialog that makes "no" hard to
 * find is not consent.
 */
export default function ConsentBanner() {
  const [ask, setAsk] = useState(false)

  useEffect(() => {
    hydrateConsent()
    const sync = () => setAsk(shouldAskConsent())
    sync()
    return subscribeConsent(sync)
  }, [])

  if (!ask) return null

  return (
    <div className="ad-consent" role="dialog" aria-label="Ad preferences">
      <div className="ad-consent__inner">
        <p className="ad-consent__text">
          We use ad partners who may set cookies. Nothing loads until you choose.{' '}
          <Link href="/privacy" className="underline decoration-dotted">
            Details
          </Link>
        </p>
        <div className="ad-consent__actions">
          <button type="button" className="ad-consent__reject" onClick={() => setConsent('denied')}>
            Reject
          </button>
          <button type="button" className="ad-consent__accept" onClick={() => setConsent('granted')}>
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
