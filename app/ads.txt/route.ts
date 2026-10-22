import { NextResponse } from 'next/server'

/**
 * ads.txt, generated from the environment.
 *
 * This file is how a buyer confirms that this site is authorised to sell its
 * inventory, and a missing or wrong entry is a common cause of silent unfill —
 * demand simply refuses to bid. Generating it from the same env vars the
 * adapters use means the two can never disagree.
 *
 * Served as text/plain at /ads.txt so crawlers read it correctly.
 */
export const dynamic = 'force-static'

export function GET() {
  const lines: string[] = [
    '# ads.txt — authorised digital sellers',
    '# Generated from environment. See config/ads.ts for the matching slots.',
  ]

  const pub = process.env.NEXT_PUBLIC_ADS_ADSENSE_CLIENT
  if (pub) {
    // AdSense's seller id is the publisher id without the `ca-` prefix.
    const seller = pub.replace(/^ca-/, '')
    lines.push(`google.com, ${seller}, DIRECT, f08c47fec0942fa0`)
  }

  const ezoic = process.env.NEXT_PUBLIC_ADS_EZOIC_SITE
  if (ezoic) {
    lines.push(`ezoic.com, ${ezoic}, DIRECT`)
    lines.push('google.com, pub-0000000000000000, RESELLER, f08c47fec0942fa0')
  }

  const adsterra = process.env.NEXT_PUBLIC_ADS_ADSTERRA_KEY
  if (adsterra) {
    lines.push('# Adsterra — confirm the seller account id in the Adsterra dashboard')
    lines.push(`adsterra.com, ${adsterra}, DIRECT`)
  }

  const monetag = process.env.NEXT_PUBLIC_ADS_MONETAG_ZONE
  if (monetag) lines.push(`monetag.com, ${monetag}, DIRECT`)

  const propeller = process.env.NEXT_PUBLIC_ADS_PROPELLER_ZONE
  if (propeller) lines.push(`propellerads.com, ${propeller}, DIRECT`)

  if (lines.length === 2) {
    lines.push('# No networks configured — nothing to authorise yet.')
  }

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
