import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  resendVerificationEmail,
  checkEmailVerified,
  verificationErrorMessage,
} from '@/services/emailVerificationService';

// Seconds the resend button stays disabled after a successful send. Keeps the
// user from hammering Firebase and tripping auth/too-many-requests.
const RESEND_COOLDOWN = 60;

export const EmailVerificationStatus: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const user = auth.currentUser;

  const refreshStatus = useCallback(async () => {
    if (user) {
      const verified = await checkEmailVerified(user);
      setIsVerified(verified);
      return verified;
    }
    return false;
  }, [user]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Tick down the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (!user) return;
    setIsResending(true);
    setMessage(null);
    try {
      await resendVerificationEmail(user);
      setMessage({ type: 'success', text: 'Verification email sent! Please check your inbox.' });
      setCooldown(RESEND_COOLDOWN);
    } catch (error: any) {
      // resendVerificationEmail throws a plain Error("already verified"); other
      // failures are FirebaseErrors with a .code we translate for the user.
      if (error?.message === 'Your email is already verified.') {
        setIsVerified(true);
        setMessage({ type: 'success', text: 'Your email is already verified.' });
      } else {
        setMessage({ type: 'error', text: verificationErrorMessage(error) });
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleCheck = async () => {
    if (!user) return;
    setIsChecking(true);
    setMessage(null);
    try {
      const verified = await refreshStatus();
      if (!verified) {
        setMessage({
          type: 'error',
          text: "Still not verified. Click the link in the email, then check again.",
        });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: verificationErrorMessage(error) });
    } finally {
      setIsChecking(false);
    }
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          {isVerified ? (
            <>
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Email Verified</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="w-6 h-6 text-orange-600" />
              <div>
                <p className="font-medium text-orange-700">Email Not Verified</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </>
          )}
        </div>

        {!isVerified && (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                Please verify your email to access all features. We'll email you a secure link —
                click it, then use "I've verified my email" below.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isResending ? 'animate-spin' : ''}`} />
              {isResending
                ? 'Sending...'
                : cooldown > 0
                  ? `Resend available in ${cooldown}s`
                  : 'Resend Verification Email'}
            </Button>

            <Button
              variant="outline"
              onClick={handleCheck}
              disabled={isChecking}
              className="w-full"
            >
              <CheckCircle className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking...' : "I've verified my email"}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Check your spam folder if you don't see the email within a few minutes.
            </p>
          </div>
        )}

        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
