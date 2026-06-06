import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { sendEmailVerification, reload } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

interface EmailVerificationPendingProps {
  email: string;
  onVerified: () => void;
}

export default function EmailVerificationPending({ email, onVerified }: EmailVerificationPendingProps) {
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const checkVerificationStatus = async () => {
    setIsChecking(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await reload(user);
        if (user.emailVerified) {
          toast({
            title: "Email verified!",
            description: "You can now proceed to profile setup.",
          });
          onVerified();
        } else {
          toast({
            title: "Not verified yet",
            description: "Please check your email and click the verification link.",
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error checking verification",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };

  const resendVerificationEmail = async () => {
    setIsResending(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await sendEmailVerification(user);
        toast({
          title: "Verification email sent!",
          description: "Please check your inbox.",
        });
        setCanResend(false);
        setCountdown(60);
      }
    } catch (error: any) {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          <Mail className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Verify Your Email</h2>
          <p className="text-gray-600 mb-6">
            We've sent a verification email to <strong>{email}</strong>
          </p>
          
          <Alert className="mb-6 text-left">
            <AlertDescription>
              <p className="mb-2">Please check your email and click the verification link to continue.</p>
              <p className="text-sm text-gray-600">
                Don't see the email? Check your spam folder or click the resend button below.
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button 
              onClick={checkVerificationStatus} 
              disabled={isChecking}
              className="w-full"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  I've Verified My Email
                </>
              )}
            </Button>

            <Button 
              variant="outline"
              onClick={resendVerificationEmail} 
              disabled={!canResend || isResending}
              className="w-full"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  {canResend ? 'Resend Verification Email' : `Resend in ${countdown}s`}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
