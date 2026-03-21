import { type LucideIcon, Package } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  action?: JSX.Element;
}

export function EmptyState({ icon: Icon = Package, title, description, className = '', action }: EmptyStateProps) {
  return (
    <div className={`text-center py-8 ${className}`} data-testid="empty-state">
      <Icon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-500">{title}</p>
      {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
