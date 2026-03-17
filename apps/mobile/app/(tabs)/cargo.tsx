import { useState, type ComponentProps } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cargoApi } from '../../src/lib/api';

const statusSteps = ['received', 'loaded', 'in_transit', 'arrived', 'delivered'];
const statusLabels: Record<string, string> = {
  pending: 'Menunggu',
  received: 'Diterima',
  loaded: 'Dimuat',
  in_transit: 'Dalam Perjalanan',
  arrived: 'Tiba di Tujuan',
  delivered: 'Terkirim',
  returned: 'Dikembalikan',
  canceled: 'Dibatalkan',
};

export default function CargoScreen() {
  const [waybill, setWaybill] = useState('');
  interface CargoTrackResult {
    waybillNumber: string;
    status: string;
    origin: string;
    destination: string;
    senderName: string;
    recipientName: string;
    createdAt: string;
    deliveredAt: string | null;
    weight: string | null;
    pieces: number | null;
  }
  const [result, setResult] = useState<CargoTrackResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTrack = async () => {
    if (!waybill.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await cargoApi.track(waybill.trim());
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Resi tidak ditemukan';
      Alert.alert('Tidak Ditemukan', msg);
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = result ? statusSteps.indexOf(result.status) : -1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.trackCard}>
        <View style={styles.trackHeader}>
          <Ionicons name="cube" size={24} color="#2563EB" />
          <Text style={styles.trackTitle}>Lacak Kiriman</Text>
        </View>
        <Text style={styles.trackSubtitle}>Masukkan nomor resi untuk melacak kiriman Anda</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.trackInput}
            placeholder="Nomor resi..."
            value={waybill}
            onChangeText={setWaybill}
            autoCapitalize="characters"
            testID="input-waybill"
          />
          <TouchableOpacity
            style={[styles.trackBtn, !waybill.trim() && { opacity: 0.5 }]}
            onPress={handleTrack}
            disabled={!waybill.trim() || loading}
            testID="button-track-cargo"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.waybillLabel}>Resi</Text>
            <Text style={styles.waybillNumber}>{result.waybillNumber}</Text>
          </View>

          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <Ionicons name="radio-button-on" size={14} color="#2563EB" />
              <Text style={styles.routeCity}>{result.origin?.name || 'N/A'}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <Ionicons name="location" size={14} color="#EF4444" />
              <Text style={styles.routeCity}>{result.destination?.name || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            {statusSteps.map((step, i) => (
              <View key={step} style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    i <= currentStepIndex ? styles.progressDotActive : null,
                    i === currentStepIndex ? styles.progressDotCurrent : null,
                  ]}
                >
                  {i <= currentStepIndex && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                <Text style={[styles.progressLabel, i <= currentStepIndex && styles.progressLabelActive]}>
                  {statusLabels[step]}
                </Text>
                {i < statusSteps.length - 1 && (
                  <View style={[styles.progressLine, i < currentStepIndex && styles.progressLineActive]} />
                )}
              </View>
            ))}
          </View>

          <View style={styles.detailGrid}>
            <DetailRow icon="person" label="Pengirim" value={result.senderName} />
            <DetailRow icon="person" label="Penerima" value={result.recipientName} />
            <DetailRow icon="document-text" label="Barang" value={result.itemDescription} />
            {result.weightKg && <DetailRow icon="scale" label="Berat" value={`${result.weightKg} kg`} />}
            <DetailRow icon="cash" label="Total" value={`Rp ${Number(result.totalAmount || 0).toLocaleString('id-ID')}`} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ icon, label, value }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabel}>
        <Ionicons name={icon} size={14} color="#6B7280" />
        <Text style={styles.detailLabelText}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  trackCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  trackHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  trackTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  trackSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 8 },
  trackInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    fontFamily: 'monospace',
  },
  trackBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  resultCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  resultHeader: { marginBottom: 16 },
  waybillLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  waybillNumber: { fontSize: 20, fontWeight: '800', color: '#1F2937', fontFamily: 'monospace', marginTop: 2 },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeCity: { fontSize: 13, fontWeight: '600', color: '#374151' },
  routeLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
  progressContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 },
  progressStep: { alignItems: 'center', flex: 1 },
  progressDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  progressDotActive: { backgroundColor: '#2563EB' },
  progressDotCurrent: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#93C5FD' },
  progressLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  progressLabelActive: { color: '#2563EB', fontWeight: '600' },
  progressLine: { position: 'absolute', top: 10, left: '60%', right: '-40%', height: 2, backgroundColor: '#E5E7EB' },
  progressLineActive: { backgroundColor: '#2563EB' },
  detailGrid: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16, gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailLabelText: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
});
