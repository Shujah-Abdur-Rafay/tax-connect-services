# Invoice Generation System

## Overview
Professional PDF invoice generation system integrated with Stripe payments and Supabase storage.

## Features
- **Automatic Invoice Generation**: Creates invoices for all payments
- **Professional Branding**: Company logo, colors, and formatting
- **Tax Calculations**: Automatic 8% tax calculation
- **Secure Storage**: Invoices stored in Supabase storage bucket
- **Download Links**: Direct download from payment history
- **Print Support**: Browser-based printing functionality

## Architecture

### Edge Function: generate-invoice
Located in `edge-functions/generate-invoice.ts`

**Endpoint**: `/functions/v1/generate-invoice`

**Request Body**:
```json
{
  "invoiceId": "payment-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "invoiceUrl": "https://...",
  "fileName": "invoice-xxx.pdf"
}
```

### Database Schema
The `payments` table includes an `invoice_url` field to store generated invoice URLs:

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  invoice_url TEXT,
  created_at TIMESTAMP
);
```

### Storage Bucket
- **Name**: `invoices`
- **Public**: No (private bucket)
- **Access**: Authenticated users only via signed URLs

## Invoice Template

### Company Information
- **Name**: Tax Connect Services
- **Address**: 456 Business Ave, Suite 100, City, ST 67890
- **Email**: billing@taxconnect.com
- **Phone**: (555) 123-4567

### Invoice Components
1. **Header**: Company branding and invoice metadata
2. **Bill To**: Customer information
3. **Line Items**: Service descriptions and amounts
4. **Totals**: Subtotal, tax (8%), and grand total
5. **Footer**: Thank you message and contact info

## Usage

### Frontend Integration

#### PaymentHistoryView Component
```tsx
const handleDownloadInvoice = async (paymentId: string) => {
  // Check for existing invoice
  const { data: payment } = await supabase
    .from('payments')
    .select('invoice_url')
    .eq('id', paymentId)
    .single();

  let invoiceUrl = payment?.invoice_url;

  // Generate if not exists
  if (!invoiceUrl) {
    const { data } = await supabase.functions.invoke('generate-invoice', {
      body: { invoiceId: paymentId }
    });
    invoiceUrl = data.invoiceUrl;
  }

  // Open in new tab
  window.open(invoiceUrl, '_blank');
};
```

#### InvoiceViewer Component
Displays invoice preview and provides download/print options:
- Fetches payment data from Supabase
- Renders formatted invoice
- Generates PDF on demand
- Supports browser printing

## Deployment

### 1. Deploy Edge Function
```bash
supabase functions deploy generate-invoice
```

### 2. Create Storage Bucket
Already created: `invoices` bucket (private)

### 3. Set Up RLS Policies
```sql
-- Users can read their own invoices
CREATE POLICY "Users access own invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 4. Configure CORS
CORS headers are included in the edge function for cross-origin requests.

## Tax Calculations
- Default tax rate: 8%
- Applied to all payments
- Displayed separately on invoices
- Included in grand total

## Security
- **Private Storage**: Invoices not publicly accessible
- **Signed URLs**: Time-limited access (1 year expiry)
- **RLS Policies**: Row-level security on payments table
- **Authentication Required**: Must be logged in to generate/view invoices

## Future Enhancements
- [ ] Multiple tax rates by location
- [ ] Custom invoice templates
- [ ] Bulk invoice generation
- [ ] Email delivery of invoices
- [ ] Invoice numbering sequence
- [ ] Multi-currency support
- [ ] Discount codes and coupons
- [ ] Recurring invoice generation

## Troubleshooting

### Invoice Generation Fails
1. Check Supabase project is active
2. Verify edge function is deployed
3. Ensure storage bucket exists
4. Check payment record exists in database

### Invoice URL Not Accessible
1. Verify signed URL hasn't expired
2. Check user authentication
3. Ensure RLS policies are correct
4. Verify storage bucket permissions

### PDF Not Displaying Correctly
1. Check browser PDF support
2. Verify HTML template formatting
3. Test with different browsers
4. Check for console errors

## Support
For issues or questions:
- Email: billing@taxconnect.com
- Phone: (555) 123-4567
