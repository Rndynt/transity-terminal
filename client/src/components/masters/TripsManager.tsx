import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { tripsApi, tripPatternsApi, vehiclesApi, layoutsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, Clock, Route, Grid3X3 } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import type { Trip, TripPattern, Vehicle, Layout } from '@/types';
import TripScheduleEditor from './TripScheduleEditor';

interface TripFormData {
  patternId: string;
  serviceDate: string;
  vehicleId: string;
  layoutId: string;
  capacity: string;
  status: 'scheduled' | 'canceled' | 'closed';
}

export default function TripsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSchedulingDialogOpen, setIsSchedulingDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [schedulingTrip, setSchedulingTrip] = useState<Trip | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState<TripFormData>({
    patternId: '',
    serviceDate: new Date().toISOString().split('T')[0],
    vehicleId: '',
    layoutId: '',
    capacity: '',
    status: 'scheduled'
  });
  const { toast } = useToast();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['/api/trips'],
    queryFn: () => tripsApi.getAll()
  });

  const { data: patterns = [] } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: vehiclesApi.getAll
  });

  const { data: layouts = [] } = useQuery({
    queryKey: ['/api/layouts'],
    queryFn: layoutsApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: tripsApi.create,
    onSuccess: (createdTrip) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Trip created successfully. Now set up the schedule."
      });
      
      // Immediately open the scheduling dialog for the new trip
      setSchedulingTrip(createdTrip);
      setIsSchedulingDialogOpen(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create trip",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tripsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingTrip(null);
      toast({
        title: "Success",
        description: "Trip updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update trip",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: tripsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setDeleteTarget(null);
      toast({
        title: "Success",
        description: "Trip deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete trip",
        variant: "destructive"
      });
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
        description: error instanceof Error ? error.message : "Failed to derive trip legs",
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
        description: error instanceof Error ? error.message : "Failed to precompute seat inventory",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      patternId: '',
      serviceDate: new Date().toISOString().split('T')[0],
      vehicleId: '',
      layoutId: '',
      capacity: '',
      status: 'scheduled'
    });
  };

  const handleCreate = () => {
    setEditingTrip(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (trip: Trip) => {
    setEditingTrip(trip);
    setFormData({
      patternId: trip.patternId,
      serviceDate: trip.serviceDate,
      vehicleId: trip.vehicleId,
      layoutId: trip.layoutId || '',
      capacity: trip.capacity.toString(),
      status: trip.status || 'scheduled'
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      capacity: parseInt(formData.capacity, 10),
      channelFlags: { CSO: true, WEB: false, APP: false, OTA: false }
    };

    if (editingTrip) {
      updateMutation.mutate({ id: editingTrip.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget);
    }
  };

  const handleDeriveLegs = (tripId: string) => {
    deriveLegsMutation.mutate(tripId);
  };

  const handlePrecomputeInventory = (tripId: string) => {
    precomputeSeatInventoryMutation.mutate(tripId);
  };

  const handleScheduling = (trip: Trip) => {
    setSchedulingTrip(trip);
    setIsSchedulingDialogOpen(true);
  };

  const getPatternName = (patternId: string) => {
    const pattern = patterns.find(p => p.id === patternId);
    return pattern ? `${pattern.name} (${pattern.code})` : 'Unknown Pattern';
  };

  const getScheduleDisplay = (trip: any) => {
    // For now, we'll extract schedule info from the existing scheduleTime field
    // In a real implementation, this would come from the TripWithDetails type
    if (trip.scheduleTime) {
      const departTime = new Date(trip.scheduleTime).toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta'
      });
      return `Departs: ${departTime}`;
    }
    return 'Schedule not set';
  };

  const getPatternPath = (patternId: string) => {
    // This would ideally come from pattern stops data
    // For now, we'll show pattern name as a placeholder
    const pattern = patterns.find(p => p.id === patternId);
    return pattern ? pattern.name : 'Unknown Route';
  };

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.code} (${vehicle.plate})` : 'Unknown Vehicle';
  };

  const getLayoutName = (layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId);
    return layout ? layout.name : 'Default';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Canceled</Badge>;
      case 'closed':
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6" data-testid="trips-manager">
      <MasterPageHeader
        title="Trips Management"
        description="Manage scheduled trips and their configurations"
        action={
          <Button onClick={handleCreate} data-testid="add-trip-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Trip
          </Button>
        }
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent data-testid="trip-dialog">
            <DialogHeader>
              <DialogTitle>
                {editingTrip ? 'Edit Trip' : 'Add New Trip'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patternId">Trip Pattern *</Label>
                <Select 
                  value={formData.patternId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, patternId: value }))}
                  required
                >
                  <SelectTrigger data-testid="select-pattern">
                    <SelectValue placeholder="Select trip pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    {patterns.filter(p => p.active).map(pattern => (
                      <SelectItem key={pattern.id} value={pattern.id}>
                        {pattern.name} ({pattern.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceDate">Service Date *</Label>
                <Input
                  id="serviceDate"
                  type="date"
                  value={formData.serviceDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceDate: e.target.value }))}
                  required
                  data-testid="input-service-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleId">Vehicle *</Label>
                <Select 
                  value={formData.vehicleId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, vehicleId: value }))}
                  required
                >
                  <SelectTrigger data-testid="select-vehicle">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(vehicle => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.code} ({vehicle.plate}) - {vehicle.capacity} seats
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="layoutId">Layout Override</Label>
                <Select 
                  value={formData.layoutId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, layoutId: value }))}
                >
                  <SelectTrigger data-testid="select-layout">
                    <SelectValue placeholder="Use vehicle default layout" />
                  </SelectTrigger>
                  <SelectContent>
                    {layouts.map(layout => (
                      <SelectItem key={layout.id} value={layout.id}>
                        {layout.name} ({layout.rows}x{layout.cols})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                    placeholder="e.g., 40"
                    min="1"
                    required
                    data-testid="input-capacity"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
                    required
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="submit-button"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Delete Trip"
        description="Are you sure you want to delete this trip? This action cannot be undone."
        isPending={deleteMutation.isPending}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table data-testid="trips-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Route & Schedule</TableHead>
                  <TableHead>Service Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Belum ada data
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map(trip => (
                    <TableRow key={trip.id} data-testid={`trip-row-${trip.id}`}>
                      <TableCell className="font-mono text-xs">{trip.id.slice(-8)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{getPatternPath(trip.patternId)}</div>
                          <div className="text-sm text-muted-foreground">
                            {getScheduleDisplay(trip)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{trip.serviceDate}</TableCell>
                      <TableCell>{getVehicleName(trip.vehicleId)}</TableCell>
                      <TableCell>{trip.capacity} seats</TableCell>
                      <TableCell>{getStatusBadge(trip.status || 'scheduled')}</TableCell>
                      <TableCell className="overflow-visible">
                        <div className="flex items-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleScheduling(trip)}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-primary/10 focus:ring-2 focus:ring-primary"
                                  aria-label={`Manage schedule for trip ${trip.id.slice(-8)}`}
                                  data-testid={`scheduling-${trip.id}`}
                                >
                                  <Clock className="h-4 w-4 text-primary" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Schedule</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Manage schedule</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeriveLegs(trip.id)}
                                  disabled={deriveLegsMutation.isPending}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-secondary/10 focus:ring-2 focus:ring-secondary disabled:opacity-50"
                                  aria-label={`Derive legs for trip ${trip.id.slice(-8)}`}
                                  data-testid={`derive-legs-${trip.id}`}
                                >
                                  <Route className="h-4 w-4 text-secondary" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Derive</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Derive legs</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePrecomputeInventory(trip.id)}
                                  disabled={precomputeSeatInventoryMutation.isPending}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-accent/10 focus:ring-2 focus:ring-accent disabled:opacity-50"
                                  aria-label={`Precompute inventory for trip ${trip.id.slice(-8)}`}
                                  data-testid={`precompute-inventory-${trip.id}`}
                                >
                                  <Grid3X3 className="h-4 w-4 text-accent" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Inventory</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Precompute inventory</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(trip)}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-primary/10 focus:ring-2 focus:ring-primary"
                                  aria-label={`Edit trip ${trip.id.slice(-8)}`}
                                  data-testid={`edit-trip-${trip.id}`}
                                >
                                  <Pencil className="h-4 w-4 text-primary" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Edit</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Edit trip</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(trip.id)}
                                  disabled={deleteMutation.isPending}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-destructive/10 focus:ring-2 focus:ring-destructive disabled:opacity-50"
                                  aria-label={`Delete trip ${trip.id.slice(-8)}`}
                                  data-testid={`delete-trip-${trip.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Delete</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Delete trip</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Scheduling Dialog */}
      <Dialog open={isSchedulingDialogOpen} onOpenChange={setIsSchedulingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="scheduling-dialog">
          <DialogHeader>
            <DialogTitle>
              Manage Schedule - {schedulingTrip && getPatternName(schedulingTrip.patternId)}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {schedulingTrip && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Service Date:</span>
                    <span className="ml-2">{schedulingTrip.serviceDate}</span>
                  </div>
                  <div>
                    <span className="font-medium">Vehicle:</span>
                    <span className="ml-2">{getVehicleName(schedulingTrip.vehicleId)}</span>
                  </div>
                  <div>
                    <span className="font-medium">Capacity:</span>
                    <span className="ml-2">{schedulingTrip.capacity} seats</span>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <span className="ml-2">{getStatusBadge(schedulingTrip.status || 'scheduled')}</span>
                  </div>
                </div>
              </div>
            )}

            {schedulingTrip && (
              <TripScheduleEditor 
                trip={schedulingTrip} 
                onClose={() => setIsSchedulingDialogOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
