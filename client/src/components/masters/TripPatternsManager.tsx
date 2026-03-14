import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { tripPatternsApi, layoutsApi, stopsApi, patternStopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import type { TripPattern, Layout, Stop, PatternStop } from '@/types';

interface TripPatternFormData {
  code: string;
  name: string;
  vehicleClass: string;
  defaultLayoutId: string;
  active: boolean;
  tags: string;
}

interface StopSequenceItem {
  stopId: string;
  stopSequence: number;
  dwellSeconds: number;
  boardingAllowed?: boolean;
  alightingAllowed?: boolean;
}

export default function TripPatternsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStopsDialogOpen, setIsStopsDialogOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<TripPattern | null>(null);
  const [selectedPatternForStops, setSelectedPatternForStops] = useState<TripPattern | null>(null);
  const [formData, setFormData] = useState<TripPatternFormData>({
    code: '',
    name: '',
    vehicleClass: '',
    defaultLayoutId: '',
    active: true,
    tags: ''
  });
  const [patternStops, setPatternStops] = useState<StopSequenceItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll
  });

  const { data: layouts = [] } = useQuery({
    queryKey: ['/api/layouts'],
    queryFn: layoutsApi.getAll
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: tripPatternsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Trip pattern created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create trip pattern",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tripPatternsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingPattern(null);
      toast({
        title: "Success",
        description: "Trip pattern updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update trip pattern",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: tripPatternsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns'] });
      setDeleteTarget(null);
      toast({
        title: "Success",
        description: "Trip pattern deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete trip pattern",
        variant: "destructive"
      });
    }
  });

  const createPatternStopMutation = useMutation({
    mutationFn: patternStopsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns', selectedPatternForStops?.id, 'stops'] });
      toast({
        title: "Success",
        description: "Pattern stop added successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add pattern stop",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      vehicleClass: '',
      defaultLayoutId: '',
      active: true,
      tags: ''
    });
  };

  const handleCreate = () => {
    setEditingPattern(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (pattern: TripPattern) => {
    setEditingPattern(pattern);
    setFormData({
      code: pattern.code,
      name: pattern.name,
      vehicleClass: pattern.vehicleClass || '',
      defaultLayoutId: pattern.defaultLayoutId || '',
      active: pattern.active !== false,
      tags: pattern.tags ? pattern.tags.join(', ') : ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
    };

    if (editingPattern) {
      updateMutation.mutate({ id: editingPattern.id, data: submitData });
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

  const getLayoutName = (layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId);
    return layout ? layout.name : 'None';
  };

  const handleManageStops = (pattern: TripPattern) => {
    setSelectedPatternForStops(pattern);
    setIsStopsDialogOpen(true);
    // Load existing pattern stops
    tripPatternsApi.getStops(pattern.id).then(stops => {
      const stopItems = stops.map(stop => ({
        stopId: stop.stopId,
        stopSequence: stop.stopSequence,
        dwellSeconds: stop.dwellSeconds || 0,
        boardingAllowed: stop.boardingAllowed,
        alightingAllowed: stop.alightingAllowed
      }));
      setPatternStops(stopItems);
    });
  };

  const addPatternStop = () => {
    const nextSequence = Math.max(0, ...patternStops.map(s => s.stopSequence)) + 1;
    setPatternStops(prev => [...prev, {
      stopId: '',
      stopSequence: nextSequence,
      dwellSeconds: 0,
      boardingAllowed: true,
      alightingAllowed: true
    }]);
  };

  const removePatternStop = (index: number) => {
    setPatternStops(prev => prev.filter((_, i) => i !== index));
  };

  const updatePatternStop = (index: number, field: keyof StopSequenceItem, value: any) => {
    setPatternStops(prev => prev.map((stop, i) => 
      i === index ? { ...stop, [field]: value } : stop
    ));
  };

  const savePatternStops = async () => {
    if (!selectedPatternForStops) return;

    try {
      // Use atomic bulk replace to avoid duplication issues
      const validStops = patternStops.filter(stop => stop.stopId).map(stop => ({
        patternId: selectedPatternForStops.id,
        stopId: stop.stopId,
        stopSequence: stop.stopSequence,
        dwellSeconds: stop.dwellSeconds,
        boardingAllowed: stop.boardingAllowed !== false,
        alightingAllowed: stop.alightingAllowed !== false
      }));
      
      await patternStopsApi.bulkReplace(selectedPatternForStops.id, validStops);
      
      // Invalidate cache for pattern stops and related trip stop times effective flags
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns', selectedPatternForStops.id, 'stops'] });
      
      // CRITICAL: Invalidate all trips' effective stop times since pattern changed
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] }); // Invalidate all trips
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          // Invalidate any query that includes 'stop-times' and 'effective' 
          const key = query.queryKey as string[];
          return key.includes('stop-times') && key.includes('effective');
        }
      });
      
      setIsStopsDialogOpen(false);
      setPatternStops([]);
      toast({
        title: "Success",
        description: "Pattern stops saved successfully - all affected trips will be refreshed"
      });
    } catch (error) {
      console.error('Error saving pattern stops:', error);
      
      let errorMessage = "Failed to save pattern stops";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = error.message as string;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const getStopName = (stopId: string) => {
    const stop = stops.find(s => s.id === stopId);
    return stop ? `${stop.name} (${stop.code})` : 'Select Stop';
  };

  return (
    <div className="space-y-6" data-testid="trip-patterns-manager">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Trip Patterns Management</h3>
          <p className="text-sm text-muted-foreground">Manage route patterns and stop sequences</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} data-testid="add-pattern-button">
              <Plus className="h-4 w-4 mr-2" />
              Add Trip Pattern
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="pattern-dialog">
            <DialogHeader>
              <DialogTitle>
                {editingPattern ? 'Edit Trip Pattern' : 'Add New Trip Pattern'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Pattern Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g., AB_via_C"
                    required
                    data-testid="input-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Pattern Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Jakarta to Bandung via Purwakarta"
                    required
                    data-testid="input-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleClass">Vehicle Class</Label>
                <Input
                  id="vehicleClass"
                  value={formData.vehicleClass}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleClass: e.target.value }))}
                  placeholder="e.g., standard, executive"
                  data-testid="input-vehicle-class"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultLayoutId">Default Layout</Label>
                <Select 
                  value={formData.defaultLayoutId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, defaultLayoutId: value }))}
                >
                  <SelectTrigger data-testid="select-layout">
                    <SelectValue placeholder="Select default layout" />
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

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="e.g., intercity, express, overnight"
                  data-testid="input-tags"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                  data-testid="switch-active"
                />
                <Label htmlFor="active">Active pattern</Label>
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
      </div>

      {/* Pattern Stops Management Dialog */}
      <Dialog open={isStopsDialogOpen} onOpenChange={setIsStopsDialogOpen}>
        <DialogContent className="max-w-3xl" data-testid="stops-dialog">
          <DialogHeader>
            <DialogTitle>
              Manage Stops - {selectedPatternForStops?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Stop Sequence</Label>
              <Button onClick={addPatternStop} size="sm" data-testid="add-pattern-stop">
                <Plus className="h-4 w-4 mr-2" />
                Add Stop
              </Button>
            </div>
            
            {patternStops.map((stop, index) => (
              <div key={index} className="flex flex-col space-y-2 p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-12 text-center font-mono font-bold">
                    {stop.stopSequence}
                  </div>
                  <div className="flex-1">
                    <Select 
                      value={stop.stopId} 
                      onValueChange={(value) => updatePatternStop(index, 'stopId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stop" />
                      </SelectTrigger>
                      <SelectContent>
                        {stops.map(stopOption => (
                          <SelectItem key={stopOption.id} value={stopOption.id}>
                            {stopOption.name} ({stopOption.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      value={stop.dwellSeconds}
                      onChange={(e) => updatePatternStop(index, 'dwellSeconds', parseInt(e.target.value, 10) || 0)}
                      placeholder="Dwell (sec)"
                      min="0"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removePatternStop(index)}
                    data-testid={`remove-stop-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center space-x-6 ml-14">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`boarding-${index}`}
                      checked={stop.boardingAllowed !== false}
                      onChange={(e) => updatePatternStop(index, 'boardingAllowed', e.target.checked)}
                      className="rounded border-input"
                      data-testid={`checkbox-boarding-${index}`}
                    />
                    <label htmlFor={`boarding-${index}`} className="text-sm font-medium">
                      Allow Pickup (Boarding)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`alighting-${index}`}
                      checked={stop.alightingAllowed !== false}
                      onChange={(e) => updatePatternStop(index, 'alightingAllowed', e.target.checked)}
                      className="rounded border-input"
                      data-testid={`checkbox-alighting-${index}`}
                    />
                    <label htmlFor={`alighting-${index}`} className="text-sm font-medium">
                      Allow Drop (Alighting)
                    </label>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsStopsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={savePatternStops} data-testid="save-pattern-stops">
                Save Stops
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Delete Trip Pattern"
        description="Are you sure you want to delete this trip pattern? This action cannot be undone."
        isPending={deleteMutation.isPending}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table data-testid="patterns-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Vehicle Class</TableHead>
                  <TableHead>Default Layout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No trip patterns found. Create your first pattern to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  patterns.map(pattern => (
                    <TableRow key={pattern.id} data-testid={`pattern-row-${pattern.code}`}>
                      <TableCell className="font-mono font-medium">{pattern.code}</TableCell>
                      <TableCell>{pattern.name}</TableCell>
                      <TableCell>{pattern.vehicleClass || '-'}</TableCell>
                      <TableCell>{getLayoutName(pattern.defaultLayoutId || '')}</TableCell>
                      <TableCell>
                        {pattern.active ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {pattern.tags?.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="overflow-visible">
                        <div className="flex items-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleManageStops(pattern)}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-secondary/10 focus:ring-2 focus:ring-secondary"
                                  aria-label={`Manage stops for ${pattern.name}`}
                                  data-testid={`manage-stops-${pattern.code}`}
                                >
                                  <MapPin className="h-4 w-4 text-secondary" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Manage</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Manage stops</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(pattern)}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-primary/10 focus:ring-2 focus:ring-primary"
                                  aria-label={`Edit pattern ${pattern.name}`}
                                  data-testid={`edit-pattern-${pattern.code}`}
                                >
                                  <Edit className="h-4 w-4 text-primary" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Edit</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Edit pattern</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(pattern.id)}
                                  disabled={deleteMutation.isPending}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-destructive/10 focus:ring-2 focus:ring-destructive disabled:opacity-50"
                                  aria-label={`Delete pattern ${pattern.name}`}
                                  data-testid={`delete-pattern-${pattern.code}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Delete</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Delete pattern</p>
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
    </div>
  );
}
