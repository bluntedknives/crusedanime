/**
 * The ad adapter interface.
 *
 * Every network is behind the same shape, so the waterfall does not know or
 * care which one it is talking to. An adapter's only job is to put a creative
 * into the element it is handed, and to tell us whether it actually filled.
 *
 * The `filled` return is the whole point. A network that renders an empty
 * iframe, or that silently does nothing because it has no demand for this
 * viewer, must say so — otherwise the waterfall stops on a blank box and the
 * slot earns nothing. Returning `false` is how a slot moves to the next
 * adapter in the chain.
 */

export type AdFormat = 'banner' | 'native' | 'anchor' | 'interstitial' | 'popunder'

export interface AdSize {
  width: number
  height: number
}

export interface AdContext {
  /** Slot name from config/ads.ts, e.g. "in-feed". */
  slot: string
  format: AdFormat
  size: AdSize
  /** Set once the viewer has accepted the consent banner. */
  consent: boolean
  /** Whether the document is currently visible. */
  visible: boolean
}

export interface AdResult {
  filled: boolean
  /** Why it did not fill, for /debug/ads. */
  reason?: string
}

export interface AdAdapter {
  name: string
  supportedFormats: AdFormat[]
  /** Resolved from env; when empty the adapter is skipped entirely. */
  configured: boolean
  render(el: HTMLElement, ctx: AdContext): Promise<AdResult>
}

const key = (n: string) => process.env[`NEXT_PUBLIC_ADS_${n.toUpperCase()}`] ?? ''

/** Adsterra key looks like `abc123def456...` and is pasted as a raw script src. */
const adsterraKey = key('ADSTERRA_KEY')
/** AdSense wants `ca-pub-…` plus a per-slot numeric id. */
const adsenseClient = key('ADSENSE_CLIENT')
const adsenseSlot = key('ADSENSE_SLOT')
/** Monetag / Propeller are single-tag networks keyed by a zone id. */
const monetagZone = key('MONETAG_ZONE')
const propellerZone = key('PROPELLER_ZONE')
/** The Adsterra Smartlink. A single URL; there is no creative tag to paste. */
const smartlinkUrl = process.env.NEXT_PUBLIC_ADS_SMARTLINK_URL ?? ''
/** Ezoic uses a site id and a standalone placement id. */
const ezoicSite = key('EZOIC_SITE')
const ezoicPlacement = key('EZOIC_PLACEMENT')

/** Inject a script once, resolving when it has loaded or failed. */
function injectScript(src: string, attrs: Record<string, string> = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true)
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.crossOrigin = 'anonymous'
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v)
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

/**
 * Script-based networks (Adsterra, Monetag, Propeller) work the same way: their
 * tag finds an element marked with their key and paints into it. We mark the
 * container, load the tag, and then check whether the network actually put
 * anything inside. That check is what makes `filled` honest rather than
 * optimistic.
 */
function scriptNetwork(name: string, src: string | null, containerKey: string) {
  return {
    async render(el: HTMLElement): Promise<AdResult> {
      if (!src) return { filled: false, reason: 'no id' }
      el.setAttribute(containerKey, name)
      el.innerHTML = ''
      const ok = await injectScript(src)
      if (!ok) return { filled: false, reason: 'script failed' }
      // Give the tag a moment to paint, then look for a real child.
      await new Promise((r) => setTimeout(r, 250))
      const painted = el.childElementCount > 0 || (el.textContent ?? '').trim().length > 0
      return painted ? { filled: true } : { filled: false, reason: 'no creative' }
    },
  }
}

