'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Hls from 'hls.js'
import {
  IconCheck,
  IconFullscreen,
  IconFullscreenExit,
  IconPause,
  IconPip,
  IconPlay,
  IconRefresh,
  IconSettings,
  IconSkipBack,
  IconSkipForward,
  IconSpinner,
  IconTheater,
  IconVolume,
  IconVolumeMute,
} from './icons'
import { usePrefs, useProgress, formatTime } from '@/lib/store'

export interface PlayerSource {
  url: string
  quality: string
  isM3U8?: boolean
}

export interface PlayerSubtitle {
  url: string
  lang: string
  label: string
  default?: boolean
}

export interface PlayerPayload {
  provider?: string
  sources: PlayerSource[]
  subtitles: PlayerSubtitle[]
  intro?: { start: number; end: number } | null
  outro?: { start: number; end: number } | null
  /**
   * Provider player page. When set, the player embeds it instead of driving a
   * <video> element, because the signed stream URLs only resolve for the IP
   * that minted them and the viewer's browser is the one address that can do
   * both halves of that exchange.
   */
  embedUrl?: string | null
}

interface Props {
  animeId: number
  animeTitle: string
  poster: string
  totalEpisodes: number | null
  /** Stored with progress so the stats page can group without refetching. */
  genres?: string[]
  episode: number
  type: 'sub' | 'dub'
  payload: PlayerPayload | null
  loading: boolean
  error: string | null
  onRetry?: () => void
  /** Reports an unrecoverable playback failure so the page can show it. */
  onFatalError?: (message: string) => void
  /** Theater mode widens the player and hides the side column. */
  theater?: boolean
  onTheaterChange?: (next: boolean) => void
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

/** How long the "next episode" countdown runs before navigating. */
const AUTO_NEXT_SECONDS = 8

/**
 * Playback preferences that belong to the player rather than to one episode.
 * Position is tracked separately (lib/store progress); these are the controls a
 * viewer expects to survive a refresh: volume, mute, speed, chosen quality and
 * chosen subtitle language.
 */
const PS_KEY = 'anistream:player:state:v1'

interface PersistedPlayer {
  volume: number
  muted: boolean
  rate: number
  /** Level label like "1080p"; null means auto. */
  quality: string | null
  /** Subtitle language tag, e.g. "en"; null means auto. */
  subtitleLang: string | null
}

const DEFAULT_PS: PersistedPlayer = {
  volume: 1,
  muted: false,
  rate: 1,
  quality: null,
  subtitleLang: null,
}

function readPS(): PersistedPlayer {
  if (typeof window === 'undefined') return DEFAULT_PS
  try {
    const raw = window.localStorage.getItem(PS_KEY)
    if (!raw) return DEFAULT_PS
    return { ...DEFAULT_PS, ...(JSON.parse(raw) as Partial<PersistedPlayer>) }
  } catch {
    return DEFAULT_PS
  }
}

function writePS(patch: Partial<PersistedPlayer>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PS_KEY, JSON.stringify({ ...readPS(), ...patch }))
  } catch {
    /* quota or private mode: ignore */
  }
}

