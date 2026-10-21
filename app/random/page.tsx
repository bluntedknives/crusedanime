import { redirect } from 'next/navigation'
import * as data from '@/lib/data'

// Must never be cached, or every visit would land on the same title.
export const dynamic = 'force-dynamic'

function pickRandom<T>(list: T[]): T | null {
  if (!list.length) return null
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * Surprise-me route. Pulls a few pools in parallel and redirects straight to
 * a detail page, so the URL can be used as a bookmark or nav target.
 */
export default async function RandomPage() {
  const [trend, top, pop] = await Promise.all([
    data.trending(1, 50),
    data.topRated(1, 50),
    data.popular(1, 50),
  ])

  const pool = [...trend.data, ...top.data, ...pop.data]
  const choice = pickRandom(pool)

  if (!choice) redirect('/')
  redirect(`/anime/${choice.id}`)
}