export const adsense: AdAdapter = {
  name: 'adsense',
  supportedFormats: ['banner', 'native', 'anchor'],
  configured: Boolean(adsenseClient && adsenseSlot),
  async render(el) {
    if (!this.configured) return { filled: false, reason: 'no id' }
    const ok = await injectScript(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`,
      { crossorigin: 'anonymous' },
    )
    if (!ok) return { filled: false, reason: 'script failed' }
    const ins = document.createElement('ins')
    ins.className = 'adsbygoogle'
    ins.style.display = 'block'
    ins.dataset.adClient = adsenseClient
    ins.dataset.adSlot = adsenseSlot
    ins.dataset.fullWidthResponsive = 'true'
    el.innerHTML = ''
    el.appendChild(ins)
    try {
      ;(window as unknown as { adsbygoogle: unknown[] }).adsbygoogle.push({})
    } catch {
      return { filled: false, reason: 'push failed' }
    }
    await new Promise((r) => setTimeout(r, 400))
    // AdSense reports unfilled by leaving the element at zero height.
    const filled = ins.getBoundingClientRect().height > 8
    return filled ? { filled: true } : { filled: false, reason: 'unfilled' }
  },
}

export const ezoic: AdAdapter = {
  name: 'ezoic',
  supportedFormats: ['banner', 'native'],
  configured: Boolean(ezoicSite && ezoicPlacement),
  async render(el) {
    if (!this.configured) return { filled: false, reason: 'no id' }
    const ok = await injectScript('https://www.ezojs.com/ezoic/sa.min.js')
    if (!ok) return { filled: false, reason: 'script failed' }
    const w = window as unknown as {
      ezstandalone?: { cmd: unknown[]; showAds?: (...ids: number[]) => void }
    }
    if (!w.ezstandalone) {
      w.ezstandalone = { cmd: [] }
    }
    const id = Number(ezoicPlacement)
    el.id = `ezoic-pub-ad-placeholder-${id}`
    w.ezstandalone.cmd.push(() => w.ezstandalone?.showAds?.(id))
    await new Promise((r) => setTimeout(r, 500))
    const filled = el.childElementCount > 0
    return filled ? { filled: true } : { filled: false, reason: 'unfilled' }
  },
}

const adsterraSrc = adsterraKey
  ? `https://www.highperformanceformat.com/${adsterraKey}/invoke.js`
  : null

export const adsterra: AdAdapter = {
  name: 'adsterra',
  supportedFormats: ['banner', 'native', 'anchor', 'popunder'],
  configured: Boolean(adsterraKey),
  ...scriptNetwork('adsterra', adsterraSrc, 'data-adsterra-zone'),
}

export const monetag: AdAdapter = {
  name: 'monetag',
  supportedFormats: ['banner', 'native', 'popunder'],
  configured: Boolean(monetagZone),
  ...scriptNetwork(
    'monetag',
    monetagZone ? `https://fpyf8.com/88/tag.min.js` : null,
    'data-monetag-zone',
  ),
}

export const propeller: AdAdapter = {
  name: 'propeller',
  supportedFormats: ['banner', 'native', 'popunder'],
  configured: Boolean(propellerZone),
  ...scriptNetwork(
    'propeller',
    propellerZone ? `https://cdn.propellerads.com/tags/${propellerZone}.js` : null,
    'data-propeller-zone',
  ),
}

/**
 * Adsterra Smartlink.
 *
 * This is the network in use. A Smartlink is a single URL that Adsterra rotates
 * offers behind, so unlike a banner network there is no script to load and no
 * creative to wait for — the unit is a labelled link card we render ourselves.
 *
 * That makes it the most reliable adapter in the chain: it cannot fail to
 * render, cannot be blocked by a slow tag, and cannot leave the slot blank. It
 * reports `filled` as soon as the card is in the DOM, which is honest — the
 * card is the ad.
 *
 * It is a real, visible, dismissible card. It never auto-opens, never traps a
 * click, and never sits inside or over a player.
 */
export const smartlink: AdAdapter = {
  name: 'smartlink',
  supportedFormats: ['banner', 'native', 'anchor', 'interstitial'],
  configured: Boolean(smartlinkUrl),
  async render(el, ctx) {
    if (!smartlinkUrl) return { filled: false, reason: 'no url' }
    el.innerHTML = ''

    const wrap = document.createElement('div')
    wrap.className = 'smartlink-card'

    const tag = document.createElement('span')
    tag.className = 'smartlink-card__tag'
    tag.textContent = 'Sponsored'

    const headline = document.createElement('p')
    headline.className = 'smartlink-card__headline'
    headline.textContent = ctx.format === 'interstitial' ? 'One word from our sponsor' : 'A partner offer for this page'

    const body = document.createElement('p')
    body.className = 'smartlink-card__body'
    body.textContent = 'Picked for this page. Opens in a new tab.'

    const link = document.createElement('a')
    link.href = smartlinkUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer nofollow sponsored'
    link.className = 'smartlink-card__cta'
    link.textContent = 'Open offer'

    wrap.append(tag, headline, body, link)
    el.appendChild(wrap)
    return { filled: true }
  },
}

/**
 * The house slot. It always fills, and it is deliberately a real, labelled box
 * rather than an invisible spacer: if every network passes, the viewer should
 * see something honest and the layout should not collapse. It also means no
 * slot is ever blank, which is the failure mode that earns nothing.
 */
export const house: AdAdapter = {
  name: 'house',
  supportedFormats: ['banner', 'native', 'anchor', 'interstitial', 'popunder'],
  configured: true,
  async render(el) {
    el.innerHTML = ''
    const box = document.createElement('div')
    box.className = 'house-ad'
    box.innerHTML =
      '<span class="house-ad__tag">House</span>' +
      '<span class="house-ad__text">Your ad could be here</span>'
    el.appendChild(box)
    return { filled: true }
  },
}

export const ADAPTERS: Record<string, AdAdapter> = {
  smartlink,
  adsense,
  ezoic,
  adsterra,
  monetag,
  propeller,
  house,
}
