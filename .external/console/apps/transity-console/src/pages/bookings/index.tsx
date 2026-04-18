import { useState } from "react";
import {
  useListBookings,
  getListBookingsQueryKey,
  useListOperators,
  getListOperatorsQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Ticket, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired:   "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  uncertain: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  pending:   Clock,
  confirmed: CheckCircle2,
  completed: CheckCircle2,
  cancelled: XCircle,
  expired:   AlertCircle,
  uncertain: AlertCircle,
};

const RECONCILE_STATUSES = [
  { value: "confirmed", label: "Confirmed — Pembayaran dikonfirmasi", color: "text-emerald-600" },
  { value: "completed", label: "Completed — Perjalanan selesai", color: "text-blue-600" },
  { value: "cancelled", label: "Cancelled — Dibatalkan", color: "text-red-600" },
  { value: "expired",   label: "Expired — Hold kedaluwarsa", color: "text-slate-500" },
  { value: "pending",   label: "Pending — Kembali ke pending", color: "text-amber-600" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

interface ReconcileDialogProps {
  booking: any;
  open: boolean;
  onClose: () => void;
}

function ReconcileDialog({ booking, open, onClose }: ReconcileDialogProps) {
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${booking.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Gagal merekonsil booking");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Rekonsil berhasil",
        description: `Booking ${booking.id.slice(0, 8)}... diubah dari ${data.previousStatus} → ${data.newStatus}`,
      });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({} as any) });
      onClose();
      setNewStatus("");
      setNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !mutation.isPending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Rekonsil Manual Booking
          </DialogTitle>
          <DialogDescription>
            Ubah status booking secara manual. Gunakan hanya saat ada ketidaksesuaian antara Console dan Terminal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Booking info */}
          <div className="bg-muted/50 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booking ID</span>
              <span className="font-mono text-xs">{booking.id.slice(0, 16)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penumpang</span>
              <span className="font-semibold">{booking.passengerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rute</span>
              <span>{booking.origin} → {booking.destination}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status Saat Ini</span>
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                STATUS_COLORS[booking.status] ?? ""
              )}>{booking.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatCurrency(booking.totalAmount)}</span>
            </div>
            {booking.externalBookingId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">External ID</span>
                <span className="font-mono text-xs">{booking.externalBookingId.slice(0, 16)}...</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status Baru</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih status yang benar..." />
              </SelectTrigger>
              <SelectContent>
                {RECONCILE_STATUSES.filter(s => s.value !== booking.status).map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className={cn("font-medium", s.color)}>{s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Alasan rekonsil, nomor referensi pembayaran, dll..."
              className="resize-none h-20 text-sm"
            />
          </div>

          {newStatus === "confirmed" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[12px] text-emerald-700">
              <strong>Confirmed</strong> akan menandai booking sebagai terbayar. Pastikan pembayaran sudah diterima sebelum mengubah status ini.
            </div>
          )}
          {newStatus === "cancelled" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[12px] text-red-700">
              <strong>Cancelled</strong> akan membatalkan booking. Kursi di Terminal perlu dilepas manual jika belum otomatis.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Batal</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!newStatus || mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Rekonsil Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BookingsList() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [operatorFilter, setOperatorFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reconcileBooking, setReconcileBooking] = useState<any>(null);
  const [searchId, setSearchId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const params = {
    page,
    limit: 15,
    ...(statusFilter && statusFilter !== "all" ? { status: statusFilter as any } : {}),
    ...(operatorFilter && operatorFilter !== "all" ? { operatorId: operatorFilter } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };

  const { data, isLoading } = useListBookings(params, {
    query: { queryKey: getListBookingsQueryKey(params) },
  });

  const { data: operatorsData } = useListOperators(undefined, {
    query: { queryKey: getListOperatorsQueryKey() },
  });

  const bookings = (data?.data ?? []).filter(b => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return b.passengerName.toLowerCase().includes(q) ||
      b.passengerPhone.includes(q) ||
      b.id.toLowerCase().includes(q) ||
      (b.externalBookingId || "").toLowerCase().includes(q);
  });

  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const operators = operatorsData?.data ?? [];

  function resetFilters() {
    setStatusFilter(""); setOperatorFilter("");
    setStartDate(""); setEndDate("");
    setSearchQuery(""); setPage(1);
  }

  // Status counts for quick filter chips
  const statusCounts: Record<string, number> = {};
  (data?.data ?? []).forEach(b => { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground mt-1">Semua transaksi booking lintas operator.</p>
        </div>
        {/* Quick status chips */}
        <div className="flex gap-2 flex-wrap justify-end">
          {["pending", "uncertain", "cancelled"].map(s => {
            const count = statusCounts[s];
            if (!count) return null;
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                  STATUS_COLORS[s] ?? "bg-slate-100 text-slate-500",
                  statusFilter === s ? "ring-2 ring-offset-1 ring-current" : "opacity-80 hover:opacity-100"
                )}
              >
                {count} {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama, telp, booking ID..."
            className="pl-9 w-56"
          />
        </div>

        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-status-filter">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="uncertain">Uncertain</SelectItem>
          </SelectContent>
        </Select>

        <Select value={operatorFilter || "all"} onValueChange={(v) => { setOperatorFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Semua operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua operator</SelectItem>
            {operators.map((op) => (
              <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-40" />
        <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-40" />

        {(statusFilter || operatorFilter || startDate || endDate || searchQuery) && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>Clear</Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground self-center">{total} booking</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-20 gap-3">
            <Ticket className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Tidak ada booking ditemukan.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const StatusIcon = STATUS_ICONS[b.status] ?? Clock;
            const needsReconcile = b.status === "pending" || b.status === "uncertain";
            return (
              <Card key={b.id} data-testid={`card-booking-${b.id}`} className={cn(
                "transition-all",
                needsReconcile ? "border-amber-200 dark:border-amber-800/50" : ""
              )}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    STATUS_COLORS[b.status] ?? "bg-slate-100 text-slate-500"
                  )}>
                    <StatusIcon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-sm">{b.passengerName}</span>
                      <span className="text-muted-foreground text-xs">{b.passengerPhone}</span>
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[b.status] ?? ""
                      )} data-testid={`status-booking-${b.id}`}>
                        {b.status}
                      </span>
                      {b.paymentMethod && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {b.paymentMethod}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>{b.origin || "—"} → {b.destination || "—"}</span>
                      <span>{b.serviceDate || b.departureDate}</span>
                      <span>Seat: {b.seatNumbers?.join(", ") || "—"}</span>
                      <span className="font-semibold text-foreground">{formatCurrency(b.totalAmount)}</span>
                      {b.holdExpiresAt && b.status === "pending" && (
                        <span className="text-amber-600">Hold s.d. {formatDateTime(b.holdExpiresAt)}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5 flex gap-3">
                      <span className="font-mono">{b.id.slice(0, 12)}...</span>
                      {b.externalBookingId && <span>Ext: {b.externalBookingId.slice(0, 12)}...</span>}
                      <span>{b.operatorName}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-7 px-3 text-xs gap-1.5",
                        needsReconcile ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""
                      )}
                      onClick={() => setReconcileBooking(b)}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Rekonsil
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(bookings.length > 0 || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">Halaman {page}</span>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
            Berikutnya
          </Button>
        </div>
      )}

      {reconcileBooking && (
        <ReconcileDialog
          booking={reconcileBooking}
          open={!!reconcileBooking}
          onClose={() => setReconcileBooking(null)}
        />
      )}
    </div>
  );
}
