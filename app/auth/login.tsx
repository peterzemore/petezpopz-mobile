// PetezPopz — OAuth Login Screen (PKCE flow)
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../src/theme/spacing';
import { useShopifyAuth, exchangeCodeForTokens, savePendingVerifier } from '../../src/api/shopify-customer';
import { useAuthStore } from '../../src/store/authStore';

// Shopify serves these on the store's primary domain; both required to be
// reachable in-app for App Store / Play Store review.
const TERMS_URL = 'https://petezpopz.com/policies/terms-of-service';
const PRIVACY_URL = 'https://petezpopz.com/policies/privacy-policy';

export default function LoginScreen() {
  const router = useRouter();
  // useAuthRequest returns a tuple [request, response, promptAsync] — not an object.
  const [request, response, promptAsync] = useShopifyAuth();
  const { setTokens, isLoading } = useAuthStore();

  // Persist the PKCE verifier as soon as it exists — in standalone Android
  // builds, the redirect can land on app/callback.tsx instead of being caught
  // here, and that screen needs this to complete the exchange itself.
  useEffect(() => {
    if (request?.codeVerifier) {
      savePendingVerifier(request.codeVerifier);
    }
  }, [request?.codeVerifier]);

  // OAuth Callback
  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      const verifier = request?.codeVerifier;
      if (code && verifier) {
        exchangeCodeForTokens(code, verifier)
          .then(({ accessToken, refreshToken, expiresIn }) =>
            setTokens(accessToken, refreshToken, expiresIn),
          )
          .then(() => {
            // After a logout, this screen is reached via router.replace(), which
            // leaves no history entry to go back to — calling back() in that case
            // throws "GO_BACK was not handled by any navigator".
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          })
          .catch((err) => {
            console.error('Token exchange failed:', err);
            alert('Sign in failed. Please try again.');
          });
      }
    }
  }, [response]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Decorative gradient background */}
        <LinearGradient
          colors={['rgba(123,47,255,0.15)', 'transparent']}
          style={styles.bgGradient}
        />

        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logoIcon}>🎯</Text>
          <Text style={styles.logoTitle}>PetezPopz</Text>
          <Text style={styles.logoSub}>Collector's Hub</Text>
        </View>

        {/* Benefits list */}
        <View style={styles.benefits}>
          {[
            { icon: '⭐', text: 'Earn 1 point per $1 spent' },
            { icon: '✨', text: 'VIP early access to exclusive drops' },
            { icon: '🎁', text: 'Redeem points for discount codes' },
            { icon: '🧸', text: 'Save your Toy Box wish list' },
          ].map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* OAuth Sign In button */}
        <Pressable
          style={[styles.signInBtn, (!request || isLoading) && { opacity: 0.5 }]}
          onPress={async () => {
            if (isLoading) return;
            try {
              // Shopify's hosted login/create-account page is a JS SPA. On
              // Android, Custom Tabs defaults to whatever the device's
              // default browser is — some OEM browsers render it as a
              // stripped-down sign-in-only form, dropping the "create
              // account" link that a fully-capable Chrome renders. Force
              // Chrome when it's available so the page renders consistently
              // with iOS's Safari-based auth session.
              let browserPackage: string | undefined;
              if (Platform.OS === 'android') {
                const { browserPackages } = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
                if (browserPackages.includes('com.android.chrome')) {
                  browserPackage = 'com.android.chrome';
                }
              }
              await promptAsync({ showInRecents: true, browserPackage });
            } catch (error) {
              console.error("Login attempt failed:", error);
            }
          }}
          disabled={!request || isLoading}
        >
          <LinearGradient
            colors={[Colors.brand.violet, Colors.brand.rose]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.signInText}>🛍️ Sign In / Create Account</Text>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          By signing in, you agree to our{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
          . Your Shopify account secures all data.
        </Text>

        {/* Skip */}
        <Pressable
          style={styles.skipBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Text style={styles.skipText}>Continue as Guest</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[8],
    paddingBottom: Spacing[8],
    alignItems: 'center',
    gap: Spacing[8], // Increased from Spacing[6] to create more room
  },
  bgGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  logoSection: {
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[6],
  },
  logoIcon: { fontSize: 64 },
  logoTitle: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['3xl'],
    color: Colors.text.primary,
    letterSpacing: -1,
  },
  logoSub: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.base,
    color: Colors.brand.violet,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  benefits: {
    width: '100%',
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    gap: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
  },
  benefitIcon: { fontSize: 24 },
  benefitText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    flex: 1,
  },
  signInBtn: {
    width: '100%',
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadow.violet,
  },
  signInText: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.white,
    zIndex: 1,
  },
  disclaimer: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  disclaimerLink: {
    color: Colors.brand.violet,
    textDecorationLine: 'underline',
  },
  skipBtn: { paddingVertical: Spacing[3] },
  skipText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    textDecorationLine: 'underline',
  },
});
