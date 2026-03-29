import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';

interface ReportPageLayoutProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  isLoading?: boolean;
  filterBar?: ReactNode;
  children: ReactNode;
}

export default function ReportPageLayout({ title, description, icon, isLoading, filterBar, children }: ReportPageLayoutProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader icon={icon} title={title} subtitle={description} />

      {filterBar && (
        <div className="px-4 sm:px-6 py-3 border-b bg-muted/20 shrink-0">
          {filterBar}
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Memuat data laporan...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
