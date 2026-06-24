import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Briefcase } from 'lucide-react';

interface Service {
  name: string;
  description: string;
  selected: boolean;
  price: string;
}

interface ServiceOfferingsStepProps {
  data: {
    services: Service[];
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const defaultServices = [
  { name: 'Individual Tax Preparation', description: 'Expert preparation of personal tax returns with maximum refunds', selected: false, price: '' },
  { name: 'Self-Employment Tax Preparation', description: 'Specialized tax services for self-employed individuals and freelancers', selected: false, price: '' },
  { name: 'Business Tax Preparation', description: 'Comprehensive business tax filing for corporations and LLCs', selected: false, price: '' },
  { name: 'Bookkeeping', description: 'Professional bookkeeping services to keep your finances organized', selected: false, price: '' },
  { name: 'Accounting Services', description: 'Full-service accounting solutions for businesses of all sizes', selected: false, price: '' },
  { name: 'Incorporation Services', description: 'Business formation and incorporation assistance', selected: false, price: '' },
  { name: 'Credit Repair', description: 'Credit restoration and improvement services', selected: false, price: '' },
  { name: 'Business Funding', description: 'Assistance with business loans and funding options', selected: false, price: '' }
];

export default function ServiceOfferingsStep({ data, onUpdate, onNext, onBack }: ServiceOfferingsStepProps) {
  const services = data.services.length > 0 ? data.services : defaultServices;

  const handleServiceToggle = (index: number, checked: boolean) => {
    const updated = [...services];
    updated[index].selected = checked;
    onUpdate({ services: updated });
  };

  const handlePriceChange = (index: number, price: string) => {
    const updated = [...services];
    updated[index].price = price;
    onUpdate({ services: updated });
  };

  const isValid = services.some(s => s.selected && s.price);

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Services & Pricing
        </CardTitle>
        <CardDescription>
          Select services you offer and set your pricing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {services.map((service, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`service-${index}`}
                checked={service.selected}
                onCheckedChange={(checked) => handleServiceToggle(index, checked as boolean)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor={`service-${index}`} className="text-base font-medium cursor-pointer">
                  {service.name}
                </Label>
                <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                {service.selected && (
                  <div className="mt-3 flex items-center gap-2">
                    <Label className="text-sm">Price:</Label>
                    <div className="relative w-32">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        type="number"
                        value={service.price}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        className="pl-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button disabled={!isValid} onClick={onNext}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
