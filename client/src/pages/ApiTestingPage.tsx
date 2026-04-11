import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Clock, Copy, Play, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  description: string;
  category: string;
  pathParams?: string[];
  queryParams?: string[];
  bodyExample?: string;
}

interface ApiResponse {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  executionTime: number;
  timezone?: string;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  // Stops
  { id: 'stops-list', method: 'GET', path: '/api/stops', description: 'Get all stops', category: 'Stops' },
  { id: 'stops-get', method: 'GET', path: '/api/stops/:id', description: 'Get stop by ID', category: 'Stops', pathParams: ['id'] },
  { id: 'stops-create', method: 'POST', path: '/api/stops', description: 'Create new stop', category: 'Stops', bodyExample: '{"name": "Stop Name", "latitude": -6.2, "longitude": 106.8, "address": "Stop Address"}' },
  { id: 'stops-update', method: 'PUT', path: '/api/stops/:id', description: 'Update stop', category: 'Stops', pathParams: ['id'], bodyExample: '{"name": "Updated Stop Name"}' },
  { id: 'stops-delete', method: 'DELETE', path: '/api/stops/:id', description: 'Delete stop', category: 'Stops', pathParams: ['id'] },
  
  // Outlets
  { id: 'outlets-list', method: 'GET', path: '/api/outlets', description: 'Get all outlets', category: 'Outlets' },
  { id: 'outlets-get', method: 'GET', path: '/api/outlets/:id', description: 'Get outlet by ID', category: 'Outlets', pathParams: ['id'] },
  { id: 'outlets-create', method: 'POST', path: '/api/outlets', description: 'Create new outlet', category: 'Outlets', bodyExample: '{"name": "Outlet Name", "city": "Jakarta", "isActive": true}' },
  { id: 'outlets-update', method: 'PUT', path: '/api/outlets/:id', description: 'Update outlet', category: 'Outlets', pathParams: ['id'], bodyExample: '{"name": "Updated Outlet Name"}' },
  { id: 'outlets-delete', method: 'DELETE', path: '/api/outlets/:id', description: 'Delete outlet', category: 'Outlets', pathParams: ['id'] },
  
  // Vehicles
  { id: 'vehicles-list', method: 'GET', path: '/api/vehicles', description: 'Get all vehicles', category: 'Vehicles' },
  { id: 'vehicles-get', method: 'GET', path: '/api/vehicles/:id', description: 'Get vehicle by ID', category: 'Vehicles', pathParams: ['id'] },
  { id: 'vehicles-create', method: 'POST', path: '/api/vehicles', description: 'Create new vehicle', category: 'Vehicles', bodyExample: '{"plateNumber": "B1234CD", "model": "Bus Model", "capacity": 40, "layoutId": "layout-id"}' },
  { id: 'vehicles-update', method: 'PUT', path: '/api/vehicles/:id', description: 'Update vehicle', category: 'Vehicles', pathParams: ['id'], bodyExample: '{"plateNumber": "B5678EF"}' },
  { id: 'vehicles-delete', method: 'DELETE', path: '/api/vehicles/:id', description: 'Delete vehicle', category: 'Vehicles', pathParams: ['id'] },
  
  // Layouts
  { id: 'layouts-list', method: 'GET', path: '/api/layouts', description: 'Get all layouts', category: 'Layouts' },
  { id: 'layouts-get', method: 'GET', path: '/api/layouts/:id', description: 'Get layout by ID', category: 'Layouts', pathParams: ['id'] },
  { id: 'layouts-create', method: 'POST', path: '/api/layouts', description: 'Create new layout', category: 'Layouts', bodyExample: '{"name": "40-Seater Standard", "capacity": 40, "seatConfig": {"rows": 10, "columns": 4}}' },
  { id: 'layouts-update', method: 'PUT', path: '/api/layouts/:id', description: 'Update layout', category: 'Layouts', pathParams: ['id'], bodyExample: '{"name": "Updated Layout"}' },
  { id: 'layouts-delete', method: 'DELETE', path: '/api/layouts/:id', description: 'Delete layout', category: 'Layouts', pathParams: ['id'] },
  
