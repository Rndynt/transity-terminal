import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { bookingsApi } from '../src/lib/api';
import { format } from 'date-fns';
import QRCode from 'react-native-qrcode-svg';

export default function ETicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => bookingsApi.getDetail(id!),
    enabled: !!id,
  });

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {booking.passengers?.map((pax: any, i: number) => (
        <View key={pax.id} style={styles.ticketCard}>
          <View style={styles.ticketHeader}>
            <Text style={styles.brandText}>TRANSITY</Text>
            <Text style={styles.ticketLabel}>E-TICKET</Text>
          </View>

          <View style={styles.qrSection}>
            <QRCode
              value={JSON.stringify({
                bookingId: booking.id,
                passengerId: pax.id,
                seatNo: pax.seatNo,
                trip: booking.tripId,
              })}
              size={160}
              backgroundColor="#fff"
              color="#1F2937"
            />
          </View>

          <View style={styles.passengerSection}>
            <Text style={styles.passengerName}>{pax.fullName}</Text>
            <View style={styles.seatDisplay}>
              <Text style={styles.seatLabel}>Kursi</Text>
              <Text style={styles.seatNumber}>{pax.seatNo}</Text>
            </View>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerCircleLeft} />
            <View style={styles.dividerLine} />
            <View style={styles.dividerCircleRight} />
          </View>

          <View style={styles.routeSection}>
            <View style={styles.routeEndpoint}>
              <Text style={styles.routeLabel}>DARI</Text>
              <Text style={styles.routeCity}>{booking.origin?.name || 'N/A'}</Text>
              <Text style={styles.routeTime}>{formatTime(booking.departAt)}</Text>
            </View>
            <View style={styles.routeArrow}>
              <Ionicons name="arrow-forward" size={20} color="#D1D5DB" />
            </View>
            <View style={[styles.routeEndpoint, { alignItems: 'flex-end' }]}>
              <Text style={styles.routeLabel}>KE</Text>
              <Text style={styles.routeCity}>{booking.destination?.name || 'N/A'}</Text>
              <Text style={styles.routeTime}>{formatTime(booking.arriveAt)}</Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Tanggal</Text>
              <Text style={styles.detailValue}>{booking.serviceDate || 'N/A'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Rute</Text>
              <Text style={styles.detailValue}>{booking.patternCode || 'N/A'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Booking ID</Text>
              <Text style={[styles.detailValue, { fontFamily: 'monospace', fontSize: 10 }]}>
                {booking.id.slice(-12).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#EF4444', marginTop: 12 },
  content: { padding: 16, paddingBottom: 40 },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  ticketHeader: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandText: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  ticketLabel: { fontSize: 12, fontWeight: '600', color: '#93C5FD', letterSpacing: 1 },
  qrSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff' },
  passengerSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  passengerName: { fontSize: 18, fontWeight: '700', color: '#1F2937', flex: 1 },
  seatDisplay: { alignItems: 'center' },
  seatLabel: { fontSize: 10, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' },
  seatNumber: { fontSize: 28, fontWeight: '900', color: '#2563EB' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dividerCircleLeft: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F3F4F6', marginLeft: -10 },
  dividerLine: { flex: 1, borderTopWidth: 2, borderTopColor: '#E5E7EB', borderStyle: 'dashed' },
  dividerCircleRight: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F3F4F6', marginRight: -10 },
  routeSection: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' },
  routeEndpoint: { flex: 1 },
  routeLabel: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeCity: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 2 },
  routeTime: { fontSize: 22, fontWeight: '800', color: '#2563EB', marginTop: 2 },
  routeArrow: { paddingHorizontal: 8 },
  detailsGrid: { flexDirection: 'row', backgroundColor: '#F9FAFB', paddingHorizontal: 20, paddingVertical: 14 },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 2 },
});
