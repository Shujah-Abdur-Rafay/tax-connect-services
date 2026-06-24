import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import PackageFormModal from './PackageFormModal';

interface PackageManagementDashboardProps {
  professionalId: string;
}

export default function PackageManagementDashboard({ professionalId }: PackageManagementDashboardProps) {
  const [packages, setPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [professionalId]);

  const loadData = async () => {
    const { data: prof } = await supabase
      .from('professionals')
      .select('services, packages')
      .eq('id', professionalId)
      .single();

    if (prof) {
      setServices(prof.services || []);
      setPackages(prof.packages || []);
    }
  };

  const savePackages = async (updatedPackages: any[]) => {
    const { error } = await supabase
      .from('professionals')
      .update({ packages: updatedPackages })
      .eq('id', professionalId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to save packages', variant: 'destructive' });
    } else {
      setPackages(updatedPackages);
      toast({ title: 'Success', description: 'Packages updated successfully' });
    }
  };

  const handleSavePackage = (pkg: any) => {
    const updated = editingPackage
      ? packages.map(p => p.id === pkg.id ? pkg : p)
      : [...packages, pkg];
    savePackages(updated);
    setEditingPackage(null);
  };

  const handleDelete = (id: string) => {
    savePackages(packages.filter(p => p.id !== id));
  };

  const getTierColor = (tier: string) => {
    const colors = { basic: 'bg-blue-100 text-blue-800', standard: 'bg-purple-100 text-purple-800', premium: 'bg-amber-100 text-amber-800' };
    return colors[tier as keyof typeof colors] || colors.basic;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Service Packages</h2>
        <Button onClick={() => { setEditingPackage(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Create Package
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(pkg => (
          <Card key={pkg.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  <Badge className={`mt-2 ${getTierColor(pkg.tier)}`}>{pkg.tier.toUpperCase()}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingPackage(pkg); setIsModalOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(pkg.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{pkg.description}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{pkg.serviceIds?.length || 0} services</span>
                </div>
                <div className="text-2xl font-bold text-primary">${pkg.price?.toFixed(2)}</div>
                <Badge variant="secondary">{pkg.discountPercent}% discount</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {packages.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No packages created yet. Create your first package to bundle services.</p>
          </CardContent>
        </Card>
      )}

      <PackageFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPackage(null); }}
        onSave={handleSavePackage}
        services={services}
        editingPackage={editingPackage}
      />
    </div>
  );
}
