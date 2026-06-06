# Refund Connect — Build-Out Roadmap

> A marketplace platform for tax professionals, accountants, bookkeepers, and financial service providers — a Fiverr/Upwork/Thumbtack model built **exclusively** for tax & accounting services.
>
> **Goal:** function as both (1) a *client-acquisition marketplace* for professionals and (2) a *business-growth platform* that helps them market, get paid, train, and scale into office / service-bureau operations.

This document maps the client's requirements against the **current codebase** so you can see what already exists (and can be reused), what's partial, and what's net-new — then sequences the work into phases.

---

## How to read this

| Tag | Meaning |
|-----|---------|
| ✅ | Exists and works |
| 🟡 | Partially built — needs extension |
| ❌ | Missing — net-new build |
| 🔴 | Broken — code exists but does not function |

**Stack:** React 18 + Vite + TypeScript · Firebase (Auth, Firestore, Storage, Cloud Functions, Trigger Email) · Stripe + Stripe Connect Express · Firebase project `refund-connect-1m30`.

### Key decisions locked for this roadmap
1. **Profile URLs:** add a new `/preparer/:slug` route with a unique per-pro slug; keep the existing `/professional/:id` working as an alias/redirect.
2. **Auto-profile:** a free **Directory Listing** profile + shareable URL is created **instantly at registration**; onboarding then enriches it.
3. **Billing:** membership tiers become **recurring Stripe subscriptions** (auto-renewal). The webhook already handles `customer.subscription.*` events.
4. **Tiers:** add a fourth **Service Bureau Partner** tier alongside Associate / Professional / Premier.

---

## 1. Current-state gap analysis

Each client requirement, its status today, the existing code to reuse, and the gap to close.

### ⭐ Priority 1 (Launch-Critical): Automatic Profile & Landing Page Creation
**Status: 🟡 Partial**

- **Exists:** `professionals` Firestore collection + `professionalsService.ts` (CRUD, search, normalization, sample fallback data). A full public profile page `ProfessionalProfile.tsx` at `/professional/:id` already renders **name, photo, bio, credentials, services, pricing, reviews, contact form, booking, and packages** in tabs. `gigsService.slugify()` is a reusable slug helper.
- **Gap:** profiles are keyed by Firestore UID, not a human-readable slug (`/preparer/john-smith`). No profile is auto-created at registration — it's built through multi-step onboarding. No "shareable link" surfaced to the pro.
- **Why P1:** directory growth depends on every pro having a shareable landing page the moment they sign up.

### 1. Professional Registration System — 🟡
- **Reuse:** `AuthContext.register`, `TaxProfessionalOnboarding.tsx` + `src/components/onboarding/*` (account → profile → services → preview → questions → terms/e-sign → payment), `CredentialVerificationStep`, `profileSyncQueue.ts` (offline write retry), `signed_agreements` collection.
- **Gap:** auto-create a public listing at registration; capture & verify **PTIN** (for the Professional tier); show the generated profile URL on completion.

### 2. Professional Directory & Search — 🟡
- **Reuse:** `FindProfessionals.tsx` (search box, map/grid toggle), `professionalsService.searchProfessionals` + `matchesLocationQuery` (smart city / "City, ST" / full-state-name / abbreviation / ZIP matching), `AdvancedFilters`, `DirectoryFilters`, `ProfessionalMapView`, `geocodingService`. Existing filters: specialty, price, experience, rating, sort, certifications.
- **Gap:** a **virtual vs in-person** flag; the full service taxonomy as first-class filters (Tax Prep, Bookkeeping, Accounting, Payroll, Tax Resolution, Business Formation, Financial Services); category-based search optimization/SEO.

### 3. Client Portal — 🟡
- **Reuse:** gig orders + `MyOrders.tsx`, messaging (`MessagingContext` + `messagingService`), secure document upload (`client_documents` + `ClientDocumentUpload`), booking (`BookingForm` → Firestore + Stripe deposit), order-status tracking (`gigOrdersService` lifecycle).
- **Gap:** **reviews are broken** — `ReviewSubmissionForm` writes to the dead Supabase stub, so submissions are silently dropped. No single unified client home.

