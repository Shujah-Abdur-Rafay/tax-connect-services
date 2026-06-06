import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface RefundRequestFormProps {
  paymentId: string;
  amount: number;
  onSuccess: () => void;
}

const RefundRequestForm: React.FC<RefundRequestFormProps> = ({ paymentId, amount, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { 
          paymentId,
          amount,
          reason,
          description
        },
      });

      if (error) throw error;

      toast({
        title: 'Refund Requested',
        description: 'Your refund request has been submitted and will be processed within 5-10 business days.'
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Refund Request Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Refund</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Refund Amount</Label>
            <div className="text-2xl font-bold">${amount.toFixed(2)}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Refund</Label>
            <Select value={reason} onValueChange={setReason} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service_not_provided">Service Not Provided</SelectItem>
                <SelectItem value="unsatisfactory">Unsatisfactory Service</SelectItem>
                <SelectItem value="duplicate_charge">Duplicate Charge</SelectItem>
                <SelectItem value="cancelled_booking">Cancelled Booking</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional Details</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide any additional details about your refund request..."
              rows={4}
              required
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
            <p className="font-semibold mb-1">Refund Policy</p>
            <p className="text-gray-600">
              Refunds are processed within 5-10 business days. The amount will be credited back to your original payment method.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Refund Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RefundRequestForm;
