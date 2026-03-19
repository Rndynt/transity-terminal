import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Phone, CreditCard, MapPin, User, Armchair, Ticket, Hash } from 'lucide-react';
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
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods = {
      cash: 'Tunai',
      qr: 'QR Code',
      ewallet: 'E-Wallet',
      bank: 'Transfer Bank'
    };
    return methods[method as keyof typeof methods] || method;
  };

  const getBookingStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      paid: { label: 'Lunas', className: 'bg-green-100 text-green-800' },
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
      canceled: { label: 'Dibatalkan', className: 'bg-red-100 text-red-800' },
      refunded: { label: 'Dikembalikan', className: 'bg-gray-100 text-gray-800' }
    };
    const variant = variants[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={variant.className} data-testid={`booking-status-${status}`}>{variant.label}</Badge>;
  };

  const getTicketStatusBadge = (status: string | null | undefined) => {
    const variants: Record<string, { label: string; className: string }> = {
      active:     { label: 'Aktif',       className: 'bg-blue-100 text-blue-800' },
      canceled:   { label: 'Dibatalkan',  className: 'bg-red-100 text-red-800' },
      refunded:   { label: 'Refund',      className: 'bg-gray-100 text-gray-700' },
      checked_in: { label: 'Check-in',    className: 'bg-emerald-100 text-emerald-800' },
      no_show:    { label: 'No-show',     className: 'bg-orange-100 text-orange-800' },
    };
    const s = status || 'active';
    const variant = variants[s] || { label: s, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={variant.className} data-testid={`ticket-status-${s}`}>{variant.label}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} data-testid="passenger-detail-modal">
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Armchair className="w-5 h-5 text-primary" />
            Detail Penumpang - Kursi {passengerDetails?.seatNo || selectedSeatNo || ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4" data-testid="modal-content">
          {isLoading && (
            <div className="flex items-center justify-center py-8" data-testid="loading-state">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-muted-foreground">Memuat detail penumpang...</span>
            </div>
          )}

          {!isLoading && (isError || passengerDetails?.error) && (
            <Card data-testid="error-state">
              <CardContent className="pt-6">
                {isError ? (
                  <div className="text-center space-y-2">
                    <p className="text-muted-foreground">Gagal memuat detail penumpang</p>
                    <p className="text-xs text-muted-foreground">Periksa koneksi internet dan coba lagi</p>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">{passengerDetails?.error}</p>
                )}
              </CardContent>
            </Card>
          )}

          {!isLoading && passengerDetails?.bookings && passengerDetails.bookings.length > 0 && (
            <>
              {passengerDetails.bookings.map((bookingData, index) => (
                <Card key={bookingData.booking.id} data-testid={`booking-${index}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {bookingData.passenger.fullName}
                      </CardTitle>
                      <div className="flex items-center gap-1.5">
                        {getTicketStatusBadge((bookingData.passenger as any).ticketStatus)}
                        {getBookingStatusBadge(bookingData.booking.status || 'unknown')}
                      </div>
                    </div>
                    {/* Ticket & Booking codes */}
                    <div className="flex flex-col gap-1 mt-2">
                      {(bookingData.passenger as any).ticketNumber && (
                        <div className="flex items-center gap-1.5 text-xs" data-testid="ticket-number">
                          <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">No. Tiket:</span>
                          <span className="font-mono font-semibold tracking-wider text-primary">
                            {(bookingData.passenger as any).ticketNumber}
                          </span>
                        </div>
                      )}
                      {(bookingData.booking as any).bookingCode && (
                        <div className="flex items-center gap-1.5 text-xs" data-testid="booking-code">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Kode Booking:</span>
                          <span className="font-mono font-semibold tracking-wider text-primary">
                            {(bookingData.booking as any).bookingCode}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Passenger Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2" data-testid="passenger-name">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Nama:</span>
                          <span>{bookingData.passenger.fullName}</span>
                        </div>
                        {bookingData.passenger.phone && (
                          <div className="flex items-center gap-2" data-testid="passenger-phone">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Telepon:</span>
                            <span>{bookingData.passenger.phone}</span>
                          </div>
                        )}
                        {bookingData.passenger.idNumber && (
                          <div className="flex items-center gap-2" data-testid="passenger-id">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">No. ID:</span>
                            <span>{bookingData.passenger.idNumber}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2" data-testid="seat-number">
                          <Armchair className="w-4 h-4 text-muted-foreground" />
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

                    {/* Journey Details */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Detail Perjalanan
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div data-testid="origin-destination">
                          <span className="font-medium">Rute:</span>
                          <div className="text-muted-foreground">
                            {bookingData.booking.originStop?.name} → {bookingData.booking.destinationStop?.name}
                          </div>
                        </div>
                        <div data-testid="booking-date">
                          <span className="font-medium">Tanggal Booking:</span>
                          <div className="text-muted-foreground">
                            {bookingData.booking.createdAt && formatDate(bookingData.booking.createdAt.toString())}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Payment Details */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Detail Pembayaran
                      </h4>
                      {bookingData.payments.length > 0 ? (
                        <div className="space-y-2">
                          {bookingData.payments.map((payment, paymentIndex) => (
                            <div key={payment.id} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm" data-testid={`payment-${paymentIndex}`}>
                              <div>
                                <span className="font-medium">Metode:</span>
                                <span className="ml-2">{getPaymentMethodLabel(payment.method)}</span>
                              </div>
                              <div>
                                <span className="font-medium">Jumlah:</span>
                                <span className="ml-2">{formatCurrency(payment.amount)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Belum ada data pembayaran</p>
                      )}
                    </div>

                    <Separator />

                    {/* Booking Reference */}
                    <div className="text-xs text-muted-foreground" data-testid="booking-reference">
                      Booking ID: <span className="font-mono">{bookingData.booking.id.slice(-8).toUpperCase()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}