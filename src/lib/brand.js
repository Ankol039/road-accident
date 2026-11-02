/** Original, tightly cropped PNG dimensions. Keep source artwork unchanged. */
export const LOGO_DIMENSIONS = {
  horizontal: [901, 183],
  stacked: [290, 317],
  mark: [268, 270],
}

export const logoSource = (variant = 'horizontal', theme = 'dark') =>
  `${import.meta.env.BASE_URL}brand/logo-${variant}-on-${theme}.png`
