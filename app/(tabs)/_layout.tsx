// PetezPopz — Tab Bar Layout
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { useCartStore } from '../../src/store/cartStore';

interface TabIconProps {
  emoji: string;
  label: string;
  focused: boolean;
  badgeCount?: number;
}

function TabIcon({ emoji, label, focused, badgeCount }: TabIconProps) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <View style={{ position: 'relative' }}>
        <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
        {!!badgeCount && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const cartQty = useCartStore((s) => s.totalQuantity());
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 56 + Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10),
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10),
          },
        ],
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.bg.secondary }]} />
          ),
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.brand.violet,
        tabBarInactiveTintColor: Colors.text.muted,
        // Give the icon slot enough height to show emoji + label without clipping
        tabBarIconStyle: { height: 54, width: 72 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🛍️" label="Shop" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="toybox"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🧸" label="Toy Box" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⭐" label="Rewards" focused={focused} badgeCount={undefined} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
    paddingTop: 6,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    // Prevent the container from clipping children
    overflow: 'visible',
  },
  tabItemActive: {
    backgroundColor: 'rgba(123,47,255,0.12)',
  },
  tabEmoji: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabEmojiActive: {
    opacity: 1,
  },
  tabLabel: {
    fontFamily: FontFamily.interMedium,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: Colors.brand.violet,
    fontFamily: FontFamily.interBold,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.brand.rose,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: FontFamily.interBold,
    fontSize: 9,
    color: Colors.white,
  },
});
