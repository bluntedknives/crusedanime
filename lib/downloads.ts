'use client'

/**
 * Offline downloads.
 *
 * An episode is downloaded by walking its HLS tree through the existing
 * `/api/hls` tunnel — the same route the player streams from — and storing the
 * playlist and segment bytes in Cache Storage under a synthetic same-origin
 * path, `/__dl/<key>/…`. The service worker answers those paths from the cache
 * alone, so a stored episode plays with no network and with the stock hls.js
 * loader: the stored playlist already points at the child URLs it needs.
 *
 * Why re-fetch in the browser rather than build the tree on the server: the CDN
 * signs every URL against the address that minted it, so a download must read
 * the tokenised manifest exactly as the player would and follow it itself. The
 * tokens it follows are the ones the player uses; no upstream URL is ever
 * needed on the client.
 *
 * Storage is Cache Storage rather than IndexedDB blobs: it streams to disk
 * without holding the whole file in memory, and it is what the service worker
 * can read directly inside a fetch handler.
 */

import { useEffect, useState } from 'react'

export type DownloadStatus = 'queued' | 'downloading' | 'ready' | 'error'

export interface DownloadSubtitle {
  url: string
  lang: string
  label: string
  default?: boolean
}

export interface DownloadMeta {
  key: string
  animeId: number
  animeTitle: string
  poster: string
  episode: number
  totalEpisodes: number | null
  type: 'sub' | 'dub'
  genres?: string[]
  status: DownloadStatus
  /** 0–1, by segment count. */
  progress: number
  /** Bytes stored so far. */
  bytes: number
  error?: string
  createdAt: number
  readyAt?: number
  /** Local playlist URL, present once ready. */
  playlist?: string
  subtitles?: DownloadSubtitle[]
  intro?: { start: number; end: number } | null
  outro?: { start: number; end: number } | null
}

export interface DownloadInput {
  animeId: number
  animeTitle: string
  poster: string
  episode: number
  totalEpisodes?: number | null
  type: 'sub' | 'dub'
  /** AniList's MAL id, needed to build the tunnel token for some providers. */
  malId?: number | null
  genres?: string[]
  intro?: { start: number; end: number } | null
  outro?: { start: number; end: number } | null
  /** Real subtitle labels from the stream payload, matched to the tunnel's tracks. */
  subtitleTracks?: { label: string; lang: string }[]
}

const DL_CACHE = 'crused-downloads-v1'
const META_KEY = 'anistream:downloads:v1'
const CONCURRENCY = 4
const FETCH_TIMEOUT_MS = 30_000

/* ---------------------------------------------------------------- storage */

function readMeta(): Record<string, DownloadMeta> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as Record<string, DownloadMeta>) : {}
  } catch {
    return {}
  }
}

let store: Record<string, DownloadMeta> = readMeta()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function persist() {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(store))
  } catch {
    /* quota or private mode: the in-memory map still works for this session */
  }
}

function setMeta(key: string, next: DownloadMeta) {
  store = { ...store, [key]: next }
  persist()
  emit()
}

function dropMeta(key: string) {
  const { [key]: _removed, ...rest } = store
  store = rest
  persist()
  emit()
}

/* ------------------------------------------------------------ identifiers */

/** Stable key for one episode's download, matching the tunnel's own keying. */
export function localKeyFor(animeId: number, episode: number, type: 'sub' | 'dub'): string {
  return `${animeId}-${episode}-${type}`
}

function playlistUrl(key: string): string {
  return `/__dl/${key}/index.m3u8`
}

function childUrl(key: string, name: string): string {
  return `/__dl/${key}/${name}`
}

/* ------------------------------------------------------------ token helpers */

interface Token {
  a: number
  e: number
  y: 'sub' | 'dub'
  m?: number | null
  k: 'p' | 's' | 't' | 'u'
  n?: number
  j?: number
  i?: number
}

