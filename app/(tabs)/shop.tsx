// PetezPopz — Fandom Grid / Shop Screen (Tab 2)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { CategoryIconCard } from '../../src/components/ui/CategoryIconCard';
import { FUNKO_CATEGORIES, LOUNGEFLY_CATEGORIES } from '../../src/api/queries/collections';

type BrandTab = 'funko' | 'loungefly';

export default function ShopScreen() {
  const [activeTab, setActiveTab] = useState<BrandTab>('funko');

  const categories = activeTab === 'funko' ? FUNKO_CATEGORIES : LOUNGEFLY_CATEGORIES;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fandom Grid</Text>
        <Text style={styles.subtitle}>Browse by universe</Text>
      </View>

      {/* Brand Toggle */}
      <View style={styles.toggleContainer}>
        <Pressable
          style={[styles.toggleBtn, activeTab === 'funko' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('funko')}
        >
          <Text style={[styles.toggleText, activeTab === 'funko' && styles.toggleTextActive]}>
            🎭 Funko Pops
          </Text>
          <View style={styles.toggleBadge}>
            <Text style={styles.toggleBadgeText}>3,500+</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.toggleBtn, activeTab === 'loungefly' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('loungefly')}
        >
          <Text style={[styles.toggleText, activeTab === 'loungefly' && styles.toggleTextActive]}>
            👜 Loungefly
          </Text>
          <View style={styles.toggleBadge}>
            <Text style={styles.toggleBadgeText}>100+</Text>
          </View>
        </Pressable>
      </View>

      {/* Category Grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        {/* Render 2-column grid */}
        {Array.from({ length: Math.ceil(categories.length / 2) }, (_, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            {categories.slice(rowIdx * 2, rowIdx * 2 + 2).map((cat) => (
              <CategoryIconCard
                key={cat.handle}
                label={cat.label}
                handle={cat.handle}
                emoji={cat.emoji}
              />
            ))}
            {/* Pad last row if odd count */}
            {rowIdx * 2 + 1 >= categories.length && <View style={{ flex: 1 }} />}
          </View>
        ))}

        {/* Browse All button */}
        <Pressable
          style={styles.browseAllBtn}
          onPress={() => {}}
        >
          <Text style={styles.browseAllText}>
            Browse All {activeTab === 'funko' ? 'Funko Pops' : 'Loungefly'} →
          </Text>
        </Pressable>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[5],
    paddingBottom: Spacing[3],
  },
  title: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['3xl'],
    color: Colors.text.primary,
  },
  subtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[4],
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing[1],
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
  },
  toggleBtnActive: {
    backgroundColor: Colors.brand.violet,
  },
  toggleText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  toggleBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  toggleBadgeText: {
    fontFamily: FontFamily.interBold,
    fontSize: 9,
    color: Colors.white,
  },

  // Grid
  grid: {
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    height: 140,
  },
  browseAllBtn: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    marginTop: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  browseAllText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.base,
    color: Colors.brand.violet,
  },
});