  // Trip Patterns
  { id: 'patterns-list', method: 'GET', path: '/api/trip-patterns', description: 'Get all trip patterns', category: 'Trip Patterns' },
  { id: 'patterns-get', method: 'GET', path: '/api/trip-patterns/:id', description: 'Get trip pattern by ID', category: 'Trip Patterns', pathParams: ['id'] },
  { id: 'patterns-create', method: 'POST', path: '/api/trip-patterns', description: 'Create new trip pattern', category: 'Trip Patterns', bodyExample: '{"name": "Jakarta-Bandung", "direction": "outbound"}' },
  { id: 'patterns-update', method: 'PUT', path: '/api/trip-patterns/:id', description: 'Update trip pattern', category: 'Trip Patterns', pathParams: ['id'], bodyExample: '{"name": "Updated Pattern"}' },
  { id: 'patterns-delete', method: 'DELETE', path: '/api/trip-patterns/:id', description: 'Delete trip pattern', category: 'Trip Patterns', pathParams: ['id'] },
  { id: 'pattern-stops-list', method: 'GET', path: '/api/trip-patterns/:patternId/stops', description: 'Get pattern stops', category: 'Trip Patterns', pathParams: ['patternId'] },
  
  // Pattern Stops
  { id: 'pattern-stops-create', method: 'POST', path: '/api/pattern-stops', description: 'Create pattern stop', category: 'Pattern Stops', bodyExample: '{"patternId": "pattern-id", "stopId": "stop-id", "sequence": 1, "pickupType": "regular", "dropoffType": "regular"}' },
  { id: 'pattern-stops-update', method: 'PUT', path: '/api/pattern-stops/:id', description: 'Update pattern stop', category: 'Pattern Stops', pathParams: ['id'], bodyExample: '{"sequence": 2}' },
  { id: 'pattern-stops-delete', method: 'DELETE', path: '/api/pattern-stops/:id', description: 'Delete pattern stop', category: 'Pattern Stops', pathParams: ['id'] },
  { id: 'pattern-stops-bulk-replace', method: 'POST', path: '/api/trip-patterns/:patternId/stops/bulk-replace', description: 'Bulk replace pattern stops', category: 'Pattern Stops', pathParams: ['patternId'], bodyExample: '{"patternStops": [{"stopId": "stop1", "sequence": 1}, {"stopId": "stop2", "sequence": 2}]}' },
  
  // Trip Bases
  { id: 'trip-bases-list', method: 'GET', path: '/api/trip-bases', description: 'Get all trip bases', category: 'Trip Bases' },
  { id: 'trip-bases-get', method: 'GET', path: '/api/trip-bases/:id', description: 'Get trip base by ID', category: 'Trip Bases', pathParams: ['id'] },
  { id: 'trip-bases-create', method: 'POST', path: '/api/trip-bases', description: 'Create new trip base', category: 'Trip Bases', bodyExample: '{"patternId": "pattern-id", "vehicleId": "vehicle-id", "outletId": "outlet-id", "originDepartHHMM": "07:00"}' },
  { id: 'trip-bases-update', method: 'PUT', path: '/api/trip-bases/:id', description: 'Update trip base', category: 'Trip Bases', pathParams: ['id'], bodyExample: '{"originDepartHHMM": "08:00"}' },
  { id: 'trip-bases-delete', method: 'DELETE', path: '/api/trip-bases/:id', description: 'Delete trip base', category: 'Trip Bases', pathParams: ['id'] },
  
  // CSO Virtual Scheduling
  { id: 'cso-materialize-trip', method: 'POST', path: '/api/cso/materialize-trip', description: 'Materialize virtual trip', category: 'CSO', bodyExample: '{"baseId": "base-id", "serviceDate": "2024-01-15"}' },
  { id: 'trips-close', method: 'POST', path: '/api/trips/:id/close', description: 'Close trip', category: 'CSO', pathParams: ['id'] },
  
