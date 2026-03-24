import { createContext, useContext } from "react";

interface LayoutContextValue {
  openSidebar: () => void;
  isMobile: boolean;
}

export const LayoutContext = createContext<LayoutContextValue>({
  openSidebar: () => {},
  isMobile: false,
});

export function useLayout() {
  return useContext(LayoutContext);
}
