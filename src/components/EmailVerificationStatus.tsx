import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { resendVerificationEmail, checkEmailVerified } from '@/services/emailVerificationService';

export const EmailVerificationStatus: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    checkVerification();
  }, []);

  const checkVerification = async () => {
    if (user) {
      const verified = await checkEmailVerified(user);
      setIsVerified(verified);
    }
  };

  const handleResend = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setMessage('');
    
    try {
      await resendVerificationEmail(user);
      setMessage('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      setMessage(error.message || 'Failed to send verification email');
    } finally {
      setIsLoading(false);
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
                Please verify your email to access all features.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleResend} 
              disabled={isLoading}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Resend Verification Email
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Check your spam folder if you don't see the email. 
              <br />
              Having issues? See <a href="/FIREBASE_EMAIL_VERIFICATION_SETUP.md" target="_blank" className="text-blue-600 hover:underline">setup guide</a>.
            </p>
          </div>
        )}


        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
