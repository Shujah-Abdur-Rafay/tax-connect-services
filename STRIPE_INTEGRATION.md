# Stripe Payment Integration

## Overview
Complete Stripe payment processing system with subscriptions, bookings, invoices, and refunds.

## Required Edge Functions

### 1. process-booking-payment
Handles one-time payments for professional service bookings.

```typescript
// Endpoint: /functions/v1/process-booking-payment
// Body: { amount, currency, professionalId, serviceType, bookingDate, duration, userId }
// Returns: { clientSecret, paymentIntentId }
```

### 2. manage-subscription
Handles subscription upgrades, downgrades, and cancellations.

```typescript
// Endpoint: /functions/v1/manage-subscription
// Body: { action: 'upgrade'|'downgrade'|'cancel', newPlanId?: string }
// Returns: { subscription }
```

### 3. generate-invoice
Generates PDF invoices for payments.

```typescript
// Endpoint: /functions/v1/generate-invoice
// Body: { invoiceId }
// Returns: { pdf: Buffer }
```

### 4. process-refund
Handles refund requests.

```typescript
// Endpoint: /functions/v1/process-refund
// Body: { paymentId, amount, reason, description }
// Returns: { refund }
```

### 5. stripe-webhook
Handles Stripe webhook events for real-time updates.

```typescript
// Endpoint: /functions/v1/stripe-webhook
// Handles: payment_intent.succeeded, subscription.updated, etc.
```

## Database Tables

### payments
- id (UUID)
- user_id (TEXT)
- stripe_payment_intent_id (TEXT)
- amount (DECIMAL)
- status (TEXT)
- payment_type (TEXT)
- created_at (TIMESTAMP)

### invoices
- id (UUID)
- payment_id (UUID FK)
- invoice_number (TEXT)
- amount (DECIMAL)
- line_items (JSONB)
- created_at (TIMESTAMP)

### refunds
- id (UUID)
- payment_id (UUID FK)
- stripe_refund_id (TEXT)
- amount (DECIMAL)
- reason (TEXT)
- status (TEXT)
- created_at (TIMESTAMP)

### bookings
- id (UUID)
- user_id (TEXT)
- professional_id (TEXT)
- service_type (TEXT)
- booking_date (TIMESTAMP)
- payment_id (UUID FK)
- status (TEXT)
- created_at (TIMESTAMP)

## Setup Instructions

1. Ensure STRIPE_SECRET_KEY is set in Supabase secrets
2. Create database tables using provided SQL
3. Deploy edge functions
4. Configure Stripe webhook endpoint
5. Update frontend components to use real API calls

## Frontend Integration

Components updated with Stripe integration:
- BookingPaymentForm: Uses Stripe Elements and edge functions
- SubscriptionManager: Calls manage-subscription endpoint
- RefundRequestForm: Calls process-refund endpoint
- PaymentHistoryView: Fetches from Supabase and generates invoices

All components include proper error handling and loading states.
