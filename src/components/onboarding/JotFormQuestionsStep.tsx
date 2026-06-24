import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowLeft, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * JotForm Questions Step — native replacement for the legacy iframe.
 *
 * Mirrors the questions collected by the Refund Connect intake JotForm
 * (https://www.jotform.com/252927299861170): personal info, address,
 * credentials (PTIN/EFIN), tax prep experience, bank-product history,
 * software experience, availability, and how the applicant heard about us.
 *
 * Data is collected here and submitted along with the rest of the
 * onboarding payload + the signed T&C agreement.
 */

export interface JotFormAnswers {
  // Personal
  dateOfBirth: string;
  ssnLast4: string; // last 4 digits only — never collect full SSN client-side
  // Address (separate from business address)
  homeStreet: string;
  homeCity: string;
  homeState: string;
  homeZip: string;
  // Credentials
  ptin: string;
  hasEfin: 'yes' | 'no' | '';
  efin: string;
  hasCaf: 'yes' | 'no' | '';
  cafNumber: string;
  isEnrolledAgent: boolean;
  isCPA: boolean;
  isAttorney: boolean;
  otherCredentials: string;
  // Experience
  yearsPreparing: string;
  returnsLastSeason: string;
  softwareUsed: string[];
  softwareOther: string;
  priorYearBankProducts: '' | 'none' | '20-49' | '50-99' | '100-199' | '200+';
  // Business model
  workLocation: 'home' | 'office' | 'remote' | 'hybrid' | '';
  hoursPerWeek: string;
  willingToTravel: boolean;
  // Referral
  heardFrom: string;
  referredBy: string;
  // Compliance
  hasBeenConvicted: 'yes' | 'no' | '';
  convictionExplanation: string;
  irsComplianceCertify: boolean;
}

export const EMPTY_JOTFORM_ANSWERS: JotFormAnswers = {
  dateOfBirth: '',
  ssnLast4: '',
  homeStreet: '',
  homeCity: '',
  homeState: '',
  homeZip: '',
  ptin: '',
  hasEfin: '',
  efin: '',
  hasCaf: '',
  cafNumber: '',
  isEnrolledAgent: false,
  isCPA: false,
  isAttorney: false,
  otherCredentials: '',
  yearsPreparing: '',
  returnsLastSeason: '',
  softwareUsed: [],
  softwareOther: '',
  priorYearBankProducts: '',
  workLocation: '',
  hoursPerWeek: '',
  willingToTravel: false,
  heardFrom: '',
  referredBy: '',
  hasBeenConvicted: '',
  convictionExplanation: '',
  irsComplianceCertify: false,
};

const SOFTWARE_OPTIONS = [
  'Drake',
  'ProSeries',
  'Lacerte',
  'UltraTax',
  'TaxWise',
  'TaxSlayer Pro',
  'ATX',
  'CrossLink',
  'TurboTax (personal only)',
  'None — I am new',
];

const HEARD_FROM_OPTIONS = [
  'Google / Search',
  'Facebook / Instagram',
  'YouTube',
  'Mailer / Postcard',
  'Friend or colleague referral',
  'Tax industry event',
  'IRS forum',
  'Other',
];

interface Props {
  value: JotFormAnswers;
  onChange: (next: JotFormAnswers) => void;
  onNext: () => void;
  onBack: () => void;
}

const JotFormQuestionsStep: React.FC<Props> = ({ value, onChange, onNext, onBack }) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof JotFormAnswers>(key: K, v: JotFormAnswers[K]) => {
    onChange({ ...value, [key]: v });
  };

  const toggleSoftware = (sw: string) => {
    const next = value.softwareUsed.includes(sw)
      ? value.softwareUsed.filter((s) => s !== sw)
      : [...value.softwareUsed, sw];
    update('softwareUsed', next);
  };

  const validate = (): string | null => {
    if (!value.dateOfBirth) return 'Date of birth is required.';
    if (!value.homeStreet || !value.homeCity || !value.homeState || !value.homeZip)
      return 'Please complete your home address.';
    if (!value.ptin) return 'PTIN is required to prepare tax returns for compensation.';
    if (value.hasEfin === '') return 'Please indicate whether you hold an EFIN.';
    if (value.hasEfin === 'yes' && !value.efin) return 'Please provide your EFIN number.';
    if (!value.yearsPreparing) return 'Please tell us how many years you have been preparing returns.';
    if (!value.workLocation) return 'Please select where you plan to work from.';
    if (value.hasBeenConvicted === '') return 'Please answer the compliance question.';
    if (value.hasBeenConvicted === 'yes' && !value.convictionExplanation.trim())
      return 'Please provide an explanation.';
    if (!value.irsComplianceCertify)
      return 'You must certify that the information provided is accurate.';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: 'Please complete the form', description: err, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    // No async work needed — parent persists with the rest of the onboarding payload.
    onNext();
    setSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Tax Professional Application
        </CardTitle>
        <CardDescription>
          Please answer all required questions accurately. This information is used
          for credentialing, IRS compliance verification, and to set up your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal */}
          <section className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input
                  id="dob"
                  type="date"
                  value={value.dateOfBirth}
                  onChange={(e) => update('dateOfBirth', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ssn4">Last 4 of SSN (for ID only)</Label>
                <Input
                  id="ssn4"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="1234"
                  value={value.ssnLast4}
                  onChange={(e) => update('ssnLast4', e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Last 4 digits only. We never store full SSNs.
                </p>
              </div>
            </div>
          </section>

          {/* Home Address */}
          <section className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Home Address</h3>
            <div>
              <Label htmlFor="homeStreet">Street Address *</Label>
              <Input
                id="homeStreet"
                value={value.homeStreet}
                onChange={(e) => update('homeStreet', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="homeCity">City *</Label>
                <Input
                  id="homeCity"
                  value={value.homeCity}
                  onChange={(e) => update('homeCity', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="homeState">State *</Label>
                <Input
                  id="homeState"
                  maxLength={2}
                  placeholder="GA"
                  value={value.homeState}
                  onChange={(e) => update('homeState', e.target.value.toUpperCase().slice(0, 2))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="homeZip">ZIP *</Label>
                <Input
                  id="homeZip"
                  inputMode="numeric"
                  value={value.homeZip}
                  onChange={(e) => update('homeZip', e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          {/* Credentials */}
          <section className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">IRS Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ptin">PTIN *</Label>
                <Input
                  id="ptin"
                  placeholder="P12345678"
                  value={value.ptin}
                  onChange={(e) => update('ptin', e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div>
                <Label>Do you hold an EFIN? *</Label>
                <div className="flex gap-4 mt-2">
                  {(['yes', 'no'] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={value.hasEfin === opt}
                        onChange={() => update('hasEfin', opt)}
                      />
                      <span className="capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {value.hasEfin === 'yes' && (
              <div>
                <Label htmlFor="efin">EFIN Number *</Label>
                <Input
                  id="efin"
                  value={value.efin}
                  onChange={(e) => update('efin', e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Do you have a CAF number?</Label>
                <div className="flex gap-4 mt-2">
                  {(['yes', 'no'] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={value.hasCaf === opt}
                        onChange={() => update('hasCaf', opt)}
                      />
                      <span className="capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              {value.hasCaf === 'yes' && (
                <div>
                  <Label htmlFor="caf">CAF Number</Label>
                  <Input
                    id="caf"
                    value={value.cafNumber}
                    onChange={(e) => update('cafNumber', e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Additional Credentials (check all that apply)</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={value.isEnrolledAgent}
                    onCheckedChange={(c) => update('isEnrolledAgent', !!c)}
                  />
                  Enrolled Agent (EA)
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={value.isCPA}
                    onCheckedChange={(c) => update('isCPA', !!c)}
                  />
                  Certified Public Accountant (CPA)
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={value.isAttorney}
                    onCheckedChange={(c) => update('isAttorney', !!c)}
                  />
                  Tax Attorney
                </label>
              </div>
              <Label htmlFor="other" className="mt-3 block">
                Other certifications / licenses
              </Label>
              <Input
                id="other"
                placeholder="e.g. AFSP Record of Completion, state license #"
                value={value.otherCredentials}
                onChange={(e) => update('otherCredentials', e.target.value)}
              />
            </div>
          </section>

          {/* Experience */}
          <section className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Tax Preparation Experience</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="years">Years preparing tax returns *</Label>
                <Input
                  id="years"
                  inputMode="numeric"
                  value={value.yearsPreparing}
                  onChange={(e) => update('yearsPreparing', e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="returns">Returns prepared last season</Label>
                <Input
                  id="returns"
                  inputMode="numeric"
                  placeholder="e.g. 120"
                  value={value.returnsLastSeason}
                  onChange={(e) => update('returnsLastSeason', e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div>
              <Label>Tax software you have used (check all that apply)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {SOFTWARE_OPTIONS.map((sw) => (
                  <label key={sw} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={value.softwareUsed.includes(sw)}
                      onCheckedChange={() => toggleSoftware(sw)}
                    />
                    {sw}
                  </label>
                ))}
              </div>
              <Input
                className="mt-2"
                placeholder="Other software (optional)"
                value={value.softwareOther}
                onChange={(e) => update('softwareOther', e.target.value)}
              />
            </div>

            <div>
              <Label>Prior-year bank products processed</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                {(['none', '20-49', '50-99', '100-199', '200+'] as const).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={value.priorYearBankProducts === opt}
                      onChange={() => update('priorYearBankProducts', opt)}
                    />
                    {opt === 'none' ? 'None' : opt}
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Work Setup */}
          <section className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Work Setup & Availability</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Primary work location *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(['home', 'office', 'remote', 'hybrid'] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={value.workLocation === opt}
                        onChange={() => update('workLocation', opt)}
                      />
                      <span className="capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="hours">Hours per week available</Label>
                <Input
                  id="hours"
                  inputMode="numeric"
                  placeholder="e.g. 30"
                  value={value.hoursPerWeek}
                  onChange={(e) => update('hoursPerWeek', e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.willingToTravel}
                onCheckedChange={(c) => update('willingToTravel', !!c)}
              />
              Willing to travel to clients within my service area
            </label>
          </section>

          {/* Referral */}
          <section className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">How did you hear about us?</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {HEARD_FROM_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={value.heardFrom === opt}
                    onChange={() => update('heardFrom', opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
            <div>
              <Label htmlFor="referredBy">Referred by (name, if applicable)</Label>
              <Input
                id="referredBy"
                value={value.referredBy}
                onChange={(e) => update('referredBy', e.target.value)}
              />
            </div>
          </section>

          {/* Compliance */}
          <section className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Compliance Disclosure</h3>
            <div>
              <Label>
                Have you ever been convicted of a felony, or had professional or tax-related sanctions? *
              </Label>
              <div className="flex gap-4 mt-2">
                {(['yes', 'no'] as const).map((opt) => (
                  <label key={opt} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={value.hasBeenConvicted === opt}
                      onChange={() => update('hasBeenConvicted', opt)}
                    />
                    <span className="capitalize">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            {value.hasBeenConvicted === 'yes' && (
              <div>
                <Label htmlFor="explain">Please explain *</Label>
                <Textarea
                  id="explain"
                  rows={3}
                  value={value.convictionExplanation}
                  onChange={(e) => update('convictionExplanation', e.target.value)}
                />
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={value.irsComplianceCertify}
                onCheckedChange={(c) => update('irsComplianceCertify', !!c)}
              />
              <span>
                I certify under penalty of perjury that all information provided above is true,
                accurate, and complete, and that I will comply with all applicable IRS Circular 230
                requirements and federal/state tax preparer regulations.
              </span>
            </label>
          </section>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              Continue to Agreement
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default JotFormQuestionsStep;
