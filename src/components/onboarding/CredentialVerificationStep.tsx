import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Shield, CheckCircle, AlertCircle } from 'lucide-react';

interface CredentialVerificationStepProps {
  data: {
    licenses: Array<{
      type: string;
      number: string;
      state: string;
      expirationDate: string;
      document?: File;
    }>;
    certifications: string[];
    ein: string;
    insurancePolicy: string;
    backgroundCheck: boolean;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CredentialVerificationStep({ data, onUpdate, onNext, onBack }: CredentialVerificationStepProps) {
  const [newLicense, setNewLicense] = useState({
    type: '',
    number: '',
    state: '',
    expirationDate: ''
  });

  const handleAddLicense = () => {
    if (newLicense.type && newLicense.number && newLicense.state) {
      onUpdate({
        ...data,
        licenses: [...data.licenses, { ...newLicense }]
      });
      setNewLicense({ type: '', number: '', state: '', expirationDate: '' });
    }
  };

  const handleRemoveLicense = (index: number) => {
    const updatedLicenses = data.licenses.filter((_, i) => i !== index);
    onUpdate({ ...data, licenses: updatedLicenses });
  };

  const handleCertificationToggle = (cert: string, checked: boolean) => {
    const updatedCerts = checked 
      ? [...data.certifications, cert]
      : data.certifications.filter(c => c !== cert);
    onUpdate({ ...data, certifications: updatedCerts });
  };

  const certificationOptions = [
    'CPA (Certified Public Accountant)',
    'EA (Enrolled Agent)',
    'CRTP (Certified Return Preparer)',
    'AFSP (Annual Filing Season Program)',
    'CTEC (California Tax Education Council)',
    'Other Professional Certification'
  ];

  const isValid = data.licenses.length > 0 && data.ein && data.backgroundCheck;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Credential Verification
        </CardTitle>
        <CardDescription>
          Verify your professional credentials and licenses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base font-medium">Professional Licenses</Label>
          <div className="space-y-4 mt-2">
            {data.licenses.map((license, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{license.type}</div>
                  <div className="text-sm text-gray-600">
                    {license.number} • {license.state} • Expires: {license.expirationDate}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveLicense(index)}
                >
                  Remove
                </Button>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4 p-4 border-2 border-dashed border-gray-300 rounded-lg">
              <div>
                <Label htmlFor="licenseType">License Type</Label>
                <Input
                  id="licenseType"
                  value={newLicense.type}
                  onChange={(e) => setNewLicense({...newLicense, type: e.target.value})}
                  placeholder="e.g., CPA License"
                />
              </div>
              <div>
                <Label htmlFor="licenseNumber">License Number</Label>
                <Input
                  id="licenseNumber"
                  value={newLicense.number}
                  onChange={(e) => setNewLicense({...newLicense, number: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="licenseState">State</Label>
                <Input
                  id="licenseState"
                  value={newLicense.state}
                  onChange={(e) => setNewLicense({...newLicense, state: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="expirationDate">Expiration Date</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={newLicense.expirationDate}
                  onChange={(e) => setNewLicense({...newLicense, expirationDate: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <Button type="button" onClick={handleAddLicense} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Add License
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-base font-medium">Professional Certifications</Label>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {certificationOptions.map((cert) => (
              <div key={cert} className="flex items-center space-x-2">
                <Checkbox
                  id={cert}
                  checked={data.certifications.includes(cert)}
                  onCheckedChange={(checked) => handleCertificationToggle(cert, checked as boolean)}
                />
                <Label htmlFor={cert} className="text-sm">{cert}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ein">EIN (Employer Identification Number) *</Label>
            <Input
              id="ein"
              value={data.ein}
              onChange={(e) => onUpdate({...data, ein: e.target.value})}
              placeholder="XX-XXXXXXX"
              required
            />
          </div>
          <div>
            <Label htmlFor="insurance">Professional Liability Insurance</Label>
            <Input
              id="insurance"
              value={data.insurancePolicy}
              onChange={(e) => onUpdate({...data, insurancePolicy: e.target.value})}
              placeholder="Policy Number"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="backgroundCheck"
            checked={data.backgroundCheck}
            onCheckedChange={(checked) => onUpdate({...data, backgroundCheck: checked as boolean})}
          />
          <Label htmlFor="backgroundCheck" className="text-sm">
            I consent to a background check and verification of my credentials *
          </Label>
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