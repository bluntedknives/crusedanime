'use client'

import { useState } from 'react'
import { stripHtml } from '@/lib/anilist'

interface Props {
  description: string | null
}

export default function Synopsis({ description }: Props) {
  const [expanded, setExpanded] = useState(false)
  const text = stripHtml(description)

  if (!text) {
    return <p className="text-sm italic text-zinc-500">No synopsis has been added yet.</p>
  }

  const long = text.length > 520

  return (
    <div>
      <p
        className={[
          'whitespace-pre-line text-[13.5px] leading-relaxed text-zinc-300 sm:text-sm',
          !expanded && long ? 'line-clamp-6' : '',
        ].join(' ')}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-accent-soft hover:text-accent"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
