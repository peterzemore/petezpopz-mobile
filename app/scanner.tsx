// PetezPopz — Barcode Scanner Screen
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { Colors } from '../src/theme/colors';
import { FontFamily, FontSize } from '../src/theme/typography';
import { Spacing, BorderRadius } from '../src/theme/spacing';
import { searchProductBySKU } from '../src/api/queries/products';

type ScanState = 'idle' | 'scanning' | 'found' | 'not_found' | 'error';

const LOOKUP_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Lookup timed out')), ms),
    ),
  ]);
}

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const scanStateRef = useRef<ScanState>('idle');
  const laserY = useSharedValue(0);
  const laserStyle = useAnimatedStyle(() => ({ transform: [{ translateY: laserY.value }] }));

  useEffect(() => {
    laserY.value = withRepeat(withTiming(200, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (!hasPermission) requestPermission();
  }, []);

  // Resets both the ref the scan-gate actually checks AND the render state —
  // previously "Scan Again" only reset the render state, leaving the ref
  // stuck so every scan after the first miss was silently ignored forever.
  const resetToIdle = useCallback(() => {
    scanStateRef.current = 'idle';
    setScanState('idle');
    setLastScan(null);
  }, []);

  const handleCodeScanned = useCallback(async (codes: { value?: string }[]) => {
  const raw = codes[0]?.value;
  // Ensure we only scan if we have a value and are in 'idle' state
  if (!raw || scanStateRef.current !== 'idle') return;

  scanStateRef.current = 'scanning';
  setScanState('scanning');
  setLastScan(raw);

  try {
    const result = await withTimeout(searchProductBySKU(raw), LOOKUP_TIMEOUT_MS);

    // Safely extract the products array
    const products = result?.data?.products?.nodes;

    if (Array.isArray(products) && products.length > 0) {
      // Success: Reset state and navigate
      scanStateRef.current = 'idle';
      router.replace(`/product/${products[0].handle}`);
    } else {
      // Not found: Update UI
      scanStateRef.current = 'not_found';
      setScanState('not_found');
    }
  } catch (err) {
    console.error('[Scanner] lookup error:', err);
    // Land on a distinct, camera-paused state instead of silently resetting to
    // 'idle' — the previous behavior re-triggered the same failing lookup on
    // every frame as long as the barcode stayed in view, which looked like the
    // app was stuck "thinking" forever with no visible error.
    scanStateRef.current = 'error';
    setScanState('error');
  }
}, [router]);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'code-39', 'qr'],
    onCodeScanned: handleCodeScanned,
  });

  if (!hasPermission || !device) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scanState === 'idle' || scanState === 'scanning'}
        codeScanner={codeScanner}
      />

      <View style={styles.overlay}>
        <View style={styles.overlayTop}>
          <Pressable
            style={[styles.closeBtn, { top: insets.top + Spacing[3] }]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            hitSlop={12}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTop, styles.cornerLeft]} />
            <View style={[styles.corner, styles.cornerTop, styles.cornerRight]} />
            <View style={[styles.corner, styles.cornerBottom, styles.cornerLeft]} />
            <View style={[styles.corner, styles.cornerBottom, styles.cornerRight]} />
            <Animated.View style={[styles.laser, laserStyle]} />
          </View>
          <View style={styles.overlaySide} />
        </View>

        <View style={styles.overlayBottom}>
          {scanState === 'not_found' || scanState === 'error' ? (
            <View style={styles.notFoundToast}>
              <Text style={styles.notFoundTitle}>
                {scanState === 'error' ? '⚠️ Lookup failed' : '😔 Product not found'}
              </Text>
              <Pressable onPress={resetToIdle} style={styles.rescanBtn}>
                <Text style={styles.rescanText}>Scan Again</Text>
              </Pressable>
            </View>
          ) : scanState === 'scanning' ? (
            <View style={styles.notFoundToast}>
              <ActivityIndicator color={Colors.brand.violet} />
              <Text style={styles.instructions}>Looking up product…</Text>
            </View>
          ) : (
            <Text style={styles.instructions}>Point camera at a barcode</Text>
          )}
          <View style={styles.skuDisplay}>
            {lastScan && <Text style={styles.skuText}>SKU: {lastScan}</Text>}
          </View>
        </View>
      </View>
    </View>
  );
}

const VIEWFINDER_SIZE = 260;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  overlay: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  closeBtn: {
    position: 'absolute',
    left: Spacing[4],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: Colors.white, fontSize: 20, fontWeight: 'bold' },
  overlayMiddle: { flexDirection: 'row', height: VIEWFINDER_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  viewfinder: { width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE, position: 'relative' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', paddingTop: Spacing[6], gap: Spacing[4] },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: Colors.brand.violet },
  cornerTop: { top: 0, borderTopWidth: CORNER_THICKNESS },
  cornerBottom: { bottom: 0, borderBottomWidth: CORNER_THICKNESS },
  cornerLeft: { left: 0, borderLeftWidth: CORNER_THICKNESS },
  cornerRight: { right: 0, borderRightWidth: CORNER_THICKNESS },
  laser: { position: 'absolute', left: 8, right: 8, height: 2, backgroundColor: Colors.brand.violet, elevation: 4 },
  instructions: { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  skuDisplay: { minHeight: 24 },
  skuText: { color: 'rgba(255,255,255,0.5)' },
  rescanBtn: { backgroundColor: Colors.brand.violet, padding: Spacing[3], borderRadius: BorderRadius.full },
  rescanText: { color: Colors.white, fontWeight: 'bold' },
  notFoundToast: { backgroundColor: Colors.bg.elevated, padding: Spacing[5], borderRadius: BorderRadius.xl, alignItems: 'center' },
  notFoundTitle: { color: Colors.text.primary, fontWeight: 'bold' }
});