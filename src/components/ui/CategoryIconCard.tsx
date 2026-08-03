// PetezPopz — CategoryIconCard Component (Fandom Grid)
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';

interface Props {
  label: string;
  handle: string;
  emoji: string;
  imageUrl?: string | null;
  /** Only show products in this collection that also carry this tag (e.g. "Loungefly"). */
  requireTag?: string;
  /**
   * Card has no backing Shopify collection — browse straight off the tag
   * (e.g. "Chase Variants", identified purely by the "Chase" product tag).
   * Routes to /tag/[tag] instead of /collection/[handle].
   */
  tagOnly?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryIconCard({ label, handle, emoji, imageUrl, requireTag, tagOnly }: Props) {
  const router = useRouter();
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[styles.card, cardStyle]}
      onPressIn={() => { scale.value = withSpring(0.95); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={() =>
        router.push(
          tagOnly
            ? { pathname: '/tag/[tag]', params: { tag: requireTag ?? label } }
            : requireTag
            ? { pathname: '/collection/[handle]', params: { handle, requireTag } }
            : { pathname: '/collection/[handle]', params: { handle } },
        )
      }
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <LinearGradient
          colors={[Colors.brand.violetDark, Colors.bg.card]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Dark overlay — near-even scrim so centered content stays legible
          across the whole card, rather than the bottom-weighted gradient the
          old bottom-aligned layout used. */}
      <LinearGradient
        colors={['rgba(10,10,18,0.45)', 'rgba(10,10,18,0.65)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.label} numberOfLines={2}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 120,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    justifyContent: 'center',
    ...Shadow.md,
  },
  content: {
    padding: Spacing[4],
    gap: 6,
    alignItems: 'center',
  },
  emoji: { fontSize: 32 },
  label: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.sm,
    color: Colors.white,
    lineHeight: 18,
    textAlign: 'center',
  },
});
