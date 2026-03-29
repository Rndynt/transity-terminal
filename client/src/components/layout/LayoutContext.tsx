import { createContext, useContext, useCallback } from "react";

interface LayoutContextValue {
  openSidebar: () => void;
  isMobile: boolean;
  hideAppHeader: boolean;
  setHideAppHeader: (hide: boolean) => void;
}

export const LayoutContext = createContext<LayoutContextValue>({
  openSidebar: () => {},
  isMobile: false,
  hideAppHeader: false,
  setHideAppHeader: () => {},
});

export function useLayout() {
  return useContext(LayoutContext);
}

export function useHideAppHeader() {
  const { setHideAppHeader } = useContext(LayoutContext);
  const hide = useCallback(() => {
    setHideAppHeader(true);
    return () => setHideAppHeader(false);
  }, [setHideAppHeader]);
  return hide;
}
