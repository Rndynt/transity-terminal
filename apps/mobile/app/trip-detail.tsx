import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { tripsApi } from '../src/lib/api';
import { format } from 'date-fns';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId, originStopId, destStopId, originSeq, destSeq } = useLocalSearchParams<{
    tripId: string;
    originStopId: string;
    destStopId: string;
    originSeq: string;
    destSeq: string;
  }>();

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip-detail', tripId],
    queryFn: () => tripsApi.getDetail(tripId!),
    enabled: !!tripId,
  });

  const { data: reviews } = useQuery({
    queryKey: ['trip-reviews', tripId],
    queryFn: () => tripsApi.getReviews(tripId!),
    enabled: !!tripId,
  });

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '--:--';
    try { return format(new Date(isoStr), 'HH:mm'); } catch { return '--:--'; }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Trip tidak ditemukan</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.patternName}>{trip.patternName || trip.patternCode}</Text>
          <Text style={styles.serviceDate}>{trip.serviceDate}</Text>
        </View>

        <View style={styles.stopsCard}>
          <Text style={styles.sectionTitle}>Rute Perjalanan</Text>
          {trip.stops?.map((stop: { stopId: number; name: string; arriveAt: string | null; departAt: string | null; seq: number }, i: number) => {
            const isOrigin = stop.stopId === originStopId;
            const isDest = stop.stopId === destStopId;
            return (
              <View key={stop.stopId} style={styles.stopRow}>
                <View style={styles.stopTimeline}>
                  <View style={[
                    styles.stopDot,
                    isOrigin && styles.stopDotOrigin,
                    isDest && styles.stopDotDest,
                  ]} />
                  {i < trip.stops.length - 1 && <View style={styles.stopLine} />}
                </View>
                <View style={styles.stopInfo}>
                  <View style={styles.stopHeader}>
                    <Text style={[styles.stopName, (isOrigin || isDest) && styles.stopNameHighlight]}>
                      {stop.name}
                    </Text>
                    {isOrigin && <Text style={styles.stopTag}>Naik</Text>}
                    {isDest && <Text style={[styles.stopTag, styles.stopTagDest]}>Turun</Text>}
                  </View>
                  <View style={styles.stopTimes}>
                    {stop.arriveAt && <Text style={styles.stopTime}>Tiba {formatTime(stop.arriveAt)}</Text>}
                    {stop.departAt && <Text style={styles.stopTime}>Berangkat {formatTime(stop.departAt)}</Text>}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {trip.reviews && (
          <View style={styles.reviewsSummary}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={styles.ratingText}>{Number(trip.reviews?.avgRating ?? 0).toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({trip.reviews.count} ulasan)</Text>
            </View>
          </View>
        )}

        {reviews && reviews.length > 0 && (
          <View style={styles.reviewsCard}>
            <Text style={styles.sectionTitle}>Ulasan</Text>
            {reviews.slice(0, 5).map((r: { id: number; userName: string; rating: number; comment: string | null; createdAt: string }) => (
              <View key={r.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{r.userName}</Text>
                  <View style={styles.starsRow}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Ionicons key={i} name={i < r.rating ? 'star' : 'star-outline'} size={12} color="#F59E0B" />
                    ))}
                  </View>
                </View>
                {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => router.push({
            pathname: '/select-seats',
            params: { tripId: tripId!, originStopId, destStopId, originSeq, destSeq },
          })}
          testID="button-book-trip"
        >
          <Text style={styles.bookBtnText}>Pilih Kursi</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#EF4444', marginTop: 12 },
  content: { padding: 16, paddingBottom: 100 },
  headerCard: { backgroundColor: '#2563EB', borderRadius: 14, padding: 20, marginBottom: 16 },
  patternName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  serviceDate: { fontSize: 14, color: '#BFDBFE', marginTop: 4 },
  stopsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 14 },
  stopRow: { flexDirection: 'row', marginBottom: 2 },
  stopTimeline: { width: 24, alignItems: 'center' },
  stopDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D1D5DB', zIndex: 1 },
  stopDotOrigin: { backgroundColor: '#2563EB', width: 14, height: 14, borderRadius: 7 },
  stopDotDest: { backgroundColor: '#EF4444', width: 14, height: 14, borderRadius: 7 },
  stopLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', minHeight: 32 },
  stopInfo: { flex: 1, paddingLeft: 8, paddingBottom: 16 },
  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopName: { fontSize: 14, fontWeight: '500', color: '#4B5563' },
  stopNameHighlight: { fontWeight: '700', color: '#1F2937' },
  stopTag: { fontSize: 10, fontWeight: '700', color: '#2563EB', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stopTagDest: { color: '#EF4444', backgroundColor: '#FEF2F2' },
  stopTimes: { flexDirection: 'row', gap: 12, marginTop: 2 },
  stopTime: { fontSize: 12, color: '#6B7280' },
  reviewsSummary: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
  reviewCount: { fontSize: 13, color: '#6B7280' },
  reviewsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  reviewItem: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 12, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewerName: { fontSize: 13, fontWeight: '600', color: '#374151' },
  starsRow: { flexDirection: 'row', gap: 1 },
  reviewComment: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  bookBtn: { flexDirection: 'row', backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
