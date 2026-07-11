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
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryIconCard({ label, handle, emoji, imageUrl }: Props) {
  const router = useRouter();
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[styles.card, cardStyle]}
      onPressIn={() => { scale.value = withSpring(0.95); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={() => router.push(`/collection/${handle}`)}
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

      {/* Dark overlay */}
      <LinearGradient
        colors={['rgba(10,10,18,0.2)', 'rgba(10,10,18,0.75)']}
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
    justifyContent: 'flex-end',
    ...Shadow.md,
  },
  content: {
    padding: Spacing[4],
    gap: 4,
  },
  emoji: { fontSize: 28 },
  label: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.sm,
    color: Colors.white,
    lineHeight: 18,
  },
});
