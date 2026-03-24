import { Link, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MapPin, Store, Truck, UserCheck, LayoutGrid, Route, Calendar, DollarSign,
  Ticket, List, Bus, PanelLeftClose, PanelLeftOpen, X, Package, Tag, Wallet, FileText, BadgePercent, ClipboardList, CalendarDays, CalendarRange, LogOut,
  BarChart3, ShoppingCart, TrendingUp, Users, AlertTriangle, CreditCard, ShieldCheck, Receipt
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";

const NAV_SECTIONS = [
  {
    title: "OPERASIONAL",
    items: [
      { name: "Reservasi", path: "/cso", icon: Ticket, flag: "page.cso" },
      { name: "Kargo", path: "/cargo", icon: Package, flag: "page.cargo" },
      { name: "All Bookings", path: "/bookings", icon: List, flag: "page.bookings" },
      { name: "Jadwal Harian", path: "/schedule", icon: CalendarDays, flag: "page.schedule" },
      { name: "Penjadwalan", path: "/scheduler", icon: CalendarRange, flag: "page.schedule" },
      { name: "SPJ", path: "/spj", icon: ClipboardList, flag: "page.spj" },
      { name: "Manifest", path: "/manifest", icon: FileText, flag: "page.manifest" },
    ]
  },
  {
    title: "LAPORAN",
    items: [
      { name: "Pendapatan", path: "/reports/revenue", icon: DollarSign, flag: "report.revenue" },
      { name: "Penjualan", path: "/reports/sales", icon: ShoppingCart, flag: "report.sales" },
      { name: "Laba Rugi Trip", path: "/reports/trip-profitability", icon: TrendingUp, flag: "report.trip_profitability" },
      { name: "Load Factor", path: "/reports/load-factor", icon: Users, flag: "report.load_factor" },
      { name: "Pembatalan", path: "/reports/cancellations", icon: AlertTriangle, flag: "report.cancellations" },
      { name: "Kargo", path: "/reports/cargo", icon: Package, flag: "report.cargo" },
      { name: "Pembayaran", path: "/reports/payments", icon: CreditCard, flag: "report.payments" },
      { name: "Commercial Fee", path: "/reports/commercial-fee", icon: Receipt, flag: "report.commercial_fee" },
    ]
  },
  {
    title: "MASTER DATA",
    items: [
      { name: "Stops", path: "/masters?tab=stops", icon: MapPin, flag: "master.stops" },
      { name: "Outlets", path: "/masters?tab=outlets", icon: Store, flag: "master.outlets" },
      { name: "Vehicles", path: "/masters?tab=vehicles", icon: Truck, flag: "master.vehicles" },
      { name: "Driver", path: "/masters?tab=drivers", icon: UserCheck, flag: "master.drivers" },
      { name: "Layouts", path: "/masters?tab=layouts", icon: LayoutGrid, flag: "master.layouts" },
      { name: "Trip Patterns", path: "/masters?tab=patterns", icon: Route, flag: "master.trip_patterns" },
      { name: "Trips", path: "/masters?tab=trips", icon: Calendar, flag: "master.trips" },
      { name: "Price Rules", path: "/masters?tab=pricing", icon: DollarSign, flag: "master.price_rules" },
      { name: "Promo & Voucher", path: "/masters?tab=promos", icon: BadgePercent, flag: "master.promos" },
      { name: "Jenis Kargo", path: "/masters?tab=cargo-types", icon: Tag, flag: "master.cargo_types" },
      { name: "Tarif Kargo", path: "/masters?tab=cargo-rates", icon: Package, flag: "master.cargo_rates" },
      { name: "Biaya Perjalanan", path: "/masters?tab=cost-templates", icon: Wallet, flag: "master.cost_templates" },
    ]
  },
  {
    title: "ADMIN",
    items: [
      { name: "Kelola Staff", path: "/admin/staff", icon: Users, flag: "admin.staff.manage" },
      { name: "Feature Flags", path: "/admin/flags", icon: ShieldCheck, flag: "admin.flags.manage" },
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
  const { user, signOut } = useAuth();
  const { can, isLoading: permLoading } = usePermissions();

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

  const visibleSections = NAV_SECTIONS.map(section => ({
    ...section,
    items: permLoading ? [] : section.items.filter(item => {
      if (!can(item.flag)) return false;
      if (section.title === 'MASTER DATA' && !can('page.masters')) return false;
      if (section.title === 'LAPORAN' && !can('page.reports')) return false;
      return true;
    }),
  })).filter(section => section.items.length > 0);

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
          {visibleSections.map(section => (
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
          <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">
                {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium text-xs">Keluar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-600">
                {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email || ""}</p>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
