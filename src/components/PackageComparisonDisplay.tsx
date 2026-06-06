import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  description: string;
  tier: 'basic' | 'standard' | 'premium';
  serviceIds: string[];
  discountPercent: number;
  price: number;
}

interface Service {
  id: string;
  name: string;
}

interface PackageComparisonDisplayProps {
  packages: Package[];
  services: Service[];
  onSelectPackage?: (pkg: Package) => void;
}

export default function PackageComparisonDisplay({ packages, services, onSelectPackage }: PackageComparisonDisplayProps) {
  const sortedPackages = [...packages].sort((a, b) => {
    const order = { basic: 1, standard: 2, premium: 3 };
    return order[a.tier] - order[b.tier];
  });

  const getTierColor = (tier: string) => {
    const colors = {
      basic: 'border-blue-200 bg-blue-50',
      standard: 'border-purple-300 bg-purple-50 shadow-lg scale-105',
      premium: 'border-amber-300 bg-amber-50'
    };
    return colors[tier as keyof typeof colors] || colors.basic;
  };

  const getTierBadge = (tier: string) => {
    const badges = {
      basic: <Badge className="bg-blue-600">Basic</Badge>,
      standard: <Badge className="bg-purple-600">Most Popular</Badge>,
      premium: <Badge className="bg-amber-600">Premium</Badge>
    };
    return badges[tier as keyof typeof badges];
  };

  if (packages.length === 0) return null;

  return (
    <div className="py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Service Packages</h2>
        <p className="text-muted-foreground">Choose the package that best fits your needs</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {sortedPackages.map(pkg => {
          const includedServices = services.filter(s => pkg.serviceIds?.includes(s.id));
          return (
            <Card key={pkg.id} className={`relative ${getTierColor(pkg.tier)}`}>
              {pkg.tier === 'standard' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-purple-600 text-white">
                    <Star className="w-3 h-3 mr-1" />
                    Recommended
                  </Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                  {getTierBadge(pkg.tier)}
                </div>
                <CardDescription>{pkg.description}</CardDescription>
                <div className="mt-4">
                  <div className="text-4xl font-bold">${pkg.price?.toFixed(2)}</div>
                  <Badge variant="secondary" className="mt-2">Save {pkg.discountPercent}%</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="font-semibold text-sm">Included Services:</p>
                  {includedServices.map(service => (
                    <div key={service.id} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{service.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={pkg.tier === 'standard' ? 'default' : 'outline'}
                  onClick={() => onSelectPackage?.(pkg)}
                >
                  Select Package
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
