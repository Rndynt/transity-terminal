import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { outletsApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import type { Outlet, Stop } from '@/types';

interface OutletFormData {
  stopId: string;
  name: string;
  address: string;
  phone: string;
  printerProfileId: string;
}

export default function OutletsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState<OutletFormData>({
    stopId: '',
    name: '',
    address: '',
    phone: '',
    printerProfileId: ''
  });
  const { toast } = useToast();

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['/api/outlets'],
    queryFn: outletsApi.getAll
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: outletsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outlets'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Outlet created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create outlet",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => outletsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outlets'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingOutlet(null);
      toast({
        title: "Success",
        description: "Outlet updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update outlet",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: outletsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outlets'] });
      setDeleteTarget(null);
      toast({
        title: "Success",
        description: "Outlet deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete outlet",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      stopId: '',
      name: '',
      address: '',
      phone: '',
      printerProfileId: ''
    });
  };

  const handleCreate = () => {
    setEditingOutlet(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setFormData({
      stopId: outlet.stopId,
      name: outlet.name,
      address: outlet.address || '',
      phone: outlet.phone || '',
      printerProfileId: outlet.printerProfileId || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingOutlet) {
      updateMutation.mutate({ id: editingOutlet.id, data: formData });
    } else {
      createMutation.mutate(formData);
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

  const getStopName = (stopId: string) => {
    const stop = stops.find(s => s.id === stopId);
    return stop ? `${stop.name} (${stop.code})` : 'Unknown Stop';
  };

  return (
    <div className="space-y-6" data-testid="outlets-manager">
      <MasterPageHeader
        title="Outlets Management"
        description="Manage ticket sales outlets and their configurations"
        action={
          <Button onClick={handleCreate} data-testid="add-outlet-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Outlet
          </Button>
        }
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent data-testid="outlet-dialog">
            <DialogHeader>
              <DialogTitle>
                {editingOutlet ? 'Edit Outlet' : 'Add New Outlet'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stopId">Stop *</Label>
                <Select 
                  value={formData.stopId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, stopId: value }))}
                  required
                >
                  <SelectTrigger data-testid="select-stop">
                    <SelectValue placeholder="Select a stop" />
                  </SelectTrigger>
                  <SelectContent>
                    {stops.filter(stop => stop.isOutlet).map(stop => (
                      <SelectItem key={stop.id} value={stop.id}>
                        {stop.name} ({stop.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Outlet Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Jakarta Terminal Outlet"
                  required
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Full address"
                  data-testid="input-address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+62-21-1234567"
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="printerProfileId">Printer Profile ID</Label>
                <Input
                  id="printerProfileId"
                  value={formData.printerProfileId}
                  onChange={(e) => setFormData(prev => ({ ...prev, printerProfileId: e.target.value }))}
                  placeholder="default"
                  data-testid="input-printer"
                />
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
        title="Delete Outlet"
        description="Are you sure you want to delete this outlet? This action cannot be undone."
        isPending={deleteMutation.isPending}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table data-testid="outlets-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Stop</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Printer</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outlets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Belum ada data
                    </TableCell>
                  </TableRow>
                ) : (
                  outlets.map(outlet => (
                    <TableRow key={outlet.id} data-testid={`outlet-row-${outlet.id}`}>
                      <TableCell className="font-medium">{outlet.name}</TableCell>
                      <TableCell>{getStopName(outlet.stopId)}</TableCell>
                      <TableCell>{outlet.address || '-'}</TableCell>
                      <TableCell>{outlet.phone || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {outlet.printerProfileId || 'default'}
                      </TableCell>
                      <TableCell className="overflow-visible">
                        <div className="flex items-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(outlet)}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-primary/10 focus:ring-2 focus:ring-primary"
                                  aria-label={`Edit outlet ${outlet.name}`}
                                  data-testid={`edit-outlet-${outlet.id}`}
                                >
                                  <Pencil className="h-4 w-4 text-primary" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Edit</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Edit outlet</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(outlet.id)}
                                  disabled={deleteMutation.isPending}
                                  className="h-8 w-8 p-0 md:h-auto md:w-auto md:px-3 md:py-2 hover:bg-destructive/10 focus:ring-2 focus:ring-destructive disabled:opacity-50"
                                  aria-label={`Delete outlet ${outlet.name}`}
                                  data-testid={`delete-outlet-${outlet.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only md:not-sr-only md:ml-2">Delete</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="md:hidden">
                                <p>Delete outlet</p>
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
