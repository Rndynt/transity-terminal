import { Phone, CreditCard, Hash, Armchair, User } from 'lucide-react';
import PassengerActions from './PassengerActions';
import type { PassengerActionTarget } from './PassengerActions';

type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'paid' | 'canceled' | 'refunded' | 'unseated';

const STATUS_MAP: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: 'text-amber-700',  bg: 'bg-amber-50 border border-amber-200' },
  confirmed:  { label: 'Terkonfirmasi', color: 'text-blue-700',   bg: 'bg-blue-50 border border-blue-200' },
  checked_in: { label: 'Check-In',   color: 'text-indigo-700', bg: 'bg-indigo-50 border border-indigo-200' },
  paid:       { label: 'Lunas',      color: 'text-emerald-700',bg: 'bg-emerald-50 border border-emerald-200' },
  canceled:   { label: 'Dibatalkan', color: 'text-red-700',    bg: 'bg-red-50 border border-red-200' },
  refunded:   { label: 'Refund',     color: 'text-purple-700', bg: 'bg-purple-50 border border-purple-200' },
  unseated:   { label: 'Unseated',   color: 'text-orange-700', bg: 'bg-orange-50 border border-orange-200' },
};

const fmt = (amount: string | number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
    .format(typeof amount === 'string' ? parseFloat(amount) : amount);

interface PassengerData {
  id: string;
  fullName: string;
  seatNo: string;
  phone?: string | null;
  idNumber?: string | null;
  ticketNumber: string | null;
  ticketStatus?: string | null;
  fareAmount?: string | number | null;
}

interface PassengerCardProps {
  passenger: PassengerData;
  actionTarget: PassengerActionTarget;
  onClose: () => void;
  showHeader?: boolean;
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

export default function PassengerCard({
  passenger: p,
  actionTarget,
  onClose,
  showHeader = true,
  onStartRescheduleMode,
  onStartAssignMode,
  onAssignInCso,
}: PassengerCardProps) {
  const isActive = p.ticketStatus !== 'unseated' && p.ticketStatus !== 'canceled';

  return (
    <div className="rounded-lg border overflow-hidden">
      {showHeader && (
        <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          Penumpang
        </div>
      )}
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${!isActive && p.ticketStatus !== 'unseated' ? 'line-through text-muted-foreground' : ''}`} data-testid="passenger-name">
            {p.fullName}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="seat-number">
            <Armchair className="w-3 h-3" />
            {p.seatNo}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {p.phone && (
            <span className="flex items-center gap-1" data-testid="passenger-phone">
              <Phone className="w-3 h-3" /> {p.phone}
            </span>
          )}
          {p.idNumber && (
            <span className="flex items-center gap-1" data-testid="passenger-id">
              <CreditCard className="w-3 h-3" /> {p.idNumber}
            </span>
          )}
          {p.ticketNumber && (
            <span className="flex items-center gap-1" data-testid="ticket-number">
              <Hash className="w-3 h-3" /> {p.ticketNumber}
            </span>
          )}
        </div>
        <p className="text-xs font-medium text-emerald-700" data-testid="fare-amount">{fmt(p.fareAmount ?? 0)}</p>
        {p.ticketStatus && p.ticketStatus !== 'active' && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium mt-1 ${
            STATUS_MAP[p.ticketStatus as BookingStatus]?.bg || 'bg-gray-50 border border-gray-200'
          } ${STATUS_MAP[p.ticketStatus as BookingStatus]?.color || 'text-gray-700'}`}>
            Tiket: {STATUS_MAP[p.ticketStatus as BookingStatus]?.label || p.ticketStatus}
          </span>
        )}
      </div>

      <div className="px-4 py-2 border-t bg-muted/10 space-y-2">
        <PassengerActions
          passenger={actionTarget}
          onClose={onClose}
          onStartRescheduleMode={onStartRescheduleMode}
          onStartAssignMode={onStartAssignMode}
          onAssignInCso={onAssignInCso}
        />
      </div>
    </div>
  );
}
