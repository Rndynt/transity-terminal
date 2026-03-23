import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '@/lib/api';
import {
  Loader2, Users, ArrowRight, Bus, AlertTriangle,
  CheckCircle2, XCircle, Armchair, X
} from 'lucide-react';
import type { CsoAvailableTrip, TripStopTime } from '@/types';

interface ActivePassenger {
  id: string;
  fullName: string;
  seatNo: string;
  bookingId: string;
  bookingCode: string;
  ticketNumber: string | null;
  fareAmount: string;
  originSeq: number;
  destinationSeq: number;
}

interface BatchRescheduleResult {
  ok: boolean;
  reschedule: {
    succeeded: number;
    failed: number;
    succeededPassengers: Array<ActivePassenger & { newSeatNo: string }>;
    failedPassengers: Array<ActivePassenger & { failReason: string }>;
  };
}

interface BatchRescheduleDialogProps {
  tripId: string;
  tripLabel: string;
  outletId: string;
  selectedDate: string;
  passengers: ActivePassenger[];
  onClose: () => void;
  onCloseOnly: () => void;
  onRescheduleComplete: (result: BatchRescheduleResult) => void;
  isClosing: boolean;
  canBatchReschedule: boolean;
}

const formatTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
    });
  } catch { return '--:--'; }
};

