'use client'

import { useCallback, useEffect, useState } from 'react'

/** Chrome/Edge/Android install event. Not in the DOM lib yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = {
  /** A native install prompt is available (Chromium-based browsers). */
  canInstall: boolean
  /** iOS Safari: no event, so we show the Share-sheet steps instead. */
  needsIOSInstructions: boolean
  /** Already running as an installed app. */
  installed: boolean
  /** Trigger the native prompt. No-op when `canInstall` is false. */
  promptInstall: () => Promise<void>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari exposes its own flag.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iP(hone|ad|od)/.test(ua)
  // iPadOS 13+ reports as a Mac; the touch-point count disambiguates it.
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOS || iPadOS
}

/** iOS only offers Add to Home Screen in Safari, not in Chrome/Firefox/Edge. */
function isIOSSafari(): boolean {
  if (!isIOS()) return false
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent)
}

/**
 * Installability state.
 *
 * Android/desktop Chromium fire `beforeinstallprompt`; we stash it and replay
 * it on demand. iOS never fires it, so we fall back to instructions. Everything
 * is read after mount so the server and client markup agree.
 */
export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
    setIos(isIOSSafari())

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    const mq = window.matchMedia('(display-mode: standalone)')
    const onMode = () => setInstalled(isStandalone())
    mq.addEventListener?.('change', onMode)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      mq.removeEventListener?.('change', onMode)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }, [deferred])

  return {
    canInstall: Boolean(deferred) && !installed,
    needsIOSInstructions: ios && !installed,
    installed,
    promptInstall,
  }
}
