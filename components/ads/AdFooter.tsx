'use client'

import SmartLink from './SmartLink'

/** A single slot above the footer. Out of the way, never sticky. */
export default function AdFooter() {
  return <SmartLink slot="footer" className="mt-10 max-w-xl" headline="Sponsored offer" body="Shown once per page." />
}