  // Trips
  { id: 'trips-list', method: 'GET', path: '/api/trips', description: 'Get all trips', category: 'Trips', queryParams: ['serviceDate'] },
  { id: 'cso-available-trips', method: 'GET', path: '/api/cso/available-trips', description: 'Get CSO available trips', category: 'Trips', queryParams: ['serviceDate', 'outletId'] },
  { id: 'trips-get', method: 'GET', path: '/api/trips/:id', description: 'Get trip by ID', category: 'Trips', pathParams: ['id'] },
  { id: 'trips-create', method: 'POST', path: '/api/trips', description: 'Create new trip', category: 'Trips', bodyExample: '{"patternId": "pattern-id", "vehicleId": "vehicle-id", "serviceDate": "2024-01-15", "status": "scheduled"}' },
  { id: 'trips-update', method: 'PUT', path: '/api/trips/:id', description: 'Update trip', category: 'Trips', pathParams: ['id'], bodyExample: '{"status": "cancelled"}' },
  { id: 'trips-delete', method: 'DELETE', path: '/api/trips/:id', description: 'Delete trip', category: 'Trips', pathParams: ['id'] },
  
  // Trip Stop Times
  { id: 'trip-stop-times-list', method: 'GET', path: '/api/trips/:tripId/stop-times', description: 'Get trip stop times', category: 'Trip Stop Times', pathParams: ['tripId'] },
  { id: 'trip-stop-times-effective', method: 'GET', path: '/api/trips/:tripId/stop-times/effective', description: 'Get effective trip stop times', category: 'Trip Stop Times', pathParams: ['tripId'] },
  { id: 'trip-stop-times-bulk-upsert', method: 'POST', path: '/api/trips/:tripId/stop-times/bulk-upsert', description: 'Bulk upsert stop times', category: 'Trip Stop Times', pathParams: ['tripId'], bodyExample: '{"stopTimes": [{"stopId": "stop-id", "sequence": 1, "arrivalTime": "07:30", "departureTime": "07:30"}]}' },
  { id: 'derive-legs', method: 'POST', path: '/api/trips/:tripId/derive-legs', description: 'Derive trip legs', category: 'Trip Stop Times', pathParams: ['tripId'] },
  { id: 'precompute-seat-inventory', method: 'POST', path: '/api/trips/:tripId/precompute-seat-inventory', description: 'Precompute seat inventory', category: 'Trip Stop Times', pathParams: ['tripId'] },
  { id: 'trip-stop-times-create', method: 'POST', path: '/api/trip-stop-times', description: 'Create trip stop time', category: 'Trip Stop Times', bodyExample: '{"tripId": "trip-id", "stopId": "stop-id", "sequence": 1, "arrivalTime": "07:30", "departureTime": "07:30"}' },
  { id: 'trip-stop-times-update', method: 'PUT', path: '/api/trip-stop-times/:id', description: 'Update trip stop time', category: 'Trip Stop Times', pathParams: ['id'], bodyExample: '{"arrivalTime": "07:35"}' },
  { id: 'trip-stop-times-delete', method: 'DELETE', path: '/api/trip-stop-times/:id', description: 'Delete trip stop time', category: 'Trip Stop Times', pathParams: ['id'] },
  
  // Seat Map & Passenger Details
  { id: 'trips-seatmap', method: 'GET', path: '/api/trips/:id/seatmap', description: 'Get trip seatmap', category: 'Seat Management', pathParams: ['id'] },
  { id: 'seat-passenger-details', method: 'GET', path: '/api/trips/:tripId/seats/:seatNo/passenger-details', description: 'Get seat passenger details', category: 'Seat Management', pathParams: ['tripId', 'seatNo'] },
  
  // Seat Holds
  { id: 'holds-create', method: 'POST', path: '/api/holds', description: 'Create seat hold', category: 'Seat Management', bodyExample: '{"tripId": "trip-id", "seatNo": "A1", "legIndexes": [0, 1]}' },
  { id: 'holds-release', method: 'DELETE', path: '/api/holds/:holdRef', description: 'Release seat hold', category: 'Seat Management', pathParams: ['holdRef'] },
  
