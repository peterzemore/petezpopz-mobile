// PetezPopz — Typography system (Outfit headlines + Inter body)
import { Platform } from 'react-native';

export const FontFamily = {
  // Loaded via expo-font
  outfitBlack: 'Outfit_900Black',
  outfitBold: 'Outfit_700Bold',
  outfitSemiBold: 'Outfit_600SemiBold',
  outfitMedium: 'Outfit_500Medium',
  outfitRegular: 'Outfit_400Regular',

  interBold: 'Inter_700Bold',
  interSemiBold: 'Inter_600SemiBold',
  interMedium: 'Inter_500Medium',
  interRegular: 'Inter_400Regular',
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 40,
  hero: 48,
} as const;

export const LineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.625,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
} as const;

// Convenience text style presets
export const TextStyles = {
  heroTitle: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize.hero,
    letterSpacing: LetterSpacing.tight,
  },
  sectionTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize['2xl'],
    letterSpacing: LetterSpacing.tight,
  },
  cardTitle: {
    fontFamily: FontFamily.outfitSemiBold,
    fontSize: FontSize.md,
    letterSpacing: LetterSpacing.normal,
  },
  body: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
  },
  bodyMedium: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.base,
  },
  label: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
  },
  price: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.xl,
  },
  badge: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase' as const,
  },
} as const;
