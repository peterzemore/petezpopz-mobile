// PetezPopz — OAuth Login Screen (PKCE flow)
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../src/theme/spacing';
import { useShopifyAuth, exchangeCodeForTokens } from '../../src/api/shopify-customer';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { request, response, promptAsync } = useShopifyAuth();
  const { setTokens, isAuthenticated, isLoading } = useAuthStore();

  // Handle OAuth callback
  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      const verifier = request?.codeVerifier;
      if (code && verifier) {
        exchangeCodeForTokens(code, verifier)
          .then(({ accessToken, refreshToken, expiresIn }) =>
            setTokens(accessToken, refreshToken, expiresIn),
          )
          .then(() => router.back())
          .catch((err) => console.error('Token exchange failed:', err));
      }
    }
  }, [response]);

  // Biometric auth for returning users
  useEffect(() => {
    if (isAuthenticated) {
      router.back();
      return;
    }
    tryBiometricLogin();
  }, [isAuthenticated]);

  const tryBiometricLogin = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) return;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to PetezPopz',
      fallbackLabel: 'Use Passcode',
    });

    if (result.success) {
      // Biometric passed — re-load existing session
      await useAuthStore.getState().loadSession();
      if (useAuthStore.getState().isAuthenticated) {
        router.back();
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
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
          style={styles.signInBtn}
          onPress={() => promptAsync()}
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

        {/* Biometric prompt */}
        <Pressable style={styles.biometricBtn} onPress={tryBiometricLogin}>
          <Text style={styles.biometricText}>🔐 Sign in with Face ID / Touch ID</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
          Your Shopify account secures all data.
        </Text>

        {/* Skip */}
        <Pressable style={styles.skipBtn} onPress={() => router.back()}>
          <Text style={styles.skipText}>Continue as Guest</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[8],
    alignItems: 'center',
    gap: Spacing[6],
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
  biometricBtn: {
    width: '100%',
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  biometricText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  disclaimer: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  skipBtn: { paddingVertical: Spacing[3] },
  skipText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    textDecorationLine: 'underline',
  },
});
