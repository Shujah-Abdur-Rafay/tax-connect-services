import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ShieldCheck, Eraser, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Terms & Conditions Agreement Step
 *
 * Legally captures:
 *   - The full text of the agreement the user is signing (snapshotted into
 *     the signature record so the contract can be reproduced later even if
 *     the master document changes)
 *   - A drawn-on-canvas signature (PNG data URL)
 *   - The signer's typed full name + email + initials
 *   - ESIGN Act consent (15 U.S.C. §7001)
 *   - Timestamp (ISO) and best-effort client IP + user agent for audit
 *
 * The resulting `SignedAgreement` object is returned to the parent and
 * persisted alongside the rest of the onboarding application in Firestore.
 *
 * NOTE: The agreement text below is the standard Refund Connect Independent
 * Tax Preparer Agreement. If the master Word document is updated, also
 * update AGREEMENT_VERSION + AGREEMENT_BODY so the snapshot stays current.
 */

export const AGREEMENT_VERSION = '2026-05-27.v1';
export const AGREEMENT_TITLE = 'Independent Tax Preparer Agreement & Terms of Service';

export const AGREEMENT_BODY = `INDEPENDENT TAX PREPARER AGREEMENT & TERMS OF SERVICE

This Independent Tax Preparer Agreement ("Agreement") is entered into between
Refund Connect ("Company", "we", "us") and the undersigned applicant ("Preparer",
"you") as of the date the Preparer electronically signs this Agreement.

1.  RELATIONSHIP. Preparer is engaged as an independent contractor and not as
    an employee, partner, joint venturer, or agent of Company. Nothing in this
    Agreement creates an employment relationship. Preparer is solely
    responsible for all federal, state, and local taxes on amounts paid under
    this Agreement and shall receive an IRS Form 1099-NEC where applicable.

2.  IRS COMPLIANCE & CREDENTIALS. Preparer represents and warrants that:
    (a) Preparer holds a current, valid PTIN issued by the IRS;
    (b) If preparing returns that require an EFIN, Preparer holds or operates
        under a valid EFIN;
    (c) Preparer will comply at all times with IRS Circular 230, all
        applicable federal and state tax preparer regulations, the Gramm-Leach-
        Bliley Act safeguards rule, and the IRS Publication 4557 written
        information security plan requirements;
    (d) Preparer will not engage in any conduct that would subject Preparer or
        Company to IRS sanctions, including but not limited to fraudulent
        returns, EIC due-diligence violations, or unauthorized disclosure of
        taxpayer information under 26 U.S.C. §7216.

3.  CONFIDENTIALITY & TAXPAYER DATA. All taxpayer information accessed through
    the Company's platform is confidential. Preparer agrees to (i) use such
    information solely to provide services to that taxpayer, (ii) maintain a
    written data-security plan, (iii) immediately report any suspected data
    breach to Company, and (iv) not disclose taxpayer information to any third
    party except as permitted by law and by signed taxpayer consent under
    26 U.S.C. §7216.

4.  COMPENSATION. Preparer will be compensated according to the membership
    tier selected (Associate, Professional, or Premier Partner) as published
    on the Company's website at the time of enrollment. Tier-specific rates,
    revenue splits, and bank-product fees are incorporated by reference.
    Company may modify forward-looking compensation with thirty (30) days'
    written notice; Preparer's exclusive remedy for any compensation change is
    to terminate this Agreement.

5.  PLATFORM FEES & MEMBERSHIP. Annual membership fees (Associate $99.95,
    Professional $299.95, Premier Partner $499.95) are non-refundable after
    fourteen (14) days from purchase. Preparer authorizes Company (or its
    payment processor, Stripe, Inc.) to charge the payment method on file for
    the selected tier and any renewals unless cancelled at least seven (7)
    days prior to renewal.

6.  NON-SOLICITATION. During the term of this Agreement and for twelve (12)
    months thereafter, Preparer shall not solicit any client, taxpayer, lead,
    or staff member introduced to Preparer through the Company's platform for
    services outside the platform, except for clients with whom Preparer had a
    documented prior relationship before joining the platform.

7.  INDEMNIFICATION. Preparer shall indemnify, defend, and hold harmless
    Company, its officers, directors, employees, and affiliates from and
    against any and all claims, losses, damages, penalties, fines, judgments,
    and reasonable attorneys' fees arising out of or relating to (a) any
    return prepared or signed by Preparer, (b) Preparer's breach of this
    Agreement, (c) Preparer's violation of any law or regulation, or
    (d) Preparer's negligence or willful misconduct.

8.  LIMITATION OF LIABILITY. EXCEPT FOR PREPARER'S INDEMNIFICATION OBLIGATIONS
    AND BREACHES OF CONFIDENTIALITY, NEITHER PARTY SHALL BE LIABLE FOR ANY
    INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. COMPANY'S
    AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE FEES PAID BY
    PREPARER TO COMPANY DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

9.  TERM & TERMINATION. This Agreement begins on the date of electronic
    signature and continues until terminated by either party. Either party may
    terminate this Agreement at any time, with or without cause, upon written
    notice (email sufficient). Sections 3 (Confidentiality), 6 (Non-
    Solicitation), 7 (Indemnification), 8 (Limitation of Liability), and 11
    (Governing Law) survive termination.

10. INTELLECTUAL PROPERTY. All software, marketing materials, templates,
    client lists, and platform content provided by Company remain the sole
    property of Company. Preparer is granted a limited, non-exclusive,
    revocable license to use such materials solely while this Agreement is in
    effect.

11. GOVERNING LAW & DISPUTE RESOLUTION. This Agreement is governed by the
    laws of the State of Georgia, without regard to conflicts of laws
    principles. Any dispute arising out of or relating to this Agreement that
    cannot be resolved informally shall be resolved by binding arbitration
    administered by the American Arbitration Association under its Commercial
    Arbitration Rules, with the seat of arbitration in Atlanta, Georgia.
    PREPARER AND COMPANY EACH WAIVE THE RIGHT TO A JURY TRIAL AND THE RIGHT
    TO PARTICIPATE IN A CLASS ACTION.

12. ELECTRONIC SIGNATURE & RECORD. The parties consent to conduct this
    transaction electronically under the Electronic Signatures in Global and
    National Commerce Act, 15 U.S.C. §7001 et seq. ("ESIGN Act"), and any
    applicable state Uniform Electronic Transactions Act. Preparer agrees
    that (a) Preparer's electronic signature has the same legal effect as a
    handwritten signature, (b) Preparer is able to access, view, and retain a
    copy of this Agreement in PDF form, and (c) Company may rely on the
    timestamp, IP address, user agent, and signature image captured at the
    time of signing as conclusive evidence of execution.

13. ENTIRE AGREEMENT. This Agreement, together with the membership-tier terms
    incorporated by reference, constitutes the entire agreement between the
    parties and supersedes all prior agreements, proposals, and communications,
    written or oral.

By signing below, you acknowledge that you have read, understood, and agree
to be legally bound by every section of this Agreement, and that you have had
the opportunity to consult with independent legal counsel before signing.`;

