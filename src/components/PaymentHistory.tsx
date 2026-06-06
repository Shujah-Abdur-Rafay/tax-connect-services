import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Receipt, CreditCard, FileText, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  paymentType: 'subscription' | 'document_processing' | 'service_fee';
  description: string;
  createdAt: string;
  stripePaymentIntentId?: string;
}

const PaymentHistory: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'subscription' | 'document_processing' | 'service_fee'>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    try {
      // Mock data for demonstration - in real app, fetch from Supabase
      const mockPayments: PaymentRecord[] = [
        {
          id: '1',
          amount: 29.95,
          currency: 'usd',
          status: 'succeeded',
          paymentType: 'subscription',
          description: 'Premium Monthly Subscription',
          createdAt: '2024-01-15T10:30:00Z',
          stripePaymentIntentId: 'pi_1234567890'
        },
        {
          id: '2',
          amount: 5.00,
          currency: 'usd',
          status: 'succeeded',
          paymentType: 'document_processing',
          description: 'Tax Document Processing - Form 1040',
          createdAt: '2024-01-10T14:20:00Z',
          stripePaymentIntentId: 'pi_0987654321'
        },
        {
          id: '3',
          amount: 150.00,
          currency: 'usd',
          status: 'succeeded',
          paymentType: 'service_fee',
          description: 'Professional Consultation - 2 hours',
          createdAt: '2024-01-08T09:15:00Z',
          stripePaymentIntentId: 'pi_1122334455'
        },
        {
          id: '4',
          amount: 29.95,
          currency: 'usd',
          status: 'succeeded',
          paymentType: 'subscription',
          description: 'Premium Monthly Subscription',
          createdAt: '2023-12-15T10:30:00Z',
          stripePaymentIntentId: 'pi_5566778899'
        }
      ];
      
      setPayments(mockPayments);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load payment history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async (paymentId: string) => {
    try {
      toast({
        title: 'Receipt Downloaded',
        description: 'Receipt has been downloaded to your device'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to download receipt',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge variant="default" className="bg-green-100 text-green-800">Paid</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentTypeIcon = (type: string) => {
    switch (type) {
      case 'subscription':
        return <CreditCard className="w-4 h-4" />;
      case 'document_processing':
        return <FileText className="w-4 h-4" />;
      case 'service_fee':
        return <Users className="w-4 h-4" />;
      default:
        return <Receipt className="w-4 h-4" />;
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredPayments = payments.filter(payment => 
    filter === 'all' || payment.paymentType === filter
  );

  const totalSpent = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold">{formatAmount(totalSpent, 'usd')}</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold">
                  {formatAmount(
                    payments
                      .filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth())
                      .reduce((sum, p) => sum + p.amount, 0),
                    'usd'
                  )}
                </p>
              </div>
              <Receipt className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Transactions</p>
                <p className="text-2xl font-bold">{payments.length}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Payment History</CardTitle>
            <div className="flex gap-2">
              {['all', 'subscription', 'document_processing', 'service_fee'].map((type) => (
                <Button
                  key={type}
                  variant={filter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(type as any)}
                >
                  {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getPaymentTypeIcon(payment.paymentType)}
                      <span className="capitalize">
                        {payment.paymentType.replace('_', ' ')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{payment.description}</TableCell>
                  <TableCell className="font-medium">
                    {formatAmount(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell>{formatDate(payment.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadReceipt(payment.id)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredPayments.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No payments found for the selected filter.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentHistory;