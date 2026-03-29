import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tripsApi, tripPatternsApi } from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ManifestDialog from '@/components/manifest/ManifestDialog';
import { FileText, ChevronLeft, ChevronRight, Bus, Clock, Search, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import type { TripWithDetails, TripPattern } from '@/types';
import { TripStatusBadge } from '@/components/shared/StatusBadges';

function formatDisplayDate(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ManifestPage() {
  usePageTitle("Manifest", "Dokumen penumpang & kargo per trip");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [search, setSearch] = useState('');
  const [manifestTripId, setManifestTripId] = useState<string | null>(null);

  const { data: trips = [], isLoading } = useQuery<TripWithDetails[]>({
    queryKey: ['/api/trips', selectedDate],
    queryFn: () => tripsApi.getAll(selectedDate),
  });

  const { data: patterns = [] } = useQuery<TripPattern[]>({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll,
  });

  const getPatternName = (patternId: string) => {
    return patterns.find(p => p.id === patternId)?.name ?? patternId.slice(-8);
  };

  const filtered = trips.filter(t => {
    const name = getPatternName(t.patternId).toLowerCase();
    return name.includes(search.toLowerCase()) || t.id.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader icon={FileText} title="Manifest Perjalanan" subtitle="Dokumen penumpang & kargo per trip" />

      {/* ── Controls ── */}
      <div className="px-6 py-4 border-b bg-muted/20 shrink-0">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Date navigator */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSelectedDate(d => addDays(d, -1))}
              data-testid="btn-prev-date"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col items-center min-w-[180px]">
              <span className="text-sm font-semibold">{formatDisplayDate(selectedDate)}</span>
              <span className="text-xs text-muted-foreground font-mono">{selectedDate}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSelectedDate(d => addDays(d, 1))}
              data-testid="btn-next-date"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2 h-8 text-xs"
              onClick={() => setSelectedDate(todayStr())}
              data-testid="btn-today"
            >
              Hari Ini
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-8 w-36 text-xs"
              data-testid="input-date-picker"
            />
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari rute..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
              data-testid="input-search-manifest"
            />
          </div>
        </div>
      </div>

      {/* ── Trip List ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
            <span className="ml-3 text-sm text-muted-foreground">Memuat trip...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="Tidak ada trip pada tanggal ini" description="Coba pilih tanggal lain" />
        ) : (
          <div className="space-y-2" data-testid="manifest-trip-list">
            {filtered.map(trip => (
              <Card
                key={trip.id}
                className="border hover:border-primary/40 hover:shadow-sm transition-all"
                data-testid={`manifest-card-${trip.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  {/* Left: trip info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bus className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{getPatternName(trip.patternId)}</span>
                        <TripStatusBadge status={trip.status ?? 'scheduled'} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {(trip as any).originDepartHHMM && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Berangkat {(trip as any).originDepartHHMM}
                          </span>
                        )}
                        <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">#{trip.id.slice(-8)}</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {trip.capacity} kursi
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: action */}
                  <Button
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => setManifestTripId(trip.id)}
                    data-testid={`btn-open-manifest-${trip.id}`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Buka Manifest
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Manifest Dialog ── */}
      <ManifestDialog
        tripId={manifestTripId}
        open={!!manifestTripId}
        onOpenChange={(open) => { if (!open) setManifestTripId(null); }}
      />
    </div>
  );
}
