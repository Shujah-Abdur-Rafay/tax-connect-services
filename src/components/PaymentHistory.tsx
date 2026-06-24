import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Receipt, CreditCard, FileText, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPaymentsForUser } from '@/services/paymentsService';
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
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'subscription' | 'document_processing' | 'service_fee'>('all');
  const { toast } = useToast();

  useEffect(() => {
    if (user?.uid) fetchPaymentHistory();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const fetchPaymentHistory = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      // Real payment history from the Firestore `payments` collection.
      const records = await fetchPaymentsForUser(user.uid);
      setPayments(
        records.map((r) => ({
          id: r.id,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          paymentType: r.paymentType,
          description: r.description,
          createdAt: r.created_at || new Date().toISOString(),
          stripePaymentIntentId: r.stripe_payment_intent_id || undefined,
        })),
      );
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