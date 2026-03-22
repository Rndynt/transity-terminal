import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export interface PermissionsData {
  flags: string[];
  role: string | null;
  outletId: string | null;
}

interface PermissionsContextValue {
  flags: Set<string>;
  role: string | null;
  outletId: string | null;
  isLoading: boolean;
  can: (flag: string) => boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PermissionsData>({
    flags: [],
    role: null,
    outletId: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions/me', { credentials: 'include' });
      if (res.ok) {
        const json: PermissionsData = await res.json();
        setData(json);
      } else {
        setData({ flags: [], role: null, outletId: null });
      }
    } catch {
      setData({ flags: [], role: null, outletId: null });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flagSet = new Set(data.flags);

  const can = useCallback(
    (flag: string) => flagSet.has(flag),
    [data.flags]
  );

  return (
    <PermissionsContext.Provider
      value={{
        flags: flagSet,
        role: data.role,
        outletId: data.outletId,
        isLoading,
        can,
        refresh,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}
