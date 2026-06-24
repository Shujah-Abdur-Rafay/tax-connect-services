import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Briefcase } from 'lucide-react';

interface ProfessionalDetailsStepProps {
  data: {
    services: string[];
    specialties: string;
    hourlyRate: string;
    experience: string;
    certifications: string;
    availability: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack?: () => void;
}

const serviceOptions = [
  'Individual Tax Returns',
  'Business Tax Returns',
  'Tax Planning',
  'IRS Audit Representation',
  'Bookkeeping',
  'Payroll Services',
  'Tax Resolution',
  'Estate Planning'
];

export default function ProfessionalDetailsStep({ data, onUpdate, onNext, onBack }: ProfessionalDetailsStepProps) {
  const handleInputChange = (field: string, value: string) => {
    onUpdate({ ...data, [field]: value });
  };

  const handleServiceToggle = (service: string) => {
    const services = data.services || [];
    const updated = services.includes(service)
      ? services.filter(s => s !== service)
      : [...services, service];
    onUpdate({ ...data, services: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isValid = data.services?.length > 0 && data.hourlyRate && data.experience;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Professional Details
        </CardTitle>
        <CardDescription>
          Tell us about your services and expertise
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label className="mb-3 block">Services Offered *</Label>
            <div className="grid grid-cols-2 gap-3">
              {serviceOptions.map(service => (
                <div key={service} className="flex items-center space-x-2">
                  <Checkbox
                    id={service}
                    checked={data.services?.includes(service)}
                    onCheckedChange={() => handleServiceToggle(service)}
                  />
                  <label htmlFor={service} className="text-sm cursor-pointer">
                    {service}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="specialties">Specialties</Label>
            <Textarea
              id="specialties"
              value={data.specialties}
              onChange={(e) => handleInputChange('specialties', e.target.value)}
              placeholder="E.g., Small business taxes, international taxation..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hourlyRate">Hourly Rate *</Label>
              <Input
                id="hourlyRate"
                type="number"
                value={data.hourlyRate}
                onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                placeholder="150"
                required
              />
            </div>
            <div>
              <Label htmlFor="experience">Years of Experience *</Label>
              <Input
                id="experience"
                type="number"
                value={data.experience}
                onChange={(e) => handleInputChange('experience', e.target.value)}
                placeholder="10"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="certifications">Certifications</Label>
            <Input
              id="certifications"
              value={data.certifications}
              onChange={(e) => handleInputChange('certifications', e.target.value)}
              placeholder="CPA, EA, etc."
            />
          </div>

          <div>
            <Label htmlFor="availability">Availability</Label>
            <Textarea
              id="availability"
              value={data.availability}
              onChange={(e) => handleInputChange('availability', e.target.value)}
              placeholder="Monday-Friday 9am-5pm, weekends by appointment..."
              rows={3}
            />
          </div>

          <div className="flex justify-between pt-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
            <Button type="submit" disabled={!isValid} className="ml-auto">
              Complete Registration
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
