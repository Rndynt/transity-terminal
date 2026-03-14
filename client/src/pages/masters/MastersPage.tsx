import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Store, Bus, LayoutGrid, Route, CalendarPlus, CalendarDays, DollarSign } from 'lucide-react';
import StopsManager from '@/components/masters/StopsManager';
import OutletsManager from '@/components/masters/OutletsManager';
import VehiclesManager from '@/components/masters/VehiclesManager';
import LayoutsManager from '@/components/masters/LayoutsManager';
import TripPatternsManager from '@/components/masters/TripPatternsManager';
import TripBasesManager from '@/components/masters/TripBasesManager';
import TripsManager from '@/components/masters/TripsManager';
import PriceRulesManager from '@/components/masters/PriceRulesManager';
import type { LucideIcon } from 'lucide-react';

interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  component: () => JSX.Element;
}

export default function MastersPage() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const tabFromUrl = urlParams.get('tab') || 'stops';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  
  useEffect(() => {
    const newTab = urlParams.get('tab') || 'stops';
    setActiveTab(newTab);
  }, [location]);

  const tabs: TabDef[] = [
    { id: 'stops', label: 'Stops', icon: MapPin, component: StopsManager },
    { id: 'outlets', label: 'Outlets', icon: Store, component: OutletsManager },
    { id: 'vehicles', label: 'Vehicles', icon: Bus, component: VehiclesManager },
    { id: 'layouts', label: 'Layouts', icon: LayoutGrid, component: LayoutsManager },
    { id: 'patterns', label: 'Trip Patterns', icon: Route, component: TripPatternsManager },
    { id: 'trip-bases', label: 'Trip Bases', icon: CalendarPlus, component: TripBasesManager },
    { id: 'trips', label: 'Trips', icon: CalendarDays, component: TripsManager },
    { id: 'pricing', label: 'Price Rules', icon: DollarSign, component: PriceRulesManager }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6" data-testid="masters-page">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">Master Data Management</CardTitle>
          <p className="text-muted-foreground">
            Configure stops, vehicles, routes, and pricing rules for the multi-stop travel system
          </p>
        </CardHeader>
      </Card>

      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border overflow-x-auto">
            <TabsList className="inline-flex h-auto p-0 bg-transparent w-max min-w-full">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex items-center gap-2 h-auto py-3 px-3 lg:px-4 flex-shrink-0 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none data-[state=active]:shadow-none"
                    data-testid={`tab-${tab.id}`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs lg:text-sm font-medium whitespace-nowrap">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <CardContent className="p-6">
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
  );
}
