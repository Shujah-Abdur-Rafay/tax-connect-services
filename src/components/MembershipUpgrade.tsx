import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MembershipUpgradeProps {
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

const MembershipUpgrade: React.FC<MembershipUpgradeProps> = ({
  title,
  description,
  price,
  priceId,
  features,
  isPopular,
  isVip
}) => {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      
      // Create upgrade payment
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: price * 100, // Convert to cents
          currency: 'usd',
          description: `${title} Membership Upgrade`,
          metadata: {
            membershipLevel: title,
            upgradeType: 'membership_tier'
          }
        }
      });

      if (error) throw error;

      // Handle payment success - redirect to member portal
      window.location.href = '/member-portal';
      
    } catch (error) {
      console.error('Upgrade error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`relative ${isPopular ? 'border-blue-500 border-2' : ''} ${isVip ? 'border-2' : ''}`} 
          style={isVip ? {borderColor: '#FFD700'} : {}}>
      {isPopular && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">Popular</div>
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
          <p><strong>Primary role:</strong> {features.role}</p>
          {features.tasks && <p><strong>Tasks:</strong> {features.tasks}</p>}
          <p><strong>Requirements:</strong> {features.requirements}</p>
          <p><strong>Compensation:</strong> {features.compensation}</p>
          <p><strong>Benefits:</strong> {features.benefits}</p>
          
          <div className="mt-4 pt-4 border-t">
            <div className="text-lg font-bold text-green-600 mb-3">
              Upgrade Fee: ${price === 0 ? '0' : price.toFixed(2)}
            </div>
            
            <Button 
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Processing...' : price === 0 ? 'Apply Now' : `Upgrade for $${price.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MembershipUpgrade;