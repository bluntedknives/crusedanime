'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Hls from 'hls.js'
import { formatTime, usePrefs, useProgress } from '@/lib/store'

export interface PlayerSource {
  url: string
  quality: string
  isM3U8: boolean
}

export interface PlayerSubtitle {
  url: string
  lang: string
  label: string
  default?: boolean
}

export interface PlayerPayload {
  provider: string
  sources: PlayerSource[]
  subtitles: PlayerSubtitle[]
  intro?: { start: number; end: number } | null
  outro?: { start: number; end: number } | null
}

interface Props {
  animeId: number
  animeTitle: string
  poster: string
  totalEpisodes: number | null
  episode: number
  type: 'sub' | 'dub'
  payload: PlayerPayload | null
  loading: boolean
  error: string | null
  onRetry?: () => void
}

export default function Player({
  animeId,
  animeTitle,
  poster,
  totalEpisodes,
  episode,
  type,
  payload,
  loading,
  error,
  onRetry,
}: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const { save, get } = useProgress()
  const { prefs, update } = usePrefs()

  const [levels, setLevels] = useState<{ index: number; label: string }[]>([])
  const [currentLevel, setCurrentLevel] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [subtitleIdx, setSubtitleIdx] = useState(-1)
  const [showSubs, setShowSubs] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [resumed, setResumed] = useState(false)
  const [rate, setRate] = useState(1)
  const [skipToast, setSkipToast] = useState<string | null>(null)

  const saved = useMemo(() => get(animeId, type), [get, animeId, type])

  const hasNext = totalEpisodes == null ? true : episode < totalEpisodes
  const hasPrev = episode > 1
  const nextHref = hasNext ? `/watch/${animeId}/${episode + 1}${type === 'dub' ? '?type=dub' : ''}` : null
  const prevHref = hasPrev ? `/watch/${animeId}/${episode - 1}${type === 'dub' ? '?type=dub' : ''}` : null

  const activeSource = useMemo(() => {
    if (!payload?.sources?.length) return null
    // Prefer an explicit high/1080p rendition, otherwise the first entry.
    const byQuality = [...payload.sources].sort((a, b) => {
      const rank = (q: string) =>
        /2160|4k/i.test(q) ? 4 : /1080/i.test(q) ? 3 : /720/i.test(q) ? 2 : /480/i.test(q) ? 1 : 0
      return rank(b.quality) - rank(a.quality)
    })
    return byQuality[0]
  }, [payload])

  /* ------------------------------------------------------------- playback */

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeSource) return

    setLevels([])
    setCurrentLevel(-1)
    setResumed(false)

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const src = activeSource.url

    // Native HLS (Safari/iOS) takes the URL directly.
    if (video.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
      video.src = src
      return
    }

    if (!Hls.isSupported()) {
      video.src = src
      return
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      maxBufferLength: 30,
      manifestLoadingTimeOut: 20_000,
      manifestLoadingMaxRetry: 4,
      fragLoadingMaxRetry: 6,
      xhrSetup: (xhr) => {
        xhr.withCredentials = false
      },
    })
    hlsRef.current = hls

    hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
      const lvls = data.levels.map((l, i) => ({
        index: i,
        label: l.height ? `${l.height}p` : `${Math.round((l.bitrate ?? 0) / 1000)}kbps`,
      }))
      setLevels(lvls)
      setCurrentLevel(hls.currentLevel)
    })

    hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => setCurrentLevel(data.level))

    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad()
          break
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError()
          break
        default:
          hls.destroy()
          hlsRef.current = null
          break
      }
    })

    hls.loadSource(src)
    hls.attachMedia(video)

    return () => {
      hls.destroy()
      hlsRef.current = null
    }
  }, [activeSource])

  // Resume from the stored position once metadata is known.
  useEffect(() => {
    const video = videoRef.current
    if (!video || resumed || !saved || saved.episode !== episode) return
    const onMeta = () => {
      if (saved.position > 5 && saved.position < (video.duration || Infinity) - 10) {
        video.currentTime = saved.position
        setSkipToast(`Resumed from ${formatTime(saved.position)}`)
        setTimeout(() => setSkipToast(null), 2600)
      }
      setResumed(true)
    }
    video.addEventListener('loadedmetadata', onMeta, { once: true })
    return () => video.removeEventListener('loadedmetadata', onMeta)
  }, [saved, episode, resumed])

  // Autoplay once the manifest is ready and the user allows it.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeSource) return
    const tryPlay = () => {
      if (!prefs.autoPlay) return
      video.play().catch(() => {
        /* autoplay blocked; user will press play */
      })
    }
    video.addEventListener('canplay', tryPlay, { once: true })
    return () => video.removeEventListener('canplay', tryPlay)
  }, [activeSource, prefs.autoPlay])

  /* -------------------------------------------------------- progress save */

  const persist = useCallback(
    (position: number, dur: number, force = false) => {
      if (!dur || Number.isNaN(dur)) return
      if (!force && position < 1) return
      save({
        animeId,
        episode,
        position,
        duration: dur,
        title: animeTitle,
        poster,
        totalEpisodes,
        type,
      })
    },
    [animeId, episode, animeTitle, poster, totalEpisodes, type, save],
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTime = () => {
      setTime(video.currentTime)
      if (video.buffered.length) {
        setBuffered(video.buffered.end(video.buffered.length - 1))
      }
    }
    const onDur = () => setDuration(video.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => {
      setPlaying(false)
      persist(video.currentTime, video.duration)
    }
    const onEnded = () => {
      setPlaying(false)
      persist(video.duration, video.duration, true)
      if (prefs.autoNext && nextHref) {
        setSkipToast('Up next…')
        setTimeout(() => router.push(nextHref), 1200)
      }
    }
    const onVolume = () => {
      setVolume(video.volume)
      setMuted(video.muted)
    }

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('durationchange', onDur)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    video.addEventListener('volumechange', onVolume)

    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('durationchange', onDur)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('volumechange', onVolume)
    }
  }, [persist, prefs.autoNext, nextHref, router])

  // Periodic checkpoint so a tab close does not lose more than ~5s.
  useEffect(() => {
    const t = setInterval(() => {
      const v = videoRef.current
      if (v && !v.paused) persist(v.currentTime, v.duration)
    }, 5000)
    return () => clearInterval(t)
  }, [persist])

  // Flush on navigation away / tab hide.
  useEffect(() => {
    const flush = () => {
      const v = videoRef.current
      if (v) persist(v.currentTime, v.duration, true)
    }
    const onVis = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [persist])

  /* ------------------------------------------------------------- controls */

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  const seekTo = (t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(t, v.duration || t))
    setTime(v.currentTime)
  }

  const skipBy = (delta: number) => seekTo((videoRef.current?.currentTime ?? 0) + delta)

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const changeVolume = (val: number) => {
    const v = videoRef.current
    if (!v) return
    v.volume = val
    v.muted = val === 0
    setVolume(val)
    setMuted(val === 0)
  }

  const toggleFullscreen = () => {
    const el = shellRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen().catch(() => {})
  }

  const changeRate = (r: number) => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = r
    setRate(r)
  }

  const applySubtitle = (idx: number) => {
    const v = videoRef.current
    if (!v) return
    setSubtitleIdx(idx)
    const tracks = v.textTracks
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = i === idx && showSubs ? 'showing' : 'disabled'
    }
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const tracks = v.textTracks
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = i === subtitleIdx && showSubs ? 'showing' : 'disabled'
    }
  }, [subtitleIdx, showSubs, payload])

  const skipIntro = () => {
    if (payload?.intro?.end) seekTo(payload.intro.end)
    else skipBy(85)
  }

  const skipOutro = () => {
    if (payload?.outro?.start) seekTo(payload.outro.start)
    else seekTo((duration || 0) - 5)
  }

  // Keyboard shortcuts, disabled while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          skipBy(5)
          break
        case 'ArrowLeft':
          e.preventDefault()
          skipBy(-5)
          break
        case 'j':
          skipBy(-10)
          break
        case 'l':
          skipBy(10)
          break
        case 'm':
          toggleMute()
          break
        case 'f':
          toggleFullscreen()
          break
        case 'n':
          if (nextHref) router.push(nextHref)
          break
        case 'p':
          if (prevHref) router.push(prevHref)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextHref, prevHref, duration, showSubs, subtitleIdx, muted])

  const pct = duration ? (time / duration) * 100 : 0

  /* --------------------------------------------------------------- render */

  if (loading) {
    return (
      <div className="aspect-video w-full animate-pulse rounded-xl bg-ink-800">
        <div className="grid h-full place-items-center text-sm text-zinc-400">
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" />
            </svg>
            Resolving stream…
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-red-500/20 bg-ink-850">
        <div className="grid h-full place-items-center p-6 text-center">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-red-300">Could not resolve this stream</p>
            <p className="mt-2 break-words text-xs leading-relaxed text-zinc-400">{error}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={onRetry} className="btn-primary">
                Try again
              </button>
              {hasPrev && (
                <Link href={prevHref!} className="btn-ghost">
                  Previous episode
                </Link>
              )}
              {hasNext && (
                <Link href={nextHref!} className="btn-ghost">
                  Next episode
                </Link>
              )}
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              Providers rotate their players often. Retrying usually picks a different server.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!payload || !activeSource) {
    return (
      <div className="aspect-video w-full rounded-xl border border-white/5 bg-ink-850">
        <div className="grid h-full place-items-center text-sm text-zinc-400">
          No sources returned for this episode.
        </div>
      </div>
    )
  }

  return (
    <div ref={shellRef} className="group relative overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        poster={poster || undefined}
        playsInline
        controls={false}
        className="aspect-video w-full bg-black"
        onClick={togglePlay}
        crossOrigin="anonymous"
      >
        {payload.subtitles.map((s, i) => (
          <track
            key={`${s.url}-${i}`}
            kind="subtitles"
            src={s.url}
            srcLang={s.lang.slice(0, 3).toLowerCase() || `s${i}`}
            label={s.label}
            default={s.default || (i === 0 && subtitleIdx === -1)}
          />
        ))}
      </video>

      {skipToast && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
          {skipToast}
        </div>
      )}

      {/* centre play affordance */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 grid place-items-center bg-black/25 transition hover:bg-black/35"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand/95 text-white shadow-2xl">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pb-3 pt-10 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <div className="mb-2 flex items-center gap-3">
          <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-zinc-300">
            {formatTime(time)}
          </span>
          <div
            className="group/seek relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              seekTo(((e.clientX - rect.left) / rect.width) * (duration || 0))
            }}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 transition group-hover/seek:opacity-100"
              style={{ left: `calc(${pct}% - 6px)` }}
            />
          </div>
          <span className="w-12 shrink-0 text-[11px] tabular-nums text-zinc-400">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={togglePlay} className="btn-subtle px-2" aria-label="Play/pause">
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button type="button" onClick={() => skipBy(-10)} className="btn-subtle px-2 text-xs" aria-label="Back 10 seconds">
            −10s
          </button>
          <button type="button" onClick={() => skipBy(10)} className="btn-subtle px-2 text-xs" aria-label="Forward 10 seconds">
            +10s
          </button>

          <div className="flex items-center gap-1.5">
            <button type="button" onClick={toggleMute} className="btn-subtle px-2" aria-label="Mute">
              {muted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 9v6h4l5 4V5L8 9H4z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="h-1 w-20 accent-brand"
              aria-label="Volume"
            />
          </div>

          {(payload.intro || payload.outro) && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={skipIntro} className="btn-subtle px-2 text-xs">
                Skip intro
              </button>
              <button type="button" onClick={skipOutro} className="btn-subtle px-2 text-xs">
                Skip outro
              </button>
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={rate}
              onChange={(e) => changeRate(Number(e.target.value))}
              className="rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[11px] text-zinc-200"
              aria-label="Playback speed"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>

            {levels.length > 1 && (
              <select
                value={currentLevel}
                onChange={(e) => {
                  const idx = Number(e.target.value)
                  if (hlsRef.current) hlsRef.current.currentLevel = idx
                  setCurrentLevel(idx)
                }}
                className="rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[11px] text-zinc-200"
                aria-label="Quality"
              >
                <option value={-1}>Auto</option>
                {levels.map((l) => (
                  <option key={l.index} value={l.index}>
                    {l.label}
                  </option>
                ))}
              </select>
            )}

            {payload.subtitles.length > 0 && (
              <div className="flex items-center gap-1">
                <select
                  value={subtitleIdx}
                  onChange={(e) => applySubtitle(Number(e.target.value))}
                  className="max-w-[150px] rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[11px] text-zinc-200"
                  aria-label="Subtitles"
                >
                  <option value={-1}>Subtitles off</option>
                  {payload.subtitles.map((s, i) => (
                    <option key={`${s.label}-${i}`} value={i}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSubs((v) => !v)}
                  className={['btn-subtle px-2 text-[11px]', showSubs ? 'text-brand-soft' : ''].join(' ')}
                  title="Toggle subtitle rendering"
                >
                  CC
                </button>
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => prevHref && router.push(prevHref)}
                className="btn-subtle px-2 text-xs disabled:opacity-40"
                title="Previous episode (p)"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => nextHref && router.push(nextHref)}
                className="btn-subtle px-2 text-xs disabled:opacity-40"
                title="Next episode (n)"
              >
                Next
              </button>
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn-subtle px-2"
              aria-label="Fullscreen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {fullscreen ? (
                  <path d="M9 3H5v4M15 3h4v4M15 21h4v-4M9 21H5v-4" />
                ) : (
                  <path d="M4 9V4h5M20 9V4h-5M20 15v5h-5M4 15v5h5" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
          <span className="truncate">
            EP {episode} · {animeTitle}
          </span>
          <span className="truncate">
            {payload.provider} · {activeSource.quality} ·{' '}
            <button
              type="button"
              className="underline decoration-dotted hover:text-zinc-300"
              onClick={() => update({ preferredType: type === 'sub' ? 'dub' : 'sub' })}
            >
              {type}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
