import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard, MapPin, Armchair, Ticket,
  ChevronDown, ChevronUp, ArrowRight,
  Loader2, Users, Phone, Hash
} from 'lucide-react';
import PassengerCard from './PassengerCard';
import { BookingStatusBadge, ChannelBadge } from '@/components/shared/StatusBadges';
import { fmtCurrency, fmtDate, getPaymentLabel, BOOKING_STATUS_MAP, type BookingStatus } from '@/lib/constants';

interface OtherPassenger {
  id: string;
  fullName: string;
  seatNo: string;
  phone?: string | null;
  ticketNumber: string | null;
  ticketStatus?: string | null;
  fareAmount?: string | number | null;
}

interface BookingDetail {
  id: string;
  bookingCode?: string;
  status?: string;
  channel?: string;
  totalAmount?: string | number;
  discountAmount?: string | number;
  voucherCode?: string;
  createdAt?: string;
  createdBy?: string;
  salesChannelCode?: string | null;
  salesChannelName?: string | null;
  originSeq?: number;
  destinationSeq?: number;
  originStopId?: string;
  destinationStopId?: string;
  outletId?: string;
  originStop?: { id: string; name: string };
  destinationStop?: { id: string; name: string };
  outlet?: { id: string; name: string; code?: string };
  vehicle?: { id: string; plate: string; code: string };
  departAt?: string | null;
  arriveAt?: string | null;
  bookingType?: string;
  overlapType?: string;
}

interface PassengerDetail {
  id: string;
  fullName: string;
  seatNo: string;
  phone?: string | null;
  idNumber?: string | null;
  ticketNumber: string | null;
  ticketStatus?: string | null;
  fareAmount?: string | number | null;
}

interface PaymentDetail {
  id: string;
  bookingId: string;
  method: string;
  amount?: string | number | null;
  paidAt?: string | null;
}

interface PassengerDetailsData {
  seatNo: string;
  bookings: Array<{
    booking: BookingDetail;
    passenger: PassengerDetail;
    otherPassengers?: OtherPassenger[];
    payments: PaymentDetail[];
  }>;
  available: boolean;
  error?: string;
}

interface PassengerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  passengerDetails: PassengerDetailsData | null;
  isLoading?: boolean;
  isError?: boolean;
  selectedSeatNo?: string | null;
  tripId?: string;
  onStartAssignMode?: (passenger: { id: string; name: string; ticketNumber: string | null; bookingCode: string }) => void;
  onStartRescheduleMode?: (passenger: { id: string; name: string; ticketNumber: string | null; bookingCode: string; seatNo: string; originStopName: string; destinationStopName: string; reason: string }) => void;
}


