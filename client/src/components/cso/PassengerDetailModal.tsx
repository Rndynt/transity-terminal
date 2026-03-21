import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard, MapPin, Armchair, Ticket,
  ChevronDown, ChevronUp, ArrowRight, Calendar, Building2, Bus,
  Loader2
} from 'lucide-react';
import PassengerCard from './PassengerCard';
import { BookingStatusBadge, ChannelBadge } from '@/components/shared/StatusBadges';
import { fmtCurrency, fmtDate, getPaymentLabel } from '@/lib/constants';
import type { Passenger, Booking, Payment, Stop } from '@/types';

interface PassengerDetailsData {
  seatNo: string;
  bookings: Array<{
    booking: Booking & {
      originStop?: Stop;
      destinationStop?: Stop;
      outlet?: { id: string; name: string; code?: string };
      vehicle?: { id: string; plate: string; code: string };
      departAt?: string | null;
      arriveAt?: string | null;
    };
    passenger: Passenger;
    payments: Payment[];
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
            Detail Penumpang — Kursi {passengerDetails?.seatNo || selectedSeatNo || ''}
            {isMulti && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({passengerDetails!.bookings.length} booking)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div data-testid="modal-content">
          {isLoading && (
            <div className="flex items-center justify-center py-12" data-testid="loading-state">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Memuat detail penumpang...</span>
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
                const b = bookingData.booking as any;
                const p = bookingData.passenger as any;

                return (
                  <div key={b.id} className="space-y-4" data-testid={`booking-${index}`}>
                    {isMulti && (
                      <button
                        type="button"
                        onClick={() => toggle(index)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
                        data-testid={`booking-header-${index}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold font-mono">{p.seatNo}</span>
                          <span>{p.fullName}</span>
                          <BookingStatusBadge status={b.status || 'unknown'} />
                        </span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )}

                    {(!isMulti || isOpen) && (
                      <>
                        {/* Booking Header */}
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Kode Booking</p>
                              <p className="font-mono font-bold text-base text-blue-700" data-testid="booking-code">
                                {b.bookingCode ?? b.id?.slice(0, 8).toUpperCase()}
                              </p>
                            </div>
                            <BookingStatusBadge status={b.status || 'unknown'} />
                          </div>

                          <div className="flex items-center gap-2 text-sm font-medium" data-testid="origin-destination">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{b.originStop?.name ?? '—'}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{b.destinationStop?.name ?? '—'}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
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
                              <p className="font-medium mt-0.5 truncate">{b.createdBy ?? '—'}</p>
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

                        {/* Payment Summary */}
                        {(() => {
                          const discount = parseFloat(String(b.discountAmount || 0));
                          const total = parseFloat(String(b.totalAmount || 0));
                          const subtotal = discount > 0 ? total + discount : total;
                          const hasDiscount = discount > 0;
                          return hasDiscount ? (
                            <div className="rounded-lg border overflow-hidden" data-testid="payment-summary">
                              <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
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

                        {/* Payments */}
                        {bookingData.payments.length > 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                              Pembayaran
                            </div>
                            <div className="divide-y">
                              {bookingData.payments.map((pay, pi) => (
                                <div key={pay.id} className="px-4 py-3 flex items-center justify-between text-sm" data-testid={`payment-${pi}`}>
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
                            <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                              Pembayaran
                            </div>
                            <p className="px-4 py-3 text-muted-foreground text-xs">Belum ada data pembayaran</p>
                          </div>
                        )}

                        {isMulti && index < passengerDetails.bookings.length - 1 && (
                          <Separator />
                        )}
                      </>
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
