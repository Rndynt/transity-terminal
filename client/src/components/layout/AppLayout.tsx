import { ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { LayoutContext } from "./LayoutContext";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hideAppHeader, setHideAppHeaderState] = useState(false);
  const [pageTitle, setPageTitleState] = useState("");
  const [pageSubtitle, setPageSubtitleState] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false);
    };

    if (sidebarOpen && isMobile) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [sidebarOpen, isMobile]);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const setHideAppHeader = useCallback((hide: boolean) => setHideAppHeaderState(hide), []);
  const setPageTitle = useCallback((title: string) => setPageTitleState(title), []);
  const setPageSubtitle = useCallback((subtitle: string) => setPageSubtitleState(subtitle), []);

  const ctxValue = useMemo(() => ({
    openSidebar,
    isMobile,
    hideAppHeader,
    setHideAppHeader,
    pageTitle,
    pageSubtitle,
    setPageTitle,
    setPageSubtitle,
  }), [openSidebar, isMobile, hideAppHeader, setHideAppHeader, pageTitle, pageSubtitle, setPageTitle, setPageSubtitle]);

  return (
    <LayoutContext.Provider value={ctxValue}>
      <div className="flex h-screen bg-gray-50 font-['Inter',sans-serif]">
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {isMobile && !hideAppHeader && (
            <div className="bg-white border-b border-gray-200 flex items-center justify-between gap-2 px-3 py-1.5 flex-shrink-0 lg:hidden">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={openSidebar}
                  className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Open sidebar"
                  data-testid="open-sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate leading-tight">
                    {pageTitle || "Transity"}
                  </div>
                  {pageSubtitle && (
                    <div className="text-[10px] text-gray-500 truncate leading-tight">
                      {pageSubtitle}
                    </div>
                  )}
                </div>
              </div>
              <NotificationBell />
            </div>
          )}
          {children}
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