export interface SignedAgreement {
  agreementVersion: string;
  agreementTitle: string;
  agreementBody: string; // full snapshot of T&C text at time of signing
  signerName: string;
  signerEmail: string;
  signerInitials: string;
  signatureImage: string; // PNG data URL of drawn signature
  esignConsent: boolean;
  readConfirmed: boolean;
  signedAt: string; // ISO
  clientIp: string | null;
  userAgent: string;
}

interface Props {
  defaultName: string;
  defaultEmail: string;
  onBack: () => void;
  onSigned: (signed: SignedAgreement) => void;
}

const TermsAgreementStep: React.FC<Props> = ({ defaultName, defaultEmail, onBack, onSigned }) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  const [signerName, setSignerName] = useState(defaultName);
  const [signerEmail, setSignerEmail] = useState(defaultEmail);
  const [signerInitials, setSignerInitials] = useState('');
  const [readConfirmed, setReadConfirmed] = useState(false);
  const [esignConsent, setEsignConsent] = useState(false);
  const [agreeAll, setAgreeAll] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientIp, setClientIp] = useState<string | null>(null);

  // Best-effort client IP for the audit record. Falls back gracefully if the
  // lookup fails or is blocked — IP capture must never block signing.
  useEffect(() => {
    let cancelled = false;
    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.ip) setClientIp(j.ip);
      })
      .catch(() => {
        /* non-blocking */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Canvas signature drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas resolution
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a8a';

    const getXY = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = 'touches' in e ? e.touches[0] : (e as MouseEvent);
      return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawingRef.current = true;
      hasDrawnRef.current = true;
      const { x, y } = getXY(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const { x, y } = getXY(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = () => {
      drawingRef.current = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) setScrolledToBottom(true);
  };

  const downloadCopy = () => {
    const blob = new Blob(
      [
        `${AGREEMENT_TITLE}\n`,
        `Version: ${AGREEMENT_VERSION}\n`,
        `Downloaded: ${new Date().toISOString()}\n\n`,
        AGREEMENT_BODY,
      ],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Alliance-Tax-Agreement-${AGREEMENT_VERSION}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim()) {
      toast({ title: 'Name required', description: 'Please type your full legal name.', variant: 'destructive' });
      return;
    }
    if (!signerEmail.trim()) {
      toast({ title: 'Email required', description: 'Please confirm your email.', variant: 'destructive' });
      return;
    }
    if (signerInitials.trim().length < 2) {
      toast({ title: 'Initials required', description: 'Please type your initials.', variant: 'destructive' });
      return;
    }
    if (!readConfirmed || !esignConsent || !agreeAll) {
      toast({
        title: 'All consents required',
        description: 'Please check all three confirmation boxes.',
        variant: 'destructive',
      });
      return;
    }
    if (!hasDrawnRef.current) {
      toast({
        title: 'Signature required',
        description: 'Please draw your signature in the box below.',
        variant: 'destructive',
      });
      return;
    }

    const canvas = canvasRef.current;
    const signatureImage = canvas ? canvas.toDataURL('image/png') : '';

    setSubmitting(true);
    const signed: SignedAgreement = {
      agreementVersion: AGREEMENT_VERSION,
      agreementTitle: AGREEMENT_TITLE,
      agreementBody: AGREEMENT_BODY,
      signerName: signerName.trim(),
      signerEmail: signerEmail.trim(),
      signerInitials: signerInitials.trim().toUpperCase(),
      signatureImage,
      esignConsent,
      readConfirmed,
      signedAt: new Date().toISOString(),
      clientIp,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
    onSigned(signed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          {AGREEMENT_TITLE}
        </CardTitle>
        <CardDescription>
          Please read the full agreement carefully, then sign below. A copy will be
          saved to your account and a confirmation will be emailed to you for your records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Agreement text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Agreement (version {AGREEMENT_VERSION})</Label>
              <Button type="button" variant="outline" size="sm" onClick={downloadCopy}>
                <Download className="h-4 w-4 mr-1" />
                Download a copy
              </Button>
            </div>
            <div
              onScroll={handleScroll}
              className="h-72 overflow-y-auto border rounded-lg p-4 bg-gray-50 text-sm whitespace-pre-wrap font-mono leading-relaxed"
            >
              {AGREEMENT_BODY}
            </div>
            {!scrolledToBottom && (
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
                Please scroll to the bottom of the agreement before signing.
              </p>
            )}
          </div>

          {/* Signer info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="sigName">Full Legal Name *</Label>
              <Input
                id="sigName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="As it appears on your ID"
                required
              />
            </div>
            <div>
              <Label htmlFor="sigInitials">Initials *</Label>
              <Input
                id="sigInitials"
                value={signerInitials}
                onChange={(e) => setSignerInitials(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="J.D."
                maxLength={4}
                required
              />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="sigEmail">Email (for the signed copy) *</Label>
              <Input
                id="sigEmail"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Signature canvas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Draw Your Signature *</Label>
              <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                <Eraser className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sign with your mouse, trackpad, or finger on touch devices.
            </p>
          </div>

          {/* Consent checkboxes */}
          <div className="space-y-3 border-t pt-4">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={readConfirmed}
                onCheckedChange={(c) => setReadConfirmed(!!c)}
                disabled={!scrolledToBottom}
              />
              <span>
                I have <strong>read and understood</strong> the entire Independent Tax Preparer
                Agreement above.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={esignConsent}
                onCheckedChange={(c) => setEsignConsent(!!c)}
              />
              <span>
                I consent to sign this Agreement electronically under the ESIGN Act
                (15 U.S.C. §7001) and agree that my electronic signature has the same
                legal effect as a handwritten signature.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={agreeAll}
                onCheckedChange={(c) => setAgreeAll(!!c)}
              />
              <span>
                I agree to be <strong>legally bound</strong> by all terms of this Agreement,
                including the indemnification, non-solicitation, arbitration, and class-action
                waiver provisions.
              </span>
            </label>
          </div>

          {/* Audit footer */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
            <div><strong>Audit record (captured at signing):</strong></div>
            <div>Timestamp: {new Date().toLocaleString()}</div>
            <div>IP address: {clientIp || 'capturing…'}</div>
            <div className="truncate">User agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}</div>
            <div>Agreement version: {AGREEMENT_VERSION}</div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={submitting}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Sign & Submit Application
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TermsAgreementStep;
