import { LOGO_DIMENSIONS, logoSource } from '../lib/brand.js'

/** Shared logo for every React brand slot; dimensions reserve its original ratio. */
export default function Logo({ variant = 'horizontal', theme = 'dark', height = 30, alt = 'RoadReport' }) {
  const [width, intrinsicHeight] = LOGO_DIMENSIONS[variant]
  return (
    <img
      className="rr-logo"
      src={logoSource(variant, theme)}
      alt={alt}
      width={width}
      height={intrinsicHeight}
      style={{ height, width: 'auto', maxWidth: '100%' }}
      decoding="async"
    />
  )
}
