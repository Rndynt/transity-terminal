import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { bookingsApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth';
import { format } from 'date-fns';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E', label: 'Menunggu' },
  confirmed: { bg: '#D1FAE5', text: '#065F46', label: 'Dikonfirmasi' },
  paid: { bg: '#DBEAFE', text: '#1E40AF', label: 'Lunas' },
  checked_in: { bg: '#E0E7FF', text: '#3730A3', label: 'Check-in' },
  canceled: { bg: '#FEE2E2', text: '#991B1B', label: 'Dibatalkan' },
  refunded: { bg: '#F3F4F6', text: '#4B5563', label: 'Refund' },
};

export default function MyTripsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingsApi.list(),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="lock-closed" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Login Diperlukan</Text>
        <Text style={styles.emptySubtitle}>Masuk untuk melihat tiket Anda</Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/(auth)/login')}
          testID="button-goto-login"
        >
          <Text style={styles.loginBtnText}>Masuk</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="ticket-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Belum Ada Tiket</Text>
        <Text style={styles.emptySubtitle}>Pesan tiket pertama Anda sekarang</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={bookings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      renderItem={({ item }) => {
        const sc = statusColors[item.status] || statusColors.pending;
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/booking-detail', params: { id: item.id } })}
            testID={`card-booking-${item.id}`}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.routeText}>
                {item.origin?.name || 'N/A'} → {item.destination?.name || 'N/A'}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={14} color="#6B7280" />
                <Text style={styles.infoText}>{item.serviceDate || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="people" size={14} color="#6B7280" />
                <Text style={styles.infoText}>{item.passengerCount} penumpang</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="bus" size={14} color="#6B7280" />
                <Text style={styles.infoText}>{item.patternName || item.patternCode}</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.amountText}>
                Rp {Number(item.totalAmount || 0).toLocaleString('id-ID')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: 16, paddingBottom: 40 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  loginBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12, marginTop: 20 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  routeText: { fontSize: 15, fontWeight: '700', color: '#1F2937', flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBody: { gap: 6, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#4B5563' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  amountText: { fontSize: 16, fontWeight: '800', color: '#1E40AF' },
});
