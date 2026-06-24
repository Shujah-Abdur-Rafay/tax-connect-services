import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { updateEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function VerifyEmailChange() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'partial'>('loading');
  const [message, setMessage] = useState('');
  const [bothVerified, setBothVerified] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    verifyToken();
  }, []);

  const verifyToken = async () => {
    const token = searchParams.get('token');
    const type = searchParams.get('type');

    if (!token || !type) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-email-change', {
        body: { token, type }
      });

      if (error) throw error;

      if (data.bothVerified) {
        setBothVerified(true);
        setNewEmail(data.newEmail);
        
        // Update Firebase Auth email
        if (auth.currentUser) {
          await updateEmail(auth.currentUser, data.newEmail);
          
          // Update Firestore user document
          const userRef = doc(db, 'users', data.userId);
          await updateDoc(userRef, {
            email: data.newEmail,
            updatedAt: new Date()
          });
        }

        setStatus('success');
        setMessage('Email address successfully updated! Both emails have been verified.');
      } else {
        setStatus('partial');
        setMessage(`${type === 'old' ? 'Current' : 'New'} email verified. Please check your ${type === 'old' ? 'new' : 'current'} email to complete the process.`);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to verify email');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin text-blue-600" />}
            {status === 'success' && <CheckCircle2 className="h-12 w-12 text-green-600" />}
            {status === 'partial' && <Mail className="h-12 w-12 text-yellow-600" />}
            {status === 'error' && <XCircle className="h-12 w-12 text-red-600" />}
          </div>
          <CardTitle>
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Updated!'}
            {status === 'partial' && 'Verification Received'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {bothVerified && newEmail && (
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                Your email has been changed to: <strong>{newEmail}</strong>
              </p>
            </div>
          )}
          <Button 
            onClick={() => navigate('/member-portal')} 
            className="w-full"
            disabled={status === 'loading'}
          >
            {status === 'success' ? 'Go to Member Portal' : 'Return to Portal'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
