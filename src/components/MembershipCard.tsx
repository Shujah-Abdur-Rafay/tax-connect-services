import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface MembershipCardProps {
  title: string;
  description: string;
  price: number;
  priceId: string;
  features: {
    role: string;
    tasks?: string;
    requirements: string;
    compensation: string;
    benefits: string;
  };
  isPopular?: boolean;
  isVip?: boolean;
}

const MembershipCard: React.FC<MembershipCardProps> = ({
  title,
  description,
  price,
  priceId,
  features,
  isPopular,
  isVip,
}) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const userEmail = user?.email ?? undefined;


  const handleSubscribe = async () => {
    try {
      setLoading(true);

      // Free tier → no checkout needed, just confirm application.
      if (price === 0) {
        toast({
          title: 'Application received',
          description: `Thanks for applying for the "${title}" tier. We'll be in touch.`,
        });
        setLoading(false);
        return;
      }

      // Paid tier → create Stripe Checkout session and redirect.
      const email =
        userEmail ||
        window.prompt('Enter your email to continue to secure checkout:') ||
        '';
      if (!email) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        'create-subscription',
        {
          body: {
            priceId,
            email,
            membershipLevel: title,
          },
        },
      );

      if (error) throw error;
      const checkoutUrl = data?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error(data?.error || 'Could not start checkout.');
      }

      window.location.href = checkoutUrl;
    } catch (err: any) {
      console.error('Subscription error:', err);
      toast({
        title: 'Checkout unavailable',
        description:
          err?.message ||
          'Could not start checkout right now. Please try again or contact support.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <Card
      className={`relative ${isPopular ? 'border-blue-500 border-2' : ''} ${
        isVip ? 'border-2' : ''
      }`}
      style={isVip ? { borderColor: '#FFD700' } : {}}
    >
      {isPopular && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
            Popular
          </div>
        </div>
      )}
      {isVip && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm flex items-center">
            <Star className="h-4 w-4 mr-1" />
            VIP
          </div>
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 text-sm">
          <p>
            <strong>Primary role:</strong> {features.role}
          </p>
          {features.tasks && (
            <p>
              <strong>Tasks:</strong> {features.tasks}
            </p>
          )}
          <p>
            <strong>Requirements:</strong> {features.requirements}
          </p>
          <p>
            <strong>Compensation:</strong> {features.compensation}
          </p>
          <p>
            <strong>Benefits:</strong> {features.benefits}
          </p>

          <div className="mt-4 pt-4 border-t">
            <div className="text-lg font-bold text-green-600 mb-3">
              Registration Fee: ${price === 0 ? '0' : price.toFixed(2)}
            </div>

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading
                ? 'Processing...'
                : price === 0
                ? 'Apply Now'
                : `Subscribe for $${price.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MembershipCard;
