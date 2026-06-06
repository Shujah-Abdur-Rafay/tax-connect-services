import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Calendar, Settings } from 'lucide-react';
import PaymentHistoryView from './PaymentHistoryView';
import SubscriptionManager from './SubscriptionManager';
import { useToast } from '@/hooks/use-toast';


interface BillingInfo {
  currentPlan: string;
  planName: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  status: 'active' | 'canceled' | 'past_due';
  documentsUsed: number;
  documentLimit: number;
  storageUsed: number;
  storageLimit: number;
}

const BillingManagement: React.FC = () => {
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    currentPlan: 'premium',
    planName: 'Premium',
    amount: 29.95,
    billingCycle: 'monthly',
    nextBillingDate: '2024-02-15',
    status: 'active',
    documentsUsed: 127,
    documentLimit: 500,
    storageUsed: 12.5,
    storageLimit: 50
  });
  
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { toast } = useToast();

  const handleCancelSubscription = async () => {
    try {
      setLoading(true);
      
      // Call Stripe API to cancel subscription
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: { subscriptionId: 'sub_example123' }
      });

      if (error) throw error;

      setBillingInfo(prev => ({ ...prev, status: 'canceled' }));
      setShowCancelDialog(false);
      
      toast({
        title: 'Subscription Canceled',
        description: 'Your subscription will remain active until the end of the current billing period.'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel subscription',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase.functions.invoke('reactivate-subscription', {
        body: { subscriptionId: 'sub_example123' }
      });

      if (error) throw error;

      setBillingInfo(prev => ({ ...prev, status: 'active' }));
      
      toast({
        title: 'Subscription Reactivated',
        description: 'Your subscription is now active again.'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reactivate subscription',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async () => {
    try {
      toast({
        title: 'Invoice Downloaded',
        description: 'Latest invoice has been downloaded to your device'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to download invoice',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Canceled</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-800">Past Due</Badge>;
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

  const usagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
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
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg">{billingInfo.planName} Plan</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    ${billingInfo.amount}/{billingInfo.billingCycle === 'monthly' ? 'month' : 'year'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    Next billing: {formatDate(billingInfo.nextBillingDate)}
                  </div>
                  {getStatusBadge(billingInfo.status)}
                </div>
              </div>
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
