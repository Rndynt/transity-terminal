import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  CalendarRange, ChevronLeft, ChevronRight, Plus, Bus, Truck,
  Clock, Users, Ban, MapPin, User, AlertTriangle, ArrowRight,
  CheckCircle, X, Pencil, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_COL_W = 56;
const CELL_W = 120;
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

type ScheduleItem = {
  id: string;
  type: 'virtual' | 'trip' | 'exception';
  routeName: string;
  routeCode: string;
  departureTime: string;
  hour: number;
  vehiclePlate?: string;
  driverName?: string;
  status?: string;
  seatsBooked?: number;
  seatsTotal?: number;
  exceptionReason?: string;
};

const MOCK_DATA: ScheduleItem[] = [
  { id: '1', type: 'trip', routeName: 'Jakarta → Semarang', routeCode: 'JKT-SMG-01', departureTime: '06:00', hour: 6, vehiclePlate: 'B 1401 TGJ', driverName: 'Rahmat', status: 'scheduled', seatsBooked: 3, seatsTotal: 11 },
  { id: '2', type: 'virtual', routeName: 'Jakarta → Semarang', routeCode: 'JKT-SMG-02', departureTime: '09:00', hour: 9, seatsTotal: 11 },
  { id: '3', type: 'trip', routeName: 'Semarang → Jakarta', routeCode: 'SMG-JKT-01', departureTime: '07:00', hour: 7, vehiclePlate: 'B 1523 KJH', driverName: 'Agus', status: 'on_progress', seatsBooked: 8, seatsTotal: 11 },
  { id: '4', type: 'virtual', routeName: 'Semarang → Yogyakarta', routeCode: 'SMG-YGY-01', departureTime: '10:00', hour: 10, seatsTotal: 8 },
  { id: '5', type: 'exception', routeName: 'Jakarta → Semarang', routeCode: 'JKT-SMG-03', departureTime: '14:00', hour: 14, exceptionReason: 'Kendaraan rusak' },
  { id: '6', type: 'trip', routeName: 'Semarang → Jakarta', routeCode: 'SMG-JKT-02', departureTime: '15:00', hour: 15, vehiclePlate: 'B 7812 PQR', driverName: 'Budi', status: 'scheduled', seatsBooked: 0, seatsTotal: 11 },
  { id: '7', type: 'virtual', routeName: 'Jakarta → Semarang', routeCode: 'JKT-SMG-04', departureTime: '19:00', hour: 19, seatsTotal: 11 },
  { id: '8', type: 'trip', routeName: 'Semarang → Yogyakarta', routeCode: 'SMG-YGY-02', departureTime: '20:00', hour: 20, vehiclePlate: 'AB 1234 CD', driverName: 'Dani', status: 'scheduled', seatsBooked: 5, seatsTotal: 8 },
];

