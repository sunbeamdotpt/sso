/* eslint-disable */
export type Token = `colors.${ColorToken}` | `fonts.${FontToken}` | `fontWeights.${FontWeightToken}` | `shadows.${ShadowToken}` | `fontSizes.${FontSizeToken}` | `radii.${RadiusToken}` | `breakpoints.${BreakpointToken}` | `sizes.${SizeToken}`

export type ColorPalette = "sunbeam.orange" | "sunbeam.flame" | "beam.orange" | "sunshine.900" | "sunshine.700" | "sunshine.500" | "sunshine.300" | "beam.gold" | "bright.yellow" | "warm.ivory" | "cream" | "sunbeam.black" | "card.dark" | "code.activePill" | "code.text" | "code.success" | "syn.keyword" | "syn.fn" | "syn.string" | "syn.prop" | "syn.number" | "syn.builtin" | "border.warm" | "border.warmSubtle" | "border.warmDark" | "bg.page" | "bg.card" | "bg.nav" | "text.primary" | "text.secondary" | "text.muted" | "border.default" | "border.subtle" | "accent" | "sectionLabel"

export type ColorToken = "sunbeam.orange" | "sunbeam.flame" | "beam.orange" | "sunshine.900" | "sunshine.700" | "sunshine.500" | "sunshine.300" | "beam.gold" | "bright.yellow" | "warm.ivory" | "cream" | "sunbeam.black" | "card.dark" | "code.activePill" | "code.text" | "code.success" | "syn.keyword" | "syn.fn" | "syn.string" | "syn.prop" | "syn.number" | "syn.builtin" | "border.warm" | "border.warmSubtle" | "border.warmDark" | "bg.page" | "bg.card" | "bg.nav" | "text.primary" | "text.secondary" | "text.muted" | "border.default" | "border.subtle" | "accent" | "sectionLabel" | "colorPalette"

export type FontToken = "heading" | "body" | "mono"

export type FontWeightToken = "display" | "heading" | "body" | "button"

export type ShadowToken = "golden" | "goldenDark" | "nav" | "code"

export type FontSizeToken = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl"

export type RadiusToken = "sm" | "md" | "lg" | "full"

export type BreakpointToken = "sm" | "md" | "lg" | "xl"

export type SizeToken = "breakpoint-sm" | "breakpoint-md" | "breakpoint-lg" | "breakpoint-xl"

export type Tokens = {
		colors: ColorToken
		fonts: FontToken
		fontWeights: FontWeightToken
		shadows: ShadowToken
		fontSizes: FontSizeToken
		radii: RadiusToken
		breakpoints: BreakpointToken
		sizes: SizeToken
} & { [token: string]: never }

export type TokenCategory = "aspectRatios" | "zIndex" | "opacity" | "colors" | "fonts" | "fontSizes" | "fontWeights" | "lineHeights" | "letterSpacings" | "sizes" | "cursor" | "shadows" | "spacing" | "radii" | "borders" | "borderWidths" | "durations" | "easings" | "animations" | "blurs" | "gradients" | "breakpoints" | "assets"