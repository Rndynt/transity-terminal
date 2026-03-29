import { ReactNode, useState, useEffect } from "react";
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

  const openSidebar = () => setSidebarOpen(true);

  return (
    <LayoutContext.Provider value={{ openSidebar, isMobile }}>
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
          {isMobile ? (
            <div className="h-10 bg-white border-b border-gray-200 flex items-center justify-between gap-2 px-3 flex-shrink-0 lg:hidden cso-hide-default-header">
              <div className="flex items-center gap-2">
                <button
                  onClick={openSidebar}
                  className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Open sidebar"
                  data-testid="open-sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <span className="text-sm font-semibold text-gray-800">Transity</span>
              </div>
              <NotificationBell />
            </div>
          ) : (
            <div className="h-10 bg-white border-b border-gray-200 flex items-center justify-end gap-2 px-4 flex-shrink-0">
              <NotificationBell />
            </div>
          )}
          {children}
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