export default function Player({
  animeId,
  animeTitle,
  poster,
  totalEpisodes,
  genres,
  episode,
  type,
  payload,
  loading,
  error,
  onRetry,
  onFatalError,
  theater = false,
  onTheaterChange,
}: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  /** Fatal network retries spent for the current source, so the loop is bounded. */
  const networkRetries = useRef(0)
  /**
   * Set when the proxied source fails unrecoverably, to switch to the
   * provider's own player page. Reset whenever the episode or source changes.
   */
  const [embedFallback, setEmbedFallback] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { save, get } = useProgress()
  const { prefs, update } = usePrefs()

  const [levels, setLevels] = useState<{ index: number; label: string }[]>([])
  const [currentLevel, setCurrentLevel] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  /*
   * The <video> element is replaced by the loading/error branch, so a plain
   * ref can be null on the render where the listener effect first runs and
   * never re-runs (its deps do not include the element). Holding the node in
   * state makes the effect re-attach whenever the element actually mounts.
   */
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)

  // Stable identity: an inline arrow would be re-attached on every render,
  // which detaches the element (null) and re-attaches it in a loop.
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    setVideoEl(node)
  }, [])
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [subtitleIdx, setSubtitleIdx] = useState(-1)
  const [showSubs, setShowSubs] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [resumed, setResumed] = useState(false)
  const [rate, setRate] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [uiVisible, setUiVisible] = useState(true)
  const [waiting, setWaiting] = useState(false)
  const [inPip, setInPip] = useState(false)
  /** Seconds until the next episode starts; null when not counting down. */
  const [nextIn, setNextIn] = useState<number | null>(null)
  const autoNextTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const saved = useMemo(() => get(animeId, type), [get, animeId, type])

  const hasNext = totalEpisodes == null ? true : episode < totalEpisodes
  const hasPrev = episode > 1
  const nextHref = hasNext ? `/watch/${animeId}/${episode + 1}${type === 'dub' ? '?type=dub' : ''}` : null
  const prevHref = hasPrev ? `/watch/${animeId}/${episode - 1}${type === 'dub' ? '?type=dub' : ''}` : null

  const activeSource = useMemo(() => {
    if (!payload?.sources?.length) return null
    const rank = (q: string) =>
      /2160|4k/i.test(q) ? 4 : /1080/i.test(q) ? 3 : /720/i.test(q) ? 2 : /480/i.test(q) ? 1 : 0
    return [...payload.sources].sort((a, b) => rank(b.quality) - rank(a.quality))[0]
  }, [payload])

  /**
   * Probe the proxied source before handing it to hls.js.
   *
   * hls.js treats a rejected manifest as a retryable network error, so letting
   * it discover the failure costs several timed retries of spinner. A single
   * request answers the same question immediately, which is what makes the
   * switch to the embedded player feel instant instead of broken.
   */
  useEffect(() => {
    if (!payload?.embedUrl || !activeSource?.url) return
    const ctrl = new AbortController()
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(activeSource.url, { signal: ctrl.signal })
        // Consume/cancel the body: only the status matters here, and a playlist
        // is small enough that leaving it unread would leak a connection.
        await res.body?.cancel().catch(() => {})
        if (!res.ok && !cancelled) setEmbedFallback(true)
      } catch {
        // Network failure or abort; hls.js gets its own attempt either way.
      }
    })()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [payload?.embedUrl, activeSource?.url])

  const flash = useCallback((msg: string, ms = 1600) => {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }, [])

  /*
   * Restore volume/mute/speed. Deliberately an effect rather than a lazy
   * useState initialiser: reading localStorage during render would make the
   * server and client disagree and trip hydration.
   */
  useEffect(() => {
    const v = videoEl
    if (!v) return
    const ps = readPS()
    v.volume = ps.volume
    v.muted = ps.muted
    v.playbackRate = ps.rate
    setVolume(ps.volume)
    setMuted(ps.muted)
    setRate(ps.rate)
  }, [videoEl])

  /* --------------------------------------------------- auto-next countdown */

  const cancelAutoNext = useCallback(() => {
    if (autoNextTimer.current) clearInterval(autoNextTimer.current)
    autoNextTimer.current = null
    setNextIn(null)
  }, [])

  const startAutoNext = useCallback(() => {
    if (!nextHref) return
    cancelAutoNext()
    setNextIn(AUTO_NEXT_SECONDS)
  }, [nextHref, cancelAutoNext])

  // Drive the countdown; navigation happens in the effect so the interval never
  // performs a side effect from inside a state updater.
  useEffect(() => {
    if (nextIn === null) return
    if (nextIn <= 0) {
      setNextIn(null)
      if (nextHref) router.push(nextHref)
      return
    }
    const t = setTimeout(() => setNextIn((n) => (n === null ? null : n - 1)), 1000)
    return () => clearTimeout(t)
  }, [nextIn, nextHref, router])

  useEffect(() => cancelAutoNext, [cancelAutoNext])

  /* ------------------------------------------------------------- playback */

  useEffect(() => {
    const video = videoEl
    if (!video || !activeSource) return

    setLevels([])
    setCurrentLevel(-1)
    setResumed(false)
    networkRetries.current = 0

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const src = activeSource.url

    // A progressive file (the public-domain film source) must be handed to the
    // element directly. Feeding it to hls.js fails, because there is no
    // manifest to parse. `isM3U8 === false` is explicit; undefined keeps the
    // anime path, where every source is HLS.
    if (activeSource.isM3U8 === false) {
      video.src = src
      return
    }

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

      // Honour a previously chosen quality if it is still offered.
      const want = readPS().quality
      const match = want ? lvls.find((l) => l.label === want) : null
      if (match) hls.currentLevel = match.index
      setCurrentLevel(hls.currentLevel)
    })

    hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => setCurrentLevel(data.level))

    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return
      // Retrying a fatal network error forever is what turned an upstream 400
      // into an endless spinner: `startLoad()` re-requests the same rejected
      // URL and the UI never hears about it. Give it one retry, then switch to
      // the provider's own player, which fetches from the viewer's IP and so
      // is not subject to the rejection. Only report an error if there is no
      // embed to fall back to.
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        networkRetries.current += 1
        if (networkRetries.current <= 1) {
          hls.startLoad()
          return
        }
        hls.destroy()
        hlsRef.current = null
        if (payload?.embedUrl) {
          setEmbedFallback(true)
          return
        }
        onFatalError?.('This episode could not be played — the stream source refused the request.')
        return
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError()
        return
      }
      hls.destroy()
      hlsRef.current = null
      if (payload?.embedUrl) {
        setEmbedFallback(true)
        return
      }
      onFatalError?.('This episode could not be played.')
    })

    hls.loadSource(src)
    hls.attachMedia(video)

    return () => {
      hls.destroy()
      hlsRef.current = null
    }
  }, [activeSource, videoEl, payload?.embedUrl])

  // A new episode or source gets a fresh attempt at the native player before
  // falling back, so one bad episode does not pin the whole session to a frame.
  useEffect(() => {
    setEmbedFallback(false)
  }, [episode, activeSource?.url])

  // Resume from the stored position once metadata is known.
  useEffect(() => {
    const video = videoEl
    if (!video || resumed || !saved || saved.episode !== episode) return
    const onMeta = () => {
      if (saved.position > 5 && saved.position < (video.duration || Infinity) - 10) {
        video.currentTime = saved.position
        flash(`Resumed from ${formatTime(saved.position)}`, 2600)
      }
      setResumed(true)
    }
    video.addEventListener('loadedmetadata', onMeta, { once: true })
    return () => video.removeEventListener('loadedmetadata', onMeta)
  }, [videoEl, saved, episode, resumed, flash])

  // Autoplay once the manifest is ready, unless the user disabled it.
  useEffect(() => {
    const video = videoEl
    if (!video || !activeSource) return
    const tryPlay = () => {
      if (!prefs.autoPlay) return
      video.play().catch(() => {
        /* autoplay blocked; the centre play button remains */
      })
    }
    video.addEventListener('canplay', tryPlay, { once: true })
    return () => video.removeEventListener('canplay', tryPlay)
  }, [videoEl, activeSource, prefs.autoPlay])

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
        genres,
      })
    },
    [animeId, episode, animeTitle, poster, totalEpisodes, genres, type, save],
  )

  useEffect(() => {
    const video = videoEl
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
      // Count down visibly so a viewer can cancel; navigating straight away
      // gave them no chance to stop it.
      if (prefs.autoNext && nextHref) startAutoNext()
    }
    const onVolume = () => {
      setVolume(video.volume)
      setMuted(video.muted)
    }
    const onWaiting = () => setWaiting(true)
    const onPlaying = () => setWaiting(false)

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('durationchange', onDur)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    video.addEventListener('volumechange', onVolume)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)

    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('durationchange', onDur)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('volumechange', onVolume)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
    }
  }, [videoEl, persist, prefs.autoNext, nextHref, startAutoNext])

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

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onEnter = () => setInPip(true)
    const onLeave = () => setInPip(false)
    v.addEventListener('enterpictureinpicture', onEnter)
    v.addEventListener('leavepictureinpicture', onLeave)
    return () => {
      v.removeEventListener('enterpictureinpicture', onEnter)
      v.removeEventListener('leavepictureinpicture', onLeave)
    }
  }, [])

  // Auto-skip the intro when the preference is on and a marker exists.
  useEffect(() => {
    if (!prefs.skipIntro) return
    const intro = payload?.intro
    if (!intro) return
    if (time >= intro.start && time < intro.end - 1) {
      const v = videoRef.current
      if (v) {
        v.currentTime = intro.end
        flash('Skipped intro')
      }
    }
    // Only re-evaluate as time advances; the marker objects are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, prefs.skipIntro, payload?.intro])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [])

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(t, v.duration || t))
    setTime(v.currentTime)
  }, [])

  const skipBy = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    seekTo(v.currentTime + delta)
  }, [seekTo])

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    writePS({ muted: v.muted })
  }

  const changeVolume = (val: number) => {
    const v = videoRef.current
    if (!v) return
    v.volume = val
    v.muted = val === 0
    setVolume(val)
    setMuted(val === 0)
    writePS({ volume: val, muted: val === 0 })
  }

  const toggleTheater = () => onTheaterChange?.(!theater)

  const toggleFullscreen = () => {
    const el = shellRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen().catch(() => {})
  }

  const togglePip = async () => {
    const v = videoRef.current
    if (!v) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await v.requestPictureInPicture()
    } catch {
      flash('Picture-in-picture unavailable')
    }
  }

  const changeRate = (r: number) => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = r
    setRate(r)
    writePS({ rate: r })
  }

  const selectLevel = (i: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = i
    setCurrentLevel(i)
    const lvl = levels.find((l) => l.index === i)
    if (lvl) writePS({ quality: lvl.label })
  }

  const skipIntro = () => {
    if (payload?.intro?.end) {
      seekTo(payload.intro.end)
      flash('Skipped intro')
    }
  }

  const skipOutro = () => {
    if (payload?.outro?.end) {
      seekTo(payload.outro.end)
      flash('Skipped outro')
    }
  }

  // Apply the subtitle preference when a new track list arrives.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const tracks = v.textTracks
    if (!tracks?.length) return
    // Restore the saved language, matched by tag rather than index: a different
    // provider returns its tracks in a different order.
    const wantLang = readPS().subtitleLang
    let idx = subtitleIdx
    if (idx < 0 && wantLang && payload?.subtitles) {
      const found = payload.subtitles.findIndex((s) => s.lang === wantLang)
      if (found >= 0) {
        idx = found
        setSubtitleIdx(found)
      }
    }

    const on = prefs.subtitlesOn && showSubs
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = on && i === (idx < 0 ? 0 : idx) ? 'showing' : 'disabled'
    }
    if (on && idx < 0) setSubtitleIdx(0)
  }, [payload, prefs.subtitlesOn, showSubs, subtitleIdx])

  // Show intro/outro skip prompts based on the current position.
  const introActive =
    !!payload?.intro && time >= payload.intro.start && time < payload.intro.end - 0.5
  const outroActive =
    !!payload?.outro && time >= payload.outro.start && time < payload.outro.end - 0.5

  /* ----------------------------------------------------------- ui chrome */

  const wake = useCallback(() => {
    setUiVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setUiVisible(false), 2800)
  }, [])

  useEffect(() => {
    wake()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [wake])

  // Keyboard shortcuts, scoped to the player shell.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          wake()
          break
        case 'arrowright':
          e.preventDefault()
          skipBy(5)
          flash('+5s', 700)
          wake()
          break
        case 'arrowleft':
          e.preventDefault()
          skipBy(-5)
          flash('−5s', 700)
          wake()
          break
        case 'arrowup':
          e.preventDefault()
          changeVolume(Math.min(1, (videoRef.current?.volume ?? 1) + 0.05))
          wake()
          break
        case 'arrowdown':
          e.preventDefault()
          changeVolume(Math.max(0, (videoRef.current?.volume ?? 1) - 0.05))
          wake()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          wake()
          break
        case 'p':
          e.preventDefault()
          void togglePip()
          break
        case 't':
          e.preventDefault()
          toggleTheater()
          break
        case 'n':
          if (nextHref) router.push(nextHref)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePlay, skipBy, wake, nextHref, router])

  const pct = duration ? (time / duration) * 100 : 0

  /* ------------------------------------------------------------- render */

  /*
   * Embedded player.
   *
   * The upstream CDN signs every playlist and segment URL against the address
   * that requested it. A serverless proxy mints on one request and fetches on
   * another, from a different egress IP, so the CDN rejects it with 400 — which
   * is what made playback hang. The provider's own page, loaded in an iframe,
   * does the whole exchange from the viewer's single client IP, so it works
   * where the proxy cannot.
   *
   * This is the fallback rather than the default: a cross-origin frame gives up
   * native controls, subtitle tracks and intro/outro skipping, so it is only
   * used when the proxied source cannot play.
   */
  if (payload?.embedUrl && (embedFallback || !activeSource)) {
    return (
      <div
        ref={shellRef}
        className={[
          'group/shell relative mx-auto overflow-hidden rounded-[var(--radius-xl)] border border-white/[0.06] bg-black',
          theater
            ? 'w-full max-w-[min(100%,calc((100vh-9rem)*1.7778))]'
            : 'w-full max-w-[min(100%,calc(100dvh-16rem))] lg:max-w-[min(100%,calc((100dvh-7.9rem)*1.7778))]',
        ].join(' ')}
      >
        <iframe
          src={payload.embedUrl}
          title={animeTitle}
          className="aspect-video w-full bg-black"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          // The provider page checks the Referer, so send the origin rather
          // than nothing. `no-referrer` makes the embed 404.
          referrerPolicy="origin"
        />
        {/* The frame is cross-origin, so its own control bar is out of reach.
            These are the episode-level controls that still work. */}
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500">
            Episode {episode}
            {payload.provider ? ` · ${payload.provider.replace(':embed', '')}` : ''}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheater}
              className="btn-ghost h-8 px-2.5 text-[11px]"
              title="Toggle theater mode"
            >
              <IconTheater size={14} />
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="btn-ghost h-8 px-2.5 text-[11px]"
                title="Reload the player"
              >
                <IconRefresh size={14} />
                Reload
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto grid aspect-video w-full max-w-[min(100%,calc(100dvh-16rem))] place-items-center rounded-[var(--radius-xl)] border border-white/[0.06] bg-white/[0.02] lg:max-w-[min(100%,calc((100dvh-7.9rem)*1.7778))]">
        <div className="flex flex-col items-center gap-3">
          <IconSpinner size={28} className="animate-spin text-accent" />
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
            Resolving stream
          </p>
        </div>
      </div>
    )
  }

  if (error || !activeSource) {
    return (
      <div className="mx-auto grid aspect-video w-full max-w-[min(100%,calc(100dvh-16rem))] place-items-center rounded-[var(--radius-xl)] border border-white/[0.06] bg-white/[0.02] p-6 lg:max-w-[min(100%,calc((100dvh-7.9rem)*1.7778))]">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <p className="text-sm text-zinc-300">{error ?? 'No playable source was returned.'}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-primary">
              <IconRefresh size={16} />
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  const VolumeIcon = muted || volume === 0 ? IconVolumeMute : IconVolume

  return (
    <div
      ref={shellRef}
      onMouseMove={wake}
      onMouseLeave={() => playing && setUiVisible(false)}
      /*
       * The player must never be taller than the space it has. Previously the
       * shell was a bare `aspect-video` box, so on a short window it overflowed
       * and pushed the controls off screen, which is what made going fullscreen
       * feel mandatory. A width cap derived from the viewport height keeps the
       * whole 16:9 frame visible and centred at any window size.
       */
      className={[
        'group/shell relative mx-auto overflow-hidden rounded-[var(--radius-xl)] border border-white/[0.06] bg-black',
        theater
          ? 'w-full max-w-[min(100%,calc((100vh-9rem)*1.7778))]'
          : 'w-full max-w-[min(100%,calc(100dvh-16rem))] lg:max-w-[min(100%,calc((100dvh-7.9rem)*1.7778))]',
        uiVisible ? '' : 'cursor-none',
      ].join(' ')}
    >
      <video
        ref={attachVideo}
        poster={poster || undefined}
        playsInline
        controls={false}
        className="aspect-video w-full bg-black"
      >
        {payload?.subtitles.map((s, i) => (
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

      {/* Buffering indicator */}
      {waiting && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <IconSpinner size={36} className="animate-spin text-white/80" />
        </div>
      )}

      {/* Up-next countdown. Cancellable, and it keeps the controls reachable so
          a viewer can also jump immediately. */}
      {/* Above the control bar, not behind it: `bottom-20` is 80px and the bar is
          taller than that, so this card used to be partly unclickable. */}
      {nextIn !== null && nextHref && (
        <div className="absolute bottom-[8.5rem] right-4 z-40 w-64 overflow-hidden rounded-xl border border-white/12 bg-black/90 p-3 shadow-2xl animate-fade-in">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-400">
            Up next in {nextIn}s
          </p>
          <p className="mt-1 line-clamp-1 text-sm font-semibold text-white">
            Episode {episode + 1}
          </p>
          <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full origin-left rounded-full bg-accent transition-transform duration-1000 ease-linear"
              style={{ transform: `scaleX(${(AUTO_NEXT_SECONDS - nextIn) / AUTO_NEXT_SECONDS})` }}
            />
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={cancelAutoNext}
              className="flex-1 rounded-md border border-white/12 px-2 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => nextHref && router.push(nextHref)}
              className="flex-1 rounded-md bg-accent px-2 py-1.5 text-[11px] font-semibold text-black transition hover:brightness-110"
            >
              Play now
            </button>
          </div>
        </div>
      )}

      {/* Toast (resume / skip feedback) */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-3.5 py-1.5 text-xs font-medium text-white animate-fade-in">
          {toast}
        </div>
      )}

      {/*
        Click surface. Sits above the video but *below* the control bar so
        control-bar clicks never reach it — the previous layout nested the
        controls inside the toggle target, so pressing pause also toggled
        playback back on.
      */}
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => {
          togglePlay()
          wake()
        }}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none"
      />

      {/* Centre play affordance when paused */}
      {!playing && (
        <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-black shadow-2xl animate-scale-in">
            <IconPlay size={24} />
          </span>
        </span>
      )}


      {/*
        Skip prompts sit in their own column that stops above the control bar.
        They used to be absolutely placed at `bottom-24`, which is 96px while the
        bar is ~123px tall — so the bar (same z-index, later in the DOM) covered
        them and every click landed on the bar instead. Anchoring the rail to the
        bar's own box keeps them clear without a magic number that drifts with
        the bar's contents.
      */}
      {(introActive || outroActive) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col items-end gap-2 px-4 pb-[8.5rem]">
          {introActive && (
            <button
              type="button"
              onClick={skipIntro}
              className="pointer-events-auto rounded-lg border border-white/15 bg-black/85 px-4 py-2 text-sm font-medium text-white transition hover:bg-black animate-fade-up"
            >
              Skip intro
            </button>
          )}
          {outroActive && (
            <button
              type="button"
              onClick={skipOutro}
              className="pointer-events-auto rounded-lg border border-white/15 bg-black/85 px-4 py-2 text-sm font-medium text-white transition hover:bg-black animate-fade-up"
            >
              Skip outro
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div
        className={[
          'absolute inset-x-0 bottom-0 z-50 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pb-3 pt-12 transition-opacity duration-200',
          uiVisible || !playing ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        {/* Seek bar */}
        <div className="mb-2.5 flex items-center gap-3">
          <span className="w-14 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-zinc-300">
            {formatTime(time)}
          </span>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(time)}
            className="group/seek relative h-4 flex-1 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              seekTo(((e.clientX - rect.left) / rect.width) * (duration || 0))
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full origin-left bg-white/30"
                style={{ transform: `scaleX(${duration ? buffered / duration : 0})` }}
              />
            </div>
            <div
              className="absolute inset-x-0 top-1/2 h-1 origin-left -translate-y-1/2 rounded-full bg-accent"
              style={{ transform: `scaleX(${duration ? time / duration : 0})` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition group-hover/seek:opacity-100"
              style={{ left: `${pct}%` }}
            />
          </div>
          <span className="w-14 shrink-0 font-mono text-[0.7rem] tabular-nums text-zinc-400">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              togglePlay()
              wake()
            }}
            className="btn-icon h-9 w-9"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <IconPause size={18} />
            ) : (
              <IconPlay size={18} />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              skipBy(-10)
              wake()
            }}
            className="btn-icon h-9 w-9"
            aria-label="Back 10 seconds"
          >
            <IconSkipBack size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              skipBy(10)
              wake()
            }}
            className="btn-icon h-9 w-9"
            aria-label="Forward 10 seconds"
          >
            <IconSkipForward size={18} />
          </button>

          <div className="group/vol flex items-center">
            <button type="button" onClick={toggleMute} className="btn-icon h-9 w-9" aria-label="Mute">
              <VolumeIcon size={18} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="h-1 w-0 opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100"
              aria-label="Volume"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Subtitle track picker */}
            {payload?.subtitles?.length ? (
              <select
                value={subtitleIdx}
                onChange={(e) => {
                  const i = Number(e.target.value)
                  setSubtitleIdx(i)
                  writePS({ subtitleLang: i < 0 ? null : payload?.subtitles[i]?.lang ?? null })
                }}
                className="h-8 max-w-[9rem] rounded-lg border border-white/10 bg-black/85 px-2 text-xs text-zinc-200 focus:outline-none"
                aria-label="Subtitles"
              >
                <option value={-1}>Subtitles off</option>
                {payload.subtitles.map((s, i) => (
                  <option key={`${s.url}-${i}`} value={i}>
                    {s.label || s.lang}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="btn-icon h-9 w-9"
              aria-label="Playback settings"
            >
              <IconSettings size={18} />
            </button>

            <button
              type="button"
              onClick={togglePip}
              className="btn-icon hidden h-9 w-9 sm:grid"
              aria-label="Picture in picture"
            >
              <IconPip size={18} />
            </button>

            <button
              type="button"
              onClick={toggleTheater}
              className={['btn-icon hidden h-9 w-9 sm:grid', theater ? 'text-accent-soft' : ''].join(' ')}
              aria-label={theater ? 'Exit theater mode' : 'Theater mode'}
              aria-pressed={theater}
            >
              <IconTheater size={18} />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn-icon h-9 w-9"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? (
                <IconFullscreenExit size={18} />
              ) : (
                <IconFullscreen size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Settings popover */}
        {settingsOpen && (
          <div className="absolute bottom-16 right-3 z-40 w-60 rounded-xl border border-white/10 bg-base-850/98 p-2 shadow-2xl animate-scale-in">
            <p className="px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">
              Speed
            </p>
            <div className="grid grid-cols-3 gap-1">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => changeRate(r)}
                  className={[
                    'flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors',
                    rate === r
                      ? 'bg-accent/20 text-accent-soft'
                      : 'text-zinc-300 hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  {rate === r && <IconCheck size={12} />}
                  {r}×
                </button>
              ))}
            </div>

            {levels.length > 1 && (
              <>
                <p className="mt-2 px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">
                  Quality
                </p>
                <div className="grid gap-0.5">
                  <button
                    type="button"
                    onClick={() => selectLevel(-1)}
                    className={[
                      'flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                      currentLevel === -1 ? 'bg-accent/20 text-accent-soft' : 'text-zinc-300 hover:bg-white/[0.06]',
                    ].join(' ')}
                  >
                    Auto
                    {currentLevel === -1 && <IconCheck size={12} />}
                  </button>
                  {levels.map((l) => (
                    <button
                      key={l.index}
                      type="button"
                      onClick={() => selectLevel(l.index)}
                      className={[
                        'flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                        currentLevel === l.index
                          ? 'bg-accent/20 text-accent-soft'
                          : 'text-zinc-300 hover:bg-white/[0.06]',
                      ].join(' ')}
                    >
                      {l.label}
                      {currentLevel === l.index && <IconCheck size={12} />}
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="mt-2 px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">
              Subtitles
            </p>
            <button
              type="button"
              onClick={() => {
                const next = !prefs.subtitlesOn
                update({ subtitlesOn: next })
                setShowSubs(next)
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06]"
            >
              Subtitles on by default
              <span
                className={[
                  'relative h-4 w-7 rounded-full transition-colors',
                  prefs.subtitlesOn ? 'bg-accent' : 'bg-white/15',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform',
                    prefs.subtitlesOn ? 'translate-x-[0.9rem]' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !prefs.skipIntro
                update({ skipIntro: next })
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06]"
            >
              Skip intro automatically
              <span
                className={[
                  'relative h-4 w-7 rounded-full transition-colors',
                  prefs.skipIntro ? 'bg-accent' : 'bg-white/15',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform',
                    prefs.skipIntro ? 'translate-x-[0.9rem]' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </span>
            </button>

            <div className="mt-1.5 border-t border-white/[0.07] px-2 pt-2">
              <p className="font-mono text-[0.6rem] leading-relaxed text-zinc-600">
                SPACE play · ←/→ 5s · ↑/↓ vol · F full · M mute · P PiP · N next
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Prev / next episode */}
      <div
        className={[
          'absolute right-3 top-3 z-30 flex items-center gap-1.5 transition-opacity duration-200',
          uiVisible || !playing ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        {prevHref && (
          <button
            type="button"
            onClick={() => router.push(prevHref)}
            className="rounded-lg border border-white/10 bg-black/85 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-black"
          >
            Prev
          </button>
        )}
        {nextHref && (
          <button
            type="button"
            onClick={() => router.push(nextHref)}
            className="rounded-lg border border-white/10 bg-black/85 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-black"
          >
            Next
          </button>
        )}
      </div>

      {inPip && (
        <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-lg bg-black/80 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wide text-zinc-300">
          In picture-in-picture
        </div>
      )}
    </div>
  )
}
