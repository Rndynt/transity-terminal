import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import type { Stop } from '@/types';

interface StopFormData {
  code: string;
  name: string;
  city: string;
  lat: string;
  lng: string;
  isOutlet: boolean;
}

export default function StopsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState<StopFormData>({
    code: '',
    name: '',
    city: '',
    lat: '',
    lng: '',
    isOutlet: false
  });
  const { toast } = useToast();

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: stopsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stops'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Stop created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create stop",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => stopsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stops'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingStop(null);
      toast({
        title: "Success",
        description: "Stop updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update stop",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: stopsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stops'] });
      setDeleteTarget(null);
      toast({
        title: "Success",
        description: "Stop deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete stop",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      city: '',
      lat: '',
      lng: '',
      isOutlet: false
    });
  };

  const handleCreate = () => {
    setEditingStop(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (stop: Stop) => {
    setEditingStop(stop);
    setFormData({
      code: stop.code,
      name: stop.name,
      city: stop.city || '',
      lat: stop.lat || '',
      lng: stop.lng || '',
      isOutlet: Boolean(stop.isOutlet)
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      lat: formData.lat ? parseFloat(formData.lat) : null,
      lng: formData.lng ? parseFloat(formData.lng) : null
    };

    if (editingStop) {
      updateMutation.mutate({ id: editingStop.id, data: submitData });
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

  return (
    <div className="space-y-6" data-testid="stops-manager">
      <MasterPageHeader
        title="Stops Management"
        description="Manage bus stops and terminal locations"
        action={
          <Button onClick={handleCreate} data-testid="add-stop-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Stop
          </Button>
        }
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent data-testid="stop-dialog">
            <DialogHeader>
              <DialogTitle>
                {editingStop ? 'Edit Stop' : 'Add New Stop'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g., JKT"
                    required
                    data-testid="input-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Jakarta Terminal"
                    required
                    data-testid="input-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="e.g., Jakarta"
                  data-testid="input-city"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData(prev => ({ ...prev, lat: e.target.value }))}
                    placeholder="e.g., -6.2088"
                    data-testid="input-lat"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData(prev => ({ ...prev, lng: e.target.value }))}
                    placeholder="e.g., 106.8456"
                    data-testid="input-lng"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isOutlet"
                  checked={formData.isOutlet}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOutlet: checked }))}
                  data-testid="switch-outlet"
                />
                <Label htmlFor="isOutlet">This stop is an outlet</Label>
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
        title="Delete Stop"
        description="Are you sure you want to delete this stop? This action cannot be undone."
        isPending={deleteMutation.isPending}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table data-testid="stops-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stops.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Belum ada data
                    </TableCell>
                  </TableRow>
                ) : (
                  stops.map(stop => (
                    <TableRow key={stop.id} data-testid={`stop-row-${stop.code}`}>
                      <TableCell className="font-mono">{stop.code}</TableCell>
                      <TableCell className="font-medium">{stop.name}</TableCell>
                      <TableCell>{stop.city || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {stop.lat && stop.lng ? `${stop.lat}, ${stop.lng}` : '-'}
                      </TableCell>
                      <TableCell>
                        {stop.isOutlet ? (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <XCircle className="h-3 w-3" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="overflow-visible">
                        <div className="flex items-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(stop)}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-primary/10 focus:ring-2 focus:ring-primary"
                                  aria-label={`Edit stop ${stop.name}`}
                                  data-testid={`edit-stop-${stop.code}`}
                                >
                                  <Pencil className="h-4 w-4 text-primary" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Edit</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Edit stop</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(stop.id)}
                                  disabled={deleteMutation.isPending}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-destructive/10 focus:ring-2 focus:ring-destructive disabled:opacity-50"
                                  aria-label={`Delete stop ${stop.name}`}
                                  data-testid={`delete-stop-${stop.code}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Delete</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Delete stop</p>
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
