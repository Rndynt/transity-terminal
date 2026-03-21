import {
  BOOKING_STATUS_MAP, CHANNEL_MAP, TRIP_STATUS_MAP,
  TICKET_STATUS_MAP, SPJ_STATUS_MAP, CARGO_STATUS_MAP,
  type BookingStatus, type BookingChannel, type TripStatus,
  type TicketStatus, type SpjStatus, type CargoStatus,
} from '@/lib/constants';

export function BookingStatusBadge({ status }: { status: string }) {
  const s = BOOKING_STATUS_MAP[status as BookingStatus] ?? { label: status, color: 'text-gray-700', bg: 'bg-gray-50 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.color}`} data-testid={`booking-status-${status}`}>
      {s.label}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const c = CHANNEL_MAP[channel as BookingChannel] ?? { label: channel, color: 'text-gray-500' };
  return <span className={`text-[11px] font-semibold ${c.color}`}>{c.label}</span>;
}

export function TripStatusBadge({ status }: { status: string }) {
  const s = TRIP_STATUS_MAP[status as TripStatus] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-100 border border-gray-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>{s.label}</span>;
}

export function TicketStatusBadge({ status }: { status: string }) {
  const s = TICKET_STATUS_MAP[status as TicketStatus] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-100' };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.color}`}>{s.label}</span>;
}

export function CargoStatusBadge({ status }: { status: string }) {
  const s = CARGO_STATUS_MAP[status as CargoStatus] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-100' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>{s.label}</span>;
}

export function SpjStatusBadge({ status }: { status: string }) {
  const s = SPJ_STATUS_MAP[status as SpjStatus] ?? SPJ_STATUS_MAP.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`} data-testid={`spj-status-${status}`}>
      {s.label}
    </span>
  );
}
