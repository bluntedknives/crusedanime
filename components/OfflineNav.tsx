'use client'

import { useEffect } from 'react'

/**
 * Make in-app links work with no connection.
 *
 * Next.js `<Link>` navigates by fetching an RSC payload for the target route.
 * That fetch needs the server, so offline it fails and the tap does nothing —
 * even though the destination page is sitting in the service-worker cache and a
 * plain document load would have rendered it.
 *
 * So while offline this turns a same-origin link tap into a real navigation.
 * The browser requests the document, the worker answers from the page cache,
 * and the route renders. When online, nothing here runs and client-side
 * navigation is untouched.
 */
export default function OfflineNav() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (navigator.onLine) return
      if (event.defaultPrevented) return
      // A modified click is a deliberate new tab/window; let the browser handle
      // it rather than hijacking it into the current document.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (event.button !== 0) return

      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return
      // Hash-only links (in-page anchors) are not navigations.
      if (href.startsWith('#')) return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      // Same page, differing only by hash: let the browser scroll.
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      window.location.assign(url.href)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
