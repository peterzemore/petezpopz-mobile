// PetezPopz — OAuth callback handler (Android standalone-build fallback)
//
// expo-auth-session's redirect completion is unreliable in standalone Android
// builds specifically (works fine in a dev client) — the OAuth redirect deep
// link arrives, but WebBrowser's auth-session interception doesn't catch it,
// so it falls through to normal app routing instead of being handled inline
// by app/auth/login.tsx. This screen is expo-router's landing spot for that
// same redirect (matching the "callback" path regardless of which of the
// app's registered schemes was used), and completes the token exchange itself
// using the PKCE verifier login.tsx persisted before starting the flow.
// See: https://github.com/expo/expo/issues/8834
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../src/theme/colors';
import { FontFamily, FontSize } from '../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../src/theme/spacing';
import { exchangeCodeForTokens, getAndClearPendingVerifier } from '../src/api/shopify-customer';
import { useAuthStore } from '../src/store/authStore';

export default function CallbackScreen() {
  const router = useRouter();
  const { code, error: oauthError } = useLocalSearchParams<{ code?: string; error?: string }>();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (oauthError) {
      console.error('OAuth error on callback:', oauthError);
      setFailed(true);
      return;
    }
    if (!code) {
      setFailed(true);
      return;
    }

    getAndClearPendingVerifier()
      .then((verifier) => {
        if (!verifier) throw new Error('No stored PKCE verifier for this sign-in attempt');
        return exchangeCodeForTokens(code, verifier);
      })
      .then(({ accessToken, refreshToken, expiresIn }) => setTokens(accessToken, refreshToken, expiresIn))
      .then(() => router.replace('/(tabs)'))
      .catch((err) => {
        console.error('Callback token exchange failed:', err);
        setFailed(true);
      });
  }, [code, oauthError]);

  if (failed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Sign-In Didn't Finish</Text>
          <Text style={styles.subtitle}>
            Something interrupted the sign-in process. Please try signing in again.
          </Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          >
            <Text style={styles.retryText}>Back to PetezPopz</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.brand.violet} />
        <Text style={styles.subtitle}>Finishing sign-in…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
    gap: Spacing[4],
  },
  icon: { fontSize: 48 },
  title: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.xl,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: Spacing[2],
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
    ...Shadow.violet,
  },
  retryText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
