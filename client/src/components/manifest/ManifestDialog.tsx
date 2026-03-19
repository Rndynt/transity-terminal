import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { manifestApi } from '@/lib/api';
import { Printer, X, Bus, User, Clock, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface ManifestDialogProps {
  tripId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(amount: number | string | null) {
  const num = parseFloat(String(amount || '0'));
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(isoStr: string | null) {
  if (!isoStr) return null;
  try {
    return new Date(isoStr).toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  } catch {
    return isoStr;
  }
}

function formatDateShort(dateStr: string) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function TicketStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active:     { label: 'Aktif',    color: 'bg-green-100 text-green-800' },
    checked_in: { label: 'Check-In', color: 'bg-blue-100 text-blue-800' },
    no_show:    { label: 'No-Show',  color: 'bg-red-100 text-red-800' },
    canceled:   { label: 'Batal',    color: 'bg-gray-100 text-gray-600' },
    refunded:   { label: 'Refund',   color: 'bg-orange-100 text-orange-800' },
  };
  const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${s.color}`}>{s.label}</span>;
}

// ── Thermal layout (visible only when printing) ──────────────────────────────
function ThermalManifest({ manifest }: { manifest: any }) {
  const h = manifest.header;
  const line = '--------------------------------';
  const doubleLine = '================================';

  return (
    <div id="thermal-manifest" className="hidden print:block font-mono text-[8pt] leading-tight whitespace-pre-wrap">
      <div className="text-center font-bold text-[10pt]">MANIFEST PERJALANAN</div>
      <div className="text-center">{doubleLine}</div>
      <div>No : {h.manifestNumber}</div>
      <div>Tgl: {formatDateShort(h.serviceDate)}{h.departureTime ? ` | Jam: ${h.departureTime}` : ''}</div>
      <div>{line}</div>
      <div>Rute  : {h.originStop} → {h.destinationStop}</div>
      <div>Pola  : {h.routeName}</div>
      <div>Plat  : {h.vehiclePlate} ({h.vehicleType})</div>
      <div>Driver: {h.driverName || '-'}</div>
      {h.driverLicense && <div>SIM   : {h.driverLicense}</div>}
      <div>{line}</div>

      {/* Section A — Penumpang */}
      <div className="font-bold">A. DAFTAR PENUMPANG ({manifest.summary.totalPassengers} orang)</div>
      <div>{line}</div>
      {manifest.passengers.length === 0 ? (
        <div>  (Tidak ada penumpang)</div>
      ) : (
        manifest.passengers.map((p: any, i: number) => (
          <div key={p.ticketNumber || i}>
            <div>{String(i + 1).padStart(2, ' ')}. {p.passengerName}</div>
            <div>    Kursi: {p.seatNo || '-'} | {p.originStopName || '-'} → {p.destinationStopName || '-'}</div>
            {p.ticketNumber && <div>    Tiket: {p.ticketNumber}</div>}
            {p.phone && <div>    HP   : {p.phone}</div>}
          </div>
        ))
      )}
      <div>{line}</div>

      {/* Section B — Kargo */}
      {manifest.cargo.length > 0 && (
        <>
          <div className="font-bold">B. DAFTAR KARGO ({manifest.summary.totalCargoItems} kiriman)</div>
          <div>{line}</div>
          {manifest.cargo.map((c: any, i: number) => (
            <div key={c.waybillNumber || i}>
              <div>{String(i + 1).padStart(2, ' ')}. {c.waybillNumber}</div>
              <div>    {c.senderName} → {c.recipientName}</div>
              <div>    {c.itemDescription}{c.quantity > 1 ? ` (${c.quantity}x)` : ''} | {c.weightKg ? parseFloat(c.weightKg).toFixed(1) + ' kg' : '-'}</div>
            </div>
          ))}
          <div>{line}</div>
        </>
      )}

      {/* Summary */}
      <div>Penumpang : {manifest.summary.totalPassengers} orang</div>
      {manifest.summary.totalCargoItems > 0 && (
        <div>Kargo     : {manifest.summary.totalCargoItems} kiriman ({manifest.summary.totalCargoWeight} kg)</div>
      )}
      <div>Pend. Tiket: {formatCurrency(manifest.summary.totalTicketRevenue)}</div>
      {manifest.summary.totalCargoRevenue > 0 && (
        <div>Pend. Kargo: {formatCurrency(manifest.summary.totalCargoRevenue)}</div>
      )}
      <div>TOTAL      : {formatCurrency(manifest.summary.totalRevenue)}</div>
      <div>{line}</div>

      {/* Print info */}
      <div className="text-center">Dicetak: {formatDateTime(new Date().toISOString())}</div>
      {h.firstPrintedAt && (
        <div className="text-center">Pertama: {formatDateTime(h.firstPrintedAt)}</div>
      )}
      <div className="text-center">{doubleLine}</div>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────
export default function ManifestDialog({ tripId, open, onOpenChange }: ManifestDialogProps) {
  const queryClient = useQueryClient();

  const { data: manifest, isLoading, error } = useQuery({
    queryKey: ['/api/trips', tripId, 'manifest'],
    queryFn: () => manifestApi.get(tripId!),
    enabled: open && !!tripId,
  });

  const printMutation = useMutation({
    mutationFn: () => manifestApi.recordPrint(tripId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips', tripId, 'manifest'] });
    },
  });

  const handlePrint = async () => {
    if (!tripId) return;
    try {
      await printMutation.mutateAsync();
    } finally {
      window.print();
    }
  };

  const firstPrintedAt = manifest?.header?.firstPrintedAt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0"
        data-testid="manifest-dialog"
      >
        {/* Non-printable dialog header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 print:hidden flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Bus className="w-4 h-4 text-primary" />
            Manifest Perjalanan
            {manifest && (
              <span className="text-xs font-mono text-muted-foreground font-normal ml-1">
                #{manifest.header.manifestNumber}
              </span>
            )}
          </DialogTitle>
          <div className="flex items-center gap-3">
            {manifest && (
              <div className="flex items-center gap-1.5 text-xs">
                {firstPrintedAt ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Cetak pertama: <span className="font-medium text-foreground">{formatDateTime(firstPrintedAt)}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    Belum pernah dicetak
                  </span>
                )}
              </div>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={handlePrint}
              disabled={isLoading || !!error || printMutation.isPending}
              className="gap-1.5"
              data-testid="button-print-manifest"
            >
              {printMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              Cetak Manifest
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable content — screen view */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 print:hidden">
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Memuat manifest...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-24 text-destructive">
              <span className="text-sm">Gagal memuat manifest. Coba lagi.</span>
            </div>
          )}

          {manifest && (
            <div className="space-y-6">

              {/* ─── HEADER SECTION ─── */}
              <div className="bg-muted/40 border border-border rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2.5">
                    <div className="flex gap-2">
                      <span className="w-32 text-muted-foreground shrink-0">Nomor Manifest</span>
                      <span className="font-mono font-semibold">{manifest.header.manifestNumber}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-32 text-muted-foreground shrink-0">Tanggal</span>
                      <span className="font-medium">{formatDate(manifest.header.serviceDate)}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-32 text-muted-foreground shrink-0">Keberangkatan</span>
                      <span className="font-medium">{manifest.header.departureTime || '—'}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="w-32 text-muted-foreground shrink-0">Rute</span>
                      <span className="font-semibold flex items-center gap-1">
                        {manifest.header.originStop}
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        {manifest.header.destinationStop}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-32 text-muted-foreground shrink-0">Pola Rute</span>
                      <span>{manifest.header.routeName}</span>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex gap-2 items-center">
                      <Bus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="w-28 text-muted-foreground shrink-0">Kendaraan</span>
                      <span className="font-semibold">{manifest.header.vehiclePlate}</span>
                      <span className="text-muted-foreground text-xs">({manifest.header.vehicleType})</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="w-28 text-muted-foreground shrink-0">Driver</span>
                      <span className="font-medium">
                        {manifest.header.driverName || <span className="text-muted-foreground italic">Belum ditugaskan</span>}
                      </span>
                    </div>
                    {manifest.header.driverLicense && (
                      <div className="flex gap-2">
                        <span className="w-[calc(0.875rem+0.5rem+7rem)] shrink-0" />
                        <span className="text-xs text-muted-foreground">No. SIM: {manifest.header.driverLicense}</span>
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="w-28 text-muted-foreground shrink-0">Cetak Pertama</span>
                      {firstPrintedAt ? (
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          {formatDateTime(firstPrintedAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Belum dicetak
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── SECTION A: PENUMPANG ─── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">A</div>
                  <h3 className="font-semibold text-sm">Daftar Penumpang</h3>
                  <Badge variant="secondary" className="text-xs">{manifest.summary.totalPassengers} penumpang</Badge>
                </div>

                {manifest.passengers.length === 0 ? (
                  <div className="border border-dashed rounded-lg py-8 text-center text-sm text-muted-foreground">
                    Tidak ada penumpang terdaftar untuk trip ini.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs" data-testid="table-manifest-passengers">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-7">No</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nama Penumpang</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">No. Tiket</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-14">Kursi</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Naik Di</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Turun Di</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">No. HP</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Tarif</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {manifest.passengers.map((p: any, idx: number) => (
                          <tr key={p.ticketNumber || idx} className="hover:bg-muted/20" data-testid={`row-passenger-${idx}`}>
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium">{p.passengerName}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{p.ticketNumber || '—'}</td>
                            <td className="px-3 py-2 font-semibold text-center">{p.seatNo}</td>
                            <td className="px-3 py-2">{p.originStopName || '—'}</td>
                            <td className="px-3 py-2">{p.destinationStopName || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.phone || '—'}</td>
                            <td className="px-3 py-2"><TicketStatusBadge status={p.ticketStatus} /></td>
                            <td className="px-3 py-2 text-right">{formatCurrency(p.fareAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ─── SECTION B: KARGO ─── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">B</div>
                  <h3 className="font-semibold text-sm">Daftar Kargo</h3>
                  <Badge variant="secondary" className="text-xs">{manifest.summary.totalCargoItems} kiriman</Badge>
                </div>

                {manifest.cargo.length === 0 ? (
                  <div className="border border-dashed rounded-lg py-8 text-center text-sm text-muted-foreground">
                    Tidak ada kargo untuk trip ini.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs" data-testid="table-manifest-cargo">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-7">No</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">No. Resi</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pengirim</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Penerima</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Keterangan</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asal</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tujuan</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Berat (kg)</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Tarif</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {manifest.cargo.map((c: any, idx: number) => (
                          <tr key={c.waybillNumber || idx} className="hover:bg-muted/20" data-testid={`row-cargo-${idx}`}>
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-medium">{c.waybillNumber}</td>
                            <td className="px-3 py-2">{c.senderName}</td>
                            <td className="px-3 py-2">{c.recipientName}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{c.itemDescription} {c.quantity > 1 ? `(${c.quantity}x)` : ''}</td>
                            <td className="px-3 py-2">{c.originStopName || '—'}</td>
                            <td className="px-3 py-2">{c.destinationStopName || '—'}</td>
                            <td className="px-3 py-2 text-right">{c.weightKg ? parseFloat(c.weightKg).toFixed(1) : '—'}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(c.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ─── SUMMARY ─── */}
              <div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-muted/40 border rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Total Penumpang</div>
                    <div className="text-2xl font-bold">{manifest.summary.totalPassengers}</div>
                    <div className="text-xs text-muted-foreground">orang</div>
                  </div>
                  <div className="bg-muted/40 border rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Total Kargo</div>
                    <div className="text-2xl font-bold">{manifest.summary.totalCargoItems}</div>
                    <div className="text-xs text-muted-foreground">{manifest.summary.totalCargoWeight > 0 ? `${manifest.summary.totalCargoWeight} kg` : 'kiriman'}</div>
                  </div>
                  <div className="bg-muted/40 border rounded-lg p-3 text-center col-span-2 md:col-span-1">
                    <div className="text-xs text-muted-foreground mb-1">Total Pendapatan</div>
                    <div className="text-lg font-bold">{formatCurrency(manifest.summary.totalRevenue)}</div>
                    <div className="text-xs text-muted-foreground">
                      Tiket: {formatCurrency(manifest.summary.totalTicketRevenue)} &bull; Kargo: {formatCurrency(manifest.summary.totalCargoRevenue)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Thermal print layout — hidden on screen, shown only when printing */}
        {manifest && <ThermalManifest manifest={manifest} />}

        {/* Bottom close bar */}
        <div className="px-6 py-3 border-t shrink-0 bg-background flex justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