/**
 * Base64url-encode a tunnel token.
 *
 * Mirrors `encodeToken` in lib/tunnel.ts. Kept as a local copy because that
 * module pulls in `node:buffer` and cannot be imported into a client bundle.
 */
function encodeToken(t: Token): string {
  return btoa(JSON.stringify(t)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenUrl(t: Token): string {
  return `/api/hls?t=${encodeToken(t)}`
}

/* ------------------------------------------------------------- fetch utils */

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw new Error('cancelled')
    try {
      const res = await fetch(url, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
          : AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`${url} -> ${res.status}`)
      return await res.text()
    } catch (err) {
      lastErr = err
      if (signal?.aborted) throw err
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  throw lastErr
}

async function cachePut(url: string, body: BodyInit, contentType: string): Promise<void> {
  const cache = await caches.open(DL_CACHE)
  await cache.put(
    url,
    new Response(body, { headers: { 'content-type': contentType } }),
  )
}

/**
 * Fetch a segment, retrying a couple of times.
 *
 * The upstream CDN intermittently returns a 502 on one segment of an otherwise
 * healthy episode. Without a retry that single blip fails the whole download,
 * which the viewer sees as a download that will not complete.
 */
async function fetchSegmentBytes(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw new Error('cancelled')
    try {
      const res = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
      })
      if (!res.ok) throw new Error(`segment -> ${res.status}`)
      return await res.arrayBuffer()
    } catch (err) {
      lastErr = err
      if (signal.aborted) throw err
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  throw lastErr
}

/** Absolute URL for a possibly-relative line in a playlist. */
function absolutise(u: string, base: string): string {
  try {
    return new URL(u, base).toString()
  } catch {
    return u
  }
}

/** Content type inferred from a media URL's extension. */
function mediaType(u: string): string {
  const path = u.split('?')[0].toLowerCase()
  if (path.endsWith('.m4s') || path.endsWith('.mp4') || path.endsWith('.m4v')) return 'video/mp4'
  if (path.endsWith('.aac')) return 'audio/aac'
  if (path.endsWith('.mp3')) return 'audio/mpeg'
  if (path.endsWith('.key')) return 'application/octet-stream'
  return 'video/mp2t'
}

/* ------------------------------------------------------------ playlist I/O */

interface SegChild {
  name: string
  url: string
  type: string
}

interface Variant {
  url: string
  bandwidth: number
  height: number
  /** Group ids from AUDIO / SUBTITLES attributes, if present. */
  audio?: string
  subtitles?: string
}

interface Rendition {
  type: string
  group: string
  url?: string
  line: string
}

/** A parsed master: its variants and its alternate renditions. */
function parseMaster(text: string, base: string): { variants: Variant[]; renditions: Rendition[] } {
  const lines = text.split('\n').map((l) => l.trim())
  const variants: Variant[] = []
  const renditions: Rendition[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('#EXT-X-MEDIA')) {
      const type = line.match(/TYPE=([A-Z]+)/)?.[1] ?? ''
      const group = line.match(/GROUP-ID="([^"]+)"/)?.[1] ?? ''
      const uri = line.match(/URI="([^"]+)"/)?.[1]
      renditions.push({ type, group, url: uri ? absolutise(uri, base) : undefined, line })
      continue
    }
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const next = lines[i + 1]
      if (!next || next.startsWith('#')) continue
      variants.push({
        url: absolutise(next, base),
        bandwidth: Number(line.match(/BANDWIDTH=(\d+)/)?.[1] ?? 0),
        height: Number(line.match(/RESOLUTION=\d+x(\d+)/)?.[1] ?? 0),
        audio: line.match(/AUDIO="([^"]+)"/)?.[1],
        subtitles: line.match(/SUBTITLES="([^"]+)"/)?.[1],
      })
    }
  }
  return { variants, renditions }
}

/**
 * Pick one video variant to store.
 *
 * Capped at 1080p: the top tier is often 4K and an order of magnitude larger,
 * a poor trade for a phone on a bus. Highest below the cap wins; if everything
 * is above it, take the smallest.
 */
