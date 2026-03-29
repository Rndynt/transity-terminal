import { type LucideIcon } from 'lucide-react';
import NotificationBell from './NotificationBell';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: string;
  iconColor?: string;
}

export default function PageHeader({ icon: Icon, title, subtitle, badge, iconColor = 'text-blue-600' }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 flex-shrink-0 hidden lg:block" data-testid="page-header">
      <div className="flex items-center justify-between px-3 md:px-5 h-11 md:h-12">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-800">{title}</span>
              {badge && (
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[10px] text-gray-400 leading-tight -mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        <NotificationBell className="hidden lg:block" />
      </div>
    </div>
  );
}
