/**
 * Ad configuration, read from the environment at build time.
 *
 * Every value is optional. An unset slot renders nothing at all rather than an
 * empty frame, so the layout is identical whether ads are configured or not.
 */
export const ADS = {
  smartlink: process.env.NEXT_PUBLIC_ADS_SMARTLINK_URL ?? '',
  socialBar: process.env.NEXT_PUBLIC_ADS_SOCIAL_BAR_SRC ?? '',
  popunder: process.env.NEXT_PUBLIC_ADS_POPUNDER_SRC ?? '',
} as const

export const adsEnabled = Boolean(ADS.smartlink || ADS.socialBar || ADS.popunder)
