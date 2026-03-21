import { Phone, CreditCard, Hash, Armchair, User } from 'lucide-react';
import PassengerActions from './PassengerActions';
import type { PassengerActionTarget } from './PassengerActions';
import { BOOKING_STATUS_MAP, fmtCurrency, type BookingStatus } from '@/lib/constants';

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
        <p className="text-xs font-medium text-emerald-700" data-testid="fare-amount">{fmtCurrency(p.fareAmount ?? 0)}</p>
        {p.ticketStatus && p.ticketStatus !== 'active' && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium mt-1 ${
            BOOKING_STATUS_MAP[p.ticketStatus as BookingStatus]?.bg || 'bg-gray-50 border border-gray-200'
          } ${BOOKING_STATUS_MAP[p.ticketStatus as BookingStatus]?.color || 'text-gray-700'}`}>
            Tiket: {BOOKING_STATUS_MAP[p.ticketStatus as BookingStatus]?.label || p.ticketStatus}
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
