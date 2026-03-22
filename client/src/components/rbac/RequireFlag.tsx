import { type ReactNode } from 'react';
import { usePermissions } from '@/lib/permissions';
import ForbiddenPage from '@/pages/auth/ForbiddenPage';

interface RequireFlagProps {
  flag?: string;
  flags?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireFlag({ flag, flags, children, fallback }: RequireFlagProps) {
  const { can, isLoading } = usePermissions();
  if (isLoading) return null;
  const allFlags = [...(flags ?? []), ...(flag ? [flag] : [])];
  const denied = allFlags.some(f => !can(f));
  if (denied) {
    return fallback !== undefined ? <>{fallback}</> : <ForbiddenPage />;
  }
  return <>{children}</>;
}
