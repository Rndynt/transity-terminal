import { useState, type ComponentProps } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];
import { bookingsApi } from '../src/lib/api';

export default function BookingConfirmScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tripId, originStopId, destStopId, originSeq, destSeq, seats } = useLocalSearchParams<{
    tripId: string;
    originStopId: string;
    destStopId: string;
    originSeq: string;
    destSeq: string;
    seats: string;
  }>();

  const seatList = seats?.split(',') || [];
  const [passengers, setPassengers] = useState(
    seatList.map((seatNo) => ({ seatNo, fullName: '', phone: '', idNumber: '' }))
  );
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'ewallet' | 'bank'>('ewallet');

  const updatePassenger = (index: number, field: string, value: string) => {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const bookMutation = useMutation({
    mutationFn: () =>
      bookingsApi.create({
        tripId,
        originStopId: originStopId,
        destinationStopId: destStopId,
        originSeq: Number(originSeq),
        destinationSeq: Number(destSeq),
        passengers: passengers.map((p) => ({
          fullName: p.fullName,
          phone: p.phone || undefined,
          idNumber: p.idNumber || undefined,
          seatNo: p.seatNo,
        })),
        paymentMethod,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      router.replace({ pathname: '/booking-detail', params: { id: data.id } });
    },
    onError: (err: Error) => {
      Alert.alert('Booking Gagal', err.message || 'Gagal membuat booking');
    },
  });

  const isValid = passengers.every((p) => p.fullName.trim().length > 0);

  const paymentMethods = [
    { key: 'ewallet' as const, label: 'E-Wallet', icon: 'wallet' },
    { key: 'qr' as const, label: 'QRIS', icon: 'qr-code' },
    { key: 'bank' as const, label: 'Transfer', icon: 'card' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Ionicons name="bus" size={20} color="#2563EB" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.summaryRoute}>Kursi: {seatList.join(', ')}</Text>
            <Text style={styles.summaryDetail}>{seatList.length} penumpang</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Data Penumpang</Text>
        {passengers.map((pax, i) => (
          <View key={pax.seatNo} style={styles.passengerCard}>
            <View style={styles.passengerHeader}>
              <View style={styles.seatBadge}>
                <Text style={styles.seatBadgeText}>{pax.seatNo}</Text>
              </View>
              <Text style={styles.passengerLabel}>Penumpang {i + 1}</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nama Lengkap *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Nama lengkap"
                value={pax.fullName}
                onChangeText={(v) => updatePassenger(i, 'fullName', v)}
                testID={`input-passenger-name-${i}`}
              />
            </View>
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Telepon</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="08xxx"
                  value={pax.phone}
                  onChangeText={(v) => updatePassenger(i, 'phone', v)}
                  keyboardType="phone-pad"
                  testID={`input-passenger-phone-${i}`}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
                <Text style={styles.formLabel}>No. KTP</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Opsional"
                  value={pax.idNumber}
                  onChangeText={(v) => updatePassenger(i, 'idNumber', v)}
                  testID={`input-passenger-id-${i}`}
                />
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
        <View style={styles.paymentOptions}>
          {paymentMethods.map((pm) => (
            <TouchableOpacity
              key={pm.key}
              style={[styles.paymentOption, paymentMethod === pm.key && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod(pm.key)}
              testID={`payment-${pm.key}`}
            >
              <Ionicons name={pm.icon as IoniconsName} size={20} color={paymentMethod === pm.key ? '#2563EB' : '#6B7280'} />
              <Text style={[styles.paymentLabel, paymentMethod === pm.key && styles.paymentLabelSelected]}>
                {pm.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bookBtn, (!isValid || bookMutation.isPending) && { opacity: 0.5 }]}
          onPress={() => bookMutation.mutate()}
          disabled={!isValid || bookMutation.isPending}
          testID="button-confirm-booking"
        >
          {bookMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.bookBtnText}>Konfirmasi Booking</Text>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 100 },
  summaryCard: { flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginBottom: 20, alignItems: 'center' },
  summaryRoute: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  summaryDetail: { fontSize: 12, color: '#3B82F6', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  passengerCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  passengerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  seatBadge: { backgroundColor: '#2563EB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  seatBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: 'monospace' },
  passengerLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  formGroup: { marginBottom: 10 },
  formRow: { flexDirection: 'row' },
  formLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  formInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#F9FAFB' },
  paymentOptions: { flexDirection: 'row', gap: 10 },
  paymentOption: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  paymentOptionSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  paymentLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  paymentLabelSelected: { color: '#2563EB' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  bookBtn: { flexDirection: 'row', backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
