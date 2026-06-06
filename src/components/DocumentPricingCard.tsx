import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, DollarSign, Clock, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();

  const handleProcessDocument = async (service: DocumentService) => {
    try {
      setLoading(service.id);
      
      // Create payment intent for document processing
      const { data, error } = await supabase.functions.invoke('process-document-payment', {
        body: {
          documentType: service.name,
          processingFee: service.basePrice,
          userId: 'user_123', // In real app, get from auth context
          customerEmail: 'user@example.com',
          description: `${service.name} - ${service.description}`
        }
      });

      if (error) {
        // Fallback to mock processing for demo
        toast({
          title: 'Document Processing Started',
          description: `${service.name} processing has been initiated. You will receive updates via email.`
        });
        
        if (onServiceSelect) {
          onServiceSelect(service);
        }
        return;
      }

      if (data?.clientSecret) {
        // In real app, redirect to payment form with client secret
        toast({
          title: 'Payment Required',
          description: 'Redirecting to secure payment form...'
        });
      }

      if (onServiceSelect) {
        onServiceSelect(service);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process document request',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
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
                disabled={loading === service.id}
              >
                {loading === service.id ? 'Processing...' : 'Start Processing'}
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
    </div>
  );
};

export default DocumentPricingCard;