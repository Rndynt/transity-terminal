import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import NotificationBell from './NotificationBell';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: string;
  iconColor?: string;
  actions?: ReactNode;
}

export default function PageHeader({ icon: Icon, title, subtitle, badge, iconColor = 'text-blue-600', actions }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 flex-shrink-0 hidden lg:block" data-testid="page-header">
      <div className="flex items-center justify-between px-3 md:px-5 h-11 md:h-12">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className="text-sm font-bold text-gray-800">{title}</span>
          {subtitle && (
            <span className="text-[10px] text-gray-400 ml-1">{subtitle}</span>
          )}
          {badge && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-1">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <NotificationBell className="hidden lg:block" />
        </div>
      </div>
    </div>
  );
}
