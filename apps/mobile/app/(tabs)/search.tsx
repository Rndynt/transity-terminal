import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { tripsApi } from '../../src/lib/api';

export default function SearchScreen() {
  const router = useRouter();
  const [originCity, setOriginCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [passengers, setPassengers] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: () => tripsApi.getCities(),
  });

  const filteredCities = cities?.filter(c =>
    c.city.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleSearch = () => {
    if (!originCity || !destinationCity || !date) return;
    router.push({
      pathname: '/search-results',
      params: { originCity, destinationCity, date, passengers: passengers.toString() },
    });
  };

  const selectCity = (city: string) => {
    if (!originCity) {
      setOriginCity(city);
    } else if (!destinationCity) {
      setDestinationCity(city);
    }
    setSearchQuery('');
  };

  const swapCities = () => {
    setOriginCity(destinationCity);
    setDestinationCity(originCity);
  };

  const clearSelection = (field: 'origin' | 'destination') => {
    if (field === 'origin') setOriginCity('');
    else setDestinationCity('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.formSection}>
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeIndicator}>
              <Ionicons name="radio-button-on" size={12} color="#2563EB" />
              <View style={styles.routeLine} />
              <Ionicons name="location" size={12} color="#EF4444" />
            </View>
            <View style={styles.routeInputs}>
              <TouchableOpacity style={styles.cityField} onPress={() => clearSelection('origin')} testID="field-origin">
                <Text style={[styles.cityLabel, { color: '#2563EB' }]}>Dari</Text>
                <Text style={originCity ? styles.cityValue : styles.cityPlaceholder}>
                  {originCity || 'Pilih kota asal'}
                </Text>
              </TouchableOpacity>
              <View style={styles.routeDivider} />
              <TouchableOpacity style={styles.cityField} onPress={() => clearSelection('destination')} testID="field-destination">
                <Text style={[styles.cityLabel, { color: '#EF4444' }]}>Ke</Text>
                <Text style={destinationCity ? styles.cityValue : styles.cityPlaceholder}>
                  {destinationCity || 'Pilih kota tujuan'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.swapBtn} onPress={swapCities} testID="button-swap">
              <Ionicons name="swap-vertical" size={18} color="#2563EB" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Tanggal</Text>
            <TextInput
              style={styles.dateInput}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              testID="input-search-date"
            />
          </View>
          <View style={styles.paxField}>
            <Text style={styles.fieldLabel}>Penumpang</Text>
            <View style={styles.paxCounter}>
              <TouchableOpacity onPress={() => setPassengers(Math.max(1, passengers - 1))} testID="button-pax-minus">
                <Ionicons name="remove-circle" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.paxText}>{passengers}</Text>
              <TouchableOpacity onPress={() => setPassengers(Math.min(10, passengers + 1))} testID="button-pax-plus">
                <Ionicons name="add-circle" size={24} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, (!originCity || !destinationCity) && { opacity: 0.5 }]}
          onPress={handleSearch}
          disabled={!originCity || !destinationCity}
          testID="button-search"
        >
          <Ionicons name="search" size={18} color="#fff" />
          <Text style={styles.searchBtnText}>Cari Bus</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.citiesSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari kota..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="input-search-city"
        />

        <Text style={styles.sectionLabel}>
          {!originCity ? 'Pilih Kota Asal' : !destinationCity ? 'Pilih Kota Tujuan' : 'Kota Tersedia'}
        </Text>

        <FlatList
          data={searchQuery ? filteredCities : cities}
          keyExtractor={(item) => item.city}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.cityItem,
                (item.city === originCity || item.city === destinationCity) && styles.cityItemSelected,
              ]}
              onPress={() => selectCity(item.city)}
              disabled={item.city === originCity || item.city === destinationCity}
              testID={`city-item-${item.city}`}
            >
              <View style={styles.cityItemLeft}>
                <Ionicons
                  name="location"
                  size={16}
                  color={item.city === originCity ? '#2563EB' : item.city === destinationCity ? '#EF4444' : '#9CA3AF'}
                />
                <Text style={[styles.cityItemText, (item.city === originCity || item.city === destinationCity) && styles.cityItemTextSelected]}>
                  {item.city}
                </Text>
              </View>
              <Text style={styles.cityItemCount}>{item.stopCount} halte</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text style={styles.emptyText}>Tidak ada kota ditemukan</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  formSection: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  routeCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  routeIndicator: { width: 20, alignItems: 'center', marginRight: 8, gap: 2 },
  routeLine: { width: 1, height: 20, backgroundColor: '#D1D5DB' },
  routeInputs: { flex: 1 },
  cityField: { paddingVertical: 6 },
  cityLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cityValue: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginTop: 2 },
  cityPlaceholder: { fontSize: 15, color: '#9CA3AF', marginTop: 2 },
  routeDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  swapBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  detailRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  dateField: { flex: 1 },
  paxField: { width: 120 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
  },
  paxCounter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 6 },
  paxText: { fontSize: 18, fontWeight: '700', color: '#1F2937', minWidth: 24, textAlign: 'center' },
  searchBtn: { flexDirection: 'row', backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  citiesSection: { flex: 1, padding: 16 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  cityItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: '#F3F4F6' },
  cityItemSelected: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  cityItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cityItemText: { fontSize: 15, fontWeight: '500', color: '#1F2937' },
  cityItemTextSelected: { fontWeight: '700', color: '#1E40AF' },
  cityItemCount: { fontSize: 12, color: '#9CA3AF' },
  emptyList: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
});
