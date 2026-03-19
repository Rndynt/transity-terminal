import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Phone, CreditCard, MapPin, User, Armchair, Ticket, Hash, ChevronDown, ChevronUp } from 'lucide-react';
import type { Passenger, Booking, Payment, Stop } from '@/types';

interface PassengerDetailsData {
  seatNo: string;
  bookings: Array<{
    booking: Booking & { originStop?: Stop; destinationStop?: Stop };
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
}

export default function PassengerDetailModal({
  isOpen,
  onClose,
  passengerDetails,
  isLoading = false,
  isError = false,
  selectedSeatNo = null
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

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'Asia/Jakarta'
    });

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = { cash: 'Tunai', qr: 'QR Code', ewallet: 'E-Wallet', bank: 'Transfer Bank' };
    return methods[method] || method;
  };

  const bookingStatusVariants: Record<string, { label: string; className: string }> = {
    paid:     { label: 'Lunas',       className: 'bg-green-100 text-green-800' },
    pending:  { label: 'Pending',     className: 'bg-yellow-100 text-yellow-800' },
    canceled: { label: 'Dibatalkan',  className: 'bg-red-100 text-red-800' },
    refunded: { label: 'Dikembalikan',className: 'bg-gray-100 text-gray-800' }
  };

  const ticketStatusVariants: Record<string, { label: string; className: string }> = {
    active:     { label: 'Aktif',      className: 'bg-blue-100 text-blue-800' },
    canceled:   { label: 'Dibatalkan', className: 'bg-red-100 text-red-800' },
    refunded:   { label: 'Refund',     className: 'bg-gray-100 text-gray-700' },
    checked_in: { label: 'Check-in',   className: 'bg-emerald-100 text-emerald-800' },
    no_show:    { label: 'No-show',    className: 'bg-orange-100 text-orange-800' },
  };

  const BookingBadge = ({ status }: { status: string }) => {
    const v = bookingStatusVariants[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={v.className} data-testid={`booking-status-${status}`}>{v.label}</Badge>;
  };

  const TicketBadge = ({ status }: { status?: string | null }) => {
    const s = status || 'active';
    const v = ticketStatusVariants[s] || { label: s, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={v.className} data-testid={`ticket-status-${s}`}>{v.label}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} data-testid="passenger-detail-modal">
      <DialogContent className="max-w-2xl max-h-[82vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Fixed header */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Armchair className="w-5 h-5 text-primary" />
            Detail Penumpang — Kursi {passengerDetails?.seatNo || selectedSeatNo || ''}
            {isMulti && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({passengerDetails!.bookings.length} penumpang)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2" data-testid="modal-content">

          {isLoading && (
            <div className="flex items-center justify-center py-10" data-testid="loading-state">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
            passengerDetails.bookings.map((bookingData, index) => {
              const isOpen = openIndices.has(index);
              const p = bookingData.passenger as any;
              const b = bookingData.booking as any;

              return (
                <div
                  key={bookingData.booking.id}
                  className="rounded-lg border bg-card overflow-hidden"
                  data-testid={`booking-${index}`}
                >
                  {/* Collapsible header — always visible */}
                  <button
                    type="button"
                    onClick={() => isMulti && toggle(index)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 ${isMulti ? 'cursor-pointer hover:bg-muted/40 transition-colors' : 'cursor-default'}`}
                    data-testid={`booking-header-${index}`}
                  >
                    {/* Seat chip */}
                    <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary text-xs font-bold font-mono">
                      {bookingData.passenger.seatNo}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{bookingData.passenger.fullName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <TicketBadge status={p.ticketStatus} />
                          <BookingBadge status={bookingData.booking.status || 'unknown'} />
                          {isMulti && (
                            <span className="text-muted-foreground">
                              {isOpen
                                ? <ChevronUp className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />
                              }
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Codes — always visible */}
                      <div className="flex flex-col gap-0.5 mt-1">
                        {p.ticketNumber && (
                          <div className="flex items-center gap-1.5 text-xs" data-testid="ticket-number">
                            <Ticket className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">Tiket:</span>
                            <span className="font-mono font-semibold tracking-wider text-primary">{p.ticketNumber}</span>
                          </div>
                        )}
                        {b.bookingCode && (
                          <div className="flex items-center gap-1.5 text-xs" data-testid="booking-code">
                            <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">Booking:</span>
                            <span className="font-mono font-semibold tracking-wider text-primary">{b.bookingCode}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Collapsible body */}
                  {(!isMulti || isOpen) && (
                    <div className="border-t px-4 py-3 space-y-3 text-sm" data-testid={`booking-body-${index}`}>

                      {/* Passenger details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2" data-testid="passenger-name">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium">Nama:</span>
                            <span>{bookingData.passenger.fullName}</span>
                          </div>
                          {bookingData.passenger.phone && (
                            <div className="flex items-center gap-2" data-testid="passenger-phone">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="font-medium">Telepon:</span>
                              <span>{bookingData.passenger.phone}</span>
                            </div>
                          )}
                          {bookingData.passenger.idNumber && (
                            <div className="flex items-center gap-2" data-testid="passenger-id">
                              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="font-medium">No. ID:</span>
                              <span>{bookingData.passenger.idNumber}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2" data-testid="seat-number">
                            <Armchair className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium">Kursi:</span>
                            <span>{bookingData.passenger.seatNo}</span>
                          </div>
                          <div className="flex items-center gap-2" data-testid="fare-amount">
                            <span className="font-medium">Tarif:</span>
                            <span>{formatCurrency(bookingData.passenger.fareAmount || '0')}</span>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Journey */}
                      <div className="space-y-1.5">
                        <h4 className="font-medium text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> Detail Perjalanan
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div data-testid="origin-destination">
                            <span className="font-medium">Rute:</span>
                            <div className="text-muted-foreground text-xs mt-0.5">
                              {bookingData.booking.originStop?.name} → {bookingData.booking.destinationStop?.name}
                            </div>
                          </div>
                          <div data-testid="booking-date">
                            <span className="font-medium">Tanggal Booking:</span>
                            <div className="text-muted-foreground text-xs mt-0.5">
                              {bookingData.booking.createdAt && formatDate(bookingData.booking.createdAt.toString())}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Payment */}
                      <div className="space-y-1.5">
                        <h4 className="font-medium text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" /> Detail Pembayaran
                        </h4>
                        {bookingData.payments.length > 0 ? (
                          bookingData.payments.map((payment, pi) => (
                            <div key={payment.id} className="grid grid-cols-2 gap-2" data-testid={`payment-${pi}`}>
                              <div>
                                <span className="font-medium">Metode:</span>
                                <span className="ml-1">{getPaymentMethodLabel(payment.method)}</span>
                              </div>
                              <div>
                                <span className="font-medium">Jumlah:</span>
                                <span className="ml-1">{formatCurrency(payment.amount)}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground text-xs">Belum ada data pembayaran</p>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
