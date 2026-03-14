import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Printer, Plus, AlertCircle, MapPin, Clock, Calendar, Store, Users, CreditCard } from 'lucide-react';

interface PrintPreviewProps {
  booking: any;
  printPayload: any;
  onNewBooking: () => void;
  onPrint: () => void;
}

export default function PrintPreview({ booking, onNewBooking, onPrint }: PrintPreviewProps) {
  if (!booking) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Memuat data booking...</p>
        </CardContent>
      </Card>
    );
  }

  const isPaid = booking.status === 'paid';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  };

  const bookingIdShort = booking.id?.slice(0, 8).toUpperCase() || '-';

  return (
    <div className="space-y-4" data-testid="print-preview-container">
      <div className={`rounded-lg p-4 text-center ${isPaid ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className="flex items-center justify-center gap-2 mb-1">
          {isPaid ? (
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          ) : (
            <AlertCircle className="w-6 h-6 text-amber-600" />
          )}
          <span className={`text-xl font-bold ${isPaid ? 'text-green-800' : 'text-amber-800'}`}>
            {isPaid ? 'Booking Berhasil!' : 'Booking Tersimpan'}
          </span>
        </div>
        <p className={`text-sm ${isPaid ? 'text-green-700' : 'text-amber-700'}`}>
          Booking ID: <strong>{bookingIdShort}</strong>
        </p>
      </div>

      <Card className="overflow-hidden border-2" data-testid="eticket-card">
        <div className="bg-primary px-4 py-3 flex items-center justify-between">
          <span className="text-primary-foreground font-bold text-lg">E-Ticket</span>
          <Badge variant={isPaid ? 'secondary' : 'outline'} className={isPaid ? 'bg-green-100 text-green-800 border-green-300' : 'bg-white/20 text-primary-foreground border-primary-foreground/30'}>
            {isPaid ? 'LUNAS' : 'BELUM BAYAR'}
          </Badge>
        </div>

        <CardContent className="p-0">
          <div className="flex items-stretch">
            <div className="flex-1 p-4">
              <div className="text-center py-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-black tracking-wide">{booking.originStop?.code || 'ORI'}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">{booking.originStop?.name}</div>
                  </div>
                  <div className="flex flex-col items-center px-2">
                    <div className="w-16 border-t-2 border-dashed border-primary relative">
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-1">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-black tracking-wide">{booking.destinationStop?.code || 'DST'}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">{booking.destinationStop?.name}</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-dashed my-2" />

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm py-2">
                <div className="flex items-start gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground font-medium">Tanggal</div>
                    <div className="font-medium text-xs">{formatDate(booking.tripDetails?.serviceDate || booking.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground font-medium">Berangkat</div>
                    <div className="font-bold text-base">{formatTime(booking.departAt || booking.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Store className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground font-medium">Outlet</div>
                    <div className="font-medium text-xs">{booking.outlet?.name || '-'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground font-medium">Penumpang</div>
                    <div className="font-medium text-xs">{booking.passengers?.length || 0} orang</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-px bg-border border-dashed" />

            <div className="w-28 flex flex-col items-center justify-center p-3 bg-muted/30">
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center" data-testid="qr-placeholder">
                <span className="text-gray-500 font-bold text-lg">QR</span>
              </div>
              <div className="text-[9px] text-muted-foreground mt-1.5 text-center font-mono">{bookingIdShort}</div>
            </div>
          </div>

          <div className="border-t border-dashed" />

          {booking.passengers && booking.passengers.length > 0 && (
            <div className="px-4 py-3">
              <table className="w-full text-xs" data-testid="passenger-table">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1 font-medium">Nama Penumpang</th>
                    <th className="text-center py-1 font-medium w-16">Kursi</th>
                    <th className="text-right py-1 font-medium w-24">Tarif</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.passengers.map((p: any, i: number) => (
                    <tr key={i} className="border-b border-dashed last:border-0" data-testid={`passenger-row-${i}`}>
                      <td className="py-1.5 font-medium">{p.fullName}</td>
                      <td className="py-1.5 text-center">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.seatNo}</Badge>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{formatCurrency(p.fareAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-dashed" />

          <div className="px-4 py-3 bg-muted/20">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Total Bayar</span>
              <span className="font-bold text-primary text-xl tabular-nums">{formatCurrency(booking.totalAmount)}</span>
            </div>
            {booking.payments && booking.payments.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <CreditCard className="w-3 h-3" />
                <span>Dibayar via <span className="capitalize font-medium">{booking.payments[0].method}</span></span>
              </div>
            )}
          </div>

          <div className="border-t px-4 py-2 bg-muted/10 text-center">
            <p className="text-[10px] text-muted-foreground">
              Tunjukkan e-ticket ini kepada petugas saat naik kendaraan.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {isPaid ? (
          <Button onClick={onPrint} className="flex-1" size="lg" data-testid="button-print">
            <Printer className="w-4 h-4 mr-2" />
            Cetak Tiket
          </Button>
        ) : (
          <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2" data-testid="unpaid-notice">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Belum dibayar — tiket dicetak setelah pembayaran.
            </p>
          </div>
        )}
        <Button onClick={onNewBooking} variant="outline" size="lg" data-testid="button-new-booking">
          <Plus className="w-4 h-4 mr-2" />
          Booking Baru
        </Button>
      </div>
    </div>
  );
}