  // Price Rules
  { id: 'price-rules-list', method: 'GET', path: '/api/price-rules', description: 'Get all price rules', category: 'Price Rules' },
  { id: 'price-rules-create', method: 'POST', path: '/api/price-rules', description: 'Create price rule', category: 'Price Rules', bodyExample: '{"name": "Standard Fare", "ruleType": "distance", "basePrice": 15000, "pricePerKm": 1000}' },
  { id: 'price-rules-update', method: 'PUT', path: '/api/price-rules/:id', description: 'Update price rule', category: 'Price Rules', pathParams: ['id'], bodyExample: '{"basePrice": 18000}' },
  { id: 'price-rules-delete', method: 'DELETE', path: '/api/price-rules/:id', description: 'Delete price rule', category: 'Price Rules', pathParams: ['id'] },
  
  // Pricing
  { id: 'pricing-quote-fare', method: 'GET', path: '/api/pricing/quote-fare', description: 'Quote fare', category: 'Pricing', queryParams: ['tripId', 'originSeq', 'destinationSeq'] },
  
  // Bookings
  { id: 'bookings-list', method: 'GET', path: '/api/bookings', description: 'Get all bookings', category: 'Bookings', queryParams: ['tripId'] },
  { id: 'bookings-get', method: 'GET', path: '/api/bookings/:id', description: 'Get booking by ID', category: 'Bookings', pathParams: ['id'] },
  { id: 'bookings-create', method: 'POST', path: '/api/bookings', description: 'Create booking', category: 'Bookings', bodyExample: '{"tripId": "trip-id", "outletId": "outlet-id", "originSeq": 0, "destinationSeq": 2, "totalAmount": 25000, "status": "confirmed"}' },
  
  // Payments
  { id: 'payments-list', method: 'GET', path: '/api/bookings/:bookingId/payments', description: 'Get booking payments', category: 'Payments', pathParams: ['bookingId'] },
  { id: 'payments-create', method: 'POST', path: '/api/payments', description: 'Create payment', category: 'Payments', bodyExample: '{"bookingId": "booking-id", "amount": 25000, "method": "cash", "status": "completed"}' },
  
  // Seed Data
  { id: 'seed', method: 'POST', path: '/api/seed', description: 'Seed database with demo data', category: 'Utilities' }
];

const JAKARTA_TIMEZONE = 'Asia/Jakarta';