export default function BatchRescheduleDialog({
  tripId,
  tripLabel,
  outletId,
  selectedDate,
  passengers,
  onClose,
  onCloseOnly,
  onRescheduleComplete,
  isClosing,
  canBatchReschedule,
}: BatchRescheduleDialogProps) {
  const [step, setStep] = useState<'choose' | 'select-trip' | 'confirm' | 'result'>('choose');
  const [selectedTargetTrip, setSelectedTargetTrip] = useState<CsoAvailableTrip | null>(null);
  const [selectedStopPair, setSelectedStopPair] = useState<{
    originStopId: string; destinationStopId: string;
    originSeq: number; destinationSeq: number;
    originName: string; destinationName: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<BatchRescheduleResult | null>(null);

  const { data: availableTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['/api/cso/available-trips', selectedDate, outletId, 'batch-reschedule'],
    queryFn: () => tripsApi.getCsoAvailableTrips(selectedDate, outletId),
    enabled: step === 'select-trip' || step === 'confirm',
  });

  const targetTripId = selectedTargetTrip?.tripId;
  const { data: targetStopTimes = [] } = useQuery<Array<TripStopTime & { stopName?: string; stopCode?: string }>>({
    queryKey: ['/api/trips', targetTripId, 'stop-times', 'effective'],
    queryFn: () => tripsApi.getStopTimesWithEffectiveFlags(targetTripId!),
    enabled: !!targetTripId,
  });

  const eligibleTrips = useMemo(() =>
    availableTrips.filter(t =>
      t.tripId && t.tripId !== tripId &&
      t.status !== 'closed' && t.status !== 'canceled' &&
      (t.availableSeats ?? 0) > 0
    ),
    [availableTrips, tripId]
  );

  const sortedStopTimes = useMemo(() =>
    [...targetStopTimes].sort((a, b) => a.sequence - b.sequence),
    [targetStopTimes]
  );

  const handleSelectTrip = (trip: CsoAvailableTrip) => {
    setSelectedTargetTrip(trip);
    setSelectedStopPair(null);
  };

  const handleSelectStops = (origin: typeof targetStopTimes[number], destination: typeof targetStopTimes[number]) => {
    setSelectedStopPair({
      originStopId: origin.stopId,
      destinationStopId: destination.stopId,
      originSeq: origin.sequence,
      destinationSeq: destination.sequence,
      originName: origin.stopName || `Stop ${origin.sequence}`,
      destinationName: destination.stopName || `Stop ${destination.sequence}`,
    });
  };

  const handleConfirmReschedule = async () => {
    if (!selectedTargetTrip?.tripId || !selectedStopPair) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/close-with-reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          newTripId: selectedTargetTrip.tripId,
          newOriginStopId: selectedStopPair.originStopId,
          newDestinationStopId: selectedStopPair.destinationStopId,
          newOriginSeq: selectedStopPair.originSeq,
          newDestinationSeq: selectedStopPair.destinationSeq,
          reason: 'Batch reschedule — trip ditutup oleh operator',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data: BatchRescheduleResult = await res.json();
      setResult(data);
      setStep('result');
      onRescheduleComplete(data);
    } catch (err) {
      setResult(null);
      setStep('result');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/80">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Tutup Trip — {tripLabel}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors" disabled={isProcessing}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'choose' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {passengers.length} penumpang aktif di trip ini
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Pilih tindakan sebelum menutup trip.
                </p>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {passengers.map(pax => (
                  <div key={pax.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <Armchair className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-semibold text-gray-700">{pax.seatNo}</span>
                      <span className="text-gray-600">{pax.fullName}</span>
                    </div>
                    <span className="text-gray-400 font-mono text-[10px]">{pax.bookingCode}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2">
                {canBatchReschedule && (
                  <button
                    onClick={() => setStep('select-trip')}
                    className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Tutup & Reschedule Semua
                  </button>
                )}
                <button
                  onClick={onCloseOnly}
                  disabled={isClosing}
                  className="w-full px-4 py-2.5 bg-white hover:bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Tutup Saja (tanpa reschedule)
                </button>
              </div>
            </div>
          )}

          {step === 'select-trip' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 font-medium">Pilih trip tujuan untuk {passengers.length} penumpang:</p>

              {tripsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : eligibleTrips.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">Tidak ada trip lain tersedia di tanggal ini.</p>
                  <button onClick={() => setStep('choose')} className="mt-3 text-xs text-blue-600 hover:underline">← Kembali</button>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {eligibleTrips.map(trip => (
                    <button
                      key={trip.tripId || trip.baseId}
                      onClick={() => handleSelectTrip(trip)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        selectedTargetTrip?.tripId === trip.tripId
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bus className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-800">{trip.patternCode}</span>
                          <span className="text-[10px] text-gray-400">{trip.vehicle?.plate || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-emerald-600 font-medium">{trip.availableSeats ?? '?'} kursi</span>
                          <span className="text-xs text-gray-600 font-mono">{formatTime(trip.departAtAtOutlet)}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{trip.patternPath}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedTargetTrip && sortedStopTimes.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Pilih rute tujuan (asal → tujuan):</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Asal</label>
                      <div className="space-y-1 max-h-32 overflow-y-auto mt-1">
                        {sortedStopTimes.map(st => (
                          <button
                            key={st.id}
                            onClick={() => {
                              if (selectedStopPair?.destinationSeq && st.sequence < selectedStopPair.destinationSeq) {
                                handleSelectStops(st, sortedStopTimes.find(s => s.sequence === selectedStopPair.destinationSeq)!);
                              } else {
                                setSelectedStopPair(prev => prev ? {
                                  ...prev,
                                  originStopId: st.stopId,
                                  originSeq: st.sequence,
                                  originName: st.stopName || `Stop ${st.sequence}`,
                                } : {
                                  originStopId: st.stopId,
                                  originSeq: st.sequence,
                                  originName: st.stopName || `Stop ${st.sequence}`,
                                  destinationStopId: '',
                                  destinationSeq: 0,
                                  destinationName: '',
                                });
                              }
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                              selectedStopPair?.originSeq === st.sequence
                                ? 'bg-amber-100 border border-amber-300 text-amber-800 font-semibold'
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-transparent'
                            }`}
                          >
                            {st.stopName || `Stop ${st.sequence}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Tujuan</label>
                      <div className="space-y-1 max-h-32 overflow-y-auto mt-1">
                        {sortedStopTimes
                          .filter(st => !selectedStopPair?.originSeq || st.sequence > selectedStopPair.originSeq)
                          .map(st => (
                            <button
                              key={st.id}
                              onClick={() => {
                                if (selectedStopPair?.originStopId) {
                                  setSelectedStopPair(prev => prev ? {
                                    ...prev,
                                    destinationStopId: st.stopId,
                                    destinationSeq: st.sequence,
                                    destinationName: st.stopName || `Stop ${st.sequence}`,
                                  } : null);
                                }
                              }}
                              disabled={!selectedStopPair?.originStopId}
                              className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors disabled:opacity-40 ${
                                selectedStopPair?.destinationSeq === st.sequence
                                  ? 'bg-amber-100 border border-amber-300 text-amber-800 font-semibold'
                                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-transparent'
                              }`}
                            >
                              {st.stopName || `Stop ${st.sequence}`}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => { setStep('choose'); setSelectedTargetTrip(null); setSelectedStopPair(null); }}
                  className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold transition-colors"
                >
                  ← Kembali
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!selectedTargetTrip?.tripId || !selectedStopPair?.destinationStopId}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Lanjut
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && selectedTargetTrip && selectedStopPair && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-800">Konfirmasi Batch Reschedule</p>
                <div className="text-xs text-amber-700 space-y-1">
                  <p><span className="font-medium">Jumlah penumpang:</span> {passengers.length} orang</p>
                  <p><span className="font-medium">Trip tujuan:</span> {selectedTargetTrip.patternCode} — {selectedTargetTrip.vehicle?.plate || '-'} ({formatTime(selectedTargetTrip.departAtAtOutlet)})</p>
                  <p><span className="font-medium">Rute:</span> {selectedStopPair.originName} → {selectedStopPair.destinationName}</p>
                  <p><span className="font-medium">Kursi tersedia:</span> {selectedTargetTrip.availableSeats ?? '?'}</p>
                </div>
                {(selectedTargetTrip.availableSeats ?? 0) < passengers.length && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded p-2">
                    <p className="text-[11px] text-red-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Kursi tersedia ({selectedTargetTrip.availableSeats}) kurang dari jumlah penumpang ({passengers.length}). Sebagian penumpang mungkin gagal dipindahkan.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('select-trip')}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  ← Kembali
                </button>
                <button
                  onClick={handleConfirmReschedule}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isProcessing ? 'Memproses...' : 'Tutup & Reschedule'}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && (
            <div className="space-y-4">
              {result ? (
                <>
                  <div className={`rounded-lg p-3 ${result.reschedule.failed > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                    <p className={`text-sm font-semibold ${result.reschedule.failed > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                      {result.reschedule.failed > 0 ? 'Reschedule selesai dengan catatan' : 'Reschedule berhasil!'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Trip telah ditutup. {result.reschedule.succeeded} penumpang berhasil dipindahkan.
                      {result.reschedule.failed > 0 && ` ${result.reschedule.failed} penumpang gagal.`}
                    </p>
                  </div>

                  {result.reschedule.succeeded > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Berhasil ({result.reschedule.succeeded})
                      </p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {result.reschedule.succeededPassengers.map(pax => (
                          <div key={pax.id} className="flex items-center justify-between px-2 py-1 bg-emerald-50 rounded text-[11px]">
                            <span className="text-gray-700">{pax.fullName}</span>
                            <span className="text-emerald-600 font-mono">{pax.seatNo} → {pax.newSeatNo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.reschedule.failed > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Gagal ({result.reschedule.failed})
                      </p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {result.reschedule.failedPassengers.map(pax => (
                          <div key={pax.id} className="flex items-center justify-between px-2 py-1 bg-red-50 rounded text-[11px]">
                            <span className="text-gray-700">{pax.fullName} ({pax.seatNo})</span>
                            <span className="text-red-600">{pax.failReason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-800">Gagal memproses reschedule</p>
                  <p className="text-xs text-red-600 mt-1">Terjadi kesalahan. Silakan coba lagi.</p>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
