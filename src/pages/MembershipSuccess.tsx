import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  verifyMembershipCheckout,
  finalizeMembershipUpgrade,
} from '@/services/membershipCheckoutService';

const MembershipSuccess: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const sessionId = params.get('session_id') || '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [tierName, setTierName] = useState('');
  const [amount, setAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionId) {
        setStatus('error');
        setErrorMsg('Missing checkout session');
        return;
      }
      try {
        const result = await verifyMembershipCheckout(sessionId);
        if (cancelled) return;
        if (!result.paid) {
          setStatus('error');
          setErrorMsg(`Payment not completed (status: ${result.paymentStatus || result.status})`);
          return;
        }
        const meta = result.metadata || {};
        const newLevel = meta.membership_level || 'Professional';
        setTierName(newLevel);
        setAmount(((result.amountTotal || 0) / 100).toFixed(2));

        const targetUserId = user?.id || meta.user_id;
        if (targetUserId) {
          await finalizeMembershipUpgrade({
            userId: targetUserId,
            newLevel,
            promoDocId: meta.promo_doc_id || undefined,
            sessionId,
          });
          try { await refreshUser(); } catch { /* ignore */ }
        }
        if (!cancelled) setStatus('success');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Verification failed');
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, user?.id, refreshUser]);

  return (
    <AppLayout>
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          {status === 'verifying' && (
            <>
              <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirming your payment…</h1>
              <p className="text-gray-600">Hang tight while we activate your membership.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">You're upgraded!</h1>
              <p className="text-gray-600 mb-6">
                Welcome to <strong>{tierName}</strong>. We charged{' '}
                <strong>${amount}</strong> to your card and a receipt is on its way to your inbox.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={() => navigate('/member-portal')} className="bg-blue-600 hover:bg-blue-700">
                  Open Member Portal
                </Button>
                <Button variant="outline" onClick={() => navigate('/pricing')}>Back to Pricing</Button>
              </div>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">We couldn't confirm your upgrade</h1>
              <p className="text-gray-600 mb-6">{errorMsg || 'Please try again or contact support.'}</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={() => navigate('/pricing')} className="bg-blue-600 hover:bg-blue-700">
                  Return to Pricing
                </Button>
                <Button variant="outline" onClick={() => navigate('/support')}>Contact Support</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default MembershipSuccess;
