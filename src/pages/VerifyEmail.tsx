import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';
import { updateProfile } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        // Check token in database
        const { data, error } = await supabase
          .from('email_verification_tokens')
          .select('*')
          .eq('token', token)
          .single();

        if (error || !data) {
          setStatus('error');
          setMessage('Invalid or expired verification link');
          return;
        }

        // Check if already verified
        if (data.verified) {
          setStatus('success');
          setMessage('Email already verified!');
          setTimeout(() => navigate('/member-portal'), 3000);
          return;
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setStatus('error');
          setMessage('Verification link has expired. Please request a new one.');
          return;
        }

        // Mark as verified
        const { error: updateError } = await supabase
          .from('email_verification_tokens')
          .update({ verified: true })
          .eq('token', token);

        if (updateError) throw updateError;

        // Update Firebase user if logged in
        const user = auth.currentUser;
        if (user && user.uid === data.user_id) {
          await updateProfile(user, { emailVerified: true } as any);
        }

        setStatus('success');
        setMessage('Email verified successfully!');
        setTimeout(() => navigate('/member-portal'), 3000);

      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('Failed to verify email. Please try again.');
      }
    };

    verifyToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Verifying Email</h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <h1 className="text-2xl font-bold mb-2 text-green-600">Success!</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500">Redirecting to your portal...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
            <h1 className="text-2xl font-bold mb-2 text-red-600">Verification Failed</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Button onClick={() => navigate('/join-platform')}>
              Back to Sign Up
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