function pickVariant(list: Variant[]): Variant {
  const capped = list.filter((v) => !v.height || v.height <= 1080)
  const pool = capped.length ? capped : list
  return [...pool].sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth)[0]
}

/**
 * Rewrite a *media* playlist so its segments and auxiliary URIs point at local
 * paths, returning the children to fetch.
 */
function localiseMedia(text: string, base: string, key: string): { text: string; segments: SegChild[] } {
  const segments: SegChild[] = []
  const nameByUrl = new Map<string, string>()
  let segIdx = 0
  let auxIdx = 0

  const localFor = (raw: string, isSegment: boolean): string => {
    const abs = absolutise(raw, base)
    const existing = nameByUrl.get(abs)
    if (existing) return existing
    const name = isSegment ? `seg-${String(segIdx++).padStart(5, '0')}.ts` : `aux-${auxIdx++}`
    nameByUrl.set(abs, name)
    segments.push({ name, url: abs, type: mediaType(abs) })
    return name
  }

  const out = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
          const abs = absolutise(uri, base)
          const isSeg = /\.(m4s|mp4|m4v|ts)$/i.test(abs.split('?')[0])
          return `URI="${childUrl(key, localFor(uri, isSeg))}"`
        })
      }
      return childUrl(key, localFor(trimmed, true))
    })
    .join('\n')

  return { text: out, segments }
}

/**
 * Rewrite a *master* playlist down to the chosen variant and the alternate
 * renditions it references, returning the child playlists to fetch.
 *
 * Dropping the unchosen variants is the point: storing every quality would
 * multiply the download size for no benefit. The referenced audio/subtitle
 * renditions are kept because a demuxed stream carries its audio in a separate
 * playlist — without them the stored episode would play silent.
 */
function localiseMaster(
  text: string,
  base: string,
  key: string,
  chosen: Variant,
): { text: string; playlists: { name: string; url: string }[] } {
  const playlists: { name: string; url: string }[] = []
  const { renditions } = parseMaster(text, base)
  const groups = new Set([chosen.audio, chosen.subtitles].filter(Boolean) as string[])

  const nameByUrl = new Map<string, string>()
  let idx = 0
  const localFor = (url: string): string => {
    const existing = nameByUrl.get(url)
    if (existing) return existing
    const name = `pl-${idx++}.m3u8`
    nameByUrl.set(url, name)
    playlists.push({ name, url })
    return name
  }

  const out = text
    .split('\n')
    .flatMap((line) => {
      const trimmed = line.trim()
      if (!trimmed) return []
      if (trimmed.startsWith('#EXT-X-MEDIA')) {
        const r = renditions.find((x) => x.line === trimmed)
        if (!r?.url || !groups.has(r.group)) return []
        return trimmed.replace(/URI="([^"]+)"/, `URI="${childUrl(key, localFor(r.url))}"`)
      }
      if (trimmed.startsWith('#EXT-X-STREAM-INF')) {
        // Keep only the chosen variant's header and its URI line.
        const bw = Number(trimmed.match(/BANDWIDTH=(\d+)/)?.[1] ?? 0)
        const height = Number(trimmed.match(/RESOLUTION=\d+x(\d+)/)?.[1] ?? 0)
        if (bw !== chosen.bandwidth || height !== chosen.height) return []
        return [trimmed, childUrl(key, localFor(chosen.url))]
      }
      // I-frame playlists carry their own URI and are for trick-play scrubbing,
      // not playback. Drop them: they are not stored, and their URI is a live
      // token that would fail offline.
      if (trimmed.startsWith('#EXT-X-I-FRAME-STREAM-INF')) return []
      // A bare URI is the unchosen variant's address, already handled above.
      if (!trimmed.startsWith('#')) return []
      return [trimmed]
    })
    .join('\n')

  return { text: out, playlists }
}