### 4. Professional Dashboard — 🟡
- **Reuse:** `MemberPortal` / `MemberDashboard`, `ProGigsManager`, `ProOrdersInbox`, `ProPayouts` (Connect balance + payouts), `ProfessionalAnalyticsDashboard`, `ServiceManagementDashboard`, messaging.
- **Gap:** consolidate into one dashboard; add a **leads/inquiries** view (from contact forms), a **commissions** view, and resource-center access.

### 5. Resource Center / Document Library — ❌
- **Reuse:** `MarketingMaterials.tsx` (stub), Storage upload patterns in `firebaseStorageService.ts`.
- **Gap:** net-new — a `resources` collection + Storage prefix, admin upload UI, and a **tier-gated** pro-facing library (training, tax-prep guides, compliance docs, marketing materials, video content, forms/checklists, manuals).

### 6. Messaging & Communication — ✅ / 🟡
- **Reuse:** `messagingService.ts` (conversations + messages subcollection, realtime listeners, unread counts), `ChatWindow`, `ConversationList`, `MessagingCenter`, `MessageNotifications`, file sharing via Storage.
- **Gap:** **appointment reminders** (scheduled function) and automated **project status-update** notifications.

### 7. Payment Processing — 🟡
- **Reuse:** `createTaxProPayment` Cloud Function (membership PaymentIntents **and** gig **destination charges** with the 80/20 split via `platform_settings/fees`), `stripeWebhook`, `stripeConnect` (Express onboarding/status/dashboard), `membershipCheckoutService`, `stripeConnectService`.
- **Gap:** **`refundGigOrder` Cloud Function is referenced but never defined (🔴)** — refunding a *paid* gig order currently 404s. No recurring subscription billing yet.
- **Commission structure (confirmed):** platform 20% / professional 80% — already implemented and admin-tunable at `/admin/platform-fees`.

### 8. Membership System — 🟡
- **Reuse:** `constants/membershipLevels.ts`, `membershipCheckoutService` (Associate $99.95 / Professional $299.95 / Premier $499.95), `TaxProMembershipPlans`, `SubscriptionPlans`.
- **Gap:** add a fourth **Service Bureau Partner** tier (manage preparer networks, advanced reporting, admin tools); align tier names to "*Partner"; PTIN gate on Professional Partner; convert to subscriptions.

### 9. Admin Dashboard — 🟡
- **Reuse:** `AdminPanel`, `AdminDashboard`, `ApprovalWorkflow` / `ApplicationReview`, `/admin/platform-fees`, `/admin/crm-contacts`, `/admin/crm-broadcast` (announcements), `/admin/landing-analytics`, `adminNotificationsService`, Stripe/Firestore health pages.
- **Gap:** user management, subscription management, review moderation, training-resource upload, payouts/commissions monitoring view, and a support-ticket inbox.

---

## 2. Phased roadmap

> Estimates are engineering order-of-magnitude, not commitments. Phases are ordered by dependency.

### Phase 0 — Foundation fixes *(unblock launch — ~1 week)*
The platform has a few latent breakages that will bite during launch. Fix these first.

- [ ] **Implement & deploy the missing `refundGigOrder` Cloud Function** that `gigOrdersService.refundGigOrder` already calls (Stripe refund on the stored PaymentIntent → write `refunded` state back to the order).
- [ ] **Fix reviews:** migrate `ReviewSubmissionForm`, `ReviewDisplay`, and `ReviewResponseForm` off the Supabase stub to a Firestore `reviews` collection; recompute `professionals.rating` / `review_count` on write.
- [ ] **Finish removing Supabase:** sweep the ~29 files still importing `@/lib/supabase`; migrate any live calls — notably `membershipCheckoutService.trySupabaseFallback` (its fallback can never succeed against the stub).
- [ ] **Reconcile Firestore rules:** ensure `firestore.rules` covers every collection actually used (`gigs`, `gig_orders`, `platform_settings`, `reviews`, `crm_sync_log`, `stripe_webhook_events`, …); verify the **deployed** ruleset matches the file; add Storage rules for new paths.

