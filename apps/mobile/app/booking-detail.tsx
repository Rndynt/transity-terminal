import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { bookingsApi } from '../src/lib/api';
import { format } from 'date-fns';

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E', label: 'Menunggu Bayar', icon: 'time' },
  confirmed: { bg: '#D1FAE5', text: '#065F46', label: 'Dikonfirmasi', icon: 'checkmark-circle' },
  paid: { bg: '#DBEAFE', text: '#1E40AF', label: 'Lunas', icon: 'checkmark-done-circle' },
  checked_in: { bg: '#E0E7FF', text: '#3730A3', label: 'Sudah Check-in', icon: 'log-in' },
  canceled: { bg: '#FEE2E2', text: '#991B1B', label: 'Dibatalkan', icon: 'close-circle' },
  refunded: { bg: '#F3F4F6', text: '#4B5563', label: 'Direfund', icon: 'return-down-back' },
};

export default function BookingDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => bookingsApi.getDetail(id!),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: any) => Alert.alert('Gagal', err.message),
  });

  const { data: paymentStatus } = useQuery({
    queryKey: ['payment-status', id],
    queryFn: () => bookingsApi.getPaymentStatus(id!),
    enabled: !!id && booking?.status === 'pending',
    refetchInterval: booking?.status === 'pending' ? 5000 : false,
  });

  const handleCancel = () => {
    Alert.alert('Batalkan Booking?', 'Booking yang dibatalkan tidak dapat dikembalikan.', [
      { text: 'Tidak', style: 'cancel' },
      { text: 'Batalkan', style: 'destructive', onPress: () => cancelMutation.mutate() },
    ]);
  };

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '--:--';
    try { return format(new Date(isoStr), 'HH:mm'); } catch { return '--:--'; }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Booking tidak ditemukan</Text>
      </View>
    );
  }

  const sc = statusConfig[booking.status] || statusConfig.pending;
  const canCancel = ['pending', 'confirmed'].includes(booking.status);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.statusBar, { backgroundColor: sc.bg }]}>
          <Ionicons name={sc.icon as any} size={20} color={sc.text} />
          <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rute</Text>
          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <Ionicons name="radio-button-on" size={14} color="#2563EB" />
              <View>
                <Text style={styles.routeCity}>{booking.origin?.name || 'N/A'}</Text>
                <Text style={styles.routeTime}>{formatTime(booking.departAt)}</Text>
              </View>
            </View>
            <View style={styles.routeDash} />
            <View style={styles.routePoint}>
              <Ionicons name="location" size={14} color="#EF4444" />
              <View>
                <Text style={styles.routeCity}>{booking.destination?.name || 'N/A'}</Text>
                <Text style={styles.routeTime}>{formatTime(booking.arriveAt)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={14} color="#6B7280" />
            <Text style={styles.infoText}>{booking.serviceDate || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="bus" size={14} color="#6B7280" />
            <Text style={styles.infoText}>{booking.patternName || booking.patternCode || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Penumpang</Text>
          {booking.passengers?.map((p: any, i: number) => (
            <View key={p.id} style={[styles.paxRow, i > 0 && styles.paxDivider]}>
              <View style={styles.paxSeat}>
                <Text style={styles.paxSeatText}>{p.seatNo}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paxName}>{p.fullName}</Text>
                {p.phone && <Text style={styles.paxPhone}>{p.phone}</Text>}
              </View>
              <Text style={styles.paxFare}>Rp {Number(p.fareAmount || 0).toLocaleString('id-ID')}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pembayaran</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>Rp {Number(booking.totalAmount || 0).toLocaleString('id-ID')}</Text>
          </View>
          {booking.payments?.map((p: any) => (
            <View key={p.id} style={styles.paymentRow}>
              <Text style={styles.paymentMethod}>{p.method.toUpperCase()}</Text>
              <Text style={styles.paymentStatus}>{p.status}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking ID</Text>
          <Text style={styles.bookingId}>{booking.id}</Text>
        </View>

        {booking.status === 'pending' && booking.paymentIntent && (
          <View style={styles.pendingPayBanner} testID="banner-payment-pending">
            <Ionicons name="time" size={20} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingPayTitle}>Menunggu Pembayaran</Text>
              <Text style={styles.pendingPayDesc}>
                Selesaikan pembayaran via {booking.paymentIntent.method?.toUpperCase() || 'payment gateway'}.
                {booking.holdExpiresAt ? ` Batas waktu: ${formatTime(booking.holdExpiresAt)}` : ''}
              </Text>
              {paymentStatus?.providerRef && (
                <Text style={styles.pendingPayRef}>Ref: {paymentStatus.providerRef}</Text>
              )}
            </View>
          </View>
        )}

        {['confirmed', 'paid'].includes(booking.status) && (
          <TouchableOpacity
            style={styles.ticketBtn}
            onPress={() => router.push({ pathname: '/e-ticket', params: { id: booking.id } })}
            testID="button-view-ticket"
          >
            <Ionicons name="qr-code" size={20} color="#2563EB" />
            <Text style={styles.ticketBtnText}>Lihat E-Ticket</Text>
          </TouchableOpacity>
        )}

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
            testID="button-cancel-booking"
          >
            <Text style={styles.cancelBtnText}>{cancelMutation.isPending ? 'Membatalkan...' : 'Batalkan Booking'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#EF4444', marginTop: 12 },
  content: { padding: 16, paddingBottom: 40 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 14, marginBottom: 16 },
  statusText: { fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  routePoint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeCity: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  routeTime: { fontSize: 12, color: '#6B7280' },
  routeDash: { width: 20, height: 1, backgroundColor: '#E5E7EB' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13, color: '#4B5563' },
  paxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  paxDivider: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  paxSeat: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  paxSeatText: { fontSize: 12, fontWeight: '800', color: '#2563EB', fontFamily: 'monospace' },
  paxName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  paxPhone: { fontSize: 12, color: '#6B7280' },
  paxFare: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#1E40AF' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  paymentMethod: { fontSize: 13, color: '#4B5563' },
  paymentStatus: { fontSize: 13, fontWeight: '600', color: '#059669' },
  bookingId: { fontSize: 13, fontFamily: 'monospace', color: '#6B7280' },
  pendingPayBanner: { flexDirection: 'row', backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14, alignItems: 'flex-start', gap: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  pendingPayTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  pendingPayDesc: { fontSize: 12, color: '#92400E', marginTop: 2 },
  pendingPayRef: { fontSize: 11, fontFamily: 'monospace', color: '#B45309', marginTop: 4 },
  ticketBtn: { flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  ticketBtnText: { fontSize: 15, fontWeight: '700', color: '#2563EB' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});