/* --------------------------------------------------------------- download */

const inflight = new Map<string, AbortController>()

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      await fn(items[i])
    }
  })
  await Promise.all(workers)
}

/**
 * Start (or resume) a download. Resolves once the tree is stored.
 *
 * Re-entrant by key: calling it again while one is running is a no-op, so a
 * double-tap cannot start two transfers of the same episode.
 */
export async function downloadEpisode(input: DownloadInput): Promise<void> {
  const key = localKeyFor(input.animeId, input.episode, input.type)
  const existing = store[key]
  if (existing && (existing.status === 'downloading' || existing.status === 'ready')) return

  const base: DownloadMeta = {
    key,
    animeId: input.animeId,
    animeTitle: input.animeTitle,
    poster: input.poster,
    episode: input.episode,
    totalEpisodes: input.totalEpisodes ?? null,
    type: input.type,
    genres: input.genres,
    status: 'downloading',
    progress: 0,
    bytes: 0,
    createdAt: Date.now(),
    intro: input.intro ?? null,
    outro: input.outro ?? null,
  }
  setMeta(key, base)

  const ctrl = new AbortController()
  inflight.set(key, ctrl)
  const signal = ctrl.signal

  try {
    const t: Token = { a: input.animeId, e: input.episode, y: input.type, m: input.malId ?? null, k: 'p', n: 0 }
    const masterUrl = tokenUrl(t)
    const master = await fetchText(masterUrl, signal)

    // A master playlist is stored as a master with the unchosen variants
    // removed; a bare media playlist is stored as itself. Either way the local
    // index is the one URL the player points at.
    const { variants } = parseMaster(master, masterUrl)
    const children: SegChild[] = []

    if (variants.length) {
      const chosen = pickVariant(variants)
      const { text: index, playlists } = localiseMaster(master, masterUrl, key, chosen)
      await cachePut(childUrl(key, 'index.m3u8'), index, 'application/vnd.apple.mpegurl')

      for (const pl of playlists) {
        const body = await fetchText(pl.url, signal)
        const { text, segments } = localiseMedia(body, pl.url, key)
        await cachePut(childUrl(key, pl.name), text, 'application/vnd.apple.mpegurl')
        children.push(...segments)
      }
    } else {
      const { text, segments } = localiseMedia(master, masterUrl, key)
      await cachePut(childUrl(key, 'index.m3u8'), text, 'application/vnd.apple.mpegurl')
      children.push(...segments)
    }

    let done = 0
    let bytes = 0
    const total = children.length || 1

    await runPool(children, CONCURRENCY, async (child) => {
      const buf = await fetchSegmentBytes(child.url, signal)
      bytes += buf.byteLength
      await cachePut(childUrl(key, child.name), buf, child.type)
      done += 1
      const cur = store[key]
      if (cur) setMeta(key, { ...cur, progress: done / total, bytes })
    })

    // Subtitles are best-effort: a missing track must not fail the download.
    const subtitles: DownloadSubtitle[] = []
    for (let i = 0; i < 6; i++) {
      try {
        const subT: Token = { ...t, k: 't', i }
        const text = await fetchText(tokenUrl(subT), signal)
        const name = `sub-${i}.vtt`
        await cachePut(childUrl(key, name), text, 'text/vtt; charset=utf-8')
        // The tunnel's track order matches the payload's, so the real label
        // carries over; fall back to a positional name if it does not.
        const track = input.subtitleTracks?.[i]
        subtitles.push({
          url: childUrl(key, name),
          lang: track?.lang ?? `track-${i}`,
          label: track?.label ?? `Subtitle ${i + 1}`,
        })
      } catch {
        break
      }
    }

    setMeta(key, {
      ...base,
      status: 'ready',
      progress: 1,
      bytes,
      readyAt: Date.now(),
      playlist: playlistUrl(key),
      subtitles,
    })

    // Warm the page cache so the watch route itself opens offline, and try to
    // keep the poster. Both are best-effort.
    precacheForOffline([
      `/watch/${input.animeId}/${input.episode}${input.type === 'dub' ? '?type=dub' : ''}`,
      input.poster,
    ])
  } catch (err) {
    const aborted = signal.aborted
    const cur = store[key]
    if (aborted) {
      if (cur) dropMeta(key)
      await deleteCache(key)
      return
    }
    if (cur) setMeta(key, { ...cur, status: 'error', error: err instanceof Error ? err.message : 'download failed' })
  } finally {
    inflight.delete(key)
  }
}

