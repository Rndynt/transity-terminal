import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { tripsApi } from '../src/lib/api';
import { useAuthStore } from '../src/store/auth';

export default function SelectSeatsScreen() {
  const router = useRouter();
  const { tripId, originStopId, destStopId, originSeq, destSeq } = useLocalSearchParams<{
    tripId: string;
    originStopId: string;
    destStopId: string;
    originSeq: string;
    destSeq: string;
  }>();
  const { isAuthenticated } = useAuthStore();
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  const { data: seatmap, isLoading } = useQuery({
    queryKey: ['seatmap', tripId, originSeq, destSeq],
    queryFn: () => tripsApi.getSeatmap(tripId!, Number(originSeq), Number(destSeq)),
    enabled: !!tripId,
  });

  const toggleSeat = (seatNo: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seatNo) ? prev.filter((s) => s !== seatNo) : [...prev, seatNo]
    );
  };

  const handleContinue = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    router.push({
      pathname: '/booking-confirm',
      params: {
        tripId: tripId!,
        originStopId: originStopId!,
        destStopId: destStopId!,
        originSeq: originSeq!,
        destSeq: destSeq!,
        seats: selectedSeats.join(','),
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Memuat layout kursi...</Text>
      </View>
    );
  }

  if (!seatmap) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Gagal memuat kursi</Text>
      </View>
    );
  }

  interface SeatCell {
    row: number;
    col: number;
    seatNo: string;
    label: string;
    type: string;
  }
  interface SeatStatus {
    available: boolean;
    booked: boolean;
    held: boolean;
  }

  const layout = seatmap.layout;
  const seatMapData = layout.seatMap as SeatCell[];
  const maxRow = Math.max(...seatMapData.map((s) => s.row));
  const maxCol = Math.max(...seatMapData.map((s) => s.col));

  const grid: (SeatCell | null)[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    grid[r] = [];
    for (let c = 0; c <= maxCol; c++) grid[r][c] = null;
  }
  seatMapData.forEach((s) => { grid[s.row][s.col] = s; });

  const availableCount = Object.values(seatmap.seatAvailability as Record<string, SeatStatus>).filter((s) => s.available).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBar}>
          <Text style={styles.infoText}>{availableCount} kursi tersedia</Text>
          <Text style={styles.infoText}>{selectedSeats.length} dipilih</Text>
        </View>

        <View style={styles.legend}>
          <LegendItem color="#fff" borderColor="#D1D5DB" label="Tersedia" />
          <LegendItem color="#2563EB" borderColor="#2563EB" label="Dipilih" />
          <LegendItem color="#FEE2E2" borderColor="#FECACA" label="Terisi" />
        </View>

        <View style={styles.busFrame}>
          <View style={styles.busDriver}>
            <Ionicons name="car" size={16} color="#9CA3AF" />
            <Text style={styles.busDriverText}>Depan</Text>
          </View>

          <View style={styles.seatGrid}>
            {grid.map((row, ri) => (
              <View key={ri} style={styles.seatRow}>
                {row.map((seat, ci) => {
                  if (!seat) return <View key={`gap-${ri}-${ci}`} style={styles.seatGap} />;
                  const avail = seatmap.seatAvailability[seat.seat_no];
                  const isSelected = selectedSeats.includes(seat.seat_no);
                  const isAvailable = avail?.available && !avail?.held;

                  return (
                    <TouchableOpacity
                      key={seat.seat_no}
                      style={[
                        styles.seat,
                        isSelected && styles.seatSelected,
                        !isAvailable && !isSelected && styles.seatBooked,
                      ]}
                      onPress={() => isAvailable && toggleSeat(seat.seat_no)}
                      disabled={!isAvailable && !isSelected}
                      testID={`seat-${seat.seat_no}`}
                    >
                      <Text
                        style={[
                          styles.seatText,
                          isSelected && styles.seatTextSelected,
                          !isAvailable && !isSelected && styles.seatTextBooked,
                        ]}
                      >
                        {seat.seat_no}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.busBack}>
            <Text style={styles.busDriverText}>Belakang</Text>
          </View>
        </View>
      </ScrollView>

      {selectedSeats.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedLabel}>Kursi:</Text>
            <View style={styles.seatChips}>
              {selectedSeats.sort().map((s) => (
                <View key={s} style={styles.seatChip}>
                  <Text style={styles.seatChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} testID="button-continue-booking">
            <Text style={styles.continueBtnText}>Lanjutkan</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function LegendItem({ color, borderColor, label }: { color: string; borderColor: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color, borderColor }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  errorText: { fontSize: 16, color: '#EF4444', marginTop: 12 },
  content: { padding: 16, paddingBottom: 120 },
  infoBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 12 },
  infoText: { fontSize: 13, fontWeight: '600', color: '#1E40AF' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 11, color: '#6B7280' },
  busFrame: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  busDriver: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 12 },
  busDriverText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  busBack: { alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 12 },
  seatGrid: { alignItems: 'center', gap: 4 },
  seatRow: { flexDirection: 'row', gap: 4 },
  seatGap: { width: 44, height: 44 },
  seat: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  seatBooked: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  seatText: { fontSize: 11, fontWeight: '700', color: '#4B5563', fontFamily: 'monospace' },
  seatTextSelected: { color: '#fff' },
  seatTextBooked: { color: '#FCA5A5' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  selectedInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  selectedLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginRight: 8 },
  seatChips: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  seatChip: { backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  seatChipText: { fontSize: 12, fontWeight: '700', color: '#1E40AF', fontFamily: 'monospace' },
  continueBtn: { flexDirection: 'row', backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
