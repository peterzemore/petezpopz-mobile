// PetezPopz — Root Layout
import '../src/polyfills'; // ← Must be first: patches Hermes Event.NONE read-only bug
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { useCartStore } from '../src/store/cartStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const loadSession = useAuthStore((s) => s.loadSession);
  const initCart = useCartStore((s) => s.initCart);

  useEffect(() => {
    const bootstrap = async () => {
      await Promise.all([loadSession(), initCart()]);
      if (fontsLoaded) {
        await SplashScreen.hideAsync();
      }
    };
    bootstrap();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg.primary }}>
      <StatusBar style="light" backgroundColor={Colors.bg.primary} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bg.secondary },
          headerTintColor: Colors.text.primary,
          headerTitleStyle: {
            fontFamily: 'Outfit_700Bold',
            fontSize: 18,
          },
          contentStyle: { backgroundColor: Colors.bg.primary },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[handle]" options={{ title: 'Product', headerShown: false }} />
        <Stack.Screen name="collection/[handle]" options={{ title: 'Collection' }} />
        <Stack.Screen
          name="scanner"
          options={{
            title: 'Scan Barcode',
            presentation: 'fullScreenModal',
            headerStyle: { backgroundColor: Colors.black },
            headerTintColor: Colors.white,
          }}
        />
        <Stack.Screen
          name="auth/login"
          options={{
            title: 'Sign In',
            presentation: 'modal',
            headerStyle: { backgroundColor: Colors.bg.secondary },
          }}
        />
        <Stack.Screen
          name="checkout"
          options={{
            title: 'Checkout',
            presentation: 'modal',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
