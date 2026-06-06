import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { DollarSign, Clock, Percent } from 'lucide-react';

interface PricingSetupStepProps {
  data: {
    hourlyRate: string;
    fixedPricing: Array<{
      service: string;
      price: string;
    }>;
    consultationFee: string;
    consultationDuration: string;
    paymentTerms: string;
    acceptsPaymentPlans: boolean;
    minimumProject: string;
    rushFeePercentage: string;
    specialNotes: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function PricingSetupStep({ data, onUpdate, onNext, onBack }: PricingSetupStepProps) {
  const handleFixedPricingUpdate = (index: number, field: string, value: string) => {
    const updatedPricing = [...data.fixedPricing];
    updatedPricing[index] = { ...updatedPricing[index], [field]: value };
    onUpdate({ ...data, fixedPricing: updatedPricing });
  };

  const commonServices = [
    'Individual Tax Return (1040)',
    'Business Tax Return (1120)',
    'Partnership Return (1065)',
    'Quarterly Estimates',
    'Tax Planning Session',
    'Audit Representation',
    'Bookkeeping (Monthly)',
    'Payroll Setup'
  ];

  const isValid = data.hourlyRate && data.consultationFee && data.paymentTerms;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Pricing Setup
        </CardTitle>
        <CardDescription>
          Configure your service pricing and payment terms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="hourlyRate">Hourly Rate *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="hourlyRate"
                type="number"
                value={data.hourlyRate}
                onChange={(e) => onUpdate({...data, hourlyRate: e.target.value})}
                className="pl-10"
                placeholder="150"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="minimumProject">Minimum Project Fee</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="minimumProject"
                type="number"
                value={data.minimumProject}
                onChange={(e) => onUpdate({...data, minimumProject: e.target.value})}
                className="pl-10"
                placeholder="100"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="consultationFee">Initial Consultation Fee *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="consultationFee"
                type="number"
                value={data.consultationFee}
                onChange={(e) => onUpdate({...data, consultationFee: e.target.value})}
                className="pl-10"
                placeholder="75"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="consultationDuration">Consultation Duration *</Label>
            <Input
              id="consultationDuration"
              type="number"
              value={data.consultationDuration}
              onChange={(e) => onUpdate({...data, consultationDuration: e.target.value})}
              placeholder="60"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Duration in minutes</p>
          </div>


        </div>

        <div>
          <Label className="text-base font-medium">Fixed Service Pricing</Label>
          <div className="space-y-3 mt-2">
            {commonServices.map((service, index) => {
              const existingPrice = data.fixedPricing.find(p => p.service === service);
              return (
                <div key={service} className="flex items-center gap-3">
                  <Label className="flex-1 text-sm">{service}</Label>
                  <div className="relative w-32">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="number"
                      value={existingPrice?.price || ''}
                      onChange={(e) => {
                        const updatedPricing = data.fixedPricing.filter(p => p.service !== service);
                        if (e.target.value) {
                          updatedPricing.push({ service, price: e.target.value });
                        }
                        onUpdate({...data, fixedPricing: updatedPricing});
                      }}
                      className="pl-10 text-sm"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="rushFee">Rush Fee Percentage</Label>
            <div className="relative">
              <Percent className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="rushFee"
                type="number"
                value={data.rushFeePercentage}
                onChange={(e) => onUpdate({...data, rushFeePercentage: e.target.value})}
                className="pl-10"
                placeholder="25"
              />
            </div>
          </div>
          <div>
            <Label className="text-base font-medium mb-3 block">Payment Terms *</Label>
            <div className="space-y-2">
              {[
                { value: 'due-on-completion', label: 'Due on Completion' },
                { value: '50-50', label: '50% Upfront, 50% on Completion' },
                { value: 'net-15', label: 'Net 15 Days' },
                { value: 'net-30', label: 'Net 30 Days' }
              ].map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.value}
                    checked={data.paymentTerms === option.value}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onUpdate({...data, paymentTerms: option.value});
                      }
                    }}
                  />
                  <Label
                    htmlFor={option.value}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>


        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="paymentPlans" className="text-base font-medium">
            Accept Payment Plans
          </Label>
          <Switch
            id="paymentPlans"
            checked={data.acceptsPaymentPlans}
            onCheckedChange={(checked) => onUpdate({...data, acceptsPaymentPlans: checked})}
          />
        </div>

        <div>
          <Label htmlFor="specialNotes">Special Pricing Notes</Label>
          <Textarea
            id="specialNotes"
            value={data.specialNotes}
            onChange={(e) => onUpdate({...data, specialNotes: e.target.value})}
            placeholder="Any special terms, discounts, or pricing considerations..."
            rows={3}
          />
        </div>

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