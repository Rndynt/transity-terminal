import { useQuery } from '@tanstack/react-query';
import { useNav } from '@/App';
import { tripsApi, type TripSearchResult, type TripStopInfo } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import OperatorLogo from '@/components/OperatorLogo';
import { Loader2, Clock, MapPin, Users, Bus, ChevronRight, Route, Banknote, ShieldCheck, Info, Star, Plug, Snowflake, Wifi, Armchair, Luggage, Droplets, Music, ShieldAlert } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useState } from 'react';

interface Props {
  tripId: string;
  serviceDate: string;
  passengers: number;
  originCity: string;
  destCity: string;
  trip: TripSearchResult;
  rawStops: TripStopInfo[];
}

const VEHICLE_LABELS: Record<string, string> = {
  'commuter-14': 'Commuter',
  'premio-14': 'Premio',
  'executive-14': 'Executive',
};

function vehicleLabel(vc: string | null | undefined): string {
  if (!vc) return '';
  return VEHICLE_LABELS[vc] || vc.replace(/-\d+$/, '').replace(/^\w/, c => c.toUpperCase());
}

function getDurationLabel(departureTime?: string | null, arrivalTime?: string | null): string {
  if (!departureTime || !arrivalTime) return '';
  const d1 = new Date(departureTime).getTime();
  const d2 = new Date(arrivalTime).getTime();
  if (isNaN(d1) || isNaN(d2)) return '';
  const diff = Math.abs(d2 - d1);
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

function getRawTimes(trip: TripSearchResult): { departAt: string | null; arriveAt: string | null } {
  const raw = (trip as unknown as { raw?: { origin?: { departAt: string | null }; destination?: { arriveAt: string | null } } }).raw;
  return {
    departAt: raw?.origin?.departAt || trip.origin?.departureTime || null,
    arriveAt: raw?.destination?.arriveAt || trip.destination?.departureTime || null,
  };
}

export default function TripDetailPage({ tripId, serviceDate, passengers, originCity, destCity, trip, rawStops }: Props) {
  const { navigate, goBack } = useNav();
  const [showTerms, setShowTerms] = useState(false);

  const { data: tripDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['trip-detail', tripId, serviceDate],
    queryFn: () => tripsApi.getDetail(tripId, serviceDate),
  });

  const rawTimes = getRawTimes(trip);
  const departTime = fmtTime(rawTimes.departAt);
  const arriveTime = fmtTime(rawTimes.arriveAt);
  const duration = getDurationLabel(rawTimes.departAt, rawTimes.arriveAt);
  const svcLabel = vehicleLabel(trip.vehicleClass);

  const stops = rawStops.length > 0 ? rawStops : (tripDetail?.stops || []);

  let dateLabel = serviceDate;
  try { dateLabel = format(parseISO(serviceDate), 'EEEE, d MMMM yyyy', { locale: idLocale }); } catch {}

  const tripLabel = `${trip.operatorName} · ${trip.origin?.cityName || originCity} → ${trip.destination?.cityName || destCity}`;

  const handleSelect = () => {
    const stopsForNav: TripStopInfo[] = stops.map(s => ({
      stopId: s.stopId || (s as unknown as { code?: string }).code || '',
      name: s.name,
      code: (s as unknown as { code?: string }).code || '',
      city: s.city ?? undefined,
      sequence: s.sequence,
      arriveAt: s.arriveAt,
      departAt: s.departAt,
      boardingAllowed: s.boardingAllowed,
      alightingAllowed: s.alightingAllowed,
    }));
    navigate({
      name: 'select-stops',
      tripId: trip.tripId,
      serviceDate,
      passengers,
      tripLabel,
      fare: trip.farePerPerson,
      stops: stopsForNav,
      originCity,
      destCity,
      originSeq: trip.origin?.sequence || 0,
      destSeq: trip.destination?.sequence || 0,
    });
  };

  const reviewData = tripDetail?.reviews;

  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa]">
      <PageHeader title="Detail Perjalanan" onBack={goBack} className="pb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-4 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <OperatorLogo
              name={trip.operatorName}
              logo={trip.operatorLogo}
              color={trip.operatorColor || '#134E4A'}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[16px] text-white truncate">{trip.operatorName}</p>
              {svcLabel && (
                <span className="inline-block mt-0.5 text-[11px] font-semibold text-teal-200 bg-white/10 px-2 py-0.5 rounded-md">
                  {svcLabel}
                </span>
              )}
            </div>
            {reviewData && reviewData.count > 0 && (
              <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1.5 rounded-xl">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-[13px] font-bold text-white">{reviewData.avgRating.toFixed(1)}</span>
                <span className="text-[10px] text-teal-200">({reviewData.count})</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <p className="font-extrabold text-[24px] text-white font-display leading-none">{departTime}</p>
                  <p className="text-[11px] text-teal-200 mt-1 font-medium truncate">{trip.origin?.stopName || originCity}</p>
                </div>
                <div className="flex flex-col items-center flex-1 px-1">
                  <div className="flex items-center gap-1 w-full">
                    <div className="w-2 h-2 rounded-full border-2 border-teal-300" />
                    <div className="flex-1 h-[2px] bg-gradient-to-r from-teal-300 to-white/40 rounded-full" />
                    {duration && (
                      <span className="text-[10px] font-semibold text-teal-200 whitespace-nowrap px-1">{duration}</span>
                    )}
                    <div className="flex-1 h-[2px] bg-gradient-to-r from-white/40 to-coral-400 rounded-full" />
                    <div className="w-2 h-2 rounded-full bg-coral-400" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-extrabold text-[24px] text-white font-display leading-none">{arriveTime}</p>
                  <p className="text-[11px] text-teal-200 mt-1 font-medium truncate">{trip.destination?.stopName || destCity}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageHeader>

      <div className="px-4 pt-3 safe-pb-32 space-y-3">
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Informasi Layanan</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoTile icon={Bus} label="Kelas" value={svcLabel || 'Reguler'} />
              <InfoTile icon={Clock} label="Durasi" value={duration || '-'} />
              <InfoTile icon={Users} label="Kursi Tersedia" value={`${trip.availableSeats} kursi`}
                valueColor={trip.availableSeats <= 5 ? 'text-amber-600' : undefined} />
              <InfoTile icon={MapPin} label="Jumlah Stop" value={`${stops.length} pemberhentian`} />
            </div>
          </div>
          <div className="px-4 pb-3">
            <p className="text-[12px] text-slate-400">
              <span className="font-semibold text-slate-500">Tanggal:</span> {dateLabel}
            </p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              <span className="font-semibold text-slate-500">Penumpang:</span> {passengers} orang
            </p>
            {trip.isVirtual && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2 font-medium">
                Jadwal ini bersifat dinamis dan akan dikonfirmasi saat pemesanan.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="px-4 pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Armchair className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fasilitas</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Snowflake, label: 'Full AC' },
                { icon: Armchair, label: 'Kursi Reclining' },
                { icon: Plug, label: 'Colokan Listrik' },
                { icon: Wifi, label: 'Wi-Fi Gratis' },
                { icon: Luggage, label: 'Bagasi 20 kg' },
                { icon: Droplets, label: 'Air Mineral' },
                { icon: Music, label: 'Audio/USB' },
                { icon: ShieldAlert, label: 'Asuransi' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-1.5 bg-teal-50 text-teal-700 rounded-lg px-2.5 py-1.5">
                  <f.icon className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Route className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rute Perjalanan</p>
            </div>

            {detailLoading && stops.length === 0 ? (
              <div className="ml-5 space-y-3 py-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-3 w-12" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stops.length > 0 ? (
              <div className="ml-1 pl-4 border-l-2 border-teal-100 space-y-0">
                {stops.map((stop, i) => {
                  const isFirst = i === 0;
                  const isLast = i === stops.length - 1;
                  const time = fmtTime(stop.departAt || stop.arriveAt);

                  return (
                    <div key={stop.stopId || i} className="relative pb-4 last:pb-0">
                      <div className={cn(
                        'absolute -left-[21px] w-3 h-3 rounded-full border-2',
                        isFirst ? 'bg-white border-teal-500' :
                        isLast ? 'bg-coral-500 border-coral-500' :
                        'bg-white border-slate-300'
                      )} style={{ top: '2px' }} />
                      <div className="flex items-start gap-3">
                        <span className="text-[12px] font-bold text-slate-500 w-12 shrink-0 pt-0.5">{time}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-[13px] font-semibold truncate',
                            isFirst || isLast ? 'text-slate-800' : 'text-slate-600'
                          )}>{stop.name}</p>
                          {stop.city && (
                            <p className="text-[11px] text-slate-400">{stop.city}</p>
                          )}
                        </div>
                        {isFirst && (
                          <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded shrink-0">Naik</span>
                        )}
                        {isLast && (
                          <span className="text-[10px] font-bold text-coral-600 bg-red-50 px-2 py-0.5 rounded shrink-0">Turun</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-slate-400 py-4">Informasi rute belum tersedia</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up delay-2">
          <div className="px-4 pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rincian Harga</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-slate-500">Tarif per orang</span>
                <span className="text-[14px] font-semibold text-slate-700">{fmtCurrency(trip.farePerPerson)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-slate-500">Jumlah penumpang</span>
                <span className="text-[14px] font-semibold text-slate-700">{passengers} orang</span>
              </div>
              <div className="border-t border-dashed border-slate-200 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] font-bold text-slate-700">Total Estimasi</span>
                  <span className="text-[20px] font-extrabold text-teal-700 font-display">{fmtCurrency(trip.farePerPerson * passengers)}</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Harga sudah termasuk komisi. Harga final akan dikonfirmasi saat pemesanan.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up delay-3">
          <button
            onClick={() => setShowTerms(!showTerms)}
            className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <ShieldCheck className="w-[18px] h-[18px] text-teal-600" />
            </div>
            <span className="flex-1 text-left text-[14px] font-medium text-slate-700">Syarat & Ketentuan</span>
            <ChevronRight className={cn('w-4 h-4 text-slate-300 transition-transform', showTerms && 'rotate-90')} />
          </button>
          {showTerms && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3 anim-fade">
              <p className="text-[11px] font-bold text-slate-500 mb-2">Ketentuan Umum</p>
              <ul className="space-y-2 text-[12px] text-slate-500 leading-relaxed mb-3">
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Penumpang wajib hadir minimal 15 menit sebelum jadwal keberangkatan di titik naik yang telah dipilih.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Tiket berlaku hanya untuk tanggal, rute, dan jam keberangkatan yang tertera.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Tiket bersifat personal dan tidak dapat dipindahtangankan ke orang lain.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Penumpang wajib menunjukkan e-tiket (QR code) dan identitas diri saat boarding.</li>
              </ul>
              <p className="text-[11px] font-bold text-slate-500 mb-2">Pembatalan & Refund</p>
              <ul className="space-y-2 text-[12px] text-slate-500 leading-relaxed mb-3">
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Pembatalan dapat dilakukan maksimal 2 jam sebelum keberangkatan melalui aplikasi.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Refund akan diproses dalam 3-5 hari kerja ke metode pembayaran asal.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Pembatalan di bawah 2 jam sebelum keberangkatan tidak mendapatkan refund.</li>
              </ul>
              <p className="text-[11px] font-bold text-slate-500 mb-2">Bagasi & Barang Bawaan</p>
              <ul className="space-y-2 text-[12px] text-slate-500 leading-relaxed mb-3">
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Setiap penumpang diperbolehkan membawa bagasi maksimal 20 kg.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Barang berharga dan mudah pecah menjadi tanggung jawab penumpang.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Hewan peliharaan dan barang berbahaya tidak diperkenankan dibawa ke dalam bus.</li>
              </ul>
              <p className="text-[11px] font-bold text-slate-500 mb-2">Selama Perjalanan</p>
              <ul className="space-y-2 text-[12px] text-slate-500 leading-relaxed">
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Penumpang wajib mematuhi peraturan keselamatan dan menggunakan sabuk pengaman.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Dilarang merokok, mengkonsumsi alkohol, dan membuat keributan di dalam bus.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Operator berhak mengubah jadwal keberangkatan dengan pemberitahuan sebelumnya.</li>
                <li className="flex gap-2"><span className="text-teal-500 mt-0.5">•</span>Operator tidak bertanggung jawab atas keterlambatan akibat force majeure.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 font-medium">Total {passengers} penumpang</p>
              <p className="font-display font-extrabold text-[20px] text-teal-800">{fmtCurrency(trip.farePerPerson * passengers)}</p>
            </div>
            <Button
              className="h-[52px] px-8 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[15px] font-bold shadow-lg shadow-emerald-600/15 transition-all active:scale-[0.97] gap-2 disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleSelect}
              disabled={stops.length === 0 && detailLoading}
            >
              {stops.length === 0 && detailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Pilih Perjalanan
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, valueColor }: {
  icon: typeof Bus; label: string; value: string; valueColor?: string;
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-[13px] font-bold', valueColor || 'text-slate-700')}>{value}</p>
    </div>
  );
}