/** Cancel a running download and remove anything it stored. */
export async function cancelDownload(key: string): Promise<void> {
  inflight.get(key)?.abort()
  inflight.delete(key)
  dropMeta(key)
  await deleteCache(key)
}

/** Remove a finished (or failed) download and its bytes. */
export async function removeDownload(key: string): Promise<void> {
  inflight.get(key)?.abort()
  inflight.delete(key)
  dropMeta(key)
  await deleteCache(key)
}

async function deleteCache(key: string): Promise<void> {
  try {
    const cache = await caches.open(DL_CACHE)
    const keys = await cache.keys()
    await Promise.all(
      keys.filter((r) => new URL(r.url).pathname.startsWith(`/__dl/${key}/`)).map((r) => cache.delete(r)),
    )
  } catch {
    /* nothing stored, or storage unavailable */
  }
}

/**
 * Ask the service worker to cache a page so it opens offline.
 *
 * The SW's navigation branch only caches navigations it actually serves, and a
 * programmatic fetch is not one — so this posts the URL and lets the worker do
 * the fetch-and-store. No-op without a controlling worker.
 */
function precacheForOffline(urls: string[]) {
  if (typeof navigator === 'undefined') return
  navigator.serviceWorker?.controller?.postMessage({ type: 'CACHE_URLS', urls })
}

/** True when a usable download exists for this episode. */
export function hasDownload(key: string): boolean {
  return store[key]?.status === 'ready'
}

export function getDownload(key: string): DownloadMeta | undefined {
  return store[key]
}

/** Every download, newest first. */
export function listDownloads(): DownloadMeta[] {
  return Object.values(store).sort((a, b) => (b.readyAt ?? b.createdAt) - (a.readyAt ?? a.createdAt))
}

export function totalBytes(): number {
  return Object.values(store).reduce((n, d) => n + (d.bytes || 0), 0)
}

/**
 * Ask the browser to keep this storage.
 *
 * Without it the bytes are "best-effort" and the OS may evict them — most
 * aggressively on iOS — which would silently empty the downloads.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------- hook */

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function snapshot(): string {
  return JSON.stringify(store)
}

function parse(raw: string): Record<string, DownloadMeta> {
  try {
    return JSON.parse(raw) as Record<string, DownloadMeta>
  } catch {
    return {}
  }
}

/** Re-render subscribers when the download store changes. */
export function useDownloads() {
  // Always start empty so the server and the first client render agree; the
  // effect then loads the real snapshot. Reading localStorage during the
  // initial render would hydrate against different markup.
  const [raw, setRaw] = useState<string>('{}')

  useEffect(() => {
    setRaw(snapshot())
    return subscribe(() => setRaw(snapshot()))
  }, [])

  const entries = parse(raw)

  return {
    entries,
    list: Object.values(entries).sort(
      (a, b) => (b.readyAt ?? b.createdAt) - (a.readyAt ?? a.createdAt),
    ),
    get: (key: string) => entries[key],
    has: (key: string) => entries[key]?.status === 'ready',
    download: downloadEpisode,
    remove: removeDownload,
    cancel: cancelDownload,
  }
}

/** Bytes → a short human string. */
export function formatBytes(n: number): string {
  if (!n) return '0 MB'
  const mb = n / (1024 * 1024)
  if (mb < 1) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}
