import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, CheckCircle2, FileText, Sparkles, Package } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createGigOrder } from '@/services/gigOrdersService';
import { Link } from 'react-router-dom';
import type { TaxGig, GigTier } from '@/data/taxGigs';


interface ProjectBriefModalProps {
  open: boolean;
  onClose: () => void;
  gig: TaxGig | null;
  tier: GigTier | null;
}

const FILING_STATUSES = ['Single', 'Married Filing Jointly', 'Married Filing Separately', 'Head of Household', 'Qualifying Widow(er)'];
const INCOME_SOURCES = ['W-2 wages', '1099 / freelance', 'Self-employment / business', 'Rental property', 'Investment / dividends', 'Crypto / NFT', 'Retirement (IRA / 401k)', 'Social Security', 'Foreign income', 'Other'];

const ProjectBriefModal: React.FC<ProjectBriefModalProps> = ({ open, onClose, gig, tier }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [filingStatus, setFilingStatus] = useState('Single');
  const [dependents, setDependents] = useState('0');
  const [states, setStates] = useState('');
  const [incomeSources, setIncomeSources] = useState<string[]>(['W-2 wages']);
  const [hasPriorYearReturn, setHasPriorYearReturn] = useState('yes');
  const [urgency, setUrgency] = useState('normal');
  const [notes, setNotes] = useState('');

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const toggleIncomeSource = (src: string) => {
    setIncomeSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
    );
  };

  const reset = () => {
    setStep(1); setSubmitted(false); setSubmitting(false); setOrderId(null);
    setName(''); setEmail(''); setPhone('');
    setFilingStatus('Single'); setDependents('0'); setStates('');
    setIncomeSources(['W-2 wages']); setHasPriorYearReturn('yes');
    setUrgency('normal'); setNotes('');
  };

  const handleClose = () => { reset(); onClose(); };


  const handleSubmit = async () => {
    if (!email || !email.includes('@')) {
      toast({ title: 'Email required', description: 'We need your email to send the brief.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // 1. Add to CRM (newsletter / contact list)
      await fetch('https://famous.ai/api/crm/68a3939608e7f1e2bfd480c9/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          source: 'project-brief',
          tags: [
            'project-brief',
            `gig-${gig?.slug ?? 'unknown'}`,
            `tier-${tier?.name?.toLowerCase() ?? 'standard'}`,
            `urgency-${urgency}`,
            `filing-${filingStatus.toLowerCase().replace(/\s+/g, '-')}`,
            ...incomeSources.map((s) => `income-${s.toLowerCase().split(' ')[0]}`),
          ],
          custom_fields: {
            gig_title: gig?.title,
            gig_id: gig?.id,
            pro_name: gig?.proName,
            tier_name: tier?.name,
            tier_price: tier?.price,
            tier_delivery_days: tier?.deliveryDays,
            filing_status: filingStatus,
            dependents: Number(dependents) || 0,
            states_filed: states,
            income_sources: incomeSources.join(', '),
            has_prior_year_return: hasPriorYearReturn,
            urgency,
            phone,
            notes,
            submitted_at: new Date().toISOString(),
          },
        }),
      }).catch((e) => console.warn('[ProjectBriefModal] CRM subscribe failed:', e));

      // 2. If the client is logged in, create a real order document in Firestore.
      //    Otherwise we still send the brief via CRM — they can sign up later to track it.
      if (user && gig && tier) {
        try {
          const order = await createGigOrder({
            gigId: gig.id,
            gigSlug: gig.slug,
            gigTitle: gig.title,
            gigImage: gig.image,
            proId: gig.proId,
            proName: gig.proName,
            proAvatar: gig.proAvatar,
            clientUid: user.uid,
            clientName: name || user.name,
            clientEmail: email || user.email,
            clientPhone: phone,
            tier: {
              name: tier.name,
              price: tier.price,
              deliveryDays: tier.deliveryDays,
              revisions: tier.revisions,
            },
            brief: {
              filingStatus,
              dependents: Number(dependents) || 0,
              states,
              incomeSources,
              hasPriorYearReturn,
              urgency,
              notes,
              clientName: name,
              clientEmail: email,
              clientPhone: phone,
            },
          });
          setOrderId(order.id);
        } catch (orderErr: any) {
          console.warn('[ProjectBriefModal] Order creation failed:', orderErr);
          toast({
            title: 'Brief sent — order not saved',
            description: orderErr?.message || 'Your brief reached the pro but we could not save the order to your dashboard.',
          });
        }
      }

      setSubmitted(true);
      toast({
        title: 'Brief sent!',
        description: `${gig?.proName?.split(',')[0]} will review your project and respond ${gig?.responseTime?.toLowerCase() ?? 'soon'}.`,
      });
    } catch (err) {
      toast({
        title: 'Something went wrong',
        description: 'Please try again or message the pro directly.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };


  if (!gig || !tier) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-green-100">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Brief sent to {gig.proName.split(',')[0]}</h2>
            <p className="mt-2 text-gray-600">They typically reply {gig.responseTime.toLowerCase()}. You'll get a quote and next steps by email.</p>
            {orderId && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
                <Package className="h-3 w-3" /> Order #{orderId.slice(0, 8)} created in your dashboard
              </div>
            )}
            <div className="mt-6 rounded-lg border bg-blue-50 p-4 text-left text-sm">
              <p className="font-semibold text-blue-900">What happens next</p>
              <ol className="mt-2 space-y-1 text-blue-800">
                <li>1. {gig.proName.split(',')[0]} reviews your brief</li>
                <li>2. You receive a confirmed quote & timeline</li>
                <li>3. Pay securely — funds held in escrow</li>
                <li>4. Upload documents in the secure portal</li>
                <li>5. Review & accept your delivered return</li>
              </ol>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {orderId && (
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/my-orders" onClick={handleClose}>View my orders</Link>
                </Button>
              )}
              <Button onClick={handleClose} className="flex-1">Done</Button>
            </div>
          </div>

        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <Badge variant="outline" className="text-xs">Project Brief · {tier.name} · ${tier.price}</Badge>
              </div>
              <DialogTitle>Tell {gig.proName.split(',')[0]} about your tax situation</DialogTitle>
              <DialogDescription>
                Takes about 90 seconds. The more detail you share, the faster we get you a precise quote.
              </DialogDescription>
            </DialogHeader>

            <div className="mb-4">
              <div className="mb-1 flex justify-between text-xs text-gray-500">
                <span>Step {step} of {totalSteps}</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">1. Filing basics</h3>
                <div>
                  <Label>Filing status</Label>
                  <RadioGroup value={filingStatus} onValueChange={setFilingStatus} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {FILING_STATUSES.map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-gray-50">
                        <RadioGroupItem value={s} />
                        <span>{s}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="deps">Dependents</Label>
                    <Input id="deps" type="number" min={0} value={dependents} onChange={(e) => setDependents(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="states">State(s) to file</Label>
                    <Input id="states" placeholder="e.g. CA, NY" value={states} onChange={(e) => setStates(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">2. Income sources <span className="font-normal text-gray-500">(select all that apply)</span></h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {INCOME_SOURCES.map((src) => (
                    <label key={src} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-gray-50">
                      <Checkbox checked={incomeSources.includes(src)} onCheckedChange={() => toggleIncomeSource(src)} />
                      <span>{src}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">3. Context & urgency</h3>
                <div>
                  <Label>Do you have a prior-year tax return?</Label>
                  <RadioGroup value={hasPriorYearReturn} onValueChange={setHasPriorYearReturn} className="mt-2 flex gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                      <RadioGroupItem value="yes" /> Yes
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                      <RadioGroupItem value="no" /> No
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                      <RadioGroupItem value="not-sure" /> Not sure
                    </label>
                  </RadioGroup>
                </div>
                <div>
                  <Label>How soon do you need this done?</Label>
                  <RadioGroup value={urgency} onValueChange={setUrgency} className="mt-2 grid grid-cols-3 gap-2">
                    <label className="flex cursor-pointer flex-col items-start rounded-md border p-3 text-sm hover:bg-gray-50">
                      <RadioGroupItem value="normal" className="mb-1" />
                      <span className="font-semibold">Standard</span>
                      <span className="text-xs text-gray-500">Standard timeline</span>
                    </label>
                    <label className="flex cursor-pointer flex-col items-start rounded-md border p-3 text-sm hover:bg-gray-50">
                      <RadioGroupItem value="rush" className="mb-1" />
                      <span className="font-semibold">Rush</span>
                      <span className="text-xs text-gray-500">Within 48 hrs</span>
                    </label>
                    <label className="flex cursor-pointer flex-col items-start rounded-md border p-3 text-sm hover:bg-gray-50">
                      <RadioGroupItem value="urgent" className="mb-1" />
                      <span className="font-semibold">Urgent</span>
                      <span className="text-xs text-gray-500">Same-day if possible</span>
                    </label>
                  </RadioGroup>
                </div>
                <div>
                  <Label htmlFor="notes">Anything else? <span className="text-gray-400">(optional)</span></Label>
                  <Textarea id="notes" rows={3} placeholder="Special circumstances, questions, concerns..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">4. Your contact info</h3>
                <div>
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone <span className="text-gray-400">(optional)</span></Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                </div>

                <div className="rounded-lg border bg-blue-50 p-4 text-sm">
                  <p className="font-semibold text-blue-900 flex items-center gap-1"><Sparkles className="h-4 w-4" /> Brief summary</p>
                  <ul className="mt-2 space-y-1 text-blue-800">
                    <li><strong>Service:</strong> {gig.title}</li>
                    <li><strong>Package:</strong> {tier.name} (${tier.price}, {tier.deliveryDays}d delivery)</li>
                    <li><strong>Filing:</strong> {filingStatus} · {dependents} dependent(s)</li>
                    <li><strong>Income:</strong> {incomeSources.join(', ')}</li>
                    <li><strong>Urgency:</strong> {urgency}</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1 || submitting}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              {step < totalSteps ? (
                <Button onClick={() => setStep((s) => s + 1)} className="bg-blue-600 hover:bg-blue-700">
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                  {submitting ? 'Sending...' : 'Send brief to pro'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectBriefModal;
