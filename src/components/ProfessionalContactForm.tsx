import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MessageCircle, Send, CheckCircle2, LogIn, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitContactForm } from '@/services/contactFormService';
import { createConversationFromContactSubmission } from '@/services/messagingService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { queueFirebaseEmail, buildBrandedEmail } from '@/services/firebaseEmailService';


interface ProfessionalContactFormProps {
  professionalName: string;
  professionalId: string;
  /** Professional's email address so we can send them a notification of the inquiry. */
  professionalEmail?: string;
  /** Optional trigger override. If omitted, a default "Contact Professional" button is used. */
  trigger?: React.ReactNode;
}

const SERVICE_OPTIONS = [
  { value: 'tax-preparation', label: 'Tax Preparation' },
  { value: 'tax-planning', label: 'Tax Planning' },
  { value: 'business-taxes', label: 'Business Taxes' },
  { value: 'audit-representation', label: 'Audit Representation' },
  { value: 'bookkeeping', label: 'Bookkeeping' },
  { value: 'consultation', label: 'General Consultation' },
  { value: 'other', label: 'Other / Not Sure' },
];

const CONTACT_METHOD_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'message', label: 'In-app Message' },
  { value: 'either', label: 'Either Email or Phone' },
];

const findLabel = (
  options: { value: string; label: string }[],
  value: string,
): string => options.find((o) => o.value === value)?.label || '';

/**
 * Native <select> wrapper styled to match shadcn's SelectTrigger. We use a
 * native select (instead of Radix Select) because the Radix popover content
 * can fight with the parent Dialog's pointer/focus traps on some browsers,
 * which is why the dropdown previously appeared "frozen" inside this modal.
 *
 * Native selects are also more accessible on mobile (system-native picker).
 */
const NativeSelect: React.FC<{
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  required?: boolean;
}> = ({ id, value, onChange, options, placeholder, required }) => (
  <div className="relative">
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={
        'flex h-10 w-full appearance-none items-center justify-between rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ' +
        'ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary/50 ' +
        'disabled:cursor-not-allowed disabled:opacity-50 transition-colors ' +
        (value ? 'text-foreground' : 'text-muted-foreground/70')
      }
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-60" />
  </div>
);

