import { ReactNode } from 'react';

interface MasterPageHeaderProps {
  title: string;
  description: string;
  action: ReactNode;
}

export default function MasterPageHeader({
  title,
  description,
  action,
}: MasterPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
