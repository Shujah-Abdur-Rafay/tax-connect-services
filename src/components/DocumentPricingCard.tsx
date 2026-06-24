import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FileText, DollarSign, Clock, Shield } from 'lucide-react';
import { PaymentForm } from '@/components/PaymentForm';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DocumentService {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  processingTime: string;
  features: string[];
  category: 'tax_forms' | 'business_docs' | 'personal_docs';
}

const documentServices: DocumentService[] = [
  {
    id: 'form_1040',
    name: 'Form 1040 Processing',
    description: 'Individual Income Tax Return preparation and review',
    basePrice: 25.00,
    processingTime: '2-3 business days',
    features: ['Professional review', 'Error checking', 'Digital signature', 'IRS e-filing'],
    category: 'tax_forms'
  },
  {
    id: 'schedule_c',
    name: 'Schedule C Business',
    description: 'Profit or Loss from Business preparation',
    basePrice: 35.00,
    processingTime: '3-5 business days',
    features: ['Business expense categorization', 'Deduction optimization', 'Professional review'],
    category: 'tax_forms'
  },
  {
    id: 'tax_amendment',
    name: 'Tax Amendment (1040X)',
    description: 'Amended tax return preparation and filing',
    basePrice: 75.00,
    processingTime: '5-7 business days',
    features: ['Original return analysis', 'Amendment preparation', 'IRS correspondence'],
    category: 'tax_forms'
  },
  {
    id: 'business_formation',
    name: 'Business Formation Docs',
    description: 'LLC, Corporation, or Partnership documentation',
    basePrice: 150.00,
    processingTime: '7-10 business days',
    features: ['Entity selection guidance', 'State filing', 'Operating agreements'],
    category: 'business_docs'
  }
];

interface DocumentPricingCardProps {
  onServiceSelect?: (service: DocumentService) => void;
}

const DocumentPricingCard: React.FC<DocumentPricingCardProps> = ({ onServiceSelect }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // The service whose Stripe payment dialog is currently open (null = closed).
  const [payingFor, setPayingFor] = useState<DocumentService | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Open the Stripe payment dialog for the chosen document service. The actual
  // charge is created by the Firebase Cloud Function `createTaxProPayment`
  // (via <PaymentForm>) and confirmed with Stripe Elements — no Supabase.
  const handleProcessDocument = (service: DocumentService) => {
    setPayingFor(service);
  };

  const handlePaymentSuccess = () => {
    const service = payingFor;
    setPayingFor(null);
    if (!service) return;
    toast({
      title: 'Payment received',
      description: `Your payment for ${service.name} was successful. We'll begin processing and email you updates.`,
    });
    onServiceSelect?.(service);
  };

  const filteredServices = documentServices.filter(service => 
    selectedCategory === 'all' || service.category === selectedCategory
  );

  const categories = [
    { id: 'all', name: 'All Services' },
    { id: 'tax_forms', name: 'Tax Forms' },
    { id: 'business_docs', name: 'Business Documents' },
    { id: 'personal_docs', name: 'Personal Documents' }
  ];

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Services Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service) => (
          <Card key={service.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {service.category.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{service.description}</p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    ${service.basePrice}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  {service.processingTime}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  Included Features:
                </h4>
                <ul className="text-sm space-y-1">
                  {service.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="w-full"
                onClick={() => handleProcessDocument(service)}
              >
                Start Processing
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No services found for the selected category.
        </div>
      )}

      {/* Pricing Note */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Usage-Based Pricing</h3>
              <p className="text-sm text-blue-700 mt-1">
                Document processing fees are charged per service. Premium and Enterprise members receive discounted rates and priority processing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe payment dialog — charges the document processing fee via Stripe. */}
      <Dialog open={!!payingFor} onOpenChange={(open) => !open && setPayingFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay for {payingFor?.name}</DialogTitle>
            <DialogDescription>
              Secure payment processed by Stripe. Your card is charged the
              one-time processing fee for this service.
            </DialogDescription>
          </DialogHeader>
          {payingFor && (
            <PaymentForm
              amount={payingFor.basePrice}
              description={`${payingFor.name} — ${payingFor.description}`}
              onSuccess={handlePaymentSuccess}
              metadata={{
                purpose: 'document_processing',
                documentServiceId: payingFor.id,
                documentType: payingFor.name,
                ...(user?.uid ? { userId: user.uid } : {}),
                ...(user?.email ? { customerEmail: user.email } : {}),
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentPricingCard;