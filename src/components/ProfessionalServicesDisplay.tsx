import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Clock } from 'lucide-react';

interface Service {
  id: string;
  service_name: string;
  description?: string;
  price: number;
  price_type: 'fixed' | 'hourly' | 'starting_at';
  duration_minutes?: number;
  is_active: boolean;
}

interface ProfessionalServicesDisplayProps {
  services: Service[];
}

const ProfessionalServicesDisplay = ({ services }: ProfessionalServicesDisplayProps) => {
  const activeServices = services.filter(s => s.is_active);

  if (activeServices.length === 0) {
    return null;
  }

  const formatPrice = (price: number, type: string) => {
    const formatted = `$${price.toFixed(2)}`;
    if (type === 'hourly') return `${formatted}/hr`;
    if (type === 'starting_at') return `From ${formatted}`;
    return formatted;
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Services & Pricing</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeServices.map((service) => (
            <div key={service.id} className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-semibold text-gray-900">{service.service_name}</h4>
                <Badge variant="secondary" className="ml-2">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {formatPrice(service.price, service.price_type)}
                </Badge>
              </div>
              {service.description && (
                <p className="text-sm text-gray-600 mb-1">{service.description}</p>
              )}
              {service.duration_minutes && (
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="h-3 w-3 mr-1" />
                  {service.duration_minutes} minutes
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfessionalServicesDisplay;
