import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface Service {
  id: string;
  name: string;
  price: number;
}

interface PackageFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pkg: any) => void;
  services: Service[];
  editingPackage?: any;
}

export default function PackageFormModal({ isOpen, onClose, onSave, services, editingPackage }: PackageFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<'basic' | 'standard' | 'premium'>('basic');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState(10);

  useEffect(() => {
    if (editingPackage) {
      setName(editingPackage.name);
      setDescription(editingPackage.description);
      setTier(editingPackage.tier);
      setSelectedServices(editingPackage.serviceIds);
      setDiscountPercent(editingPackage.discountPercent);
    } else {
      setName('');
      setDescription('');
      setTier('basic');
      setSelectedServices([]);
      setDiscountPercent(10);
    }
  }, [editingPackage, isOpen]);

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const calculatePrice = () => {
    const total = services
      .filter(s => selectedServices.includes(s.id))
      .reduce((sum, s) => sum + s.price, 0);
    return total * (1 - discountPercent / 100);
  };

  const handleSave = () => {
    onSave({
      id: editingPackage?.id || Date.now().toString(),
      name,
      description,
      tier,
      serviceIds: selectedServices,
      discountPercent,
      price: calculatePrice(),
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPackage ? 'Edit Package' : 'Create Package'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Package Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tax Essentials Package" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Complete tax preparation for individuals" rows={3} />
          </div>
          <div>
            <Label>Tier</Label>
            <Select value={tier} onValueChange={(v: any) => setTier(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Discount Percentage</Label>
            <Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} min={0} max={50} />
          </div>
          <div>
            <Label>Select Services</Label>
            <div className="space-y-2 mt-2 border rounded-lg p-4 max-h-60 overflow-y-auto">
              {services.map(service => (
                <div key={service.id} className="flex items-center space-x-2">
                  <Checkbox checked={selectedServices.includes(service.id)} onCheckedChange={() => toggleService(service.id)} />
                  <span className="flex-1">{service.name}</span>
                  <Badge variant="secondary">${service.price}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Package Price:</span>
              <span className="text-2xl font-bold text-primary">${calculatePrice().toFixed(2)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {discountPercent}% discount applied
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name || selectedServices.length === 0}>Save Package</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
