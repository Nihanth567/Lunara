/**
 * Lunara design tokens — deep indigo cosmic palette.
 * Dark mode is the primary and only intended experience.
 * Both light and dark keys return the same lunar palette so
 * useColors() always resolves to the Lunara aesthetic.
 */

const lunaraTokens = {
  // Core backgrounds
  background: '#0F0C29',
  backgroundMid: '#1A1635',
  backgroundDeep: '#24243E',

  // Typography
  foreground: '#F8F5FF',
  text: '#F8F5FF',
  textSecondary: '#9B89C2',

  // Cards (frosted glass)
  surface: '#1E1B3A',
  surfaceHigh: '#252047',
  card: '#1E1B3A',
  cardStrong: '#252047',
  cardForeground: '#F8F5FF',
  cardBorder: 'rgba(255,255,255,0.12)',

  // Primary accent — soft coral
  primary: '#FF9A8B',
  primaryForeground: '#1A0E18',
  primaryGlow: '#FECFEF',

  // Secondary — soft lavender
  secondary: '#C3B1E1',
  secondaryForeground: '#0F0C29',

  // Accent alias (used by useColors)
  accent: '#C3B1E1',
  accentForeground: '#F8F5FF',

  // Muted elements
  muted: '#181532',
  mutedForeground: '#7A6D98',

  // UI chrome
  border: 'rgba(255,255,255,0.10)',
  input: 'rgba(255,255,255,0.07)',
  tint: '#FF9A8B',

  // Semantic
  destructive: '#FF6B6B',
  destructiveForeground: '#FFFFFF',

  // Ritual card type colors
  gratefulColor: '#FF9A8B',
  cuteColor: '#C3B1E1',
  growColor: '#A8D8A8',
};

const colors = {
  light: lunaraTokens,
  dark: lunaraTokens,
  radius: { card: 12, chip: 8, dot: 4 },
};

export default colors;
