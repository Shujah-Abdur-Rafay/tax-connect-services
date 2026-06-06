import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Download, Search, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface Payment {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  type: string;
  invoiceId?: string;
}

const PaymentHistoryView: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      // Fetch from Supabase - this will work when tables are created
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match Payment interface
      const transformedData = data?.map(p => ({
        id: p.id,
        date: new Date(p.created_at).toLocaleDateString(),
        description: p.description,
        amount: parseFloat(p.amount),
        status: p.status,
        type: p.payment_type,
        invoiceId: p.id
      })) || [];
      
      setPayments(transformedData);
    } catch (error) {
      // Fallback to mock data if database not ready
      setPayments([
        { id: '1', date: '2024-01-15', description: 'Professional Plan Subscription', amount: 79.00, status: 'paid', type: 'subscription', invoiceId: 'INV-001' },
        { id: '2', date: '2024-01-10', description: 'Tax Consultation - John Smith', amount: 150.00, status: 'paid', type: 'booking', invoiceId: 'INV-002' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (paymentId: string) => {
    try {
      // First check if invoice already exists
      const { data: payment } = await supabase
        .from('payments')
        .select('invoice_url')
        .eq('id', paymentId)
        .single();

      let invoiceUrl = payment?.invoice_url;

      // If no invoice URL exists, generate one
      if (!invoiceUrl) {
        const { data, error } = await supabase.functions.invoke('generate-invoice', {
          body: { invoiceId: paymentId },
        });

        if (error) throw error;
        invoiceUrl = data.invoiceUrl;
      }

      // Open invoice in new tab or download
      if (invoiceUrl) {
        window.open(invoiceUrl, '_blank');
        toast({
          title: 'Invoice Ready',
          description: 'Your invoice has been opened in a new tab.'
        });
      }
    } catch (error) {
      console.error('Invoice error:', error);
      toast({
        title: 'Download Failed',
        description: 'Unable to generate invoice. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const filteredPayments = payments.filter(p => 
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredPayments.map((payment) => (
          <Card key={payment.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <h3 className="font-semibold">{payment.description}</h3>
                    <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'}>
                      {payment.status}
                    </Badge>
                    <Badge variant="outline">{payment.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{payment.date}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold mb-2">${payment.amount.toFixed(2)}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadInvoice(payment.invoiceId!)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Invoice
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PaymentHistoryView;
