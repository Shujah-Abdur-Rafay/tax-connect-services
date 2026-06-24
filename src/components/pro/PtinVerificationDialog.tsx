import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { savePtin, isValidPtin } from '@/services/ptinService';

interface PtinVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  /** Initial value (e.g. a previously-entered but unsaved PTIN). */
  initialPtin?: string;
  /** Called once a valid PTIN is saved. */
  onVerified: (ptin: string) => void;
}

/**
 * Phase 4 — captures & format-verifies a preparer's PTIN before they can
 * subscribe to a paid tier. Writes to the pro's own professionals/{uid} doc.
 */
const PtinVerificationDialog: React.FC<PtinVerificationDialogProps> = ({
  open,
  onOpenChange,
  uid,
  initialPtin = '',
  onVerified,
}) => {
  const { toast } = useToast();
  const [ptin, setPtin] = useState(initialPtin);
  const [saving, setSaving] = useState(false);

  const valid = isValidPtin(ptin);

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const saved = await savePtin(uid, ptin);
      toast({ title: 'PTIN verified', description: 'Your PTIN is on file. You can continue.' });
      onVerified(saved);
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: 'Could not save PTIN',
        description: e?.message || 'Please check the format and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Verify your PTIN
          </DialogTitle>
          <DialogDescription>
            The IRS requires a valid PTIN to prepare returns for compensation. Paid membership
            tiers need one on file before you can subscribe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="ptin-input">PTIN</Label>
            <Input
              id="ptin-input"
              value={ptin}
              onChange={(e) => setPtin(e.target.value.toUpperCase())}
              placeholder="P12345678"
              maxLength={9}
              className="mt-1.5 font-mono tracking-wider"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-slate-500">
              Format: the letter <strong>P</strong> followed by 8 digits.
            </p>
            {ptin && !valid && (
              <p className="mt-1 text-xs text-red-600">
                That doesn't look like a valid PTIN yet.
              </p>
            )}
          </div>

          <a
            href="https://www.irs.gov/tax-professionals/ptin-requirements-for-tax-return-preparers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Don't have a PTIN? Get one free from the IRS
            <ExternalLink className="h-3 w-3" />
          </a>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!valid || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save & verify'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PtinVerificationDialog;
