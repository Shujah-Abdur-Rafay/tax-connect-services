import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';


interface InvoiceViewerProps {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
}

const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ invoiceId, open, onClose }) => {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoice();
    }
  }, [open, invoiceId]);

  const fetchInvoice = async () => {
    try {
      // Mock invoice data for now - Firebase Firestore integration would go here
      setInvoice({
        number: `INV-${invoiceId.substring(0, 8).toUpperCase()}`,
        date: new Date().toLocaleDateString(),
        dueDate: new Date().toLocaleDateString(),
        items: [{ description: 'Tax Preparation Services', quantity: 1, rate: 250, amount: 250 }],
        subtotal: 250,
        tax: 20,
        total: 270,
        status: 'paid',
        billTo: { name: 'Customer', email: '', address: '' },
        billFrom: { name: 'Tax Connect Services', address: '456 Business Ave, Suite 100, City, ST 67890', email: 'billing@taxconnect.com' }
      });
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    toast({ title: 'Download', description: 'Invoice download functionality ready for Firebase Storage integration.' });
  };


  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { invoiceId },
      });

      if (error) throw error;

      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank');
        toast({ title: 'Invoice Downloaded', description: 'Your invoice PDF has been generated.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate invoice PDF.', variant: 'destructive' });
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-content');
    if (printContent) {
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow?.document.write('<html><head><title>Invoice</title>');
      printWindow?.document.write('<style>body{font-family:Arial,sans-serif;padding:20px;}</style>');
      printWindow?.document.write('</head><body>');
      printWindow?.document.write(printContent.innerHTML);
      printWindow?.document.write('</body></html>');
      printWindow?.document.close();
      printWindow?.print();
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent><div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div></DialogContent>
      </Dialog>
    );
  }

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice {invoice.number}</DialogTitle>
        </DialogHeader>
        <div id="invoice-content" className="space-y-6 p-6">
          <div className="flex justify-between">
            <div>
              <h3 className="font-bold text-lg">{invoice.billFrom.name}</h3>
              <p className="text-sm text-gray-600">{invoice.billFrom.address}</p>
              <p className="text-sm text-gray-600">{invoice.billFrom.email}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">INVOICE</p>
              <p className="text-sm">#{invoice.number}</p>
              <p className="text-sm text-gray-600">Date: {invoice.date}</p>
            </div>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item: any, idx: number) => (
                <tr key={idx} className="border-b">
                  <td className="py-2">{item.description}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">${item.rate.toFixed(2)}</td>
                  <td className="text-right">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between"><span>Subtotal:</span><span>${invoice.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Tax:</span><span>${invoice.tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>${invoice.total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button onClick={handleDownload}><Download className="h-4 w-4 mr-2" />Download PDF</Button>
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceViewer;