import { createContext, useContext, useCallback, useEffect } from "react";

interface LayoutContextValue {
  openSidebar: () => void;
  isMobile: boolean;
  hideAppHeader: boolean;
  setHideAppHeader: (hide: boolean) => void;
  pageTitle: string;
  pageSubtitle: string;
  setPageTitle: (title: string) => void;
  setPageSubtitle: (subtitle: string) => void;
}

export const LayoutContext = createContext<LayoutContextValue>({
  openSidebar: () => {},
  isMobile: false,
  hideAppHeader: false,
  setHideAppHeader: () => {},
  pageTitle: "",
  pageSubtitle: "",
  setPageTitle: () => {},
  setPageSubtitle: () => {},
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

export function usePageTitle(title: string, subtitle?: string) {
  const { setPageTitle, setPageSubtitle } = useContext(LayoutContext);
  useEffect(() => {
    setPageTitle(title);
    setPageSubtitle(subtitle ?? "");
    return () => {
      setPageTitle("");
      setPageSubtitle("");
    };
  }, [title, subtitle, setPageTitle, setPageSubtitle]);
}
