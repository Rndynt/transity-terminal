import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
  'data-testid'?: string;
}

export function RowActionsMenu({ actions, 'data-testid': testId }: RowActionsMenuProps) {
  const normal = actions.filter(a => a.variant !== 'destructive');
  const danger = actions.filter(a => a.variant === 'destructive');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 rounded-lg data-[state=open]:bg-muted"
          data-testid={testId}
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {normal.map((action, i) => (
          <DropdownMenuItem
            key={i}
            onClick={action.onClick}
            disabled={action.disabled}
            className="gap-2 cursor-pointer"
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
        {normal.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map((action, i) => (
          <DropdownMenuItem
            key={i}
            onClick={action.onClick}
            disabled={action.disabled}
            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
