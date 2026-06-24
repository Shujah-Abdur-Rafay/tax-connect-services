import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  documentLimit: number;
  storageLimit: number;
  icon: React.ReactNode;
  popular?: boolean;
}

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    priceMonthly: 9.95,
    priceYearly: 99.50,
    features: [
      'Up to 50 documents/month',
      'Basic tax form templates',
      'Email support',
      'Standard encryption',
      '5GB storage'
    ],
    documentLimit: 50,
    storageLimit: 5,
    icon: <Check className="w-6 h-6" />
  },
  {
    id: 'premium',
    name: 'Premium',
    priceMonthly: 29.95,
    priceYearly: 299.50,
    features: [
      'Up to 500 documents/month',
      'Advanced tax templates',
      'Priority support',
      'Advanced encryption',
      'Collaboration tools',
      'Version control',
      '50GB storage'
    ],
    documentLimit: 500,
    storageLimit: 50,
    icon: <Star className="w-6 h-6" />,
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 99.95,
    priceYearly: 999.50,
    features: [
      'Unlimited documents',
      'Custom templates',
      '24/7 phone support',
      'Enterprise encryption',
      'Advanced collaboration',
      'API access',
      'Custom integrations',
      'Unlimited storage'
    ],
    documentLimit: -1,
    storageLimit: -1,
    icon: <Crown className="w-6 h-6" />
  }
];

interface SubscriptionPlansProps {
  currentPlan?: string;
  onPlanSelect?: (planId: string, billing: 'monthly' | 'yearly') => void;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ 
  currentPlan, 
  onPlanSelect 
}) => {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubscribe = async (plan: Plan) => {
    try {
      setLoading(plan.id);
      
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          planId: plan.id,
          billing,
          amount: billing === 'monthly' ? plan.priceMonthly : plan.priceYearly,
          planName: `${plan.name} ${billing === 'monthly' ? 'Monthly' : 'Yearly'}`
        }
      });

      if (error) throw error;

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }

      if (onPlanSelect) {
        onPlanSelect(plan.id, billing);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start subscription',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-2 rounded-md transition-colors ${
              billing === 'monthly' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-4 py-2 rounded-md transition-colors ${
              billing === 'yearly' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            <Badge variant="secondary" className="ml-2">Save 17%</Badge>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative ${
              plan.popular ? 'border-blue-500 shadow-lg' : ''
            } ${currentPlan === plan.id ? 'ring-2 ring-green-500' : ''}`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2 text-blue-600">
                {plan.icon}
              </div>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <div className="text-3xl font-bold">
                ${billing === 'monthly' ? plan.priceMonthly : plan.priceYearly}
                <span className="text-sm font-normal text-gray-600">
                  /{billing === 'monthly' ? 'month' : 'year'}
                </span>
              </div>
              {billing === 'yearly' && (
                <p className="text-sm text-green-600">
                  Save ${((plan.priceMonthly * 12) - plan.priceYearly).toFixed(2)} per year
                </p>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className="w-full" 
                variant={currentPlan === plan.id ? 'outline' : 'default'}
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.id || currentPlan === plan.id}
              >
                {loading === plan.id ? (
                  'Processing...'
                ) : currentPlan === plan.id ? (
                  'Current Plan'
                ) : (
                  'Subscribe Now'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionPlans;