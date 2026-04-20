import {
  CheckCircle2, Printer, RotateCcw, Package,
  User, Phone, MapPin, Bus, Calendar, FileText, QrCode
} from 'lucide-react';
import { fmtCurrency } from '@/lib/constants';
import type { CargoShipmentWithStops } from '@/types';

interface CargoWaybillPreviewProps {
  shipment: CargoShipmentWithStops;
  onNewShipment: () => void;
  onPrint: () => void;
}

export default function CargoWaybillPreview({ shipment, onNewShipment, onPrint }: CargoWaybillPreviewProps) {
  if (!shipment) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Memuat data resi...</p>
      </div>
    );
  }

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('id-ID', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Jakarta'
      });
    } catch { return '-'; }
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    pending: { text: 'MENUNGGU', color: 'bg-amber-400/20 text-amber-100' },
    in_transit: { text: 'DALAM PERJALANAN', color: 'bg-blue-400/20 text-blue-100' },
    arrived: { text: 'TIBA DI TUJUAN', color: 'bg-emerald-400/20 text-emerald-100' },
    delivered: { text: 'TERKIRIM', color: 'bg-emerald-400/20 text-emerald-100' },
    canceled: { text: 'DIBATALKAN', color: 'bg-red-400/20 text-red-100' }
  };

  const status = (shipment.status ? statusLabel[shipment.status] : null) || statusLabel.pending;

  return (
    <div className="space-y-5 flex flex-col items-center" data-testid="cargo-waybill-container">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 bg-amber-100">
          <CheckCircle2 className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Resi Berhasil Dibuat!</h2>
        <p className="text-sm text-gray-500">
          No. Resi: <span className="font-mono text-amber-600 font-semibold">{shipment.waybillNumber}</span>
        </p>
      </div>

      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm print-section" data-testid="waybill-card">
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-white" />
            <span className="text-white font-bold text-base tracking-wide">Resi Kargo</span>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${status.color}`}>
            {status.text}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center">
              <p className="text-lg font-black text-gray-900 tracking-wider">{shipment.originStopCode || 'ORI'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{shipment.originStopName || 'Asal'}</p>
            </div>
            <div className="flex-1 mx-4 flex flex-col items-center">
              <div className="flex items-center w-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-1" />
                <Package className="w-4 h-4 text-amber-500" />
                <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-1" />
                <div className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-gray-900 tracking-wider">{shipment.destinationStopCode || 'DST'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{shipment.destinationStopName || 'Tujuan'}</p>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3" /> Pengirim
                </p>
                <p className="text-[11px] font-medium text-gray-700">{shipment.senderName}</p>
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Phone className="w-2.5 h-2.5" /> {shipment.senderPhone}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3" /> Penerima
                </p>
                <p className="text-[11px] font-medium text-gray-700">{shipment.recipientName}</p>
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Phone className="w-2.5 h-2.5" /> {shipment.recipientPhone}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Package className="w-3 h-3" /> Detail Barang
            </p>
            <p className="text-sm font-medium text-gray-700">{shipment.itemDescription}</p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
              <span>Jumlah: <span className="font-semibold">{shipment.quantity}</span></span>
              {shipment.weightKg && <span>Berat: <span className="font-semibold">{shipment.weightKg} kg</span></span>}
            </div>
            {shipment.notes && (
              <p className="text-[10px] text-gray-400 mt-1 italic">{shipment.notes}</p>
            )}
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 block">Tanggal</span>
              <span className="text-[11px] font-medium text-gray-700">{formatDate(shipment.createdAt ? String(shipment.createdAt) : '')}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 block">Total Biaya</span>
              <span className="text-lg font-black text-amber-700 font-mono">{fmtCurrency(parseFloat(shipment.totalAmount))}</span>
            </div>
          </div>

          {(shipment.outletName || shipment.vehiclePlate || shipment.tripDepartAt) && (
            <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-x-4 gap-y-2">
              {shipment.outletName && (
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Outlet Pengiriman</span>
                  <span className="text-[11px] font-medium text-gray-700">{shipment.outletName}</span>
                </div>
              )}
              {shipment.vehiclePlate && (
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Kendaraan</span>
                  <span className="text-[11px] font-medium text-gray-700">{shipment.vehiclePlate}</span>
                </div>
              )}
              {shipment.tripDepartAt && (
                <div className="col-span-2">
                  <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Keberangkatan</span>
                  <span className="text-[11px] font-medium text-gray-700">
                    {new Date(shipment.tripDepartAt).toLocaleString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Jakarta'
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2.5 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 flex items-center gap-1 capitalize">
            <FileText className="w-3 h-3" />
            {shipment.paymentMethod || 'Belum dibayar'}
          </span>
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-200" data-testid="cargo-qr-placeholder">
            <QrCode className="w-6 h-6 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-lg">
        <button
          onClick={onPrint}
          className="flex-1 h-10 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          data-testid="button-print-waybill"
        >
          <Printer className="w-4 h-4" /> Cetak Resi
        </button>
        <button
          onClick={onNewShipment}
          className="flex-1 h-10 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-gray-200 transition-colors"
          data-testid="button-new-cargo"
        >
          <RotateCcw className="w-4 h-4" /> Kirim Baru
        </button>
      </div>
    </div>
  );
}
