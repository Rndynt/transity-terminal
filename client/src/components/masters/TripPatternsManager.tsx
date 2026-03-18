import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { tripPatternsApi, layoutsApi, stopsApi, patternStopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, MapPin, Loader2 } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
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
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredPatterns = patterns.filter(pattern => 
    pattern.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pattern.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="trip-patterns-manager">
      <MasterPageHeader
        title="Trip Patterns Management"
        description="Manage route patterns and stop sequences"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari pattern..."
        count={filteredPatterns.length}
        action={
          <Button onClick={handleCreate} data-testid="add-pattern-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Trip Pattern
          </Button>
        }
      />
      <MasterFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingPattern ? 'Edit Trip Pattern' : 'Add New Trip Pattern'}
        description={editingPattern ? 'Ubah informasi pola rute perjalanan.' : 'Tambah pola rute perjalanan baru.'}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        data-testid="pattern-dialog"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium">Active pattern</p>
          </div>
          <Switch
            id="active"
            checked={formData.active}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
            data-testid="switch-active"
          />
        </div>
      </MasterFormDialog>

      {/* Pattern Stops Management Dialog */}
      <Dialog open={isStopsDialogOpen} onOpenChange={setIsStopsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0" data-testid="stops-dialog">
          <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
            <DialogTitle>
              Manage Stops - {selectedPatternForStops?.name}
            </DialogTitle>
            <DialogDescription>
              Kelola daftar pemberhentian untuk pola rute ini.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stop Sequence</Label>
              <Button onClick={addPatternStop} size="sm" data-testid="add-pattern-stop">
                <Plus className="h-4 w-4 mr-2" />
                Add Stop
              </Button>
            </div>
            
            <div className="space-y-3">
              {patternStops.map((stop, index) => (
                <div key={index} className="flex flex-col space-y-2 p-3 border rounded-lg bg-card">
                  <div className="flex items-center space-x-2">
                    <div className="w-12 text-center font-mono font-bold text-primary">
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
                      size="icon"
                      variant="ghost"
                      onClick={() => removePatternStop(index)}
                      data-testid={`remove-stop-${index}`}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center space-x-6 ml-14">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`boarding-${index}`}
                        checked={stop.boardingAllowed !== false}
                        onCheckedChange={(checked) => updatePatternStop(index, 'boardingAllowed', checked)}
                        data-testid={`switch-boarding-${index}`}
                      />
                      <Label htmlFor={`boarding-${index}`} className="text-sm font-medium cursor-pointer">
                        Allow Pickup
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`alighting-${index}`}
                        checked={stop.alightingAllowed !== false}
                        onCheckedChange={(checked) => updatePatternStop(index, 'alightingAllowed', checked)}
                        data-testid={`switch-alighting-${index}`}
                      />
                      <Label htmlFor={`alighting-${index}`} className="text-sm font-medium cursor-pointer">
                        Allow Drop
                      </Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 py-4 border-t shrink-0 bg-background flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsStopsDialogOpen(false)}
            >
              Batal
            </Button>
            <Button onClick={savePatternStops} data-testid="save-pattern-stops">
              Simpan
            </Button>
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
                {filteredPatterns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada data'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatterns.map(pattern => (
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
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-secondary/10 focus:ring-2 focus:ring-secondary"
                                  aria-label={`Manage stops for ${pattern.name}`}
                                  data-testid={`manage-stops-${pattern.code}`}
                                >
                                  <MapPin className="h-4 w-4 text-secondary" />
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
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10 focus:ring-2 focus:ring-primary"
                                  aria-label={`Edit pattern ${pattern.name}`}
                                  data-testid={`edit-pattern-${pattern.code}`}
                                >
                                  <Pencil className="h-4 w-4 text-primary" />
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
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-destructive/10 focus:ring-2 focus:ring-destructive disabled:opacity-50"
                                  aria-label={`Delete pattern ${pattern.name}`}
                                  data-testid={`delete-pattern-${pattern.code}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
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
