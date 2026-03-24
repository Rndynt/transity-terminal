import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CalendarRange, ChevronLeft, ChevronRight, Plus, Bus, X,
  ArrowRight, Clock, Users, AlertCircle, Ban, Calendar as CalIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  return {
    day: days[d.getDay()],
    date: d.getDate(),
    month: d.toLocaleDateString('id-ID', { month: 'short' }),
    isToday: dateStr === todayStr(),
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

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const VISIBLE_DAYS = 7;

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

function ScheduleCell({ items, dateStr, hour, isToday }: { items: ScheduleItem[]; dateStr: string; hour: number; isToday: boolean }) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "h-full min-h-[56px] border-b border-r border-border/40 group cursor-pointer transition-colors",
          isToday ? "bg-blue-50/30 dark:bg-blue-950/10" : "bg-background",
          "hover:bg-muted/50"
        )}
        data-testid={`cell-${dateStr}-${hour}`}
      >
        <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-[56px] border-b border-r border-border/40 p-0.5 space-y-0.5",
        isToday ? "bg-blue-50/30 dark:bg-blue-950/10" : "bg-background"
      )}
      data-testid={`cell-${dateStr}-${hour}`}
    >
      {items.map(item => (
        <ScheduleChip key={item.id} item={item} />
      ))}
    </div>
  );
}

function ScheduleChip({ item }: { item: ScheduleItem }) {
  if (item.type === 'exception') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="px-1.5 py-1 rounded text-[10px] leading-tight cursor-pointer border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 flex items-center gap-1"
            data-testid={`chip-exception-${item.id}`}
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

export default function SchedulerPage() {
  const [startDate, setStartDate] = useState(todayStr());
  const gridRef = useRef<HTMLDivElement>(null);

  const dates = useMemo(() => {
    return Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  useEffect(() => {
    if (gridRef.current) {
      const hourRow = gridRef.current.querySelector('[data-hour="6"]');
      if (hourRow) {
        hourRow.scrollIntoView({ block: 'start' });
      }
    }
  }, [startDate]);

  const getItemsForCell = (dateStr: string, hour: number): ScheduleItem[] => {
    const isStartDate = dateStr === dates[0];
    if (!isStartDate) return [];
    return MOCK_DATA.filter(item => item.hour === hour);
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="scheduler-page">
      <div className="border-b px-4 md:px-6 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Penjadwalan</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button variant="ghost" size="sm" className="rounded-none h-8 px-2" onClick={() => setStartDate(addDays(startDate, -VISIBLE_DAYS))} data-testid="btn-prev-week">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-none h-8 px-3 text-xs font-medium" onClick={() => setStartDate(todayStr())} data-testid="btn-today">
                Hari Ini
              </Button>
              <Button variant="ghost" size="sm" className="rounded-none h-8 px-2" onClick={() => setStartDate(addDays(startDate, VISIBLE_DAYS))} data-testid="btn-next-week">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-8 px-2 text-xs border rounded-lg bg-background"
              data-testid="input-start-date"
            />
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

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex border-b sticky top-0 z-10 bg-background">
          <div className="w-14 md:w-16 shrink-0 border-r bg-muted/30" />
          {dates.map(dateStr => {
            const info = formatShortDate(dateStr);
            return (
              <div
                key={dateStr}
                className={cn(
                  "flex-1 min-w-[100px] md:min-w-[130px] text-center py-2 border-r border-border/40",
                  info.isToday && "bg-primary/5",
                  info.isSunday && "text-red-500"
                )}
                data-testid={`date-header-${dateStr}`}
              >
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{info.day}</div>
                <div className={cn("text-sm font-semibold", info.isToday && "text-primary")}>
                  {info.date}
                </div>
                <div className="text-[10px] text-muted-foreground">{info.month}</div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto" ref={gridRef}>
          {HOURS.map(hour => (
            <div key={hour} className="flex" data-hour={hour}>
              <div className="w-14 md:w-16 shrink-0 border-r bg-muted/20 flex items-start justify-end pr-2 pt-1">
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              {dates.map(dateStr => {
                const info = formatShortDate(dateStr);
                const items = getItemsForCell(dateStr, hour);
                return (
                  <div key={dateStr} className="flex-1 min-w-[100px] md:min-w-[130px]">
                    <ScheduleCell
                      items={items}
                      dateStr={dateStr}
                      hour={hour}
                      isToday={info.isToday}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
