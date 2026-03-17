import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { tripsApi } from '../src/lib/api';
import { format } from 'date-fns';

export default function SearchResultsScreen() {
  const router = useRouter();
  const { originCity, destinationCity, date, passengers } = useLocalSearchParams<{
    originCity: string;
    destinationCity: string;
    date: string;
    passengers: string;
  }>();

  const { data: results, isLoading } = useQuery({
    queryKey: ['search-trips', originCity, destinationCity, date],
    queryFn: () => tripsApi.search({ originCity: originCity!, destinationCity: destinationCity!, date: date!, passengers: Number(passengers || 1) }),
    enabled: !!originCity && !!destinationCity && !!date,
  });

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '--:--';
    try {
      return format(new Date(isoStr), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const getDuration = (depart: string | null, arrive: string | null) => {
    if (!depart || !arrive) return '';
    try {
      const diff = new Date(arrive).getTime() - new Date(depart).getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return `${hours}j ${mins}m`;
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Mencari bus tersedia...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {originCity} → {destinationCity}
        </Text>
        <Text style={styles.summaryDate}>{date} · {passengers || 1} pax</Text>
      </View>

      {!results || results.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bus-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Tidak Ada Bus</Text>
          <Text style={styles.emptySubtitle}>Coba tanggal atau rute lain</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.tripId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tripCard}
              onPress={() => router.push({
                pathname: '/trip-detail',
                params: {
                  tripId: item.tripId,
                  originStopId: item.origin.stopId,
                  destStopId: item.destination.stopId,
                  originSeq: item.origin.sequence.toString(),
                  destSeq: item.destination.sequence.toString(),
                },
              })}
              testID={`card-trip-${item.tripId}`}
            >
              <View style={styles.tripHeader}>
                <Text style={styles.tripPattern}>{item.patternName || item.patternCode}</Text>
                {item.availableSeats !== undefined && (
                  <View style={[styles.seatsBadge, item.availableSeats < 5 && styles.seatsBadgeLow]}>
                    <Text style={[styles.seatsText, item.availableSeats < 5 && styles.seatsTextLow]}>
                      {item.availableSeats} kursi
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.timeRow}>
                <View style={styles.timePoint}>
                  <Text style={styles.timeText}>{formatTime(item.origin.departAt)}</Text>
                  <Text style={styles.cityName}>{item.origin.name}</Text>
                </View>
                <View style={styles.timeLine}>
                  <View style={styles.lineBar} />
                  <Text style={styles.durationText}>{getDuration(item.origin.departAt, item.destination.arriveAt)}</Text>
                </View>
                <View style={[styles.timePoint, { alignItems: 'flex-end' }]}>
                  <Text style={styles.timeText}>{formatTime(item.destination.arriveAt)}</Text>
                  <Text style={styles.cityName}>{item.destination.name}</Text>
                </View>
              </View>

              <View style={styles.tripFooter}>
                <Text style={styles.priceText}>
                  Rp {Number(item.farePerPerson || 0).toLocaleString('id-ID')}
                  <Text style={styles.priceUnit}>/orang</Text>
                </Text>
                <TouchableOpacity style={styles.selectBtn} testID={`button-select-trip-${item.tripId}`}>
                  <Text style={styles.selectBtnText}>Pilih</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  summaryBar: { backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DBEAFE' },
  summaryText: { fontSize: 15, fontWeight: '700', color: '#1E40AF' },
  summaryDate: { fontSize: 12, color: '#3B82F6', marginTop: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 40 },
  tripCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tripPattern: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  seatsBadge: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  seatsBadgeLow: { backgroundColor: '#FEE2E2' },
  seatsText: { fontSize: 11, fontWeight: '600', color: '#065F46' },
  seatsTextLow: { color: '#991B1B' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  timePoint: { flex: 1 },
  timeText: { fontSize: 22, fontWeight: '800', color: '#1F2937' },
  cityName: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  timeLine: { flex: 1, alignItems: 'center' },
  lineBar: { width: '80%', height: 2, backgroundColor: '#E5E7EB', borderRadius: 1 },
  durationText: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  tripFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  priceText: { fontSize: 18, fontWeight: '800', color: '#1E40AF' },
  priceUnit: { fontSize: 12, fontWeight: '400', color: '#6B7280' },
  selectBtn: { flexDirection: 'row', backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', gap: 4 },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
