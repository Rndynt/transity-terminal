import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarRange, ChevronLeft, ChevronRight, Plus, Bus, Truck,
  Clock, Users, Ban, MapPin, User, AlertTriangle,
  CheckCircle, X, ExternalLink, Loader2, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { outletsApi } from '@/lib/api';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_COL_W = 56;
const CELL_W = 160;
const CELL_H = 56;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthDates(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

function formatMonthTitle(year: number, month: number) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const today = todayStr();
  return {
    day: days[d.getDay()],
    date: d.getDate(),
    isToday: dateStr === today,
    isSunday: d.getDay() === 0,
    isSaturday: d.getDay() === 6,
  };
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

type CalendarItem = {
  id: string;
  type: 'trip' | 'virtual' | 'exception';
  serviceDate: string;
  departureTime: string;
  hour: number;
  routeName: string;
  routeCode: string;
  baseId?: string | null;
  tripId?: string | null;
  vehiclePlate?: string | null;
  driverName?: string | null;
  status?: string | null;
  capacity: number | null;
  seatsBooked?: number;
  exceptionId?: string | null;
  exceptionReason?: string | null;
  patternId?: string | null;
};

function stripTimeFromCode(code: string): string {
  return code.replace(/\/\d{2}:\d{2}(:\d{2})?$/, '');
}

function ScheduleChip({ item, onSelect }: { item: CalendarItem; onSelect?: (item: CalendarItem) => void }) {
  if (item.type === 'exception') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="px-1.5 py-1 rounded text-[10px] leading-tight cursor-pointer border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center gap-1 line-through opacity-70 hover:opacity-100 transition-opacity"
            data-testid={`chip-exception-${item.id}`}
            onClick={() => onSelect?.(item)}
          >
            <Ban className="w-2.5 h-2.5 shrink-0" />
            <span className="font-mono opacity-60">{item.departureTime}</span>
            <span className="truncate">{stripTimeFromCode(item.routeCode)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="font-semibold text-xs">{item.routeName}</p>
          <p className="text-xs text-red-500 mt-0.5">Pengecualian — tidak beroperasi</p>
          {item.exceptionReason && <p className="text-xs text-muted-foreground mt-0.5">Alasan: {item.exceptionReason}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (item.type === 'virtual') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="px-1.5 py-1 rounded text-[10px] leading-tight cursor-pointer border border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground flex items-center gap-1 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            data-testid={`chip-virtual-${item.id}`}
            onClick={() => onSelect?.(item)}
          >
            <span className="font-mono opacity-60">{item.departureTime}</span>
            <span className="truncate">{stripTimeFromCode(item.routeCode)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="font-semibold text-xs">{item.routeName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Jadwal virtual — {item.departureTime}</p>
          {item.capacity && <p className="text-xs text-muted-foreground">{item.capacity} kursi tersedia</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  const statusColors: Record<string, string> = {
    scheduled: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
    on_progress: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300',
    arrived: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300',
    closed: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400',
    canceled: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400',
  };
  const colorClass = statusColors[item.status || 'scheduled'] || statusColors.scheduled;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn("px-1.5 py-1 rounded text-[10px] leading-tight cursor-pointer border transition-shadow hover:shadow-sm", colorClass)}
          data-testid={`chip-trip-${item.id}`}
          onClick={() => onSelect?.(item)}
        >
          <div className="flex items-center gap-1">
            <span className="font-mono opacity-70">{item.departureTime}</span>
            <span className="truncate font-medium">{stripTimeFromCode(item.routeCode)}</span>
          </div>
          {item.seatsBooked !== undefined && item.capacity && (
            <div className="flex items-center gap-0.5 mt-0.5 opacity-80">
              <Users className="w-2.5 h-2.5" />
              <span>{item.seatsBooked}/{item.capacity}</span>
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[220px]">
        <p className="font-semibold text-xs">{item.routeName}</p>
        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <p>Berangkat: {item.departureTime}</p>
          {item.vehiclePlate && <p>Kendaraan: {item.vehiclePlate}</p>}
          {item.driverName && <p>Driver: {item.driverName}</p>}
          {item.seatsBooked !== undefined && item.capacity && <p>Penumpang: {item.seatsBooked}/{item.capacity}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Terjadwal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  on_progress: { label: 'Dalam Perjalanan', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  arrived: { label: 'Tiba', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  closed: { label: 'Ditutup', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  canceled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

type PatternStopInfo = {
  id: string;
  stopSequence: number;
  boardingAllowed: boolean;
  alightingAllowed: boolean;
  stop: { id: string; name: string; code: string } | null;
};

type StopExceptionData = {
  id: string;
  stopId: string;
  disableBoarding: boolean;
  disableAlighting: boolean;
  reason: string | null;
};

function RouteStopsTimeline({ patternId, baseId, serviceDate }: { patternId: string; baseId?: string; serviceDate?: string }) {
  const { toast } = useToast();
  const [toggleReasonStop, setToggleReasonStop] = useState<{ stopId: string; field: 'boarding' | 'alighting'; stopName: string } | null>(null);
  const [toggleReason, setToggleReason] = useState('');

  const { data: stops, isLoading } = useQuery<PatternStopInfo[]>({
    queryKey: ['/api/trip-patterns', patternId, 'stops'],
    queryFn: async () => {
      const res = await fetch(`/api/trip-patterns/${patternId}/stops`);
      if (!res.ok) throw new Error('Failed to load stops');
      return res.json();
    },
    enabled: !!patternId,
    staleTime: 60_000,
  });

  const canManageExceptions = !!(baseId && serviceDate);

  const { data: stopExceptions = [] } = useQuery<StopExceptionData[]>({
    queryKey: ['/api/scheduler/stop-exceptions', baseId, serviceDate],
    queryFn: async () => {
      const res = await fetch(`/api/scheduler/stop-exceptions?baseId=${baseId}&date=${serviceDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canManageExceptions,
    staleTime: 15_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (params: { stopId: string; disableBoarding: boolean; disableAlighting: boolean; reason: string }) => {
      const res = await apiRequest('POST', '/api/scheduler/stop-exceptions', {
        baseId,
        exceptionDate: serviceDate,
        stopId: params.stopId,
        disableBoarding: params.disableBoarding,
        disableAlighting: params.disableAlighting,
        reason: params.reason || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/stop-exceptions', baseId, serviceDate] });
      toast({ title: 'Stop exception diperbarui' });
      setToggleReasonStop(null);
      setToggleReason('');
    },
    onError: () => {
      toast({ title: 'Gagal update stop exception', variant: 'destructive' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (exceptionId: string) => {
      await apiRequest('DELETE', `/api/scheduler/stop-exceptions/${exceptionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/stop-exceptions', baseId, serviceDate] });
      toast({ title: 'Stop exception dihapus' });
    },
  });

  const getStopException = (stopId: string) => stopExceptions.find(e => e.stopId === stopId);

  const handleToggle = (stopId: string, field: 'boarding' | 'alighting', stopName: string) => {
    const existing = getStopException(stopId);
    if (existing) {
      const newBoarding = field === 'boarding' ? !existing.disableBoarding : existing.disableBoarding;
      const newAlighting = field === 'alighting' ? !existing.disableAlighting : existing.disableAlighting;
      if (!newBoarding && !newAlighting) {
        removeMutation.mutate(existing.id);
      } else {
        toggleMutation.mutate({ stopId, disableBoarding: newBoarding, disableAlighting: newAlighting, reason: existing.reason || '' });
      }
    } else {
      setToggleReasonStop({ stopId, field, stopName });
      setToggleReason('');
    }
  };

  const confirmToggle = () => {
    if (!toggleReasonStop) return;
    toggleMutation.mutate({
      stopId: toggleReasonStop.stopId,
      disableBoarding: toggleReasonStop.field === 'boarding',
      disableAlighting: toggleReasonStop.field === 'alighting',
      reason: toggleReason,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Memuat titik rute...</span>
      </div>
    );
  }

  if (!stops || stops.length === 0) return null;

  const sorted = [...stops].sort((a, b) => a.stopSequence - b.stopSequence);
  const pickupStops = sorted.filter(s => s.boardingAllowed);
  const dropoffStops = sorted.filter(s => s.alightingAllowed);

  const origin = sorted[0];
  const destination = sorted[sorted.length - 1];
  const viaStops = sorted.slice(1, -1);

  return (
    <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Titik Rute</span>
        {canManageExceptions && stopExceptions.length > 0 && (
          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 ml-auto">
            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
            {stopExceptions.length} stop ditutup
          </Badge>
        )}
      </div>

      <div className="relative ml-1.5">
        {sorted.map((stop, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1;
          const isPickup = stop.boardingAllowed;
          const isDropoff = stop.alightingAllowed;
          const stopEx = getStopException(stop.stop?.id || '');

          return (
            <div key={stop.id} className="flex items-start gap-3 relative" data-testid={`route-stop-${stop.stop?.code}`}>
              {idx < sorted.length - 1 && (
                <div className="absolute left-[5px] top-[14px] w-px h-[calc(100%)] bg-border" />
              )}
              <div className={cn(
                "w-[11px] h-[11px] rounded-full border-2 shrink-0 mt-0.5 z-10",
                stopEx ? "border-amber-500 bg-amber-100 dark:bg-amber-900" :
                isFirst ? "border-green-500 bg-green-100 dark:bg-green-900" :
                isLast ? "border-red-500 bg-red-100 dark:bg-red-900" :
                isPickup ? "border-blue-400 bg-blue-50 dark:bg-blue-950" :
                "border-orange-400 bg-orange-50 dark:bg-orange-950"
              )} />
              <div className={cn("pb-3 min-w-0 flex-1", isLast && "pb-0")}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{stop.stop?.name || '—'}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">({stop.stop?.code})</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {isPickup && !stopEx?.disableBoarding && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 font-medium">NAIK</span>
                  )}
                  {isDropoff && !stopEx?.disableAlighting && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 font-medium">TURUN</span>
                  )}
                  {stopEx?.disableBoarding && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 font-medium line-through">NAIK</span>
                  )}
                  {stopEx?.disableAlighting && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 font-medium line-through">TURUN</span>
                  )}
                </div>
                {stopEx && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">Ditutup Ops</span>
                    {stopEx.reason && <span className="text-[9px] text-muted-foreground">— {stopEx.reason}</span>}
                  </div>
                )}
                {canManageExceptions && stop.stop?.id && (
                  <div className="flex items-center gap-1 mt-1.5">
                    {isPickup && (
                      <button
                        onClick={() => handleToggle(stop.stop!.id, 'boarding', stop.stop!.name)}
                        disabled={toggleMutation.isPending || removeMutation.isPending}
                        data-testid={`toggle-boarding-${stop.stop.code}`}
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded border font-medium transition-colors",
                          stopEx?.disableBoarding
                            ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400"
                        )}
                      >
                        {stopEx?.disableBoarding ? 'Buka Naik' : 'Tutup Naik'}
                      </button>
                    )}
                    {isDropoff && (
                      <button
                        onClick={() => handleToggle(stop.stop!.id, 'alighting', stop.stop!.name)}
                        disabled={toggleMutation.isPending || removeMutation.isPending}
                        data-testid={`toggle-alighting-${stop.stop.code}`}
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded border font-medium transition-colors",
                          stopEx?.disableAlighting
                            ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400"
                        )}
                      >
                        {stopEx?.disableAlighting ? 'Buka Turun' : 'Tutup Turun'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toggleReasonStop && (
        <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 space-y-2">
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            Tutup {toggleReasonStop.field === 'boarding' ? 'Naik' : 'Turun'} di {toggleReasonStop.stopName}
          </p>
          <input
            type="text"
            value={toggleReason}
            onChange={(e) => setToggleReason(e.target.value)}
            placeholder="Alasan (opsional)"
            className="w-full text-xs px-2 py-1.5 rounded border bg-white dark:bg-gray-900 dark:border-gray-700"
            data-testid="input-stop-exception-reason"
          />
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setToggleReasonStop(null)}>Batal</Button>
            <Button
              size="sm"
              className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={confirmToggle}
              disabled={toggleMutation.isPending}
              data-testid="btn-confirm-stop-exception"
            >
              {toggleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Konfirmasi'}
            </Button>
          </div>
        </div>
      )}

      {viaStops.length > 0 && (
        <div className="text-[10px] text-muted-foreground border-t pt-2 mt-1">
          <span className="font-medium">Via: </span>
          {viaStops.map(s => s.stop?.name || s.stop?.code).join(' → ')}
        </div>
      )}
    </div>
  );
}

function ScheduleDetailDialog({ item, open, onClose, onMaterialize, onCloseTrip, onAddException, onRemoveException, isMaterializing, isClosingTrip, isAddingException, isRemovingException }: {
  item: CalendarItem | null;
  open: boolean;
  onClose: () => void;
  onMaterialize: (item: CalendarItem) => void;
  onCloseTrip: (item: CalendarItem) => void;
  onAddException: (item: CalendarItem, reason?: string) => void;
  onRemoveException: (item: CalendarItem) => void;
  isMaterializing: boolean;
  isClosingTrip: boolean;
  isAddingException: boolean;
  isRemovingException: boolean;
}) {
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  useEffect(() => {
    if (!open) {
      setShowReasonInput(false);
      setExceptionReason('');
    }
  }, [open]);

  if (!item) return null;

  if (item.type === 'exception') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Pengecualian Jadwal
            </DialogTitle>
            <DialogDescription>Jadwal ini tidak beroperasi pada tanggal ini</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
              <p className="text-xs text-red-600 dark:text-red-400">Jadwal ini dikecualikan dan tidak akan muncul sebagai virtual trip pada tanggal ini.</p>
              {item.exceptionReason && (
                <p className="text-xs text-muted-foreground mt-1.5">Alasan: {item.exceptionReason}</p>
              )}
            </div>

            <div className="space-y-3">
              <DetailRow icon={MapPin} label="Rute" value={item.routeName} />
              <DetailRow icon={Bus} label="Kode" value={stripTimeFromCode(item.routeCode)} mono />
              <DetailRow icon={Clock} label="Jam Berangkat" value={item.departureTime} />
              <DetailRow icon={CalendarRange} label="Tanggal" value={formatDateLabel(item.serviceDate)} />
            </div>

            {item.patternId && <RouteStopsTimeline patternId={item.patternId} baseId={item.baseId || undefined} serviceDate={item.serviceDate} />}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose} data-testid="btn-close-detail">Tutup</Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/30"
              data-testid="btn-remove-exception"
              onClick={() => onRemoveException(item)}
              disabled={isRemovingException}
            >
              {isRemovingException ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Aktifkan Kembali
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (item.type === 'virtual') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Jadwal Virtual
            </DialogTitle>
            <DialogDescription>Jadwal ini belum di-materialize menjadi trip</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
              <p className="text-xs text-muted-foreground">Jadwal virtual akan otomatis aktif saat ada booking pertama, atau bisa di-materialize manual.</p>
            </div>

            <div className="space-y-3">
              <DetailRow icon={MapPin} label="Rute" value={item.routeName} />
              <DetailRow icon={Bus} label="Kode" value={stripTimeFromCode(item.routeCode)} mono />
              <DetailRow icon={Clock} label="Jam Berangkat" value={item.departureTime} />
              {item.capacity && <DetailRow icon={Users} label="Kapasitas" value={`${item.capacity} kursi`} />}
            </div>

            {item.patternId && <RouteStopsTimeline patternId={item.patternId} baseId={item.baseId || undefined} serviceDate={item.serviceDate} />}
          </div>
          {showReasonInput && (
            <div className="space-y-2 border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50/50 dark:bg-red-950/30">
              <label className="text-xs font-semibold text-red-700 dark:text-red-400">Alasan Pengecualian</label>
              <textarea
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                placeholder="Contoh: Libur nasional, kendaraan maintenance, dsb."
                className="w-full h-20 px-3 py-2 text-sm border border-red-200 dark:border-red-700 rounded-lg bg-white dark:bg-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700"
                data-testid="input-exception-reason"
                autoFocus
              />
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { if (showReasonInput) { setShowReasonInput(false); setExceptionReason(''); } else { onClose(); } }} data-testid="btn-close-detail">
              {showReasonInput ? 'Batal' : 'Tutup'}
            </Button>
            {showReasonInput ? (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                data-testid="btn-confirm-exception"
                onClick={() => onAddException(item, exceptionReason.trim() || undefined)}
                disabled={isAddingException}
              >
                {isAddingException ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Konfirmasi Pengecualian
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  data-testid="btn-add-exception"
                  onClick={() => setShowReasonInput(true)}
                  disabled={isAddingException}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Tambah Pengecualian
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  data-testid="btn-materialize"
                  onClick={() => onMaterialize(item)}
                  disabled={isMaterializing}
                >
                  {isMaterializing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Aktifkan Trip
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const statusInfo = STATUS_LABELS[item.status || 'scheduled'] || STATUS_LABELS.scheduled;
  const occupancy = item.seatsBooked !== undefined && item.capacity
    ? Math.round((item.seatsBooked / item.capacity) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-primary" />
            Detail Trip
          </DialogTitle>
          <DialogDescription>
            {item.serviceDate ? formatDateLabel(item.serviceDate) : 'Informasi trip'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono font-semibold">{item.routeCode}</span>
            <Badge className={cn("text-xs", statusInfo.color)}>{statusInfo.label}</Badge>
          </div>

          <div className="space-y-3">
            <DetailRow icon={MapPin} label="Rute" value={item.routeName} />
            <DetailRow icon={Clock} label="Jam Berangkat" value={item.departureTime} />
            <DetailRow icon={User} label="Driver" value={item.driverName || '—'} />
            <DetailRow icon={Truck} label="Kendaraan" value={item.vehiclePlate || '—'} mono />
          </div>

          {item.patternId && <RouteStopsTimeline patternId={item.patternId} baseId={item.baseId || undefined} serviceDate={item.serviceDate} />}

          {item.seatsBooked !== undefined && item.capacity && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Okupansi
                </span>
                <span className="text-sm font-semibold">{item.seatsBooked}/{item.capacity} kursi</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    occupancy >= 80 ? "bg-green-500" : occupancy >= 50 ? "bg-blue-500" : occupancy > 0 ? "bg-amber-500" : "bg-gray-300"
                  )}
                  style={{ width: `${occupancy}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{item.capacity - item.seatsBooked} kursi tersisa</span>
                <span>{occupancy}% terisi</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} data-testid="btn-close-detail">Tutup</Button>
          {item.status === 'scheduled' && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              data-testid="btn-close-trip"
              onClick={() => onCloseTrip(item)}
              disabled={isClosingTrip}
            >
              {isClosingTrip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Tutup Trip
            </Button>
          )}
          {item.tripId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              data-testid="btn-view-manifest"
              onClick={() => window.open(`/manifest?tripId=${item.tripId}`, '_blank')}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Lihat Manifest
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn("text-sm font-medium truncate", mono && "font-mono")}>{value}</p>
      </div>
    </div>
  );
}

type EmptyCellInfo = { dateStr: string; hour: number; dateLabel: string };

function EmptyCellDialog({ cell, open, onClose }: { cell: EmptyCellInfo | null; open: boolean; onClose: () => void }) {
  if (!cell) return null;
  const hourStr = String(cell.hour).padStart(2, '0') + ':00';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Tambah Jadwal
          </DialogTitle>
          <DialogDescription>{cell.dateLabel} — {hourStr}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            data-testid="btn-add-trip"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Bus className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Buat Trip Baru</p>
              <p className="text-xs text-muted-foreground">Buat trip aktif dengan assign driver & kendaraan</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            data-testid="btn-add-extra-trip"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Plus className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Trip Tambahan</p>
              <p className="text-xs text-muted-foreground">Tambah trip di luar jadwal reguler</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            data-testid="btn-add-exception-empty"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400">
              <Ban className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Tambah Pengecualian</p>
              <p className="text-xs text-muted-foreground">Tandai jadwal tidak beroperasi pada tanggal ini</p>
            </div>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} data-testid="btn-close-empty-cell">Batal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SchedulerPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [emptyCell, setEmptyCell] = useState<EmptyCellInfo | null>(null);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const dates = useMemo(() => getMonthDates(year, month), [year, month]);
  const gridWidth = TIME_COL_W + dates.length * CELL_W;
  const fromDate = dates[0];
  const toDate = dates[dates.length - 1];

  const { data: outlets = [] } = useQuery<{ id: string; name: string; stopId: string }[]>({
    queryKey: ['/api/outlets'],
    queryFn: () => outletsApi.getAll(),
    staleTime: 60_000,
  });

  const { data: patternStopMap = {} } = useQuery<Record<string, string[]>>({
    queryKey: ['/api/scheduler/pattern-stop-map'],
    queryFn: async () => {
      const res = await fetch('/api/scheduler/pattern-stop-map');
      if (!res.ok) throw new Error('Failed to load pattern stops');
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: calendarItems = [], isLoading } = useQuery<CalendarItem[]>({
    queryKey: ['/api/scheduler/calendar', fromDate, toDate],
    queryFn: async () => {
      const res = await fetch(`/api/scheduler/calendar?from=${fromDate}&to=${toDate}`);
      if (!res.ok) throw new Error('Failed to load schedule');
      return res.json();
    },
    staleTime: 30_000,
  });

  const filteredItems = useMemo(() => {
    if (selectedOutletId === 'all') return calendarItems;
    const outlet = outlets.find(o => o.id === selectedOutletId);
    if (!outlet) return calendarItems;
    return calendarItems.filter(item => {
      if (!item.patternId) return false;
      const stopIds = patternStopMap[item.patternId];
      return stopIds?.includes(outlet.stopId);
    });
  }, [calendarItems, selectedOutletId, outlets, patternStopMap]);

  const itemsByDateHour = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of filteredItems) {
      const key = `${item.serviceDate}-${item.hour}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filteredItems]);

  const getItemsForCell = useCallback((dateStr: string, hour: number): CalendarItem[] => {
    return itemsByDateHour.get(`${dateStr}-${hour}`) || [];
  }, [itemsByDateHour]);

  const materializeMutation = useMutation({
    mutationFn: async (item: CalendarItem) => {
      const res = await apiRequest('POST', '/api/cso/materialize-trip', {
        baseId: item.baseId,
        serviceDate: item.serviceDate,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Trip diaktifkan', description: 'Jadwal virtual berhasil di-materialize menjadi trip aktif.' });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/calendar'] });
      setSelectedItem(null);
    },
    onError: (err: any) => {
      toast({ title: 'Gagal mengaktifkan trip', description: err.message, variant: 'destructive' });
    },
  });

  const closeTripMutation = useMutation({
    mutationFn: async (item: CalendarItem) => {
      const res = await apiRequest('POST', `/api/trips/${item.tripId}/close`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Trip ditutup', description: 'Trip berhasil ditutup.' });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/calendar'] });
      setSelectedItem(null);
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menutup trip', description: err.message, variant: 'destructive' });
    },
  });

  const addExceptionMutation = useMutation({
    mutationFn: async ({ item, reason }: { item: CalendarItem; reason?: string }) => {
      const res = await apiRequest('POST', '/api/scheduler/exceptions', {
        baseId: item.baseId,
        exceptionDate: item.serviceDate,
        reason,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Pengecualian ditambahkan', description: 'Jadwal dikecualikan pada tanggal ini.' });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/calendar'] });
      setSelectedItem(null);
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menambah pengecualian', description: err.message, variant: 'destructive' });
    },
  });

  const removeExceptionMutation = useMutation({
    mutationFn: async (item: CalendarItem) => {
      const res = await apiRequest('DELETE', `/api/scheduler/exceptions/${item.exceptionId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Pengecualian dihapus', description: 'Jadwal diaktifkan kembali.' });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/calendar'] });
      setSelectedItem(null);
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menghapus pengecualian', description: err.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      const todayIdx = dates.indexOf(todayStr());
      if (todayIdx >= 0) {
        scrollRef.current.scrollLeft = Math.max(0, todayIdx * CELL_W - 200);
      }
      const hour6Top = 6 * CELL_H;
      scrollRef.current.scrollTop = hour6Top;
    }
  }, [dates]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const goToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="scheduler-page">
      <div className="border-b px-4 md:px-6 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Penjadwalan</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
              <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="select-outlet-filter">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Semua Outlet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Outlet</SelectItem>
                {outlets.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button variant="ghost" size="sm" className="rounded-none h-8 px-2" onClick={prevMonth} data-testid="btn-prev-month">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-none h-8 px-3 text-xs font-medium min-w-[140px]" onClick={goToday} data-testid="btn-today">
                {formatMonthTitle(year, month)}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-none h-8 px-2" onClick={nextMonth} data-testid="btn-next-month">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-3 h-3 rounded border border-blue-300 bg-blue-50 dark:bg-blue-950/50" />
            <span>Trip Aktif</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-3 h-3 rounded border border-dashed border-muted-foreground/40 bg-muted/30" />
            <span>Virtual</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-3 h-3 rounded border border-red-300 bg-red-50 dark:bg-red-950/50" />
            <span>Pengecualian</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-3 h-3 rounded border border-green-300 bg-green-50 dark:bg-green-950/50" />
            <span>Dalam Perjalanan</span>
          </div>
          {isLoading && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground ml-auto">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Memuat...</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto relative" ref={scrollRef}>
        <div style={{ width: gridWidth }} className="relative pb-40">

          <div
            className="sticky top-0 z-30 flex bg-white dark:bg-gray-950 border-b"
            style={{ width: gridWidth }}
          >
            <div
              className="sticky left-0 z-40 bg-white dark:bg-gray-950 border-r border-b flex items-center justify-center"
              style={{ width: TIME_COL_W, minWidth: TIME_COL_W, height: 48 }}
            >
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {dates.map(dateStr => {
              const info = formatShortDate(dateStr);
              return (
                <div
                  key={dateStr}
                  className={cn(
                    "border-r border-b flex flex-col items-center justify-center shrink-0",
                    info.isToday && "bg-blue-50 dark:bg-blue-950/30",
                    !info.isToday && "bg-white dark:bg-gray-950"
                  )}
                  style={{ width: CELL_W, minWidth: CELL_W, height: 48 }}
                  data-testid={`header-${dateStr}`}
                >
                  <div className={cn(
                    "text-[10px] font-medium uppercase",
                    info.isToday ? "text-primary" : info.isSunday ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {info.day}
                  </div>
                  <div className={cn(
                    "text-sm font-semibold leading-tight",
                    info.isToday && "text-primary",
                    info.isSunday && !info.isToday && "text-red-500"
                  )}>
                    {info.date}
                  </div>
                </div>
              );
            })}
          </div>

          {HOURS.map(hour => (
            <div
              key={hour}
              className="flex"
              style={{ minHeight: CELL_H }}
              data-hour={hour}
            >
              <div
                className="sticky left-0 z-20 bg-white dark:bg-gray-950 border-r border-b border-border/40 flex items-start justify-end pr-2 pt-1 shrink-0"
                style={{ width: TIME_COL_W, minWidth: TIME_COL_W }}
              >
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              {dates.map(dateStr => {
                const info = formatShortDate(dateStr);
                const items = getItemsForCell(dateStr, hour);
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "border-b border-r border-border/40 shrink-0 group cursor-pointer transition-colors",
                      info.isToday ? "bg-blue-50/30 dark:bg-blue-950/10" : "bg-background",
                      "hover:bg-muted/50"
                    )}
                    style={{ width: CELL_W, minWidth: CELL_W }}
                    data-testid={`cell-${dateStr}-${hour}`}
                    onClick={() => {
                      if (items.length === 0) {
                        setEmptyCell({ dateStr, hour, dateLabel: formatDateLabel(dateStr) });
                      }
                    }}
                  >
                    {items.length > 0 ? (
                      <div className="p-0.5 space-y-0.5">
                        {items.map(item => (
                          <ScheduleChip key={item.id} item={item} onSelect={setSelectedItem} />
                        ))}
                      </div>
                    ) : (
                      <div className="h-full min-h-[56px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <ScheduleDetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onMaterialize={(item) => materializeMutation.mutate(item)}
        onCloseTrip={(item) => closeTripMutation.mutate(item)}
        onAddException={(item, reason) => addExceptionMutation.mutate({ item, reason })}
        onRemoveException={(item) => removeExceptionMutation.mutate(item)}
        isMaterializing={materializeMutation.isPending}
        isClosingTrip={closeTripMutation.isPending}
        isAddingException={addExceptionMutation.isPending}
        isRemovingException={removeExceptionMutation.isPending}
      />

      <EmptyCellDialog
        cell={emptyCell}
        open={!!emptyCell}
        onClose={() => setEmptyCell(null)}
      />
    </div>
  );
}
