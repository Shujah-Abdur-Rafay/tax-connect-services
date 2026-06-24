import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Upload, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Native-HTML enrollment form.
 *
 * IMPORTANT: All dropdowns use plain <select> elements (NOT the Radix UI
 * Select component). This guarantees they open and respond to clicks in
 * every browser — that was the bug that previously broke this form and
 * forced the JotForm fallback. JotForm has now been removed entirely;
 * step 3 collects the same intake answers natively.
 */

export interface EnrollmentData {
  // Step 1 — Basic info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  experienceLevel: string;
  priorYearBankProducts: string;

  // Step 2 — Profile
  profilePhoto?: string;
  businessName?: string;
  website?: string;
  bio?: string;
  servicesOffered: string[];

  // Step 3 — Intake / credentialing
  ptin: string;
  efin: string;
  hasEfin: string;          // 'yes' | 'no' | 'applying'
  credentials: string;      // 'none' | 'ea' | 'cpa' | 'attorney' | 'afsp'
  yearsPreparing: string;
  returnsLastSeason: string;
  softwareUsed: string;
  workSetup: string;        // 'remote' | 'in-office' | 'hybrid'
  hoursPerWeek: string;
  referralSource: string;
  felonyDisclosure: string; // 'yes' | 'no'
  circular230Ack: boolean;
}

interface EnrollmentFormProps {
  onSubmit: (data: EnrollmentData) => void;
  loading?: boolean;
}

