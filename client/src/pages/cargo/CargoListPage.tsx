import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cargoApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Package, Search, X, Loader2, ArrowRight,
  Phone, Clock, CheckCircle2, Truck, XCircle, Eye,
  Download, Upload, RotateCcw
} from 'lucide-react';

const fmt = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Menunggu', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
  received: { label: 'Diterima', color: 'text-orange-700', bg: 'bg-orange-100', icon: Download },
  loaded: { label: 'Dimuat', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Upload },
  in_transit: { label: 'Dalam Perjalanan', color: 'text-blue-700', bg: 'bg-blue-100', icon: Truck },
  arrived: { label: 'Tiba', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
  delivered: { label: 'Terkirim', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
  returned: { label: 'Dikembalikan', color: 'text-purple-700', bg: 'bg-purple-100', icon: RotateCcw },
  canceled: { label: 'Dibatalkan', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle }
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['received', 'canceled'],
  received: ['loaded', 'canceled'],
  loaded: ['in_transit', 'canceled'],
  in_transit: ['arrived', 'canceled'],
  arrived: ['delivered', 'returned'],
  delivered: [],
  returned: [],
  canceled: []
};

export default function CargoListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const { toast } = useToast();

  const { data: shipments = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/cargo', statusFilter],
    queryFn: () => cargoApi.getAll(statusFilter ? { status: statusFilter } : undefined)
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => cargoApi.updateStatus(id, status),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo'] });
      setSelectedShipment(result);
      toast({ title: 'Status Diperbarui', description: `Resi ${result.waybillNumber} diperbarui` });
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    }
  });

  const filteredShipments = searchQuery.trim()
    ? shipments.filter(s =>
        s.waybillNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.itemDescription.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shipments;

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta'
      });
    } catch { return '-'; }
  };

  const formatTime = (date: string) => {
    try {
      return new Date(date).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
      });
    } catch { return '-'; }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="cargo-list-page">
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between px-3 md:px-5 h-11 md:h-12">
          <div className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-gray-800">Daftar Pengiriman Kargo</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-1">
              {filteredShipments.length} kiriman
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`${selectedShipment ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden border-r border-gray-200`}>
          <div className="p-3 md:p-4 space-y-3 flex-shrink-0 bg-white border-b border-gray-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari resi, pengirim, penerima..."
                className="w-full h-9 pl-9 pr-8 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                data-testid="input-search-cargo"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {[
                { value: '', label: 'Semua' },
                { value: 'pending', label: 'Menunggu' },
                { value: 'received', label: 'Diterima' },
                { value: 'loaded', label: 'Dimuat' },
                { value: 'in_transit', label: 'Perjalanan' },
                { value: 'arrived', label: 'Tiba' },
                { value: 'delivered', label: 'Terkirim' },
                { value: 'returned', label: 'Kembali' },
                { value: 'canceled', label: 'Batal' }
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                    statusFilter === f.value
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                  data-testid={`filter-${f.value || 'all'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-500" />
                <p className="text-xs text-gray-400 mt-1.5">Memuat data...</p>
              </div>
            ) : filteredShipments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Tidak ada pengiriman ditemukan</p>
              </div>
            ) : (
              filteredShipments.map(shipment => {
                const s = STATUS_MAP[shipment.status || 'pending'] || STATUS_MAP.pending;
                const StatusIcon = s.icon;
                const isSelected = selectedShipment?.id === shipment.id;
                return (
                  <button
                    key={shipment.id}
                    onClick={() => setSelectedShipment(shipment)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-200'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    data-testid={`cargo-item-${shipment.id}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-amber-700">{shipment.waybillNumber}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${s.bg} ${s.color} flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {s.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1">
                      <span className="font-medium text-gray-700">{shipment.senderName}</span>
                      <ArrowRight className="w-3 h-3 text-gray-300" />
                      <span className="font-medium text-gray-700">{shipment.recipientName}</span>
                    </div>
                    {(shipment.originStopName || shipment.destinationStopName) && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
                        <span>{shipment.originStopName || '?'}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-gray-300" />
                        <span>{shipment.destinationStopName || '?'}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{shipment.itemDescription}</span>
                      <span className="font-mono font-semibold text-gray-600">{fmt(parseFloat(shipment.totalAmount))}</span>
                    </div>
                    <div className="text-[10px] text-gray-300 mt-1">
                      {formatDate(shipment.createdAt!)} {formatTime(shipment.createdAt!)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={`${selectedShipment ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto p-4 md:p-6`}>
          {selectedShipment ? (
            <div className="max-w-lg mx-auto space-y-4">
              <button
                onClick={() => setSelectedShipment(null)}
                className="md:hidden text-xs text-blue-600 hover:underline mb-2"
                data-testid="btn-back-list"
              >
                &larr; Kembali ke daftar
              </button>

              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-white" />
                    <span className="text-white font-bold">{selectedShipment.waybillNumber}</span>
                  </div>
                  {(() => {
                    const s = STATUS_MAP[selectedShipment.status || 'pending'] || STATUS_MAP.pending;
                    return (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/20 text-white/90">
                        {s.label.toUpperCase()}
                      </span>
                    );
                  })()}
                </div>

                <div className="p-5 space-y-4">
                  {(selectedShipment.originStopName || selectedShipment.destinationStopName) && (
                    <div className="flex items-center justify-between text-center">
                      <div>
                        <p className="text-lg font-black text-gray-900 tracking-wider">{selectedShipment.originStopCode || 'ORI'}</p>
                        <p className="text-[10px] text-gray-400">{selectedShipment.originStopName || 'Asal'}</p>
                      </div>
                      <div className="flex-1 mx-4 flex items-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-1" />
                        <Package className="w-4 h-4 text-amber-500" />
                        <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-1" />
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 tracking-wider">{selectedShipment.destinationStopCode || 'DST'}</p>
                        <p className="text-[10px] text-gray-400">{selectedShipment.destinationStopName || 'Tujuan'}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider">Pengirim</p>
                      <p className="text-sm font-medium text-gray-700">{selectedShipment.senderName}</p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" /> {selectedShipment.senderPhone}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider">Penerima</p>
                      <p className="text-sm font-medium text-gray-700">{selectedShipment.recipientName}</p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" /> {selectedShipment.recipientPhone}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-3">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Barang</p>
                    <p className="text-sm font-medium text-gray-700">{selectedShipment.itemDescription}</p>
                    <div className="flex gap-3 text-[11px] text-gray-500 mt-1 flex-wrap">
                      <span>Qty: {selectedShipment.quantity}</span>
                      {selectedShipment.weightKg && <span>Berat: {selectedShipment.weightKg} kg</span>}
                      {(selectedShipment.lengthCm || selectedShipment.widthCm || selectedShipment.heightCm) && (
                        <span>Dimensi: {selectedShipment.lengthCm || '-'}x{selectedShipment.widthCm || '-'}x{selectedShipment.heightCm || '-'} cm</span>
                      )}
                    </div>
                    {selectedShipment.declaredValue && (
                      <p className="text-[11px] text-gray-500 mt-0.5">Nilai barang: {fmt(parseFloat(selectedShipment.declaredValue))}</p>
                    )}
                    {selectedShipment.notes && (
                      <p className="text-[10px] text-gray-400 mt-1 italic">{selectedShipment.notes}</p>
                    )}
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="text-lg font-black text-amber-700 font-mono">
                      {fmt(parseFloat(selectedShipment.totalAmount))}
                    </span>
                  </div>
                </div>
              </div>

              {(STATUS_TRANSITIONS[selectedShipment.status || 'pending'] || []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Ubah Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {(STATUS_TRANSITIONS[selectedShipment.status || 'pending'] || []).map(nextStatus => {
                      const s = STATUS_MAP[nextStatus] || STATUS_MAP.pending;
                      const Icon = s.icon;
                      return (
                        <button
                          key={nextStatus}
                          onClick={() => updateStatusMutation.mutate({ id: selectedShipment.id, status: nextStatus })}
                          disabled={updateStatusMutation.isPending}
                          className={`flex-1 min-w-[100px] h-9 ${s.bg} ${s.color} rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-transparent hover:opacity-90 transition-opacity disabled:opacity-50`}
                          data-testid={`btn-status-${nextStatus}`}
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Icon className="w-3.5 h-3.5" />
                          )}
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
              <Eye className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium text-gray-400">Pilih pengiriman untuk melihat detail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
