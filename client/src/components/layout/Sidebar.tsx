import { Link, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MapPin, Store, Truck, UserCheck, LayoutGrid, Route, Calendar, DollarSign,
  Ticket, List, Bus, PanelLeftClose, PanelLeftOpen, X, Package, Tag, Wallet, FileText, BadgePercent
} from "lucide-react";

const NAV_SECTIONS = [
  {
    title: "OPERATIONS",
    items: [
      { name: "Reservasi", path: "/cso", icon: Ticket },
      { name: "Kargo", path: "/cargo", icon: Package },
      { name: "All Bookings", path: "/bookings", icon: List },
      { name: "Manifest", path: "/manifest", icon: FileText },
    ]
  },
  {
    title: "MASTERS",
    items: [
      { name: "Stops", path: "/masters?tab=stops", icon: MapPin },
      { name: "Outlets", path: "/masters?tab=outlets", icon: Store },
      { name: "Vehicles", path: "/masters?tab=vehicles", icon: Truck },
      { name: "Driver", path: "/masters?tab=drivers", icon: UserCheck },
      { name: "Layouts", path: "/masters?tab=layouts", icon: LayoutGrid },
      { name: "Trip Patterns", path: "/masters?tab=patterns", icon: Route },
      { name: "Trips", path: "/masters?tab=trips", icon: Calendar },
      { name: "Price Rules", path: "/masters?tab=pricing", icon: DollarSign },
      { name: "Promo & Voucher", path: "/masters?tab=promos", icon: BadgePercent },
      { name: "Jenis Kargo", path: "/masters?tab=cargo-types", icon: Tag },
      { name: "Tarif Kargo", path: "/masters?tab=cargo-rates", icon: Package },
      { name: "Biaya Perjalanan", path: "/masters?tab=cost-templates", icon: Wallet },
    ]
  }
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isOpen = true, onClose, isMobile = false, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const [location] = useLocation();
  const search = useSearch();

  const handleLinkClick = () => {
    if (isMobile && onClose) onClose();
  };

  const isActive = (path: string) => {
    if (path === '/cso') return location === '/' || location === '/cso';
    const [pathBase, pathQuery] = path.split('?');
    if (location !== pathBase) return false;
    if (!pathQuery) return true;
    const pathParams = new URLSearchParams(pathQuery);
    const currentParams = new URLSearchParams(search);
    for (const [key, value] of pathParams.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  };

  return (
    <div
      id="mobile-sidebar"
      role={isMobile ? "dialog" : "navigation"}
      aria-modal={isMobile ? "true" : undefined}
      aria-label="Main navigation"
      className={cn(
        "bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-full transition-all duration-200",
        isMobile ? [
          "fixed left-0 top-0 bottom-0 z-50 w-52 transform",
          isOpen ? "translate-x-0" : "-translate-x-full"
        ] : [
          "relative",
          isCollapsed ? "w-14" : "w-52"
        ]
      )}
    >
      <div className={cn(
        "py-4 border-b border-gray-100 flex items-center",
        isCollapsed && !isMobile ? "px-3 justify-center" : "px-4 justify-between"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Bus className="w-4 h-4 text-white" />
          </div>
          {(!isCollapsed || isMobile) && (
            <div>
              <h1 className="text-sm font-bold text-gray-800 leading-tight">Transity</h1>
              <p className="text-[10px] text-gray-400">Multi-Stop Travel System</p>
            </div>
          )}
        </div>
        {isMobile ? (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            data-testid="close-sidebar"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (!isCollapsed && onToggleCollapse) ? (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            data-testid="btn-collapse-sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {isCollapsed && !isMobile && onToggleCollapse && (
        <div className="px-2 pt-3 pb-1">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            data-testid="btn-expand-sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      <nav className={cn("flex-1 py-3 overflow-y-auto", isCollapsed && !isMobile ? "px-2" : "px-3")}>
        <TooltipProvider delayDuration={100}>
          {NAV_SECTIONS.map(section => (
            <div key={section.title} className="mb-4">
              {(!isCollapsed || isMobile) && (
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5">
                  {section.title}
                </p>
              )}
              {isCollapsed && !isMobile && <div className="h-px bg-gray-100 mx-1 mb-2" />}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  if (isCollapsed && !isMobile) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>
                          <Link href={item.path}>
                            <div
                              onClick={handleLinkClick}
                              className={cn(
                                "w-full flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer",
                                active ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                              )}
                              data-testid={`icon-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-medium text-xs">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Link key={item.name} href={item.path}>
                      <div
                        onClick={handleLinkClick}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                          active
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                        )}
                        data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-blue-600" : "text-gray-400")} />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </TooltipProvider>
      </nav>

      <div className={cn("py-3 border-t border-gray-100", isCollapsed && !isMobile ? "px-2" : "px-3")}>
        {isCollapsed && !isMobile ? (
          <div className="flex justify-center">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-[8px] font-bold text-gray-400">v1</span>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-gray-400 px-2">Demo Transport</p>
            <p className="text-[10px] text-gray-300 px-2">Version: 1.0.0-MVP</p>
          </>
        )}
      </div>
    </div>
  );
}