const SERVICES = [
  'Individual Tax Preparation',
  'Business Tax Preparation',
  'Tax Planning & Consulting',
  'IRS Representation',
  'Bookkeeping Services',
  'Payroll Services',
  'Estate & Trust Tax',
  'Sales Tax Filing',
  'Audit Support',
  'Financial Statements',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

// Reusable native select — styled to match shadcn/ui inputs.
const NativeSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }
> = ({ className = '', children, ...props }) => (
  <select
    {...props}
    className={
      'flex h-10 w-full items-center justify-between rounded-md border border-input ' +
      'bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground ' +
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ' +
      'disabled:cursor-not-allowed disabled:opacity-50 ' +
      className
    }
  >
    {children}
  </select>
);

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ onSubmit, loading = false }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();

  const [formData, setFormData] = useState<EnrollmentData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    experienceLevel: '',
    priorYearBankProducts: '',
    profilePhoto: '',
    businessName: '',
    website: '',
    bio: '',
    servicesOffered: [],
    ptin: '',
    efin: '',
    hasEfin: '',
    credentials: '',
    yearsPreparing: '',
    returnsLastSeason: '',
    softwareUsed: '',
    workSetup: '',
    hoursPerWeek: '',
    referralSource: '',
    felonyDisclosure: '',
    circular230Ack: false,
  });

  const handleInputChange = (field: keyof EnrollmentData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value as never }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => handleInputChange('profilePhoto', reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleService = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      servicesOffered: prev.servicesOffered.includes(service)
        ? prev.servicesOffered.filter((s) => s !== service)
        : [...prev.servicesOffered, service],
    }));
  };

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateStep1 = () => {
    const required: Array<[keyof EnrollmentData, string]> = [
      ['firstName', 'First name'],
      ['lastName', 'Last name'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['address', 'Street address'],
      ['city', 'City'],
      ['state', 'State'],
      ['zip', 'ZIP code'],
      ['experienceLevel', 'Experience level'],
    ];
    for (const [field, label] of required) {
      if (!String(formData[field] ?? '').trim()) {
        toast({
          title: 'Missing information',
          description: `${label} is required.`,
          variant: 'destructive',
        });
        return false;
      }
    }
    if (!validateEmail(formData.email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (formData.servicesOffered.length === 0) {
      toast({
        title: 'Services required',
        description: 'Please select at least one service you offer.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const required: Array<[keyof EnrollmentData, string]> = [
      ['hasEfin', 'EFIN status'],
      ['credentials', 'Credentials'],
      ['yearsPreparing', 'Years preparing'],
      ['returnsLastSeason', 'Returns last season'],
      ['workSetup', 'Work setup'],
      ['hoursPerWeek', 'Hours per week'],
      ['felonyDisclosure', 'Compliance disclosure'],
    ];
    for (const [field, label] of required) {
      if (!String(formData[field] ?? '').trim()) {
        toast({
          title: 'Missing information',
          description: `${label} is required.`,
          variant: 'destructive',
        });
        return false;
      }
    }
    if (!formData.circular230Ack) {
      toast({
        title: 'Acknowledgement required',
        description: 'You must acknowledge IRS Circular 230 compliance.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
    onSubmit(formData);
  };

  const stepLabel =
    currentStep === 1 ? 'Basic Information'
    : currentStep === 2 ? 'Profile Creation'
    : 'Credentialing & Intake';

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Enrollment Form — Step {currentStep} of 3</CardTitle>
        <CardDescription>{stepLabel}</CardDescription>
        {/* Progress dots */}
        <div className="flex gap-2 pt-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                n <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* ───────────────── STEP 1 ───────────────── */}
        {currentStep === 1 && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleNext();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <NativeSelect
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="zip">ZIP *</Label>
                <Input
                  id="zip"
                  inputMode="numeric"
                  maxLength={10}
                  value={formData.zip}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="experienceLevel">Experience Level *</Label>
              <NativeSelect
                id="experienceLevel"
                value={formData.experienceLevel}
                onChange={(e) => handleInputChange('experienceLevel', e.target.value)}
                required
              >
                <option value="">Select your experience level…</option>
                <option value="entry-level">Entry Level (new to tax prep)</option>
                <option value="professional">Professional (1+ years experience)</option>
                <option value="ero-efin">ERO — EFIN Holder</option>
              </NativeSelect>
            </div>

            <div>
              <Label htmlFor="priorYearBankProducts">Prior Year Bank Products</Label>
              <NativeSelect
                id="priorYearBankProducts"
                value={formData.priorYearBankProducts}
                onChange={(e) => handleInputChange('priorYearBankProducts', e.target.value)}
              >
                <option value="">Select range…</option>
                <option value="none">None</option>
                <option value="1-19">1–19</option>
                <option value="20-49">20–49</option>
                <option value="50-99">50–99</option>
                <option value="100-199">100–199</option>
                <option value="200+">200+</option>
              </NativeSelect>
            </div>

            <Button type="submit" className="w-full">
              Next Step <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        )}

        {/* ───────────────── STEP 2 ───────────────── */}
        {currentStep === 2 && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleNext();
            }}
          >
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src={formData.profilePhoto} />
                <AvatarFallback className="text-2xl">
                  {formData.firstName[0]}{formData.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <Label htmlFor="photo-upload" className="cursor-pointer">
                <div className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                  <Upload className="h-4 w-4" />
                  <span>Upload Photo</span>
                </div>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </Label>
            </div>

            <div>
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                placeholder="Your Tax Business"
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </div>

            <div>
              <Label htmlFor="bio">Professional Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell us about your experience and expertise…"
                rows={4}
              />
            </div>

            <div>
              <Label className="text-base font-medium">Services Offered *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {SERVICES.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      id={`service-${service}`}
                      checked={formData.servicesOffered.includes(service)}
                      onCheckedChange={() => toggleService(service)}
                    />
                    <Label htmlFor={`service-${service}`} className="text-sm font-normal cursor-pointer">
                      {service}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button type="submit" className="flex-1">
                Next Step <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        )}

        {/* ───────────────── STEP 3 ───────────────── */}
        {currentStep === 3 && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              These questions replace the previous JotForm intake. All answers
              are stored securely with your application.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ptin">PTIN</Label>
                <Input
                  id="ptin"
                  placeholder="P00000000"
                  value={formData.ptin}
                  onChange={(e) => handleInputChange('ptin', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="efin">EFIN (if any)</Label>
                <Input
                  id="efin"
                  placeholder="000000"
                  value={formData.efin}
                  onChange={(e) => handleInputChange('efin', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="hasEfin">Do you have an EFIN? *</Label>
              <NativeSelect
                id="hasEfin"
                value={formData.hasEfin}
                onChange={(e) => handleInputChange('hasEfin', e.target.value)}
                required
              >
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="applying">Currently applying</option>
              </NativeSelect>
            </div>

            <div>
              <Label htmlFor="credentials">Professional Credentials *</Label>
              <NativeSelect
                id="credentials"
                value={formData.credentials}
                onChange={(e) => handleInputChange('credentials', e.target.value)}
                required
              >
                <option value="">Select…</option>
                <option value="none">None</option>
                <option value="afsp">AFSP — Annual Filing Season Program</option>
                <option value="ea">EA — Enrolled Agent</option>
                <option value="cpa">CPA — Certified Public Accountant</option>
                <option value="attorney">Tax Attorney</option>
              </NativeSelect>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="yearsPreparing">Years Preparing Taxes *</Label>
                <NativeSelect
                  id="yearsPreparing"
                  value={formData.yearsPreparing}
                  onChange={(e) => handleInputChange('yearsPreparing', e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  <option value="0">Less than 1 year</option>
                  <option value="1-2">1–2 years</option>
                  <option value="3-5">3–5 years</option>
                  <option value="6-10">6–10 years</option>
                  <option value="10+">10+ years</option>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="returnsLastSeason">Returns Filed Last Season *</Label>
                <NativeSelect
                  id="returnsLastSeason"
                  value={formData.returnsLastSeason}
                  onChange={(e) => handleInputChange('returnsLastSeason', e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  <option value="0">None</option>
                  <option value="1-49">1–49</option>
                  <option value="50-99">50–99</option>
                  <option value="100-249">100–249</option>
                  <option value="250-499">250–499</option>
                  <option value="500+">500+</option>
                </NativeSelect>
              </div>
            </div>

            <div>
              <Label htmlFor="softwareUsed">Tax Software Used</Label>
              <Input
                id="softwareUsed"
                placeholder="e.g. Drake, ProSeries, TaxSlayer Pro, UltraTax"
                value={formData.softwareUsed}
                onChange={(e) => handleInputChange('softwareUsed', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workSetup">Work Setup *</Label>
                <NativeSelect
                  id="workSetup"
                  value={formData.workSetup}
                  onChange={(e) => handleInputChange('workSetup', e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  <option value="remote">Remote</option>
                  <option value="in-office">In-office</option>
                  <option value="hybrid">Hybrid</option>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="hoursPerWeek">Hours Available / Week *</Label>
                <NativeSelect
                  id="hoursPerWeek"
                  value={formData.hoursPerWeek}
                  onChange={(e) => handleInputChange('hoursPerWeek', e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  <option value="<10">Less than 10</option>
                  <option value="10-20">10–20</option>
                  <option value="20-40">20–40</option>
                  <option value="40+">40+ (full time)</option>
                </NativeSelect>
              </div>
            </div>

            <div>
              <Label htmlFor="referralSource">How did you hear about us?</Label>
              <NativeSelect
                id="referralSource"
                value={formData.referralSource}
                onChange={(e) => handleInputChange('referralSource', e.target.value)}
              >
                <option value="">Select…</option>
                <option value="google">Google search</option>
                <option value="social">Social media</option>
                <option value="referral">Referral from a friend</option>
                <option value="postcard">Postcard / Mailer</option>
                <option value="event">Event / conference</option>
                <option value="email">Email campaign</option>
                <option value="podcast">Podcast / Radio</option>
                <option value="other">Other</option>
              </NativeSelect>
            </div>


            <div>
              <Label htmlFor="felonyDisclosure">
                Have you been convicted of a felony or subject to IRS sanctions
                in the last 10 years? *
              </Label>
              <NativeSelect
                id="felonyDisclosure"
                value={formData.felonyDisclosure}
                onChange={(e) => handleInputChange('felonyDisclosure', e.target.value)}
                required
              >
                <option value="">Select…</option>
                <option value="no">No</option>
                <option value="yes">Yes (will be reviewed)</option>
              </NativeSelect>
            </div>

            <div className="flex items-start space-x-2 rounded-md border p-3">
              <Checkbox
                id="circular230Ack"
                checked={formData.circular230Ack}
                onCheckedChange={(checked) =>
                  handleInputChange('circular230Ack', checked === true)
                }
              />
              <Label htmlFor="circular230Ack" className="text-sm font-normal cursor-pointer leading-snug">
                I acknowledge that I will comply with IRS Circular 230 and all
                applicable federal and state tax-preparer regulations, and that
                false statements on this application may result in denial or
                termination. *
              </Label>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  'Processing…'
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Submit Application
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default EnrollmentForm;
