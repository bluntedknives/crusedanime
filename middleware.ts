import { NextResponse, type NextRequest } from 'next/server'
import { COVER_COOKIE, ITEM_PATH, VIEWER_PATH } from './lib/cover'

/**
 * Route cover.
 *
 * While the `cover` cookie is set the content-bearing routes are served under
 * neutral prefixes, so the address bar, history, bookmarks and referrers never
 * carry a content-bearing path.
 *
 * Two prefix pairs are in play and must not be confused:
 *   - `/item/*`, `/view/*`              the *covered* prefixes the browser asks for
 *   - `/anime/*`, `/movies/*`, `/watch/*`  the real routes that render the page
 *
 * A covered prefix is rewritten onto its real route (internal, so the route
 * handlers are untouched). A direct hit on a real route is redirected to its
 * covered prefix, so the exposed path never renders.
 *
 * The catalogue is recovered from the id's sign: AniList ids are positive and
 * live under `/anime`, the film/series catalogue uses negative ids under
 * `/movies`. That is the same rule `isMovieId` applies in the app, restated here
 * because middleware runs on the edge and must not pull in the fetch-heavy
 * catalogue modules.
 */
const COVERED_ITEM_RE = /^\/item\//
const COVERED_VIEWER_RE = /^\/view\//
const REAL_ITEM_RE = /^\/(anime|movies)\//
const REAL_VIEWER_RE = /^\/watch\//

/** Which real detail route a covered `/item/<id>` belongs to. */
export function itemTarget(rest: string): string {
  const first = rest.split('/')[0]
  return first.startsWith('-') ? `/movies/${rest}` : `/anime/${rest}`
}

/** Covered prefix -> real route. The only place that knows the pairing. */
export function rewritePath(pathname: string): string | null {
  const rest = pathname.slice(pathname.indexOf('/', 1) + 1)
  if (COVERED_ITEM_RE.test(pathname)) return itemTarget(rest)
  if (COVERED_VIEWER_RE.test(pathname)) return `/watch/${rest}`
  return null
}

export function middleware(req: NextRequest) {
  if (req.cookies.get(COVER_COOKIE)?.value !== '1') return NextResponse.next()

  const { pathname } = req.nextUrl
  const url = req.nextUrl.clone()

  const target = rewritePath(pathname)
  if (target) {
    url.pathname = target
    const res = NextResponse.rewrite(url)
    res.headers.set('x-cover', 'active')
    return res
  }

  // A real route reached while covered: send the browser to the covered prefix,
  // preserving which catalogue it belonged to by the id's sign.
  if (REAL_ITEM_RE.test(pathname)) {
    url.pathname = `/${ITEM_PATH}/` + pathname.replace(REAL_ITEM_RE, '')
    return NextResponse.redirect(url)
  }
  if (REAL_VIEWER_RE.test(pathname)) {
    url.pathname = '/' + pathname.replace(REAL_VIEWER_RE, `${VIEWER_PATH}/`)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/anime/:path*', '/movies/:path*', '/watch/:path*', '/item/:path*', '/view/:path*'],
}