function ScheduleChip({ item, onSelect }: { item: ScheduleItem; onSelect?: (item: ScheduleItem) => void }) {
  if (item.type === 'exception') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="px-1.5 py-1 rounded text-[10px] leading-tight cursor-pointer border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 flex items-center gap-1"
            data-testid={`chip-exception-${item.id}`}
            onClick={() => onSelect?.(item)}
          >
            <Ban className="w-3 h-3 shrink-0" />
            <span className="truncate font-medium">{item.routeCode}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="font-semibold text-xs">{item.routeName}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Dibatalkan: {item.exceptionReason}</p>
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
            <Clock className="w-3 h-3 shrink-0 opacity-60" />
            <span className="truncate">{item.routeCode}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="font-semibold text-xs">{item.routeName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Jadwal virtual — {item.departureTime}</p>
          <p className="text-xs text-muted-foreground">{item.seatsTotal} kursi tersedia</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const statusColors: Record<string, string> = {
    scheduled: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
    on_progress: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300',
    arrived: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300',
    closed: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400',
    cancelled: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400',
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
            <Bus className="w-3 h-3 shrink-0" />
            <span className="truncate font-medium">{item.routeCode}</span>
          </div>
          {item.seatsBooked !== undefined && (
            <div className="flex items-center gap-0.5 mt-0.5 opacity-80">
              <Users className="w-2.5 h-2.5" />
              <span>{item.seatsBooked}/{item.seatsTotal}</span>
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
          {item.seatsBooked !== undefined && <p>Penumpang: {item.seatsBooked}/{item.seatsTotal}</p>}
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
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

function ScheduleDetailDialog({ item, open, onClose }: { item: ScheduleItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null;

  if (item.type === 'exception') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Jadwal Dibatalkan
            </DialogTitle>
            <DialogDescription>Detail pembatalan jadwal</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Alasan Pembatalan</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">{item.exceptionReason || '—'}</p>
            </div>

            <div className="space-y-3">
              <DetailRow icon={MapPin} label="Rute" value={item.routeName} />
              <DetailRow icon={Bus} label="Kode" value={item.routeCode} mono />
              <DetailRow icon={Clock} label="Jam Berangkat" value={item.departureTime} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} data-testid="btn-close-detail">Tutup</Button>
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
              <DetailRow icon={Bus} label="Kode" value={item.routeCode} mono />
              <DetailRow icon={Clock} label="Jam Berangkat" value={item.departureTime} />
              <DetailRow icon={Users} label="Kapasitas" value={`${item.seatsTotal} kursi`} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose} data-testid="btn-close-detail">Tutup</Button>
            <Button variant="destructive" size="sm" className="gap-1.5" data-testid="btn-cancel-schedule">
              <Ban className="w-3.5 h-3.5" /> Batalkan Jadwal
            </Button>
            <Button size="sm" className="gap-1.5" data-testid="btn-materialize">
              <CheckCircle className="w-3.5 h-3.5" /> Aktifkan Trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const statusInfo = STATUS_LABELS[item.status || 'scheduled'] || STATUS_LABELS.scheduled;
  const occupancy = item.seatsBooked !== undefined && item.seatsTotal
    ? Math.round((item.seatsBooked / item.seatsTotal) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-primary" />
            Detail Trip
          </DialogTitle>
          <DialogDescription>Informasi trip yang sudah aktif</DialogDescription>
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

          {item.seatsBooked !== undefined && item.seatsTotal && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Okupansi
                </span>
                <span className="text-sm font-semibold">{item.seatsBooked}/{item.seatsTotal} kursi</span>
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
                <span>{item.seatsTotal - item.seatsBooked} kursi tersisa</span>
                <span>{occupancy}% terisi</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} data-testid="btn-close-detail">Tutup</Button>
          {item.status === 'scheduled' && (
            <Button variant="destructive" size="sm" className="gap-1.5" data-testid="btn-close-trip">
              <X className="w-3.5 h-3.5" /> Tutup Trip
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" data-testid="btn-view-manifest">
            <ExternalLink className="w-3.5 h-3.5" /> Lihat Manifest
          </Button>
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

export default function SchedulerPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dates = useMemo(() => getMonthDates(year, month), [year, month]);
  const gridWidth = TIME_COL_W + dates.length * CELL_W;

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

  const getItemsForCell = (dateStr: string, hour: number): ScheduleItem[] => {
    if (dateStr !== todayStr()) return [];
    return MOCK_DATA.filter(item => item.hour === hour);
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
            <span>Dibatalkan</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-3 h-3 rounded border border-green-300 bg-green-50 dark:bg-green-950/50" />
            <span>Dalam Perjalanan</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative" ref={scrollRef}>
        <div style={{ width: gridWidth, minHeight: HOURS.length * CELL_H + 48 + 120 }} className="relative">

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
                    "text-center py-1.5 border-r border-border/40 shrink-0",
                    info.isToday && "bg-primary/5"
                  )}
                  style={{ width: CELL_W, minWidth: CELL_W, height: 48 }}
                  data-testid={`date-header-${dateStr}`}
                >
                  <div className={cn(
                    "text-[10px] uppercase tracking-wider",
                    info.isSunday ? "text-red-500" : "text-muted-foreground"
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
              style={{ height: CELL_H }}
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
                  >
                    {items.length > 0 ? (
                      <div className="p-0.5 space-y-0.5">
                        {items.map(item => (
                          <ScheduleChip key={item.id} item={item} onSelect={setSelectedItem} />
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
      />
    </div>
  );
}
