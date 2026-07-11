// PetezPopz — Dark-mode-first design system colors
export const Colors = {
  // ── Backgrounds ──────────────────────────────────────────
  bg: {
    primary: '#0A0A12',
    secondary: '#111120',
    card: '#16162A',
    elevated: '#1E1E38',
    overlay: 'rgba(10, 10, 18, 0.85)',
  },

  // ── Brand & Accent ────────────────────────────────────────
  brand: {
    violet: '#7B2FFF',
    violetLight: '#9D5FFF',
    violetDark: '#5A1DCC',
    rose: '#FF2D6B',
    roseLight: '#FF5F8A',
  },

  // ── Loyalty Tier Palette ──────────────────────────────────
  tier: {
    common: '#9CA3AF',      // Grey — Common
    exclusive: '#60A5FA',   // Blue — Exclusive
    chase: '#A78BFA',       // Purple — Chase
    vaulted: '#FFD700',     // Gold — Vaulted
  },

  // ── Semantic ──────────────────────────────────────────────
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#38BDF8',

  // ── Text ──────────────────────────────────────────────────
  text: {
    primary: '#F0F0FF',
    secondary: '#A0A0C0',
    muted: '#5C5C80',
    inverse: '#0A0A12',
  },

  // ── Borders / Dividers ────────────────────────────────────
  border: {
    default: 'rgba(255,255,255,0.08)',
    subtle: 'rgba(255,255,255,0.04)',
    accent: 'rgba(123,47,255,0.4)',
  },

  // ── Gradients (start/end pairs) ───────────────────────────
  gradient: {
    hero: ['#1A0033', '#0A0A12'],
    card: ['#1E1E38', '#16162A'],
    violet: ['#7B2FFF', '#FF2D6B'],
    gold: ['#FFD700', '#FF8C00'],
    vipBadge: ['#7B2FFF', '#A855F7'],
  },

  // ── Special ───────────────────────────────────────────────
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
  vipGlow: 'rgba(123, 47, 255, 0.35)',
  scarcityRed: '#FF3B30',
} as const;

export type ColorToken = typeof Colors;
