import type { SVGProps } from 'react'

/**
 * Hand-drawn icon set. Every glyph is built on a 24x24 grid with a 1.6 stroke
 * and round joins so the whole UI reads as one family, which the mixed-weight
 * lucide defaults did not. `currentColor` only, so colour comes from the
 * caller's text colour.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.8V19a1 1 0 0 0 1 1h3.2v-4.4h3.6V20H17a1 1 0 0 0 1-1V9.8" />
    </Svg>
  )
}

export function IconCompass(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="m15 9-1.9 4.1L9 15l1.9-4.1z" />
    </Svg>
  )
}

export function IconFlame(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5c.6 2.4-.7 3.6-1.9 4.9C8.8 9.8 7.5 11.3 7.5 14a4.5 4.5 0 0 0 9 0c0-2.3-1.2-3.5-2.3-4.7-.5.9-1 1.4-1.8 1.7.6-2.7.3-5.3-.4-7.5Z" />
    </Svg>
  )
}

export function IconCalendar(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.8" y="5.5" width="16.4" height="14.2" rx="2.4" />
      <path d="M3.8 10h16.4M8.5 3.8v3.4M15.5 3.8v3.4" />
    </Svg>
  )
}

export function IconShuffle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h3.2c1.2 0 2.2.6 2.9 1.6l3.8 6.8c.6 1 1.7 1.6 2.9 1.6H20" />
      <path d="M17.6 14.4 20 17l-2.4 2.6" />
      <path d="M4 17h3.2c1.2 0 2.2-.6 2.9-1.6l.7-1.2" />
      <path d="m13.2 8.8.6-1.2c.6-1 1.7-1.6 2.9-1.6H20" />
      <path d="M17.6 3.4 20 6l-2.4 2.6" />
    </Svg>
  )
}

export function IconBookmark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 4.8h11a.7.7 0 0 1 .7.7v14.2l-6.2-3.6-6.2 3.6V5.5a.7.7 0 0 1 .7-.7Z" />
    </Svg>
  )
}

export function IconBookmarkFilled(p: IconProps) {
  return (
    <Svg {...p} fill="currentColor" strokeWidth={0}>
      <path d="M6.5 4.8h11a.7.7 0 0 1 .7.7v14.2l-6.2-3.6-6.2 3.6V5.5a.7.7 0 0 1 .7-.7Z" />
    </Svg>
  )
}

export function IconHistory(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.8 12a8.2 8.2 0 1 0 2.6-6" />
      <path d="M3.5 4.4v4.2h4.2" />
      <path d="M12 8.2V12l2.7 1.7" />
    </Svg>
  )
}

export function IconSettings(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="2.9" />
      <path d="M12 3.6v2M12 18.4v2M4.8 7.8l1.7 1M17.5 15.2l1.7 1M4.8 16.2l1.7-1M17.5 8.8l1.7-1" />
    </Svg>
  )
}

export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.4 15.4 4 4" />
    </Svg>
  )
}

export function IconMenu(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
    </Svg>
  )
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Svg>
  )
}

export function IconPlay(p: IconProps) {
  return (
    <Svg {...p} fill="currentColor" strokeWidth={0}>
      <path d="M8.4 5.9a.7.7 0 0 1 1.06-.6l8.2 5.4a.8.8 0 0 1 0 1.34l-8.2 5.4a.7.7 0 0 1-1.06-.6Z" />
    </Svg>
  )
}

export function IconPause(p: IconProps) {
  return (
    <Svg {...p} fill="currentColor" strokeWidth={0}>
      <rect x="7.4" y="5.6" width="3.4" height="12.8" rx="1" />
      <rect x="13.2" y="5.6" width="3.4" height="12.8" rx="1" />
    </Svg>
  )
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11v5M12 8.2h.01" />
    </Svg>
  )
}

export function IconStar(p: IconProps) {
  return (
    <Svg {...p} fill="currentColor" strokeWidth={0}>
      <path d="m12 4.6 2.3 4.7 5.2.8-3.8 3.6.9 5.2-4.6-2.4-4.6 2.4.9-5.2L4.5 10l5.2-.8Z" />
    </Svg>
  )
}

export function IconArrowLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 12H5.6" />
      <path d="m11 6.2-5.6 5.8 5.6 5.8" />
    </Svg>
  )
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 6.5 9 12l5.5 5.5" />
    </Svg>
  )
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 6.5 15 12l-5.5 5.5" />
    </Svg>
  )
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 9.5 12 15l5.5-5.5" />
    </Svg>
  )
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4.5 20.2 18.6a.8.8 0 0 1-.7 1.2H4.5a.8.8 0 0 1-.7-1.2Z" />
      <path d="M12 10v4M12 16.8h.01" />
    </Svg>
  )
}

export function IconRefresh(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.3" />
      <path d="M19.6 4.6v4.2h-4.2" />
    </Svg>
  )
}

export function IconGrid(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4.4" y="4.4" width="6.2" height="6.2" rx="1.6" />
      <rect x="13.4" y="4.4" width="6.2" height="6.2" rx="1.6" />
      <rect x="4.4" y="13.4" width="6.2" height="6.2" rx="1.6" />
      <rect x="13.4" y="13.4" width="6.2" height="6.2" rx="1.6" />
    </Svg>
  )
}

export function IconList(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8.6 6.5h11M8.6 12h11M8.6 17.5h11" />
      <path d="M4.6 6.5h.01M4.6 12h.01M4.6 17.5h.01" />
    </Svg>
  )
}

export function IconSubtitles(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.6" y="5.4" width="16.8" height="13.2" rx="2.2" />
      <path d="M7.2 11.4h4M13.4 11.4h3.4M7.2 14.6h3.4M12.8 14.6h4" />
    </Svg>
  )
}

export function IconVolume(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 9.6h2.8L11.6 6v12L7.8 14.4H5Z" />
      <path d="M15 9.5a3.6 3.6 0 0 1 0 5M17.4 7.4a7 7 0 0 1 0 9.2" />
    </Svg>
  )
}

export function IconVolumeMute(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 9.6h2.8L11.6 6v12L7.8 14.4H5Z" />
      <path d="m15.2 9.8 4 4.4M19.2 9.8l-4 4.4" />
    </Svg>
  )
}

export function IconSkipBack(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 12a6 6 0 1 0 1.9-4.4" />
      <path d="M8.4 3.6v4.4h4.4" />
      <path d="M12 9.6 10.6 12h2.8Z" fill="currentColor" strokeWidth={0} />
    </Svg>
  )
}

export function IconSkipForward(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 12a6 6 0 1 1-1.9-4.4" />
      <path d="M15.6 3.6v4.4h-4.4" />
      <path d="m12 9.6 1.4 2.4h-2.8Z" fill="currentColor" strokeWidth={0} />
    </Svg>
  )
}

export function IconTheater(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 9.5h20" />
      <path d="M6.5 5v14M17.5 5v14" />
    </Svg>
  )
}

export function IconFullscreen(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.6 9.4V5.4a.8.8 0 0 1 .8-.8h4M15 4.6h4a.8.8 0 0 1 .8.8v4M19.4 14.6v4a.8.8 0 0 1-.8.8h-4M9 19.4H5a.8.8 0 0 1-.8-.8v-4" />
    </Svg>
  )
}

export function IconFullscreenExit(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.4 4.6v4a.8.8 0 0 1-.8.8h-4M14.6 4.6v4a.8.8 0 0 0 .8.8h4M14.6 19.4v-4a.8.8 0 0 1 .8-.8h4M9.4 19.4v-4a.8.8 0 0 0-.8-.8h-4" />
    </Svg>
  )
}

export function IconPip(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.8" y="5.4" width="16.4" height="13.2" rx="2.2" />
      <rect x="12.4" y="12" width="5.6" height="4.4" rx="1.2" fill="currentColor" strokeWidth={0} />
    </Svg>
  )
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5.6v12.8M5.6 12h12.8" />
    </Svg>
  )
}

export function IconSpinner(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4.2a7.8 7.8 0 1 0 7.8 7.8" />
    </Svg>
  )
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5.6 12.4 4.2 4.2 8.6-9" />
    </Svg>
  )
}

export function IconFilter(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.4 6.4h15.2M7.4 12h9.2M10.2 17.6h3.6" />
    </Svg>
  )
}

export function IconTrailer(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.6" y="6.4" width="16.8" height="11.2" rx="2.2" />
      <path d="M3.6 10.2h16.8M8 6.4l2 3.8M14 6.4l2 3.8" />
    </Svg>
  )
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.6V12l3.2 1.9" />
    </Svg>
  )
}

export function IconFilm(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2.2" />
      <path d="M8.2 4.6v14.8M15.8 4.6v14.8M3.6 9.4h4.6M3.6 14.6h4.6M15.8 9.4h4.6M15.8 14.6h4.6" />
    </Svg>
  )
}

export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.8 7.2h14.4M9.4 7.2V5.4a.8.8 0 0 1 .8-.8h3.6a.8.8 0 0 1 .8.8v1.8" />
      <path d="M6.6 7.2 7.5 19a.8.8 0 0 0 .8.8h7.4a.8.8 0 0 0 .8-.8l.9-11.8" />
      <path d="M10.4 10.8v5M13.6 10.8v5" />
    </Svg>
  )
}

export function IconSliders(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.6 8.4h10M18.4 8.4h1M4.6 15.6h1M9.4 15.6h10" />
      <circle cx="16.2" cy="8.4" r="2.2" />
      <circle cx="7.2" cy="15.6" r="2.2" />
    </Svg>
  )
}

export function IconExternal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13.6 5.4h5v5" />
      <path d="M18.6 5.4 11 13" />
      <path d="M17.4 13.8v4a.8.8 0 0 1-.8.8H6.2a.8.8 0 0 1-.8-.8V7.4a.8.8 0 0 1 .8-.8h4" />
    </Svg>
  )
}

export function IconChart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </Svg>
  )
}

export function IconShare(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="m8.3 10.7 7.4-4.3" />
      <path d="m8.3 13.3 7.4 4.3" />
    </Svg>
  )
}

export function IconFlame2(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3s5 4.2 5 8.6a5 5 0 0 1-10 0C7 9 9 7 9 7s.4 2.2 2 2.6C11.6 9 12 3 12 3Z" />
    </Svg>
  )
}

export function IconDownload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v10" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M4.5 18.5h15" />
    </Svg>
  )
}

export function IconUpload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 15V5" />
      <path d="M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 18.5h15" />
    </Svg>
  )
}

export function IconTrophy(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4.5V8a3 3 0 0 0 3 3" />
      <path d="M17 5.5h2.5V8a3 3 0 0 1-3 3" />
      <path d="M12 14v3.5" />
      <path d="M8.5 20.5h7l-.7-3h-5.6Z" />
    </Svg>
  )
}

export function IconGrid2(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </Svg>
  )
}

export function IconSparkle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9Z" />
      <path d="M18.5 16.5 19.2 19l2.5.7-2.5.7-.7 2.5-.7-2.5-2.5-.7 2.5-.7Z" />
    </Svg>
  )
}
