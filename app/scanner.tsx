// PetezPopz — Barcode Scanner Screen
// Uses react-native-vision-camera v5 (built-in object/code scanning)
// Scans UPC/EAN barcodes and searches Shopify by SKU.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useObjectOutput,
  type ScannedObject,
  type ScannedCode,
  type ScannedObjectType,
} from 'react-native-vision-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../src/theme/colors';
import { FontFamily, FontSize } from '../src/theme/typography';
import { Spacing, BorderRadius } from '../src/theme/spacing';
import { searchProductBySKU } from '../src/api/queries/products';

type ScanState = 'idle' | 'scanning' | 'found' | 'not_found';

// Barcode types supported by VisionCamera v5
const BARCODE_TYPES: ScannedObjectType[] = [
  'ean-13',
  'ean-8',
  'upc-e',
  'code-128',
  'code-39',
  'qr',
];

export default function ScannerScreen() {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  // Use a ref to track scan state inside the callback without stale closures
  const scanStateRef = useRef<ScanState>('idle');
  const lastScanRef = useRef<string | null>(null);

  // Laser sweep animation
  const laserY = useSharedValue(0);
  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserY.value }],
  }));

  useEffect(() => {
    laserY.value = withRepeat(
      withTiming(200, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  const handleObjectsScanned = useCallback(
    async (objects: ScannedObject[]) => {
      // Filter to only ScannedCode objects (barcodes) which have a `value`
      const codes = objects.filter(
        (o): o is ScannedCode => 'value' in o && typeof (o as ScannedCode).value === 'string',
      );

      const code = codes[0]?.value;
      if (
        !code ||
        code === lastScanRef.current ||
        scanStateRef.current === 'scanning'
      ) {
        return;
      }

      lastScanRef.current = code;
      scanStateRef.current = 'scanning';
      setLastScan(code);
      setScanState('scanning');
      setIsActive(false);

      try {
        const result = await searchProductBySKU(code);
        const products = result.data.products.nodes;

        if (products.length > 0) {
          scanStateRef.current = 'found';
          setScanState('found');
          setTimeout(() => {
            router.replace(`/product/${products[0].handle}`);
          }, 600);
        } else {
          scanStateRef.current = 'not_found';
          setScanState('not_found');
          setTimeout(() => {
            scanStateRef.current = 'idle';
            lastScanRef.current = null;
            setScanState('idle');
            setLastScan(null);
            setIsActive(true);
          }, 3000);
        }
      } catch {
        scanStateRef.current = 'idle';
        lastScanRef.current = null;
        setScanState('idle');
        setLastScan(null);
        setIsActive(true);
      }
    },
    [router],
  );

  // VisionCamera v5: useObjectOutput replaces useBarcodeScanner
  const objectOutput = useObjectOutput({
    types: BARCODE_TYPES,
    onObjectsScanned: handleObjectsScanned,
  });

  if (!hasPermission) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permSub}>
          Allow camera access to scan product barcodes.
        </Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permTitle}>No Camera Found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera view — V5 API: pass outputs array */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        outputs={[objectOutput]}
      />

      {/* Dark overlay with cutout effect */}
      <View style={styles.overlay}>
        {/* Top darken */}
        <View style={styles.overlayTop} />

        {/* Middle row: dark | viewfinder | dark */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />

          {/* Viewfinder box */}
          <View style={styles.viewfinder}>
            {/* Corner brackets */}
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <View
                key={corner}
                style={[
                  styles.corner,
                  corner.includes('t') ? styles.cornerTop : styles.cornerBottom,
                  corner.includes('l') ? styles.cornerLeft : styles.cornerRight,
                ]}
              />
            ))}

            {/* Laser sweep */}
            <Animated.View style={[styles.laser, laserStyle]} />

            {/* Scan state feedback */}
            {scanState === 'scanning' && (
              <View style={styles.stateOverlay}>
                <ActivityIndicator color={Colors.brand.violet} size="large" />
                <Text style={styles.stateText}>Searching catalog...</Text>
              </View>
            )}
            {scanState === 'found' && (
              <View style={[styles.stateOverlay, styles.foundOverlay]}>
                <Text style={styles.stateIconLarge}>✅</Text>
                <Text style={styles.stateText}>Product found!</Text>
              </View>
            )}
          </View>

          <View style={styles.overlaySide} />
        </View>

        {/* Bottom darken + instructions */}
        <View style={styles.overlayBottom}>
          {scanState === 'not_found' ? (
            <View style={styles.notFoundToast}>
              <Text style={styles.notFoundTitle}>😔 Item not found online</Text>
              <Text style={styles.notFoundSub}>
                Ask an associate at the counter for help!
              </Text>
            </View>
          ) : (
            <Text style={styles.instructions}>
              {scanState === 'idle' || scanState === 'scanning'
                ? 'Point camera at a barcode to search our catalog'
                : ''}
            </Text>
          )}

          <View style={styles.skuDisplay}>
            {lastScan && <Text style={styles.skuText}>SKU: {lastScan}</Text>}
          </View>

          {/* Reset button */}
          {scanState === 'not_found' && (
            <Pressable
              style={styles.rescanBtn}
              onPress={() => {
                scanStateRef.current = 'idle';
                lastScanRef.current = null;
                setScanState('idle');
                setLastScan(null);
                setIsActive(true);
              }}
            >
              <Text style={styles.rescanText}>🔄 Scan Again</Text>
            </Pressable>
          )}
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
  permContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[8],
    gap: Spacing[4],
  },
  permIcon: { fontSize: 56 },
  permTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.xl,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  permSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
  },
  permBtnText: {
    fontFamily: FontFamily.interBold,
    color: Colors.white,
    fontSize: FontSize.base,
  },

  // Overlay
  overlay: { flex: 1 },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
    overflow: 'hidden',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    paddingTop: Spacing[6],
    gap: Spacing[4],
    paddingHorizontal: Spacing[6],
  },

  // Corners
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: Colors.brand.violet,
  },
  cornerTop: { top: 0, borderTopWidth: CORNER_THICKNESS },
  cornerBottom: { bottom: 0, borderBottomWidth: CORNER_THICKNESS },
  cornerLeft: { left: 0, borderLeftWidth: CORNER_THICKNESS },
  cornerRight: { right: 0, borderRightWidth: CORNER_THICKNESS },

  // Laser
  laser: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: Colors.brand.violet,
    shadowColor: Colors.brand.violet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },

  // State overlays
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,18,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  foundOverlay: { backgroundColor: 'rgba(34,197,94,0.2)' },
  stateIconLarge: { fontSize: 48 },
  stateText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },

  // Bottom info
  instructions: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  skuDisplay: { minHeight: 24 },
  skuText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.5)',
  },
  rescanBtn: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
  },
  rescanText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  notFoundToast: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    alignItems: 'center',
    gap: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.border.default,
    width: '100%',
  },
  notFoundTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  notFoundSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
