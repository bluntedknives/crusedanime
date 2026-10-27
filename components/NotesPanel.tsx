'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconStickyNote } from './icons'
import { useNotes } from '@/lib/collections'

interface Props {
  animeId: number
  title: string
}

/**
 * Private notes for one title.
 *
 * Autosaves on a short debounce rather than on blur, because a viewer who types
 * a line and immediately navigates away should not lose it. The saved indicator
 * appears only after a write, so it reads as feedback rather than decoration.
 */
export default function NotesPanel({ animeId, title }: Props) {
  const { get, set } = useNotes()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  /** Skip the first autosave so mounting does not rewrite what was just read. */
  const primed = useRef(false)

  useEffect(() => {
    setText(get(animeId))
    primed.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId])

  useEffect(() => {
    if (!primed.current) {
      primed.current = true
      return
    }
    const t = setTimeout(() => {
      set(animeId, text)
      setSaved(true)
      setTimeout(() => setSaved(false), 1400)
    }, 600)
    return () => clearTimeout(t)
  }, [text, animeId, set])

  return (
    <section className="card p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-zinc-200">
          <IconStickyNote size={15} className="text-accent" />
          Your notes
        </h2>
        <span
          className={[
            'flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-wider transition-opacity',
            saved ? 'text-signal opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <IconCheck size={11} />
          Saved
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={`Private notes on ${title}…`}
        aria-label={`Notes on ${title}`}
        className="w-full resize-y rounded-md border border-white/[0.08] bg-black/30 p-2.5 text-[13px] leading-relaxed text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/50"
      />
      <p className="mt-1.5 font-mono text-[0.6rem] text-zinc-600">
        Stored on this device only · {text.trim().length} characters
      </p>
    </section>
  )
}
