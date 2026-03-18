import { useState, useEffect } from 'react';
import { useSearch, useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
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
  LayoutGrid,
  Route,
  CalendarPlus,
  CalendarDays,
  DollarSign,
  Tag,
  Package,
} from 'lucide-react';
import StopsManager from '@/components/masters/StopsManager';
import OutletsManager from '@/components/masters/OutletsManager';
import VehiclesManager from '@/components/masters/VehiclesManager';
import LayoutsManager from '@/components/masters/LayoutsManager';
import TripPatternsManager from '@/components/masters/TripPatternsManager';
import TripBasesManager from '@/components/masters/TripBasesManager';
import TripsManager from '@/components/masters/TripsManager';
import PriceRulesManager from '@/components/masters/PriceRulesManager';
import CargoTypesManager from '@/components/masters/CargoTypesManager';
import CargoRatesManager from '@/components/masters/CargoRatesManager';
import type { LucideIcon } from 'lucide-react';

interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  component: () => JSX.Element;
}

export default function MastersPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const tabFromUrl = new URLSearchParams(search).get('tab') || 'stops';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  useEffect(() => {
    const newTab = new URLSearchParams(search).get('tab') || 'stops';
    setActiveTab(newTab);
  }, [search]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLocation(`/masters?tab=${value}`);
  };

  const tabs: TabDef[] = [
    { id: 'stops', label: 'Stops', icon: MapPin, component: StopsManager },
    { id: 'outlets', label: 'Outlets', icon: Store, component: OutletsManager },
    {
      id: 'vehicles',
      label: 'Vehicles',
      icon: Bus,
      component: VehiclesManager,
    },
    {
      id: 'layouts',
      label: 'Layouts',
      icon: LayoutGrid,
      component: LayoutsManager,
    },
    {
      id: 'patterns',
      label: 'Trip Patterns',
      icon: Route,
      component: TripPatternsManager,
    },
    {
      id: 'trip-bases',
      label: 'Trip Bases',
      icon: CalendarPlus,
      component: TripBasesManager,
    },
    { id: 'trips', label: 'Trips', icon: CalendarDays, component: TripsManager },
    {
      id: 'pricing',
      label: 'Price Rules',
      icon: DollarSign,
      component: PriceRulesManager,
    },
    {
      id: 'cargo-types',
      label: 'Jenis Kargo',
      icon: Tag,
      component: CargoTypesManager,
    },
    {
      id: 'cargo-rates',
      label: 'Tarif Kargo',
      icon: Package,
      component: CargoRatesManager,
    },
  ];

  const activeTabDef = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      data-testid="masters-page"
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full p-3 sm:p-4 md:p-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Master Data Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure stops, vehicles, routes, and pricing rules for the
              multi-stop travel system
            </p>
          </div>

          <Card className="overflow-hidden border-none shadow-none bg-transparent sm:bg-card sm:border sm:shadow-sm">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              {/* Mobile Select Dropdown */}
              <div className="sm:hidden mb-4">
                <Select value={activeTab} onValueChange={handleTabChange}>
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2">
                      <activeTabDef.icon className="h-4 w-4" />
                      <SelectValue placeholder="Select Tab" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {tabs.map((tab) => (
                      <SelectItem key={tab.id} value={tab.id}>
                        <div className="flex items-center gap-2">
                          <tab.icon className="h-4 w-4" />
                          <span>{tab.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Desktop Tabs List */}
              <div className="hidden sm:block border-b border-border overflow-x-auto">
                <TabsList className="inline-flex h-auto p-0 bg-transparent w-max min-w-full">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="flex items-center gap-1.5 h-auto py-3 px-4 flex-shrink-0 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none data-[state=active]:shadow-none text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`tab-${tab.id}`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium whitespace-nowrap">
                          {tab.label}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <CardContent className="p-0 sm:p-4 md:p-6 mt-4 sm:mt-0">
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
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
