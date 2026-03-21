import { ReactNode } from 'react';
import { Loader2, FileBarChart } from 'lucide-react';

interface ReportPageLayoutProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  isLoading?: boolean;
  children: ReactNode;
}

export default function ReportPageLayout({ title, description, icon, isLoading, children }: ReportPageLayoutProps) {
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-3">
        {icon || <FileBarChart className="w-6 h-6 text-primary" />}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Memuat data laporan...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
