import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
}

export function SummaryCard({ label, value, icon: Icon, iconBg, iconColor, subtitle }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold truncate">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 ${iconBg} rounded-full flex items-center justify-center flex-shrink-0 ml-3`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SummaryCardsGridProps {
  items: SummaryCardProps[];
}

export function SummaryCardsGrid({ items }: SummaryCardsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <SummaryCard key={i} {...item} />
      ))}
    </div>
  );
}