export default function PassengerDetailModal({
  isOpen,
  onClose,
  passengerDetails,
  onStartRescheduleMode,
  isLoading = false,
  isError = false,
  selectedSeatNo = null,
  tripId,
  onStartAssignMode
}: PassengerDetailModalProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set([0]));

  const toggle = (index: number) => {
    setOpenIndices(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const isMulti = (passengerDetails?.bookings?.length ?? 0) > 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose} data-testid="passenger-detail-modal">
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Armchair className="w-4 h-4 text-primary" />
            Detail Kursi {passengerDetails?.seatNo || selectedSeatNo || ''}
            {isMulti && (
              <span className="ml-1 text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {passengerDetails!.bookings.length} booking
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div data-testid="modal-content">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2" data-testid="loading-state">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Memuat detail...</span>
            </div>
          )}

          {!isLoading && (isError || passengerDetails?.error) && (
            <div className="rounded-lg border bg-card p-5" data-testid="error-state">
              {isError ? (
                <div className="text-center space-y-1">
                  <p className="text-muted-foreground">Gagal memuat detail penumpang</p>
                  <p className="text-xs text-muted-foreground">Periksa koneksi internet dan coba lagi</p>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">{passengerDetails?.error}</p>
              )}
            </div>
          )}

          {!isLoading && passengerDetails?.bookings && passengerDetails.bookings.length > 0 && (
            <div className="space-y-4">
              {passengerDetails.bookings.map((bookingData, index) => {
                const isOpen = openIndices.has(index);
                const b = bookingData.booking;
                const p = bookingData.passenger;
                const others = bookingData.otherPassengers || [];
                const totalPassengers = 1 + others.length;

                return (
                  <div key={b.id} className="rounded-xl border overflow-hidden" data-testid={`booking-${index}`}>
                    <button
                      type="button"
                      onClick={() => toggle(index)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                      data-testid={`booking-header-${index}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold font-mono flex-shrink-0">
                          {p.seatNo}
                        </span>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold truncate">{p.fullName}</span>
                            <BookingStatusBadge status={b.status || 'unknown'} />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-mono">{b.bookingCode ?? b.id?.slice(0, 8).toUpperCase()}</span>
                            {totalPassengers > 1 && (
                              <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                <Users className="w-2.5 h-2.5" /> {totalPassengers} pax
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="p-4 space-y-4">
                        <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium" data-testid="origin-destination">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{b.originStop?.name ?? '—'}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{b.destinationStop?.name ?? '—'}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Channel</p>
                              <p className="font-medium mt-0.5">
                                {b.channel ? <ChannelBadge channel={b.channel} /> : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total</p>
                              <p className="font-semibold text-emerald-700 mt-0.5">{fmtCurrency(b.totalAmount ?? 0)}</p>
                              {b.discountAmount && parseFloat(String(b.discountAmount)) > 0 && (
                                <p className="text-[11px] text-orange-600 mt-0.5">
                                  Diskon: -{fmtCurrency(b.discountAmount)} {b.voucherCode ? `(${b.voucherCode})` : ''}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-muted-foreground">Dibuat</p>
                              <p className="font-medium mt-0.5">{fmtDate(b.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Oleh</p>
                              <p className="font-medium mt-0.5 truncate" data-testid={`text-created-by-${b.id}`}>
                                {b.channel === 'OTA' && b.salesChannelName
                                  ? `OTA - ${b.salesChannelName}`
                                  : b.createdBy ?? '—'}
                              </p>
                            </div>
                            {b.outlet && (
                              <div>
                                <p className="text-muted-foreground">Outlet</p>
                                <p className="font-medium mt-0.5 truncate">{b.outlet.name}</p>
                              </div>
                            )}
                            {b.vehicle && (
                              <div>
                                <p className="text-muted-foreground">Kendaraan</p>
                                <p className="font-medium mt-0.5">{b.vehicle.plate} ({b.vehicle.code})</p>
                              </div>
                            )}
                            {b.departAt && (
                              <div>
                                <p className="text-muted-foreground">Berangkat</p>
                                <p className="font-medium mt-0.5">{fmtDate(b.departAt)}</p>
                              </div>
                            )}
                            {b.arriveAt && (
                              <div>
                                <p className="text-muted-foreground">Tiba</p>
                                <p className="font-medium mt-0.5">{fmtDate(b.arriveAt)}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <PassengerCard
                          passenger={p}
                          actionTarget={{
                            id: p.id,
                            fullName: p.fullName,
                            seatNo: p.seatNo,
                            ticketNumber: p.ticketNumber,
                            ticketStatus: p.ticketStatus ?? 'active',
                            bookingCode: b.bookingCode ?? b.id?.slice(0, 8).toUpperCase(),
                            bookingId: b.id,
                            originStopName: b.originStop?.name,
                            destinationStopName: b.destinationStop?.name,
                          }}
                          onClose={onClose}
                          onStartRescheduleMode={onStartRescheduleMode}
                          onStartAssignMode={onStartAssignMode}
                        />

                        {others.length > 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <div className="px-4 py-2.5 bg-blue-50/50 flex items-center gap-2 text-sm font-semibold text-blue-800">
                              <Users className="w-3.5 h-3.5" />
                              Penumpang Lain ({others.length})
                            </div>
                            <div className="divide-y">
                              {others.map((op) => {
                                const isActive = op.ticketStatus !== 'unseated' && op.ticketStatus !== 'cancelled';
                                return (
                                  <div key={op.id} className="px-4 py-2.5 flex items-center justify-between gap-2" data-testid={`other-pax-${op.seatNo}`}>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-sm font-medium truncate ${!isActive ? 'line-through text-muted-foreground' : ''}`}>
                                          {op.fullName}
                                        </span>
                                        {op.ticketStatus && op.ticketStatus !== 'active' && (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                            BOOKING_STATUS_MAP[op.ticketStatus as BookingStatus]?.bg || 'bg-gray-50'
                                          } ${BOOKING_STATUS_MAP[op.ticketStatus as BookingStatus]?.color || 'text-gray-700'}`}>
                                            {BOOKING_STATUS_MAP[op.ticketStatus as BookingStatus]?.label || op.ticketStatus}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                                        <span className="flex items-center gap-0.5">
                                          <Armchair className="w-2.5 h-2.5" /> {op.seatNo}
                                        </span>
                                        {op.phone && (
                                          <span className="flex items-center gap-0.5">
                                            <Phone className="w-2.5 h-2.5" /> {op.phone}
                                          </span>
                                        )}
                                        {op.ticketNumber && (
                                          <span className="flex items-center gap-0.5">
                                            <Hash className="w-2.5 h-2.5" /> {op.ticketNumber}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-700 flex-shrink-0">
                                      {fmtCurrency(op.fareAmount ?? 0)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {(() => {
                          const discount = parseFloat(String(b.discountAmount || 0));
                          const total = parseFloat(String(b.totalAmount || 0));
                          const subtotal = discount > 0 ? total + discount : total;
                          const hasDiscount = discount > 0;
                          return hasDiscount ? (
                            <div className="rounded-lg border overflow-hidden" data-testid="payment-summary">
                              <div className="px-4 py-2.5 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                                <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                                Rincian Pembayaran
                              </div>
                              <div className="px-4 py-3 space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Subtotal</span>
                                  <span className="font-mono">{fmtCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-orange-600">
                                  <span>Diskon {b.voucherCode ? <span className="font-mono text-[10px]">({b.voucherCode})</span> : ''}</span>
                                  <span className="font-mono">-{fmtCurrency(discount)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-semibold">
                                  <span>Total Bayar</span>
                                  <span className="text-emerald-700 font-mono">{fmtCurrency(total)}</span>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {bookingData.payments.length > 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <div className="px-4 py-2.5 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                              Pembayaran
                            </div>
                            <div className="divide-y">
                              {bookingData.payments.map((pay, pi) => (
                                <div key={pay.id} className="px-4 py-2.5 flex items-center justify-between text-sm" data-testid={`payment-${pi}`}>
                                  <div>
                                    <p className="font-medium">{getPaymentLabel(pay.method)}</p>
                                    {pay.paidAt && <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(pay.paidAt)}</p>}
                                  </div>
                                  <p className="font-semibold text-emerald-700">{fmtCurrency(pay.amount ?? 0)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {bookingData.payments.length === 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <div className="px-4 py-2.5 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                              Pembayaran
                            </div>
                            <p className="px-4 py-3 text-muted-foreground text-xs">Belum ada data pembayaran</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
