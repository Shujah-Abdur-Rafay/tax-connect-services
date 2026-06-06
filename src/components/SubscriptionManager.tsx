import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowUpCircle, ArrowDownCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
}

const plans: Plan[] = [
  { id: 'basic', name: 'Basic', price: 29, features: ['5 consultations/month', 'Email support', 'Basic resources'] },
  { id: 'professional', name: 'Professional', price: 79, features: ['15 consultations/month', 'Priority support', 'Advanced resources', 'Document storage'] },
  { id: 'enterprise', name: 'Enterprise', price: 199, features: ['Unlimited consultations', '24/7 support', 'Premium resources', 'Dedicated account manager'] }
];

const SubscriptionManager: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState('professional');
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'upgrade', newPlanId: planId },
      });

      if (error) throw error;

      setCurrentPlan(planId);
      toast({
        title: 'Plan Upgraded',
        description: `Successfully upgraded to ${plans.find(p => p.id === planId)?.name} plan!`
      });
    } catch (error: any) {
      toast({
        title: 'Upgrade Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDowngrade = async (planId: string) => {
    setLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'downgrade', newPlanId: planId },
      });

      if (error) throw error;

      setCurrentPlan(planId);
      toast({
        title: 'Plan Changed',
        description: `Successfully changed to ${plans.find(p => p.id === planId)?.name} plan!`
      });
    } catch (error: any) {
      toast({
        title: 'Change Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    setLoading('cancel');
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'cancel' },
      });

      if (error) throw error;

      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription will remain active until the end of the billing period.'
      });
    } catch (error: any) {
      toast({
        title: 'Cancellation Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={currentPlan === plan.id ? 'border-blue-500 border-2' : ''}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{plan.name}</CardTitle>
                {currentPlan === plan.id && <Badge>Current</Badge>}
              </div>
              <div className="text-3xl font-bold">${plan.price}<span className="text-sm text-gray-500">/mo</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-4">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              {currentPlan !== plan.id && (
                <Button
                  onClick={() => plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === currentPlan) 
                    ? handleUpgrade(plan.id) 
                    : handleDowngrade(plan.id)}
                  className="w-full"
                  disabled={loading === plan.id}
                >
                  {loading === plan.id ? 'Processing...' : 
                   plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === currentPlan) 
                    ? <><ArrowUpCircle className="mr-2 h-4 w-4" />Upgrade</> 
                    : <><ArrowDownCircle className="mr-2 h-4 w-4" />Downgrade</>}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cancel Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Cancel your subscription at any time. You'll continue to have access until the end of your billing period.
          </p>
          <Button variant="destructive" onClick={handleCancel} disabled={loading === 'cancel'}>
            <XCircle className="mr-2 h-4 w-4" />
            {loading === 'cancel' ? 'Processing...' : 'Cancel Subscription'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionManager;
