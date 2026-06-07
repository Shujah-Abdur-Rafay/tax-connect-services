import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { GripVertical, Plus, Edit, Trash2, DollarSign, Search, Tag } from 'lucide-react';
import { ServiceFormModal } from './ServiceFormModal';
import { BulkPricingModal } from './BulkPricingModal';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  enabled: boolean;
  order: number;
}

export const ServiceManagementDashboard = ({ professionalId }: { professionalId: string }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const { toast } = useToast();

  const categories = ['Tax Preparation', 'Business Services', 'Financial Services', 'Consulting', 'Other'];

  useEffect(() => {
    fetchServices();
  }, [professionalId]);

  useEffect(() => {
    filterServices();
  }, [services, searchTerm, selectedCategory]);

  const fetchServices = async () => {
    if (!db || !professionalId) return;
    try {
      const snap = await getDoc(doc(db, 'professionals', professionalId));
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      // The pro's structured service list lives on their professionals/{uid}
      // doc as a `services` array. Older docs may store a plain string[] of
      // service names, so guard against the legacy shape.
      const raw = data?.services;
      setServices(
        Array.isArray(raw) && raw.every((s) => s && typeof s === 'object')
          ? (raw as Service[])
          : [],
      );
    } catch (error) {
      console.error('[ServiceManagementDashboard] load failed:', error);
      toast({ title: 'Error', description: 'Failed to load services', variant: 'destructive' });
    }
  };

  const filterServices = () => {
    let filtered = [...services];
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }
    
    setFilteredServices(filtered.sort((a, b) => a.order - b.order));
  };

  const saveServices = async (updatedServices: Service[]) => {
    if (!db || !professionalId) return false;
    try {
      await updateDoc(doc(db, 'professionals', professionalId), {
        services: updatedServices,
        updated_at: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ServiceManagementDashboard] save failed:', error);
      toast({ title: 'Error', description: 'Failed to save services', variant: 'destructive' });
      return false;
    }

    setServices(updatedServices);
    toast({ title: 'Success', description: 'Services updated successfully' });
    return true;
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(filteredServices);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reordered = items.map((item, index) => ({ ...item, order: index }));
    saveServices(reordered);
  };

  const handleToggleEnabled = async (serviceId: string) => {
    const updated = services.map(s => 
      s.id === serviceId ? { ...s, enabled: !s.enabled } : s
    );
    saveServices(updated);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    const updated = services.filter(s => s.id !== serviceId);
    saveServices(updated);
  };

  const handleSaveService = (service: Service) => {
    if (editingService) {
      const updated = services.map(s => s.id === service.id ? service : s);
      saveServices(updated);
    } else {
      saveServices([...services, { ...service, id: Date.now().toString(), order: services.length }]);
    }
    setShowServiceModal(false);
    setEditingService(null);
  };

  const handleBulkPricing = (updates: { percentage: number; type: 'increase' | 'decrease' }) => {
    const updated = services.map(s => ({
      ...s,
      price: updates.type === 'increase' 
        ? s.price * (1 + updates.percentage / 100)
        : s.price * (1 - updates.percentage / 100)
    }));
    saveServices(updated);
    setShowBulkModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Service Management</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowBulkModal(true)} variant="outline">
            <DollarSign className="w-4 h-4 mr-2" />
            Bulk Pricing
          </Button>
          <Button onClick={() => { setEditingService(null); setShowServiceModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="services">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {filteredServices.map((service, index) => (
                <Draggable key={service.id} draggableId={service.id} index={index}>
                  {(provided) => (
                    <Card
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div {...provided.dragHandleProps}>
                          <GripVertical className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{service.name}</h3>
                            <Badge variant="outline">{service.category}</Badge>
                            {service.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                          <p className="text-lg font-bold text-green-600 mt-2">${service.price}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{service.enabled ? 'Active' : 'Disabled'}</span>
                            <Switch
                              checked={service.enabled}
                              onCheckedChange={() => handleToggleEnabled(service.id)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingService(service); setShowServiceModal(true); }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(service.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {showServiceModal && (
        <ServiceFormModal
          service={editingService}
          categories={categories}
          onSave={handleSaveService}
          onClose={() => { setShowServiceModal(false); setEditingService(null); }}
        />
      )}

      {showBulkModal && (
        <BulkPricingModal
          onApply={handleBulkPricing}
          onClose={() => setShowBulkModal(false)}
        />
      )}
    </div>
  );
};
