import { type ReactNode } from 'react';
import { usePermissions } from '@/lib/permissions';
import ForbiddenPage from '@/pages/auth/ForbiddenPage';

interface RequireFlagProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireFlag({ flag, children, fallback }: RequireFlagProps) {
  const { can, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!can(flag)) {
    return fallback !== undefined ? <>{fallback}</> : <ForbiddenPage />;
  }
  return <>{children}</>;
}
