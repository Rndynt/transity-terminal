import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PrintPreviewProps {
  booking: any;
  printPayload: any;
  onNewBooking: () => void;
  onPrint: () => void;
}

export default function PrintPreview({ booking, printPayload, onNewBooking, onPrint }: PrintPreviewProps) {
  if (!booking) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Memuat data booking...</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (date: string) => 
    new Date(date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  };

  return (
    <div className="space-y-4">
      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="text-4xl mb-2">_booking Berhasil!</div>
        <p className="text-green-700">Booking ID: <strong>{booking.id?.slice(0, 8).toUpperCase()}</strong></p>
      </div>

      {/* Ticket Card */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground pb-3">
          <CardTitle className="text-center text-xl">E-Ticket</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Route Info */}
          <div className="text-center border-b pb-4">
            <div className="text-2xl font-bold">
              {booking.originStop?.code || 'Origin'} &rarr; {booking.destinationStop?.code || 'Destination'}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {booking.originStop?.name} - {booking.destinationStop?.name}
            </div>
          </div>

          {/* Trip Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Tanggal</span>
              <p className="font-medium">{formatDate(booking.tripDetails?.serviceDate || booking.createdAt)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Waktu Berangkat</span>
              <p className="font-medium">{formatTime(booking.departAt || booking.createdAt)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Outlet</span>
              <p className="font-medium">{booking.outlet?.name || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-medium text-green-600 capitalize">{booking.status}</p>
            </div>
          </div>

          {/* Passengers */}
          {booking.passengers && booking.passengers.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Penumpang ({booking.passengers.length})</h3>
              <div className="space-y-2">
                {booking.passengers.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm bg-muted/50 rounded p-2">
                    <div>
                      <span className="font-medium">{p.fullName}</span>
                      <span className="text-muted-foreground ml-2">Kursi {p.seatNo}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(p.fareAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-lg">
              <span className="font-semibold">Total Bayar</span>
              <span className="font-bold text-primary text-xl">{formatCurrency(booking.totalAmount)}</span>
            </div>
          </div>

          {/* Payment Info */}
          {booking.payments && booking.payments.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Dibayar via <span className="font-medium capitalize">{booking.payments[0].method}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onPrint} className="flex-1" size="lg">
          Cetak Tiket
        </Button>
        <Button onClick={onNewBooking} variant="outline" className="flex-1" size="lg">
          Booking Baru
        </Button>
      </div>

      {/* Note */}
      <p className="text-xs text-muted-foreground text-center">
        Simpan e-ticket ini sebagai bukti pembayaran. Tunjukkan kepada petugas saat naik kendaraan.
      </p>
    </div>
  );
}