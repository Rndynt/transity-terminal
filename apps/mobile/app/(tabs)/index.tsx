import { useState, type ComponentProps } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];
import { tripsApi } from '../../src/lib/api';

export default function HomeScreen() {
  const router = useRouter();
  const [originCity, setOriginCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [passengers, setPassengers] = useState(1);

  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: () => tripsApi.getCities(),
  });

  const handleSearch = () => {
    if (!originCity || !destinationCity || !date) return;
    router.push({
      pathname: '/search-results',
      params: { originCity, destinationCity, date, passengers: passengers.toString() },
    });
  };

  const swapCities = () => {
    setOriginCity(destinationCity);
    setDestinationCity(originCity);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Pesan Tiket Bus</Text>
        <Text style={styles.heroSubtitle}>Perjalanan nyaman ke seluruh kota</Text>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.cityRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dari</Text>
            <TextInput
              style={styles.input}
              placeholder="Kota asal"
              value={originCity}
              onChangeText={setOriginCity}
              testID="input-origin-city"
            />
          </View>

          <TouchableOpacity onPress={swapCities} style={styles.swapBtn} testID="button-swap-cities">
            <Ionicons name="swap-vertical" size={20} color="#2563EB" />
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ke</Text>
            <TextInput
              style={styles.input}
              placeholder="Kota tujuan"
              value={destinationCity}
              onChangeText={setDestinationCity}
              testID="input-destination-city"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Tanggal</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
              testID="input-date"
            />
          </View>
          <View style={[styles.inputGroup, { width: 80, marginLeft: 12 }]}>
            <Text style={styles.label}>Pax</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                onPress={() => setPassengers(Math.max(1, passengers - 1))}
                style={styles.counterBtn}
                testID="button-decrease-pax"
              >
                <Ionicons name="remove" size={16} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.counterText}>{passengers}</Text>
              <TouchableOpacity
                onPress={() => setPassengers(Math.min(10, passengers + 1))}
                style={styles.counterBtn}
                testID="button-increase-pax"
              >
                <Ionicons name="add" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.searchButton, (!originCity || !destinationCity) && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!originCity || !destinationCity}
          testID="button-search-trips"
        >
          <Ionicons name="search" size={18} color="#fff" />
          <Text style={styles.searchButtonText}>Cari Bus</Text>
        </TouchableOpacity>
      </View>

      {cities && cities.length > 0 && (
        <View style={styles.citiesSection}>
          <Text style={styles.sectionTitle}>Kota Populer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {cities.map((c) => (
              <TouchableOpacity
                key={c.city}
                style={styles.cityChip}
                onPress={() => {
                  if (!originCity) setOriginCity(c.city);
                  else if (!destinationCity) setDestinationCity(c.city);
                }}
                testID={`chip-city-${c.city}`}
              >
                <Ionicons name="location" size={14} color="#2563EB" />
                <Text style={styles.cityChipText}>{c.city}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Layanan Kami</Text>
        <View style={styles.featuresGrid}>
          {[
            { icon: 'ticket', label: 'Tiket Bus', desc: 'Pesan tiket online' },
            { icon: 'cube' as IoniconsName, label: 'Kirim Kargo', desc: 'Pengiriman barang' },
            { icon: 'qr-code' as IoniconsName, label: 'E-Ticket', desc: 'Tiket digital QR' },
            { icon: 'star' as IoniconsName, label: 'Review', desc: 'Ulasan perjalanan' },
          ].map((f) => (
            <View key={f.label} style={styles.featureCard}>
              <Ionicons name={f.icon} size={28} color="#2563EB" />
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 40 },
  hero: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 60,
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  heroSubtitle: { fontSize: 14, color: '#BFDBFE', marginTop: 4 },
  searchCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -40,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  cityRow: { flexDirection: 'row', alignItems: 'flex-end' },
  inputGroup: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 2,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 8 },
  counterBtn: { paddingHorizontal: 8 },
  counterText: { fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  searchButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 8,
  },
  searchButtonDisabled: { opacity: 0.5 },
  searchButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  citiesSection: { marginTop: 28, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    gap: 4,
  },
  cityChipText: { fontSize: 13, fontWeight: '600', color: '#1E40AF' },
  featuresSection: { marginTop: 28, paddingHorizontal: 16 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  featureLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginTop: 8 },
  featureDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