### Phase 1 — LAUNCH CRITICAL: Auto profile + slug landing page + directory *(~1.5–2 weeks)*
- [ ] Add a `slug` field to the `Professional` model; generate it from the name (reuse `slugify`) with a numeric suffix on collision; store + index it.
- [ ] On `AuthContext.register` for `role=professional`, immediately create a free **Directory Listing** `professionals/{uid}` doc — published & searchable — and assign the slug.
- [ ] Add a `/preparer/:slug` route that looks up by slug and reuses `ProfessionalProfile.tsx`; keep `/professional/:id` as a redirect/alias.
- [ ] Surface a **"copy your shareable link"** action on the profile page and at onboarding completion.
- [ ] Extend the directory: add `serviceModality` (virtual / in-person / both) + the service-type taxonomy to the data model, expose them as filters in `AdvancedFilters` / `FindProfessionals`, add sorting + SEO meta tags on profile pages.

### Phase 2 — Client portal completion *(~1.5 weeks)*
- [ ] Unified client home (appointments, orders, documents, messages, reviews in one place).
- [ ] Reviews end-to-end (depends on Phase 0) — prompt for a rating/review on booking completion and gig delivery.
- [ ] Booking polish: availability calendar, appointment reminders, smoother secure document sharing.

### Phase 3 — Professional dashboard + resource center *(~2 weeks)*
- [ ] Consolidated pro dashboard: profile/services/pricing, leads & inquiries, appointments, messages, documents, earnings + commissions, reviews.
- [ ] New **Resource Center**: `resources` Firestore collection + Storage prefix, admin upload UI, tier-gated pro library (training, guides, compliance, marketing, video, forms/checklists, manuals).

### Phase 4 — Membership + subscriptions + Service Bureau tier *(~2 weeks)*
- [ ] Add the **Service Bureau Partner** tier to `membershipLevels`, checkout, and the plans UI; build preparer-network management (sub-accounts), advanced reporting, and admin tools.
- [ ] Convert tiers to recurring **Stripe subscriptions** (Stripe Products/Prices, subscription checkout, customer portal); rename tiers to "*Partner"; enforce **PTIN verification** for the Professional Partner tier.

### Phase 5 — Admin dashboard completion *(~1.5 weeks)*
- [ ] User & professional management, profile-approval queue (reuse `ApprovalWorkflow`), payout/commission monitoring (Connect), subscription management, review moderation, announcements (reuse broadcast), and a support-ticket inbox.

### Phase 6 — Phase-2 wishlist *(post-launch, scoped later)*
- [ ] Deeper CRM integration (extend the Famous CRM sync), marketing automation, SMS (e.g. Twilio), video training portal, certification programs, tax-software integrations, full Service Bureau / franchise reporting, expanded referral tracking (extend `referralService`).

---

## 3. Cross-cutting workstreams

These run alongside the phases above:

- **Data model & rules versioning** — keep `firestore.rules` / `firestore.indexes.json` in lockstep with new collections; redeploy on every change.
- **Analytics** — extend `landingAnalyticsService` to track the new registration, directory, and checkout funnels.
- **Email** — extend the `functions` email templates + `firebaseEmailService` for reminders, status updates, and resource notifications.
- **QA & test plan** — manual end-to-end runs of register → auto-profile → search → book → pay → review per phase.
- **Deployment checklist** — `firebase deploy` for functions, rules, and hosting after each phase.

---

## 4. Sequencing & dependencies

```
Phase 0 (fixes) ─┬─▶ Phase 1 (auto-profile + directory)  ◀── LAUNCH
                 │
   reviews fix ──┴─▶ Phase 2 (client portal)
                        │
                        ▼
                     Phase 3 (pro dashboard + resource center)
                        │ resource center
                        ▼
                     Phase 5 (admin: resource upload, moderation, payouts)
                        ▲
   Stripe Products ─▶ Phase 4 (subscriptions + Service Bureau)
                        │
                        ▼
                     Phase 6 (future enhancements)
```

| Phase | Focus | Rough effort |
|-------|-------|--------------|
| 0 | Foundation fixes | ~1 week |
| 1 | Auto-profile + slug + directory *(launch-critical)* | ~1.5–2 weeks |
| 2 | Client portal | ~1.5 weeks |
| 3 | Pro dashboard + resource center | ~2 weeks |
| 4 | Membership subscriptions + Service Bureau | ~2 weeks |
| 5 | Admin dashboard | ~1.5 weeks |
| 6 | Future (CRM, SMS, video, certifications, …) | post-launch |

**Minimum viable launch** = Phase 0 + Phase 1. Everything after deepens the marketplace and the business-growth side of the platform.
