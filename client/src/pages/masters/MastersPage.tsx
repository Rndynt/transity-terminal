import { useState, useEffect } from 'react';
import { useSearch } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Store, Bus, LayoutGrid, Route, CalendarPlus, CalendarDays, DollarSign, Tag, Package } from 'lucide-react';
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
  const tabFromUrl = new URLSearchParams(search).get('tab') || 'stops';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  useEffect(() => {
    const newTab = new URLSearchParams(search).get('tab') || 'stops';
    setActiveTab(newTab);
  }, [search]);

  const tabs: TabDef[] = [
    { id: 'stops', label: 'Stops', icon: MapPin, component: StopsManager },
    { id: 'outlets', label: 'Outlets', icon: Store, component: OutletsManager },
    { id: 'vehicles', label: 'Vehicles', icon: Bus, component: VehiclesManager },
    { id: 'layouts', label: 'Layouts', icon: LayoutGrid, component: LayoutsManager },
    { id: 'patterns', label: 'Trip Patterns', icon: Route, component: TripPatternsManager },
    { id: 'trip-bases', label: 'Trip Bases', icon: CalendarPlus, component: TripBasesManager },
    { id: 'trips', label: 'Trips', icon: CalendarDays, component: TripsManager },
    { id: 'pricing', label: 'Price Rules', icon: DollarSign, component: PriceRulesManager },
    { id: 'cargo-types', label: 'Jenis Kargo', icon: Tag, component: CargoTypesManager },
    { id: 'cargo-rates', label: 'Tarif Kargo', icon: Package, component: CargoRatesManager }
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="masters-page">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full p-3 sm:p-4 md:p-6 space-y-4">
          <Card>
            <CardHeader className="py-4 px-4 md:px-6">
              <CardTitle className="text-lg md:text-2xl font-bold text-foreground">Master Data Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure stops, vehicles, routes, and pricing rules for the multi-stop travel system
              </p>
            </CardHeader>
          </Card>

          <Card className="overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-border overflow-x-auto">
                <TabsList className="inline-flex h-auto p-0 bg-transparent w-max min-w-full">
                  {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="flex items-center gap-1.5 h-auto py-2.5 px-2.5 sm:px-3 lg:px-4 flex-shrink-0 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none data-[state=active]:shadow-none"
                        data-testid={`tab-${tab.id}`}
                      >
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs font-medium whitespace-nowrap">{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <CardContent className="p-2 sm:p-4 md:p-6">
                {tabs.map(tab => (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    className="mt-0"
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
