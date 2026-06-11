import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Calendar, Loader2 } from 'lucide-react';
import PaymentHistoryView from './PaymentHistoryView';
import SubscriptionManager from './SubscriptionManager';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';


interface BillingInfo {
  planName: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string | null;
  status: 'active' | 'canceled' | 'past_due' | 'inactive';
}

const tsToDateString = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as any)?.toDate === 'function') {
    try {
      return (v as any).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof v === 'string') return v;
  return null;
};

const normalizeStatus = (s: unknown): BillingInfo['status'] => {
  const v = String(s || '').toLowerCase();
  if (v === 'active' || v === 'trialing' || v === 'paid') return 'active';
  if (v === 'past_due' || v === 'unpaid') return 'past_due';
  if (v === 'canceled' || v === 'cancelled') return 'canceled';
  return 'inactive';
};

const BillingManagement: React.FC = () => {
  const { user } = useAuth();
  // Live snapshot of the current plan, read from the user's membership docs.
  // Authoritative subscription state (plan changes, cancellation, card,
  // invoices) is managed through Stripe in the "Manage Subscription" tab.
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [proSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'professionals', user.uid)),
          getDoc(doc(db, 'users', user.uid)),
        ]);
        const pro = proSnap.exists() ? (proSnap.data() as any) : {};
        const usr = userSnap.exists() ? (userSnap.data() as any) : {};
        const planName =
          pro.membershipTier || usr.membershipLevel || user.membershipLevel || 'Directory Listing';
        const amountCents = Number(pro.lastPaymentAmount || 0);
        const info: BillingInfo = {
          planName: String(planName),
          amount: amountCents > 0 ? Math.round(amountCents) / 100 : 0,
          billingCycle: 'yearly',
          nextBillingDate: tsToDateString(pro.currentPeriodEnd),
          status: normalizeStatus(pro.membershipStatus || pro.subscriptionStatus || (pro.paymentStatus === 'paid' ? 'active' : '')),
        };
        if (active) setBillingInfo(info);
      } catch (err) {
        console.warn('[BillingManagement] failed to load billing info:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.uid, user?.membershipLevel]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Canceled</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-800">Past Due</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">No active plan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="manage">Manage Subscription</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-gray-500 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading your plan…
                </div>
              ) : !billingInfo ? (
                <p className="text-gray-500 py-4">No billing information available.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg">{billingInfo.planName} Plan</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {billingInfo.amount > 0
                        ? `$${billingInfo.amount}/${billingInfo.billingCycle === 'monthly' ? 'month' : 'year'}`
                        : 'Free'}
                    </p>
                    {billingInfo.nextBillingDate && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        Next billing: {formatDate(billingInfo.nextBillingDate)}
                      </div>
                    )}
                    <div className="mt-2">{getStatusBadge(billingInfo.status)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <PaymentHistoryView />
        </TabsContent>

        <TabsContent value="manage">
          <SubscriptionManager />
        </TabsContent>
      </Tabs>
    </div>
  );

};

export default BillingManagement;
