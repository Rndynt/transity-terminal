import { useState, useEffect } from 'react';
import { useSearch, useLocation } from 'wouter';
import PageHeader from '@/components/layout/PageHeader';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MapPin,
  Store,
  Bus,
  UserCheck,
  LayoutGrid,
  Route,
  CalendarPlus,
  CalendarDays,
  DollarSign,
  Tag,
  Package,
  Wallet,
  Ticket,
} from 'lucide-react';
import StopsManager from '@/components/masters/StopsManager';
import OutletsManager from '@/components/masters/OutletsManager';
import VehiclesManager from '@/components/masters/VehiclesManager';
import DriversManager from '@/components/masters/DriversManager';
import LayoutsManager from '@/components/masters/LayoutsManager';
import TripPatternsManager from '@/components/masters/TripPatternsManager';
import TripBasesManager from '@/components/masters/TripBasesManager';
import TripsManager from '@/components/masters/TripsManager';
import PriceRulesManager from '@/components/masters/PriceRulesManager';
import CargoTypesManager from '@/components/masters/CargoTypesManager';
import CargoRatesManager from '@/components/masters/CargoRatesManager';
import TripCostTemplatesManager from '@/components/masters/TripCostTemplatesManager';
import PromosManager from '@/components/masters/PromosManager';
import { usePermissions } from '@/lib/permissions';
import type { LucideIcon } from 'lucide-react';

interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  flag: string;
  component: () => JSX.Element;
}

const ALL_TABS: TabDef[] = [
  { id: 'stops', label: 'Halte', icon: MapPin, flag: 'master.stops', component: StopsManager },
  { id: 'outlets', label: 'Outlet', icon: Store, flag: 'master.outlets', component: OutletsManager },
  { id: 'vehicles', label: 'Kendaraan', icon: Bus, flag: 'master.vehicles', component: VehiclesManager },
  { id: 'drivers', label: 'Driver', icon: UserCheck, flag: 'master.drivers', component: DriversManager },
  { id: 'layouts', label: 'Layout Kursi', icon: LayoutGrid, flag: 'master.layouts', component: LayoutsManager },
  { id: 'patterns', label: 'Pola Rute', icon: Route, flag: 'master.trip_patterns', component: TripPatternsManager },
  { id: 'trip-bases', label: 'Dasar Trip', icon: CalendarPlus, flag: 'master.trips', component: TripBasesManager },
  { id: 'trips', label: 'Trip', icon: CalendarDays, flag: 'master.trips', component: TripsManager },
  { id: 'pricing', label: 'Aturan Harga', icon: DollarSign, flag: 'master.price_rules', component: PriceRulesManager },
  { id: 'cargo-types', label: 'Jenis Kargo', icon: Tag, flag: 'master.cargo_types', component: CargoTypesManager },
  { id: 'cargo-rates', label: 'Tarif Kargo', icon: Package, flag: 'master.cargo_rates', component: CargoRatesManager },
  { id: 'cost-templates', label: 'Biaya Perjalanan', icon: Wallet, flag: 'master.cost_templates', component: TripCostTemplatesManager },
  { id: 'promos', label: 'Promo & Voucher', icon: Ticket, flag: 'master.promos', component: PromosManager },
];

export default function MastersPage() {
  usePageTitle("Master Data", "Konfigurasi halte, kendaraan, rute & harga");
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { can } = usePermissions();

  const tabs = ALL_TABS.filter(t => can(t.flag));
  const tabFromUrl = new URLSearchParams(search).get('tab') || tabs[0]?.id || 'stops';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  useEffect(() => {
    const newTab = new URLSearchParams(search).get('tab') || tabs[0]?.id || 'stops';
    setActiveTab(newTab);
  }, [search]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      const firstTab = tabs[0].id;
      setActiveTab(firstTab);
      setLocation(`/masters?tab=${firstTab}`);
    }
  }, [tabs.length]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLocation(`/masters?tab=${value}`);
  };

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" data-testid="masters-page">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full p-3 sm:p-4 md:p-6 space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Master Data</h1>
              <p className="text-sm text-muted-foreground">Tidak ada sub-modul yang dapat diakses.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="masters-page">
      <PageHeader icon={LayoutGrid} title="Master Data" subtitle="Konfigurasi halte, kendaraan, rute & harga" />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex overflow-hidden">
        {/* Desktop: vertical sub-sidebar */}
        <TabsList
          className="hidden md:flex flex-col h-auto w-56 lg:w-64 flex-shrink-0 p-2 bg-white border-r border-gray-100 overflow-y-auto justify-start items-stretch gap-0.5 rounded-none"
          data-testid="masters-sub-sidebar"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="w-full flex items-center justify-start gap-2.5 h-auto py-2.5 px-3 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                data-testid={`tab-${tab.id}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile/tablet-portrait: dropdown selector instead of the sub-sidebar */}
          <div className="md:hidden flex-shrink-0 bg-white border-b border-gray-100 px-3 py-2">
            <Select value={activeTab} onValueChange={handleTabChange}>
              <SelectTrigger className="w-full h-9 text-sm" data-testid="masters-mobile-select">
                <SelectValue placeholder="Pilih modul..." />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    <div className="flex items-center gap-2">
                      <tab.icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-3 md:p-5">
              {tabs.map((tab) => (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="mt-0 focus-visible:outline-none focus-visible:ring-0"
                  data-testid={`content-${tab.id}`}
                >
                  <tab.component />
                </TabsContent>
              ))}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
