import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserMinus, CalendarClock, Ban, Loader2, Armchair } from 'lucide-react';
import { passengersApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { CanAccess } from '@/components/rbac/CanAccess';

export interface PassengerActionTarget {
  id: string;
  fullName: string;
  seatNo: string;
  ticketNumber: string | null;
  ticketStatus: string;
  bookingCode: string;
  bookingId: string;
  originStopName?: string;
  destinationStopName?: string;
}

interface PassengerActionsProps {
  passenger: PassengerActionTarget;
  onClose: () => void;
  onStartRescheduleMode?: (info: {
    id: string;
    name: string;
    ticketNumber: string | null;
    bookingCode: string;
    seatNo: string;
    originStopName: string;
    destinationStopName: string;
    reason: string;
  }) => void;
  onStartAssignMode?: (info: {
    id: string;
    name: string;
    ticketNumber: string | null;
    bookingCode: string;
  }) => void;
  onAssignInCso?: (passengerId: string, passengerName: string, bookingCode: string, ticketNumber: string | null) => void;
}

export default function PassengerActions({
  passenger: p,
  onClose,
  onStartRescheduleMode,
  onStartAssignMode,
  onAssignInCso,
}: PassengerActionsProps) {
  const [confirmUnseat, setConfirmUnseat] = useState(false);
  const [unseatReason, setUnseatReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRescheduleReason, setShowRescheduleReason] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const { toast } = useToast();

  const unseatMutation = useMutation({
    mutationFn: ({ passengerId, reason }: { passengerId: string; reason: string }) =>
      passengersApi.unseat(passengerId, reason),
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Penumpang berhasil di-unseat. Kursi sekarang tersedia.' });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setConfirmUnseat(false);
      setUnseatReason('');
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'Gagal Unseat', description: e.message, variant: 'destructive' });
    }
  });

  const cancelTicketMutation = useMutation({
    mutationFn: ({ passengerId, reason }: { passengerId: string; reason: string }) =>
      passengersApi.cancelTicket(passengerId, reason),
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Tiket berhasil dibatalkan.' });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setConfirmCancel(false);
      setCancelReason('');
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'Gagal Batalkan Tiket', description: e.message, variant: 'destructive' });
    }
  });

  if (p.ticketStatus === 'canceled') return null;

  const isActive = p.ticketStatus !== 'unseated' && p.ticketStatus !== 'canceled';

  if (p.ticketStatus === 'unseated') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-orange-50 border border-orange-200 rounded-md">
          <Armchair className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <span className="text-xs text-orange-700 font-medium">Penumpang ini belum memiliki kursi. Assign ke kursi baru.</span>
        </div>
        {onStartAssignMode && (
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 w-full"
            onClick={() => {
              onStartAssignMode({
                id: p.id,
                name: p.fullName,
                ticketNumber: p.ticketNumber,
                bookingCode: p.bookingCode,
              });
              onClose();
            }}
            data-testid={`btn-assign-${p.id}`}
          >
            <Armchair className="w-3 h-3" />
            Pilih Kursi di Peta Kursi
          </Button>
        )}
        {onAssignInCso && (
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 w-full"
            onClick={() => onAssignInCso(p.id, p.fullName, p.bookingCode, p.ticketNumber)}
            data-testid={`btn-assign-${p.id}`}
          >
            <Armchair className="w-3 h-3" />
            Pilih Kursi di Reservasi
          </Button>
        )}
      </div>
    );
  }

  if (!isActive) return null;

  if (confirmUnseat) {
    return (
      <div className="space-y-2 p-2 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-xs text-red-700 font-semibold">Yakin unseat penumpang ini?</p>
        <Textarea
          placeholder="Alasan unseat (wajib diisi)..."
          value={unseatReason}
          onChange={e => setUnseatReason(e.target.value)}
          className="min-h-[50px] text-xs border-red-200 focus:border-red-400 focus:ring-red-100"
          data-testid={`input-unseat-reason-${p.id}`}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs gap-1"
            disabled={!unseatReason.trim() || unseatMutation.isPending}
            onClick={() => unseatMutation.mutate({ passengerId: p.id, reason: unseatReason.trim() })}
            data-testid={`btn-confirm-unseat-${p.id}`}
          >
            {unseatMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />}
            Ya, Unseat
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setConfirmUnseat(false); setUnseatReason(''); }} data-testid="btn-cancel-unseat">
            Batal
          </Button>
        </div>
      </div>
    );
  }

  if (confirmCancel) {
    return (
      <div className="space-y-2 p-2 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-xs text-red-700 font-semibold">Yakin batalkan tiket penumpang ini?</p>
        <Textarea
          placeholder="Alasan pembatalan (wajib diisi)..."
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          className="min-h-[50px] text-xs border-red-200 focus:border-red-400 focus:ring-red-100"
          data-testid={`input-cancel-reason-${p.id}`}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs gap-1"
            disabled={!cancelReason.trim() || cancelTicketMutation.isPending}
            onClick={() => cancelTicketMutation.mutate({ passengerId: p.id, reason: cancelReason.trim() })}
            data-testid={`btn-confirm-cancel-${p.id}`}
          >
            {cancelTicketMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
            Ya, Batalkan
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setConfirmCancel(false); setCancelReason(''); }} data-testid="btn-cancel-cancel">
            Batal
          </Button>
        </div>
      </div>
    );
  }

  if (showRescheduleReason) {
    return (
      <div className="space-y-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-700 font-semibold">Alasan reschedule</p>
        <Textarea
          placeholder="Alasan reschedule (wajib diisi)..."
          value={rescheduleReason}
          onChange={e => setRescheduleReason(e.target.value)}
          className="min-h-[50px] text-xs border-amber-200 focus:border-amber-400 focus:ring-amber-100"
          data-testid={`input-reschedule-reason-${p.id}`}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600"
            disabled={!rescheduleReason.trim()}
            onClick={() => {
              if (onStartRescheduleMode) {
                onStartRescheduleMode({
                  id: p.id,
                  name: p.fullName,
                  ticketNumber: p.ticketNumber,
                  bookingCode: p.bookingCode,
                  seatNo: p.seatNo,
                  originStopName: p.originStopName ?? '—',
                  destinationStopName: p.destinationStopName ?? '—',
                  reason: rescheduleReason.trim(),
                });
                setShowRescheduleReason(false);
                setRescheduleReason('');
                onClose();
              }
            }}
            data-testid={`btn-confirm-reschedule-${p.id}`}
          >
            <CalendarClock className="w-3 h-3" />
            Lanjut Pilih Trip & Kursi
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowRescheduleReason(false); setRescheduleReason(''); }} data-testid="btn-cancel-reschedule-reason">
            Batal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CanAccess flag="action.passenger.unseat">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={() => setConfirmUnseat(true)}
          data-testid={`btn-unseat-${p.id}`}
        >
          <UserMinus className="w-3 h-3" />
          Unseat
        </Button>
      </CanAccess>
      <CanAccess flag="action.passenger.reschedule">
        {onStartRescheduleMode && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
            onClick={() => setShowRescheduleReason(true)}
            data-testid={`btn-reschedule-${p.id}`}
          >
            <CalendarClock className="w-3 h-3" />
            Reschedule
          </Button>
        )}
      </CanAccess>
      <CanAccess flag="action.booking.cancel">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
          onClick={() => setConfirmCancel(true)}
          data-testid={`btn-cancel-ticket-${p.id}`}
        >
          <Ban className="w-3 h-3" />
          Batalkan Tiket
        </Button>
      </CanAccess>
    </div>
  );
}
