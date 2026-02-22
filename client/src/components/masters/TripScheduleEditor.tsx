import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { tripsApi, tripStopTimesApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import type { Trip, TripStopTimeWithEffectiveFlags } from '@shared/schema';

/**
 * Convert UTC timestamp to local datetime string for datetime-local input
 * This ensures the input displays the correct local time (e.g., 08:00 WIB instead of 01:00 UTC)
 */
function utcToLocalDatetime(utcTimestamp: string | Date | null): string {
  if (!utcTimestamp) return '';
  
  const date = new Date(utcTimestamp);
  // Format in Asia/Jakarta timezone (WIB = UTC+7)
  const year = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' });
  const month = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', month: '2-digit' });
  const day = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', day: '2-digit' });
  const hours = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false });
  const minutes = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', minute: '2-digit' });
  
  // Pad with zeros if needed
  const padHours = hours.padStart(2, '0');
  const padMinutes = minutes.padStart(2, '0');
  
  return `${year}-${month}-${day}T${padHours}:${padMinutes}`;
}

/**
 * Format UTC timestamp to display time in Asia/Jakarta timezone
 */
function formatTimeWIB(utcTimestamp: string | Date | null): string {
  if (!utcTimestamp) return '--:--';
  
  const date = new Date(utcTimestamp);
  return date.toLocaleTimeString('id-ID', { 
    timeZone: 'Asia/Jakarta', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

/**
 * Format UTC timestamp to display full date and time in Asia/Jakarta timezone
 */
function formatDateTimeWIB(utcTimestamp: string | Date | null): string {
  if (!utcTimestamp) return '--';
  
  const date = new Date(utcTimestamp);
  return date.toLocaleString('id-ID', { 
    timeZone: 'Asia/Jakarta', 
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

interface TripScheduleEditorProps {
  trip: Trip;
  onClose: () => void;
}

interface StopTimeFormData {
  id?: string;
  stopId: string;
  stopSequence: number;
  arriveAt: string;
  departAt: string;
  dwellSeconds: number;
  boardingAllowed?: boolean | null;
  alightingAllowed?: boolean | null;
}

export default function TripScheduleEditor({ trip, onClose }: TripScheduleEditorProps) {
  const [stopTimes, setStopTimes] = useState<StopTimeFormData[]>([]);
  const [hasBookings, setHasBookings] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [backendErrors, setBackendErrors] = useState<Array<{ stopSequence: number; field: string; message: string }>>([]);
  const { toast } = useToast();

  // Fetch stop times with effective flags
  const { data: stopTimesData = [], isLoading } = useQuery({
    queryKey: ['/api/trips', trip.id, 'stop-times', 'effective'],
    queryFn: () => tripsApi.getStopTimesWithEffectiveFlags(trip.id)
  });

  // Check if trip has bookings
  const { data: bookingsCheck = { hasBookings: false } } = useQuery({
    queryKey: ['/api/trips', trip.id, 'has-bookings'],
    queryFn: async () => {
      // Check if trip has any bookings via the bookings API
      const response = await fetch(`/api/bookings?tripId=${trip.id}`);
      const bookings = await response.json();
      return { hasBookings: bookings && bookings.length > 0 };
    }
  });

  const bulkUpsertMutation = useMutation({
    mutationFn: async (data: { tripId: string; stopTimes: any[]; precompute?: boolean }) => {
      const url = `/api/trips/${data.tripId}/stop-times/bulk-upsert${data.precompute ? '?precompute=true' : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.stopTimes)
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        // Create error object with response data for proper handling
        const error = new Error(`HTTP ${response.status}`);
        (error as any).responseData = responseData;
        throw error;
      }
      
      return responseData;
    },
    onSuccess: (data, variables) => {
      // Clear backend errors on success
      setBackendErrors([]);
      
      // Invalidate all related queries with consistent key pattern
      queryClient.invalidateQueries({ queryKey: ['/api/trips', trip.id, 'stop-times'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips', trip.id, 'stop-times', 'effective'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] }); // Refresh trip list
      
      const message = variables.precompute 
        ? "Schedule saved and inventory precomputed successfully"
        : "Schedule updated successfully";
      
      toast({
        title: "Success",
        description: message
      });
    },
    onError: (error: any) => {
      setBackendErrors([]);
      
      // Check if this is a backend validation error with detailed errors
      if (error.responseData?.code === 'invalid-stop-times' && error.responseData?.errors) {
        setBackendErrors(error.responseData.errors);
        toast({
          title: "Validation Error",
          description: "Please fix the highlighted issues with stop times",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error", 
          description: error.responseData?.error || error.message || "Failed to update schedule",
          variant: "destructive"
        });
      }
    }
  });

  const deriveLegsMutation = useMutation({
    mutationFn: tripsApi.deriveLegs,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Trip legs derived successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to derive trip legs",
        variant: "destructive"
      });
    }
  });

  const precomputeSeatInventoryMutation = useMutation({
    mutationFn: tripsApi.precomputeSeatInventory,
    onSuccess: () => {
      toast({
        title: "Success", 
        description: "Seat inventory precomputed successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to precompute seat inventory",
        variant: "destructive"
      });
    }
  });

  // Initialize form data when stop times are loaded
  useEffect(() => {
    if (stopTimesData.length > 0) {
      const formData = stopTimesData
        .sort((a: TripStopTimeWithEffectiveFlags, b: TripStopTimeWithEffectiveFlags) => a.stopSequence - b.stopSequence)
        .map((st: TripStopTimeWithEffectiveFlags) => ({
          id: st.id,
          stopId: st.stopId,
          stopSequence: st.stopSequence,
          // Convert UTC timestamps to local datetime (Asia/Jakarta) for datetime-local inputs
          // This ensures the input displays the correct local time (e.g., 08:00 WIB instead of 01:00 UTC)
          arriveAt: utcToLocalDatetime(st.arriveAt),
          departAt: utcToLocalDatetime(st.departAt),
          dwellSeconds: st.dwellSeconds || 0,
          boardingAllowed: st.boardingAllowed,
          alightingAllowed: st.alightingAllowed
        }));
      setStopTimes(formData);
    }
  }, [stopTimesData]);

  useEffect(() => {
    if (bookingsCheck) {
      setHasBookings(bookingsCheck.hasBookings || false);
    }
  }, [bookingsCheck]);

  // Auto-validate whenever stop times change to enable/disable buttons
  useEffect(() => {
    if (stopTimes.length > 0) {
      validateTimes();
      // Clear backend errors when form changes
      setBackendErrors([]);
    }
  }, [stopTimes]);

  // Validate chronological order and required fields
  const validateTimes = () => {
    const errors: string[] = [];
    let previousDepartTime: Date | null = null;

    for (let i = 0; i < stopTimes.length; i++) {
      const stopTime = stopTimes[i];
      const arriveTime = stopTime.arriveAt ? new Date(stopTime.arriveAt) : null;
      const departTime = stopTime.departAt ? new Date(stopTime.departAt) : null;
      const isFirst = i === 0;
      const isLast = i === stopTimes.length - 1;

      // Required field validation
      if (isFirst && !stopTime.departAt) {
        errors.push(`Stop ${i + 1}: Departure time is required for first stop`);
      }
      if (isLast && !stopTime.arriveAt) {
        errors.push(`Stop ${i + 1}: Arrival time is required for last stop`);
      }

      // Check chronological order with previous stop
      if (previousDepartTime && arriveTime && arriveTime < previousDepartTime) {
        errors.push(`Stop ${i + 1}: Arrival time must be after previous departure`);
      }

      // Check departure after arrival at same stop
      if (arriveTime && departTime && departTime < arriveTime) {
        errors.push(`Stop ${i + 1}: Departure must be after arrival`);
      }

      previousDepartTime = departTime || arriveTime || null;
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const updateStopTime = (index: number, field: keyof StopTimeFormData, value: any) => {
    setStopTimes(prev => prev.map((stop, i) => 
      i === index ? { ...stop, [field]: value } : stop
    ));
  };

  const calculateLegDuration = (index: number): string | null => {
    if (index >= stopTimes.length - 1) return null;
    
    const currentStop = stopTimes[index];
    const nextStop = stopTimes[index + 1];
    
    const currentDepart = currentStop.departAt || currentStop.arriveAt;
    const nextArrive = nextStop.arriveAt;
    
    if (!currentDepart || !nextArrive) return null;
    
    const departTime = new Date(currentDepart);
    const arriveTime = new Date(nextArrive);
    const durationMs = arriveTime.getTime() - departTime.getTime();
    
    if (durationMs < 0) return "Invalid";
    
    const durationMin = Math.round(durationMs / (1000 * 60));
    const hours = Math.floor(durationMin / 60);
    const minutes = durationMin % 60;
    
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const handleSave = (precompute = false) => {
    if (!validateTimes()) return;

    const bulkData = stopTimes.map(st => ({
      stopId: st.stopId,
      stopSequence: st.stopSequence,
      arriveAt: st.arriveAt ? new Date(st.arriveAt) : null,
      departAt: st.departAt ? new Date(st.departAt) : null,
      dwellSeconds: st.dwellSeconds,
      boardingAllowed: st.boardingAllowed,
      alightingAllowed: st.alightingAllowed
    }));

    bulkUpsertMutation.mutate({
      tripId: trip.id,
      stopTimes: bulkData,
      precompute
    });
  };

  const handleSaveAndBuild = () => {
    handleSave(true);
  };

  const getStopInfo = (stopId: string) => {
    const stopTimeData = stopTimesData.find((st: TripStopTimeWithEffectiveFlags) => st.stopId === stopId);
    return {
      name: stopTimeData?.stopName || 'Unknown Stop',
      code: stopTimeData?.stopCode || '',
      effectiveBoardingAllowed: stopTimeData?.effectiveBoardingAllowed ?? true,
      effectiveAlightingAllowed: stopTimeData?.effectiveAlightingAllowed ?? true
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="trip-schedule-editor">
      {hasBookings && (
        <Alert>
          <AlertDescription>
            This trip has active bookings. Only time edits are allowed - stop reordering is disabled.
          </AlertDescription>
        </Alert>
      )}

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="font-medium mb-2">Frontend Validation Errors:</div>
            <ul className="list-disc list-inside">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {backendErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="font-medium mb-2">Validation Errors:</div>
            <ul className="list-disc list-inside">
              {backendErrors.map((error, i) => (
                <li key={i}>
                  <Badge variant="outline" className="mr-2">
                    Stop #{error.stopSequence}
                  </Badge>
                  {error.field}: {error.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stop Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stopTimes.map((stopTime, index) => {
            const stopInfo = getStopInfo(stopTime.stopId);
            const legDuration = calculateLegDuration(index);
            const isFirst = index === 0;
            const isLast = index === stopTimes.length - 1;

            return (
              <div key={`${stopTime.stopId}-${index}`} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">
                      {stopTime.stopSequence}. {stopInfo.name} 
                      <span className="text-muted-foreground ml-2">({stopInfo.code})</span>
                    </h4>
                    <div className="flex items-center space-x-2 mt-1">
                      {stopInfo.effectiveBoardingAllowed && (
                        <Badge variant="outline" className="text-xs">Pickup</Badge>
                      )}
                      {stopInfo.effectiveAlightingAllowed && (
                        <Badge variant="outline" className="text-xs">Drop</Badge>
                      )}
                    </div>
                  </div>
                  {legDuration && (
                    <div className="text-sm text-muted-foreground">
                      Next leg: {legDuration}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {!isFirst && (
                    <div className="space-y-2">
                      <Label>Arrival Time</Label>
                      <Input
                        type="datetime-local"
                        value={stopTime.arriveAt}
                        onChange={(e) => updateStopTime(index, 'arriveAt', e.target.value)}
                        data-testid={`arrive-time-${index}`}
                      />
                    </div>
                  )}
                  
                  {!isLast && (
                    <div className="space-y-2">
                      <Label>Departure Time {isFirst && '*'}</Label>
                      <Input
                        type="datetime-local"
                        value={stopTime.departAt}
                        onChange={(e) => updateStopTime(index, 'departAt', e.target.value)}
                        required={isFirst}
                        data-testid={`depart-time-${index}`}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Dwell (seconds)</Label>
                    <Input
                      type="number"
                      value={stopTime.dwellSeconds}
                      onChange={(e) => updateStopTime(index, 'dwellSeconds', parseInt(e.target.value) || 0)}
                      min="0"
                      data-testid={`dwell-${index}`}
                    />
                  </div>
                </div>

                {/* Override flags section */}
                <div className="border-t pt-3">
                  <Label className="text-sm text-muted-foreground">Override Pattern Rules (optional)</Label>
                  <div className="flex items-center space-x-6 mt-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`boarding-override-${index}`}
                        checked={stopTime.boardingAllowed === true}
                        onChange={(e) => updateStopTime(index, 'boardingAllowed', e.target.checked ? true : null)}
                        className="rounded border-input"
                        data-testid={`boarding-override-${index}`}
                      />
                      <label htmlFor={`boarding-override-${index}`} className="text-sm">
                        Override: Allow Pickup
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`alighting-override-${index}`}
                        checked={stopTime.alightingAllowed === true}
                        onChange={(e) => updateStopTime(index, 'alightingAllowed', e.target.checked ? true : null)}
                        className="rounded border-input"
                        data-testid={`alighting-override-${index}`}
                      />
                      <label htmlFor={`alighting-override-${index}`} className="text-sm">
                        Override: Allow Drop
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => deriveLegsMutation.mutate(trip.id)}
            disabled={deriveLegsMutation.isPending || validationErrors.length > 0}
            title="Derive legs from current schedule (requires valid times)"
            data-testid="derive-legs-button"
          >
            <i className="fas fa-route mr-2"></i>
            Derive Legs
          </Button>
          <Button
            variant="outline" 
            onClick={() => precomputeSeatInventoryMutation.mutate(trip.id)}
            disabled={precomputeSeatInventoryMutation.isPending}
            title="Precompute seat inventory (requires legs to exist)"
            data-testid="precompute-inventory-button"
          >
            <i className="fas fa-th-large mr-2"></i>
            Precompute Inventory
          </Button>
        </div>
        
        <div className="space-x-2">
          <Button variant="outline" onClick={onClose} data-testid="close-button">
            Close
          </Button>
          <Button 
            onClick={() => handleSave(false)}
            disabled={bulkUpsertMutation.isPending || validationErrors.length > 0}
            variant="outline"
            data-testid="save-schedule-button"
          >
            {bulkUpsertMutation.isPending ? 'Saving...' : 'Save Schedule'}
          </Button>
          <Button 
            onClick={handleSaveAndBuild}
            disabled={bulkUpsertMutation.isPending || validationErrors.length > 0}
            data-testid="save-and-build-button"
          >
            {bulkUpsertMutation.isPending ? 'Building...' : 'Save & Build (Legs + Inventory)'}
          </Button>
        </div>
      </div>
    </div>
  );
}