const ProfessionalContactForm: React.FC<ProfessionalContactFormProps> = ({
  professionalName,
  professionalId,
  professionalEmail,
  trigger,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    serviceType: '',
    message: '',
    preferredContact: 'email',
  });

  // Pre-fill name & email when a logged-in user opens the dialog.
  useEffect(() => {
    if (isOpen && user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [isOpen, user]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetAndClose = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: '',
      serviceType: '',
      message: '',
      preferredContact: 'email',
    });
    setSubmitted(false);
    setConversationId(null);
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Basic validation.
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in your name, email and message.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    let createdConversationId: string | null = null;

    try {
      // 1) Save the contact submission to Firestore for the admin inbox.
      let submissionId: string | undefined;
      try {
        const res = await submitContactForm({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          service_type: formData.serviceType,
          message: formData.message,
          preferred_contact: formData.preferredContact,
          professional_id: professionalId,
          professional_name: professionalName,
          form_type: 'professional_contact',
          client_id: user?.uid,
        });
        submissionId = res.id;
      } catch (submissionErr) {
        // Don't block messaging if submission write fails (e.g. rules).
        console.warn('Contact submission save failed:', (submissionErr as Error).message);
      }

      // 2) If the user is logged in, also create a real Firestore conversation
      //    so the professional + client can continue the dialogue in the Member Portal.
      if (user?.uid) {
        try {
          createdConversationId = await createConversationFromContactSubmission({
            clientId: user.uid,
            clientName: formData.name || user.name,
            clientEmail: formData.email || user.email,
            professionalId,
            professionalName,
            serviceType: formData.serviceType,
            message: formData.message,
            phone: formData.phone,
            preferredContact: formData.preferredContact,
          });
        } catch (convErr) {
          console.warn('Conversation creation failed:', (convErr as Error).message);
        }
      }

      // 3) Always subscribe the email to the CRM list.
      try {
        await fetch(
          'https://famous.ai/api/crm/68a3939608e7f1e2bfd480c9/subscribe',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              name: formData.name,
              source: 'professional-contact-form',
              tags: ['contact-form', 'lead', professionalName].filter(Boolean),
            }),
          },
        );
      } catch (crmErr) {
        console.warn('CRM subscribe failed:', (crmErr as Error).message);
      }

      // 4) Send a branded email notification to the professional so they
      //    actually find out about the inquiry (separately from in-portal
      //    messaging). We don't block the user flow if this fails.
      //
      // We fire TWO independent paths in parallel so a single failure (e.g.
      // Supabase project paused, edge function not deployed) doesn't silently
      // swallow the notification:
      //   a) Supabase edge function `send-professional-inquiry` (Gmail SMTP)
      //   b) Firestore `mail` queue, consumed by the Firebase Trigger Email
      //      extension. This works even when Supabase is INACTIVE.
      if (professionalEmail) {
        const portalUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}/member-portal?tab=messages`
            : 'https://refund-connect-1m30.web.app/member-portal?tab=messages';
        const portalLink = createdConversationId
          ? `${portalUrl}&conversation=${encodeURIComponent(createdConversationId)}`
          : portalUrl;
        const serviceLabel =
          findLabel(SERVICE_OPTIONS, formData.serviceType) || formData.serviceType;
        const preferredLabel =
          findLabel(CONTACT_METHOD_OPTIONS, formData.preferredContact) ||
          formData.preferredContact;

        // (a) Supabase edge function — keep, but don't depend on it.
        try {
          const { error: fnError } = await supabase.functions.invoke(
            'send-professional-inquiry',
            {
              body: {
                professionalEmail,
                professionalName,
                clientName: formData.name,
                clientEmail: formData.email,
                clientPhone: formData.phone,
                serviceType: serviceLabel,
                preferredContact: preferredLabel,
                message: formData.message,
                conversationId: createdConversationId,
                portalUrl,
              },
            },
          );
          if (fnError) {
            console.warn(
              '[ProfessionalContactForm] Supabase send-professional-inquiry failed:',
              fnError.message,
            );
          }
        } catch (emailErr) {
          console.warn(
            '[ProfessionalContactForm] Supabase send-professional-inquiry threw:',
            (emailErr as Error).message,
          );
        }

        // (b) Firebase `mail` queue fallback — always runs.
        try {
          const html = buildBrandedEmail({
            title: `New client inquiry from ${formData.name}`,
            intro: `${formData.name} just contacted you through your RefundConnect profile. Reply within 24 hours to keep your response-time rating high.`,
            rows: [
              { label: 'Name', value: formData.name },
              { label: 'Email', value: formData.email },
              ...(formData.phone ? [{ label: 'Phone', value: formData.phone }] : []),
              ...(serviceLabel ? [{ label: 'Service needed', value: serviceLabel }] : []),
              ...(preferredLabel ? [{ label: 'Preferred contact', value: preferredLabel }] : []),
              { label: 'Message', value: formData.message },
            ],
            ctaLabel: 'Reply in Member Portal',
            ctaUrl: portalLink,
            footer:
              'RefundConnect · You are receiving this because a client contacted you through your public profile.',
          });
          const text =
            `New client inquiry from ${formData.name}\n\n` +
            `Email: ${formData.email}\n` +
            (formData.phone ? `Phone: ${formData.phone}\n` : '') +
            (serviceLabel ? `Service: ${serviceLabel}\n` : '') +
            (preferredLabel ? `Preferred contact: ${preferredLabel}\n` : '') +
            `\nMessage:\n${formData.message}\n\n` +
            `Reply in Member Portal: ${portalLink}\n`;
          await queueFirebaseEmail({
            to: professionalEmail,
            subject: `New client inquiry from ${formData.name}${serviceLabel ? ` — ${serviceLabel}` : ''}`,
            html,
            text,
            category: 'professional_inquiry',
            meta: {
              professionalId,
              professionalName,
              professionalEmail,
              clientName: formData.name,
              clientEmail: formData.email,
              clientPhone: formData.phone,
              serviceType: serviceLabel,
              preferredContact: preferredLabel,
              conversationId: createdConversationId,
            },
          });
        } catch (queueErr) {
          console.warn(
            '[ProfessionalContactForm] Firebase mail queue fallback failed:',
            (queueErr as Error).message,
          );
        }
      } else {
        console.warn(
          `[ProfessionalContactForm] No email on file for professional ${professionalName} (${professionalId}); skipped inquiry email.`,
        );
      }


      setConversationId(createdConversationId);
      setSubmitted(true);

      toast({
        title: 'Message sent',
        description: createdConversationId
          ? `Your message has been delivered to ${professionalName}. Continue the conversation in your Member Portal.`
          : `Your message has been sent to ${professionalName}. They will contact you soon.`,
      });
    } catch (error) {
      console.error('Contact form submission error:', error);
      toast({
        title: 'Something went wrong',
        description:
          'We could not send your message. Please try again, or contact the professional by phone.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) resetAndClose();
        else setIsOpen(true);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="w-full">
            <MessageCircle className="h-4 w-4 mr-2" />
            Contact Professional
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact {professionalName}</DialogTitle>
          <DialogDescription>
            Send a private message.{' '}
            {user
              ? 'You can continue the conversation from your Member Portal.'
              : 'Create an account to receive replies directly in your portal.'}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-900">
                <p className="font-semibold">Message delivered to {professionalName}</p>
                <p className="mt-1">
                  {conversationId
                    ? "A conversation thread has been opened in your Member Portal. You'll be notified when they reply."
                    : "They'll be in touch using your preferred contact method."}
                </p>
                {professionalEmail && (
                  <p className="mt-2 text-xs text-green-800">
                    We've also emailed your inquiry to {professionalName} directly.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {conversationId ? (
                <Button
                  className="flex-1"
                  onClick={() => {
                    resetAndClose();
                    navigate(`/member-portal?tab=messages&conversation=${conversationId}`);
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Open in Member Portal
                </Button>
              ) : !user ? (
                <Button
                  className="flex-1"
                  onClick={() => {
                    resetAndClose();
                    navigate('/member-portal');
                  }}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Log in to track replies
                </Button>
              ) : null}
              <Button variant="outline" className="flex-1" onClick={resetAndClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact-name">Full Name *</Label>
                <Input
                  id="contact-name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="contact-email">Email *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="contact-phone">Phone Number</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                autoComplete="tel"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="contact-service">Service Needed</Label>
              <NativeSelect
                id="contact-service"
                value={formData.serviceType}
                onChange={(value) => handleChange('serviceType', value)}
                options={SERVICE_OPTIONS}
                placeholder="Select service type"
              />
            </div>

            <div>
              <Label htmlFor="contact-message">Message *</Label>
              <Textarea
                id="contact-message"
                placeholder="Tell them what you need help with..."
                value={formData.message}
                onChange={(e) => handleChange('message', e.target.value)}
                required
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="contact-method">Preferred Contact Method</Label>
              <NativeSelect
                id="contact-method"
                value={formData.preferredContact}
                onChange={(value) => handleChange('preferredContact', value)}
                options={CONTACT_METHOD_OPTIONS}
                placeholder="How should they reach you?"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                'Sending...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>

            {!user && (
              <p className="text-xs text-center text-gray-500">
                Tip: log in before contacting and your conversation will land directly in your Member Portal.
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfessionalContactForm;
