import { type ReactNode } from 'react';
import { usePermissions } from '@/lib/permissions';

interface CanAccessProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function CanAccess({ flag, children, fallback = null }: CanAccessProps) {
  const { can, isLoading } = usePermissions();
  if (isLoading) return null;
  return can(flag) ? <>{children}</> : <>{fallback}</>;
}
