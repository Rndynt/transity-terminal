import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/auth';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

export default function RootLayout() {
  const { isLoading, loadToken } = useAuthStore();

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    loadToken();
  }, []);

  if (isLoading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="search-results" options={{ headerShown: true, title: 'Hasil Pencarian' }} />
        <Stack.Screen name="trip-detail" options={{ headerShown: true, title: 'Detail Trip' }} />
        <Stack.Screen name="select-seats" options={{ headerShown: true, title: 'Pilih Kursi' }} />
        <Stack.Screen name="booking-confirm" options={{ headerShown: true, title: 'Konfirmasi Booking' }} />
        <Stack.Screen name="booking-detail" options={{ headerShown: true, title: 'Detail Booking' }} />
        <Stack.Screen name="e-ticket" options={{ headerShown: true, title: 'E-Ticket' }} />
      </Stack>
    </QueryClientProvider>
  );
}
