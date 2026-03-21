interface StatusBadgeProps {
  status: string;
  map: Record<string, { label: string; color: string; bg: string }>;
  className?: string;
}

export function StatusBadge({ status, map, className = '' }: StatusBadgeProps) {
  const config = map[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-50 border border-gray-200' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${config.color} ${config.bg} ${className}`}
      data-testid={`status-badge-${status}`}
    >
      {config.label}
    </span>
  );
}
