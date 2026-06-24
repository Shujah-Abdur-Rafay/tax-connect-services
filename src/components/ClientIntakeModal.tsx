import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { GigOrderIntake, IntakeServiceNeeded } from '@/services/gigOrdersService';

interface ClientIntakeModalProps {
  open: boolean;
  onClose: () => void;
  /** Pro the order is routed to — shown for context. */
  proName?: string | null;
  /** Prefill values (from the order / signed-in user). */
  defaults?: Partial<GigOrderIntake>;
  /** Persist the intake. Should call gigOrdersService.submitOrderIntake. */
  onSubmit: (intake: Omit<GigOrderIntake, 'submittedAt'>) => Promise<void>;
}

const SERVICE_OPTIONS: IntakeServiceNeeded[] = [
  'Individual Tax Return',
  'Business Tax Return',
  'Bookkeeping',
  'Tax Resolution',
  'Other',
];

const BEST_TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Anytime'];

/**
 * Post-purchase client intake (Fiverr-style order requirements). Collects the
 * required contact fields + screening questions and persists them to the order
 * so the assigned pro can review the requirements and reach out.
 */
const ClientIntakeModal: React.FC<ClientIntakeModalProps> = ({
  open,
  onClose,
  proName,
  defaults,
  onSubmit,
}) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [claimingDependents, setClaimingDependents] = useState<'yes' | 'no'>('no');
  const [selfEmployed, setSelfEmployed] = useState<'yes' | 'no'>('no');
  const [serviceNeeded, setServiceNeeded] = useState<IntakeServiceNeeded>('Individual Tax Return');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [bestTimeToCall, setBestTimeToCall] = useState('Anytime');

  // Seed from defaults whenever the modal (re)opens.
  useEffect(() => {
    if (!open) return;
    setFirstName(defaults?.firstName || '');
    setLastName(defaults?.lastName || '');
    setPhone(defaults?.phone || '');
    setEmail(defaults?.email || '');
    setClaimingDependents(defaults?.claimingDependents === 'yes' ? 'yes' : 'no');
    setSelfEmployed(defaults?.selfEmployed === 'yes' ? 'yes' : 'no');
    setServiceNeeded(defaults?.serviceNeeded || 'Individual Tax Return');
    setAdditionalInfo(defaults?.additionalInfo || '');
    setBestTimeToCall(defaults?.bestTimeToCall || 'Anytime');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: 'Name required', description: 'Please enter your first and last name.', variant: 'destructive' });
      return;
    }
    if (!phone.trim()) {
      toast({ title: 'Phone required', description: 'Your pro needs a phone number to contact you.', variant: 'destructive' });
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast({ title: 'Valid email required', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        claimingDependents,
        selfEmployed,
        serviceNeeded,
        additionalInfo: additionalInfo.trim(),
        bestTimeToCall: bestTimeToCall.trim(),
      });
      toast({
        title: 'Requirements submitted',
        description: `${proName ? proName.split(',')[0] : 'Your tax pro'} now has everything they need to get started.`,
      });
      onClose();
    } catch (e: any) {
      toast({
        title: 'Could not submit',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Order requirements
            </span>
          </div>
          <DialogTitle>Tell your tax pro how to reach you</DialogTitle>
          <DialogDescription>
            {proName ? `${proName.split(',')[0]} will use this to contact you and complete your intake.` : 'Your tax pro will use this to contact you and complete your intake.'} All fields marked <span className="text-red-500">*</span> are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="intake-first">First name <span className="text-red-500">*</span></Label>
              <Input id="intake-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div>
              <Label htmlFor="intake-last">Last name <span className="text-red-500">*</span></Label>
              <Input id="intake-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="intake-phone">Phone number <span className="text-red-500">*</span></Label>
              <Input id="intake-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div>
              <Label htmlFor="intake-email">Email <span className="text-red-500">*</span></Label>
              <Input id="intake-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
          </div>

          <div>
            <Label>Will you be claiming any dependents?</Label>
            <RadioGroup
              value={claimingDependents}
              onValueChange={(v) => setClaimingDependents(v as 'yes' | 'no')}
              className="mt-2 flex gap-3"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                <RadioGroupItem value="yes" /> Yes
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                <RadioGroupItem value="no" /> No
              </label>
            </RadioGroup>
          </div>

          <div>
            <Label>Are you self-employed or own a business?</Label>
            <RadioGroup
              value={selfEmployed}
              onValueChange={(v) => setSelfEmployed(v as 'yes' | 'no')}
              className="mt-2 flex gap-3"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                <RadioGroupItem value="yes" /> Yes
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                <RadioGroupItem value="no" /> No
              </label>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="intake-service">What tax service do you need help with?</Label>
            <Select value={serviceNeeded} onValueChange={(v) => setServiceNeeded(v as IntakeServiceNeeded)}>
              <SelectTrigger id="intake-service" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="intake-notes">Anything else the tax professional should know before contacting you?</Label>
            <Textarea
              id="intake-notes"
              rows={3}
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Special circumstances, questions, deadlines…"
            />
          </div>

          <div>
            <Label htmlFor="intake-besttime">Best time to call you?</Label>
            <Select value={bestTimeToCall} onValueChange={setBestTimeToCall}>
              <SelectTrigger id="intake-besttime" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BEST_TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Later
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Submit requirements</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientIntakeModal;