export default function ApiTestingPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const categories = [...new Set(API_ENDPOINTS.map(ep => ep.category))];

  const buildUrl = (endpoint: ApiEndpoint) => {
    let url = endpoint.path;
    
    // Replace path parameters
    if (endpoint.pathParams) {
      endpoint.pathParams.forEach(param => {
        const value = pathParams[param] || `:${param}`;
        url = url.replace(`:${param}`, value);
      });
    }
    
    // Add query parameters
    if (endpoint.queryParams) {
      const queryString = endpoint.queryParams
        .map(param => queryParams[param] ? `${param}=${encodeURIComponent(queryParams[param])}` : null)
        .filter(Boolean)
        .join('&');
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    
    return url;
  };

  const executeRequest = async () => {
    if (!selectedEndpoint) return;
    
    setLoading(true);
    const startTime = Date.now();
    
    try {
      const url = buildUrl(selectedEndpoint);
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      if (['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && requestBody.trim()) {
        try {
          JSON.parse(requestBody); // Validate JSON
          options.body = requestBody;
        } catch {
          toast({
            title: "Invalid JSON",
            description: "Please provide valid JSON in the request body",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      }
      
      const res = await fetch(url, options);
      const data = await res.json();
      const executionTime = Date.now() - startTime;
      
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        headers,
        executionTime,
        timezone: JAKARTA_TIMEZONE
      });
      
      toast({
        title: res.ok ? "Request Successful" : "Request Failed",
        description: `${selectedEndpoint.method} ${url} - ${res.status} ${res.statusText}`,
        variant: res.ok ? "default" : "destructive"
      });
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      setResponse({
        status: 0,
        statusText: 'Network Error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        headers: {},
        executionTime,
        timezone: JAKARTA_TIMEZONE
      });
      
      toast({
        title: "Network Error",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    }
    
    setLoading(false);
  };

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      toast({
        title: "Copied",
        description: "Response copied to clipboard"
      });
    }
  };

  const resetForm = () => {
    setPathParams({});
    setQueryParams({});
    setRequestBody(selectedEndpoint?.bodyExample || '');
    setResponse(null);
  };

  const formatDateWithTimezone = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return formatInTimeZone(date, JAKARTA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss zzz');
    } catch {
      return dateString;
    }
  };

  const detectDateTimeFields = (obj: any, path = ''): string[] => {
    const dateFields: string[] = [];
    if (!obj || typeof obj !== 'object') return dateFields;
    
    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = path ? `${path}.${key}` : key;
      
      // Detect date-time fields by key name or ISO string format
      if (typeof value === 'string') {
        if (key.toLowerCase().includes('time') || 
            key.toLowerCase().includes('date') || 
            key === 'createdAt' || 
            key === 'updatedAt' ||
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          dateFields.push(fullPath);
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          dateFields.push(...detectDateTimeFields(item, `${fullPath}[${index}]`));
        });
      } else if (value && typeof value === 'object') {
        dateFields.push(...detectDateTimeFields(value, fullPath));
      }
    });
    
    return dateFields;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6" data-testid="api-testing-page">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Play className="w-6 h-6" />
            API Testing Interface
          </CardTitle>
          <p className="text-muted-foreground">
            Test and debug all API endpoints with real-time responses and timezone verification (Asia/Jakarta)
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Endpoint Selection */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">API Endpoints</CardTitle>
            <p className="text-sm text-muted-foreground">
              {API_ENDPOINTS.length} endpoints available
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={categories[0]} className="w-full">
              <ScrollArea className="h-8 w-full">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-1 lg:h-auto gap-1">
                  {categories.map(category => (
                    <TabsTrigger
                      key={category}
                      value={category}
                      className="text-xs lg:text-sm whitespace-nowrap"
                      data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {category}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>
              
              {categories.map(category => (
                <TabsContent key={category} value={category} className="mt-4">
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {API_ENDPOINTS
                        .filter(ep => ep.category === category)
                        .map(endpoint => (
                          <Button
                            key={endpoint.id}
                            variant={selectedEndpoint?.id === endpoint.id ? "default" : "outline"}
                            className="w-full justify-start text-left p-3 h-auto"
                            onClick={() => {
                              setSelectedEndpoint(endpoint);
                              setRequestBody(endpoint.bodyExample || '');
                              setPathParams({});
                              setQueryParams({});
                              setResponse(null);
                            }}
                            data-testid={`endpoint-${endpoint.id}`}
                          >
                            <div className="flex flex-col items-start gap-1 w-full">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    endpoint.method === 'GET' ? 'secondary' :
                                    endpoint.method === 'POST' ? 'default' :
                                    endpoint.method === 'PUT' ? 'outline' :
                                    'destructive'
                                  }
                                  className="text-xs font-mono"
                                >
                                  {endpoint.method}
                                </Badge>
                                <span className="text-xs font-mono truncate">
                                  {endpoint.path}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {endpoint.description}
                              </span>
                            </div>
                          </Button>
                        ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Right Panel - Testing Interface */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {selectedEndpoint ? (
                <>
                  <Badge variant="outline" className="font-mono">
                    {selectedEndpoint.method}
                  </Badge>
                  {selectedEndpoint.path}
                </>
              ) : (
                'Select an endpoint to test'
              )}
            </CardTitle>
            {selectedEndpoint && (
              <p className="text-sm text-muted-foreground">
                {selectedEndpoint.description}
              </p>
            )}
          </CardHeader>
          
          {selectedEndpoint && (
            <CardContent className="space-y-6">
              {/* Parameters Section */}
              <div className="space-y-4">
                {/* Path Parameters */}
                {selectedEndpoint.pathParams && selectedEndpoint.pathParams.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Path Parameters</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {selectedEndpoint.pathParams.map(param => (
                        <div key={param}>
                          <Label htmlFor={`path-${param}`} className="text-xs">
                            {param}
                          </Label>
                          <Input
                            id={`path-${param}`}
                            placeholder={`Enter ${param}`}
                            value={pathParams[param] || ''}
                            onChange={(e) => setPathParams(prev => ({
                              ...prev,
                              [param]: e.target.value
                            }))}
                            data-testid={`path-param-${param}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Query Parameters */}
                {selectedEndpoint.queryParams && selectedEndpoint.queryParams.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Query Parameters</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {selectedEndpoint.queryParams.map(param => (
                        <div key={param}>
                          <Label htmlFor={`query-${param}`} className="text-xs">
                            {param} (optional)
                          </Label>
                          <Input
                            id={`query-${param}`}
                            placeholder={`Enter ${param}`}
                            value={queryParams[param] || ''}
                            onChange={(e) => setQueryParams(prev => ({
                              ...prev,
                              [param]: e.target.value
                            }))}
                            data-testid={`query-param-${param}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Request Body */}
                {['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && (
                  <div>
                    <Label htmlFor="request-body" className="text-sm font-medium">
                      Request Body (JSON)
                    </Label>
                    <Textarea
                      id="request-body"
                      placeholder="Enter JSON request body..."
                      className="mt-2 font-mono text-sm min-h-32"
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      data-testid="request-body"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={executeRequest}
                  disabled={loading}
                  className="flex items-center gap-2"
                  data-testid="execute-request"
                >
                  {loading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Execute Request
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex items-center gap-2"
                  data-testid="reset-form"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              </div>

              {/* Current URL Preview */}
              <div className="rounded border p-3 bg-muted/50">
                <Label className="text-xs font-medium text-muted-foreground">
                  Request URL:
                </Label>
                <code className="block mt-1 text-sm font-mono break-all" data-testid="request-url">
                  {selectedEndpoint.method} {buildUrl(selectedEndpoint)}
                </code>
              </div>

              <Separator />

              {/* Response Section */}
              {response && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-medium">Response</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyResponse}
                        className="flex items-center gap-1"
                        data-testid="copy-response"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  {/* Response Status */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      {response.status >= 200 && response.status < 300 ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      <Badge 
                        variant={response.status >= 200 && response.status < 300 ? "default" : "destructive"}
                        data-testid="response-status"
                      >
                        {response.status} {response.statusText}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground">
                      {response.executionTime}ms
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {response.timezone}
                    </span>
                  </div>

                  {/* Timezone Information for Date Fields */}
                  {(() => {
                    const dateFields = detectDateTimeFields(response.data);
                    return dateFields.length > 0 && (
                      <div className="rounded border p-3 bg-blue-50 dark:bg-blue-950/20">
                        <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          🕒 Timezone Information (Asia/Jakarta)
                        </Label>
                        <div className="mt-2 space-y-1 text-xs">
                          {dateFields.slice(0, 5).map(field => {
                            const value = field.split('.').reduce((obj, key) => {
                              if (key.includes('[') && key.includes(']')) {
                                const [arrayKey, index] = key.split(/[\[\]]/);
                                return obj?.[arrayKey]?.[parseInt(index)];
                              }
                              return obj?.[key];
                            }, response.data);
                            
                            return (
                              <div key={field} className="flex justify-between">
                                <span className="text-blue-600 dark:text-blue-400">{field}:</span>
                                <span className="font-mono">{formatDateWithTimezone(value)}</span>
                              </div>
                            );
                          })}
                          {dateFields.length > 5 && (
                            <div className="text-muted-foreground">
                              ... and {dateFields.length - 5} more date fields
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Response Body */}
                  <div>
                    <Label className="text-sm font-medium">Response Body</Label>
                    <ScrollArea className="h-96 w-full rounded border mt-2">
                      <pre 
                        className="p-4 text-xs font-mono overflow-x-auto"
                        data-testid="response-body"
                      >
                        {JSON.stringify(response.data, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>

                  {/* Response Headers */}
                  <div>
                    <Label className="text-sm font-medium">Response Headers</Label>
                    <ScrollArea className="h-32 w-full rounded border mt-2">
                      <div className="p-3 space-y-1">
                        {Object.entries(response.headers).map(([key, value]) => (
                          <div key={key} className="text-xs font-mono">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="ml-2">{value}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}