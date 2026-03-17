import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          height: 56,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#2563EB' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          headerTitle: 'Transity',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Cari',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
          headerTitle: 'Cari Bus',
        }}
      />
      <Tabs.Screen
        name="my-trips"
        options={{
          title: 'Perjalanan',
          tabBarIcon: ({ color, size }) => <Ionicons name="ticket" size={size} color={color} />,
          headerTitle: 'Perjalanan Saya',
        }}
      />
      <Tabs.Screen
        name="cargo"
        options={{
          title: 'Kirim Paket',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
          headerTitle: 'Kirim Paket',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          headerTitle: 'Profil Saya',
        }}
      />
    </Tabs>
  );
}
