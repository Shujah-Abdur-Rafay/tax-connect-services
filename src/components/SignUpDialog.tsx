import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface SignUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SignUpDialog: React.FC<SignUpDialogProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'client' as 'client' | 'professional',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAccountTypeChange = (type: 'client' | 'professional') => {
    setFormData({ ...formData, accountType: type });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register(formData.email, formData.password, formData.name, formData.accountType);

      // Apply pending referral, if any. Lazy-imported so it can't break signup.
      try {
        const { readPendingReferralCode, recordReferralSignup, clearPendingReferralCode } =
          await import('@/services/referralService');
        const { auth } = await import('@/lib/firebase');
        const code = readPendingReferralCode();
        const uid = auth?.currentUser?.uid;
        if (code && uid) {
          await recordReferralSignup({
            referredUid: uid,
            referredEmail: formData.email,
            referredName: formData.name,
            referrerCode: code,
          });
          clearPendingReferralCode();
        }
      } catch (refErr) {
        console.warn('[SignUpDialog] referral attach failed (non-fatal)', refErr);
      }

      if (formData.accountType === 'professional') {
        localStorage.setItem('startOnboardingAtStep', '2');
        localStorage.setItem('onboardingAccountCreated', 'true');
        onOpenChange(false);
        navigate('/onboarding');
      } else {
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.code === 'auth/configuration-not-found') {
        setError('Firebase Authentication is not enabled. Please enable Email/Password authentication in Firebase Console.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use a stronger password.');
      } else if (err.message && err.message.includes('Firebase')) {
        setError(`Firebase Error: ${err.message}.`);
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
          <DialogDescription>Join RefundConnect to access our platform</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" type="text" value={formData.name} onChange={handleInputChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleInputChange} required />
          </div>
          <div className="space-y-3">
            <Label>Account Type</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="client" checked={formData.accountType === 'client'} onCheckedChange={() => handleAccountTypeChange('client')} />
                <label htmlFor="client" className="text-sm font-medium cursor-pointer">Client - Looking for tax professionals</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="professional" checked={formData.accountType === 'professional'} onCheckedChange={() => handleAccountTypeChange('professional')} />
                <label htmlFor="professional" className="text-sm font-medium cursor-pointer">Tax Professional - Join our network</label>
              </div>
            </div>
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Account...</> : 'Create Account'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SignUpDialog;
