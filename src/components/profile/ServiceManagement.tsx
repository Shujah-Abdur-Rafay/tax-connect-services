import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Plus, X, DollarSign, Save, Loader2 } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration?: string;
}

interface ServiceManagementProps {
  professionalEmail: string;
}

export const ServiceManagement: React.FC<ServiceManagementProps> = ({ professionalEmail }) => {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', price: '', duration: '' });

  useEffect(() => {
    loadServices();
  }, [professionalEmail]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-professionals', {
        body: { email: professionalEmail }
      });

      if (error) throw error;
      if (data?.services) setServices(data.services);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addService = () => {
    if (!newService.name || !newService.price) {
      toast({ title: "Error", description: "Name and price are required", variant: "destructive" });
      return;
    }

    const service: Service = {
      id: Date.now().toString(),
      name: newService.name,
      description: newService.description,
      price: parseFloat(newService.price),
      duration: newService.duration
    };

    setServices([...services, service]);
    setNewService({ name: '', description: '', price: '', duration: '' });
  };

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const saveServices = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke('update-professional-profile', {
        body: { email: professionalEmail, services }
      });

      if (error) throw error;

      toast({ title: "Success!", description: "Services updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update services", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Service Offerings & Pricing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {services.map((service) => (
          <div key={service.id} className="flex items-start justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <h4 className="font-semibold">{service.name}</h4>
              <p className="text-sm text-gray-600">{service.description}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">${service.price}</Badge>
                {service.duration && <Badge variant="outline">{service.duration}</Badge>}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeService(service.id)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <div className="border-t pt-4 space-y-4">
          <h4 className="font-semibold">Add New Service</h4>
          <div className="grid gap-4">
            <div>
              <Label>Service Name</Label>
              <Input value={newService.name} onChange={(e) => setNewService({...newService, name: e.target.value})} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newService.description} onChange={(e) => setNewService({...newService, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price ($)</Label>
                <Input type="number" value={newService.price} onChange={(e) => setNewService({...newService, price: e.target.value})} />
              </div>
              <div>
                <Label>Duration (optional)</Label>
                <Input value={newService.duration} onChange={(e) => setNewService({...newService, duration: e.target.value})} placeholder="e.g., 1 hour" />
              </div>
            </div>
            <Button onClick={addService} variant="outline">
              <Plus className="w-4 h-4 mr-2" /> Add Service
            </Button>
          </div>
        </div>

        <Button onClick={saveServices} disabled={isSaving} className="w-full">
          {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save All Changes</>}
        </Button>
      </CardContent>
    </Card>
  );
};
