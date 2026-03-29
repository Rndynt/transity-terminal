import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cargoApi } from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { TripWithDetails } from '@shared/schema';
import type { CargoShipmentWithStops } from '@/types';
import {
  Package, Search, X, Loader2, ArrowRight,
  Phone, Clock, CheckCircle2, Truck, XCircle, Eye,
  Download, Upload, RotateCcw, Calendar, AlertTriangle, Bus, ChevronDown, Check
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';

import { CARGO_STATUS_MAP, CARGO_STATUS_TRANSITIONS, fmtCurrency, type CargoStatus } from '@/lib/constants';
import { CargoStatusBadge } from '@/components/shared/StatusBadges';

const CARGO_ICON_MAP: Record<CargoStatus, typeof Clock> = {
  pending: Clock, received: Download, loaded: Upload, in_transit: Truck,
  arrived: CheckCircle2, delivered: CheckCircle2, returned: RotateCcw, canceled: XCircle,
};

function TripCombobox({
  trips,
  value,
  onChange
}: {
  trips: TripWithDetails[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = trips.find(t => t.id === value);

  const filtered = trips.filter(t => {
    const q = search.toLowerCase();
    if (!q) return true;
    const label = [t.patternCode, t.patternName, t.vehiclePlate, t.vehicleCode, t.serviceDate].join(' ').toLowerCase();
    return label.includes(q);
  });

  const tripLabel = (t: TripWithDetails) => {
    const route = t.patternCode || t.patternName || 'Trip';
    const plate = t.vehiclePlate || t.vehicleCode || '';
    const date = t.serviceDate ? new Date(t.serviceDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';
    return `${route}${plate ? ' · ' + plate : ''}${date ? ' (' + date + ')' : ''}`;
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 pl-3 pr-7 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 flex items-center gap-1.5 min-w-[140px] max-w-[200px] relative"
        data-testid="select-trip-filter"
      >
        <Bus className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="truncate flex-1 text-left">
          {selected ? tripLabel(selected) : 'Semua Trip'}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari rute, plat, tanggal..."
                className="w-full h-8 pl-7 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-200"
                data-testid="input-trip-search"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${!value ? 'text-blue-700 font-semibold' : 'text-gray-600'}`}
            >
              {!value && <Check className="w-3 h-3 flex-shrink-0" />}
              <span className={!value ? '' : 'pl-5'}>Semua Trip</span>
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">Trip tidak ditemukan</div>
            ) : (
              filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onChange(t.id); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 hover:bg-gray-50 transition-colors ${value === t.id ? 'bg-amber-50 text-amber-700' : 'text-gray-700'}`}
                >
                  {value === t.id && <Check className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-600" />}
                  <div className={value === t.id ? '' : 'pl-5'}>
                    <div className="font-semibold">{t.patternCode || 'Trip'}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {t.vehiclePlate || t.vehicleCode || 'Kendaraan'} · {t.serviceDate ? new Date(t.serviceDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CargoListPage() {
  usePageTitle("Daftar Kargo", "Semua pengiriman kargo");
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [tripFilter, setTripFilter] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<CargoShipmentWithStops | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: CargoStatus; label: string } | null>(null);
  const { toast } = useToast();

  const { data: trips = [] } = useQuery<TripWithDetails[]>({
    queryKey: ['/api/trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json())
  });

  const { data: shipments = [], isLoading } = useQuery<CargoShipmentWithStops[]>({
    queryKey: ['/api/cargo', statusFilter, tripFilter],
    queryFn: () => {
      const filters: { status?: string; tripId?: string } = {};
      if (statusFilter) filters.status = statusFilter;
      if (tripFilter) filters.tripId = tripFilter;
      return cargoApi.getAll(Object.keys(filters).length > 0 ? filters : undefined);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => cargoApi.updateStatus(id, status),
    onSuccess: (result: CargoShipmentWithStops) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo'] });
      setSelectedShipment(result);
      setConfirmAction(null);
      toast({ title: 'Status Diperbarui', description: `Resi ${result.waybillNumber} diperbarui` });
    },
    onError: (error: Error) => {
      setConfirmAction(null);
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    }
  });

  const filteredShipments = shipments.filter(s => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = s.waybillNumber.toLowerCase().includes(q) ||
        s.senderName.toLowerCase().includes(q) ||
        s.recipientName.toLowerCase().includes(q) ||
        s.itemDescription.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (dateFilter && s.createdAt) {
      const shipmentDate = new Date(s.createdAt).toISOString().slice(0, 10);
      if (shipmentDate !== dateFilter) return false;
    }
    return true;
  });

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

  const handleStatusClick = (id: string, nextStatus: CargoStatus) => {
    const s = CARGO_STATUS_MAP[nextStatus];
    setConfirmAction({ id, status: nextStatus, label: s.label });
  };

  const confirmStatusChange = () => {
    if (!confirmAction) return;
    updateStatusMutation.mutate({ id: confirmAction.id, status: confirmAction.status });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="cargo-list-page">
      <PageHeader icon={Package} title="Daftar Pengiriman Kargo" subtitle="Semua pengiriman kargo" badge={`${filteredShipments.length} kiriman`} iconColor="text-amber-600" />

      <div className="flex-1 flex overflow-hidden">
        <div className={`${selectedShipment ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden border-r border-gray-200`}>
          <div className="p-3 md:p-4 space-y-3 flex-shrink-0 bg-white border-b border-gray-100">
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              <TripCombobox
                trips={trips}
                value={tripFilter}
                onChange={setTripFilter}
              />
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-9 pl-9 pr-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  data-testid="input-date-filter"
                />
                {dateFilter && (
                  <button onClick={() => setDateFilter('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {([
                { value: '', label: 'Semua' },
                { value: 'received', label: 'Diterima' },
                { value: 'loaded', label: 'Dimuat' },
                { value: 'in_transit', label: 'Perjalanan' },
                { value: 'arrived', label: 'Tiba' },
                { value: 'delivered', label: 'Terkirim' },
                { value: 'returned', label: 'Kembali' },
                { value: 'canceled', label: 'Batal' }
              ] as const).map(f => (
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
              <LoadingState message="Memuat data..." />
            ) : filteredShipments.length === 0 ? (
              <EmptyState icon={Package} title="Tidak ada pengiriman ditemukan" />
            ) : (
              filteredShipments.map(shipment => {
                const status = (shipment.status || 'pending') as CargoStatus;
                const s = CARGO_STATUS_MAP[status] || CARGO_STATUS_MAP.pending;
                const StatusIcon = CARGO_ICON_MAP[status] || Clock;
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
                      <span className="font-mono font-semibold text-gray-600">{fmtCurrency(parseFloat(shipment.totalAmount))}</span>
                    </div>
                    <div className="text-[10px] text-gray-300 mt-1">
                      {shipment.createdAt ? formatDate(String(shipment.createdAt)) : '-'} {shipment.createdAt ? formatTime(String(shipment.createdAt)) : ''}
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
                    const status = (selectedShipment.status || 'pending') as CargoStatus;
                    const s = CARGO_STATUS_MAP[status] || CARGO_STATUS_MAP.pending;
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
                      <p className="text-[11px] text-gray-500 mt-0.5">Nilai barang: {fmtCurrency(parseFloat(selectedShipment.declaredValue))}</p>
                    )}
                    {selectedShipment.notes && (
                      <p className="text-[10px] text-gray-400 mt-1 italic">{selectedShipment.notes}</p>
                    )}
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="text-lg font-black text-amber-700 font-mono">
                      {fmtCurrency(parseFloat(selectedShipment.totalAmount))}
                    </span>
                  </div>
                </div>
              </div>

              {(CARGO_STATUS_TRANSITIONS[(selectedShipment.status || 'pending') as CargoStatus] || []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Ubah Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {(CARGO_STATUS_TRANSITIONS[(selectedShipment.status || 'pending') as CargoStatus] || []).map(nextStatus => {
                      const s = CARGO_STATUS_MAP[nextStatus] || CARGO_STATUS_MAP.pending;
                      const Icon = CARGO_ICON_MAP[nextStatus] || Clock;
                      return (
                        <button
                          key={nextStatus}
                          onClick={() => handleStatusClick(selectedShipment.id, nextStatus)}
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

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="confirm-status-dialog">
          <div className="bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Konfirmasi Perubahan Status</h3>
                <p className="text-xs text-gray-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Ubah status pengiriman menjadi <strong className="text-gray-800">{confirmAction.label}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="h-9 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                data-testid="btn-cancel-confirm"
              >
                Batal
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={updateStatusMutation.isPending}
                className="h-9 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                data-testid="btn-confirm-status"
              >
                {updateStatusMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ya, Ubah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
