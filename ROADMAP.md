# Refund Connect — Build-Out Roadmap

> A marketplace platform for tax professionals, accountants, bookkeepers, and financial service providers — a Fiverr/Upwork/Thumbtack model built **exclusively** for tax & accounting services.
>
> **Goal:** function as both (1) a *client-acquisition marketplace* for professionals and (2) a *business-growth platform* that helps them market, get paid, train, and scale into office / service-bureau operations.

This document maps the client's requirements against the **current codebase** so you can see what already exists (and can be reused), what's partial, and what's net-new — then sequences the work into phases.

---

## ✅ Implementation status (updated 2026-06-07)

**Phase 0 (Foundation fixes) and Phase 1 (Auto-profile + slug + directory) — the "minimum viable launch" — are now implemented and build clean** (`vite build` + functions `tsc` both pass).

- **Phase 0 — done in code:** `refundGigOrder` Cloud Function implemented (+ `onReviewWrite` / `onReviewVoteWrite` rating/vote triggers); reviews migrated off the Supabase stub to a Firestore `reviews` / `review_votes` model via new `src/services/reviewsService.ts`; launch-critical Supabase live calls removed (`membershipCheckoutService` dead fallback, `ProfessionalContactForm` inquiry path); `firestore.rules` reconciled with every collection actually used (added `gigs`, `gig_orders`, `reviews`, `review_votes`, `platform_settings`, `promo_codes`, `crm_sync_log`, `landing_analytics`, `user_credits`, `email_verification_tokens`, `user_account_status`, `stripe_webhook_events`, plus an `isAdmin()` helper).
- **Phase 1 — done in code:** `slug` + `service_modality` + `service_categories` added to the `Professional` model with `generateUniqueSlug` / `getProfessionalBySlug` / `createProfessionalListing` / `ensureProfessionalSlug`; a free **Directory Listing** profile + slug is auto-created at registration (`AuthContext.register`); new `/preparer/:slug` route renders `ProfessionalProfile` (with `/professional/:id` kept as an alias); a `ShareableProfileLink` component surfaces the copy-link action on the profile page **and** the onboarding completion screen; the directory (`FindProfessionals`) gained virtual/in-person + service-category filters and now links to `/preparer/:slug`; profile pages set SEO `<title>` + meta description.
- **Still requires the operator (not code):** deploy the new functions (`firebase deploy --only functions`) and rules (`firebase deploy --only firestore:rules`) to project `refund-connect-1m30`, and add a `slug` Firestore index if the directory grows large. The remaining ~19 secondary Supabase call-sites (billing, subscriptions, documents, collaborative editor, tax-assistant chat) still no-op against the stub and are migrated within their owning phases (2–4) below.

**Phases 2, 3, 4, and 5 are also implemented in code** (frontend `vite build` + functions `tsc` both pass):
- Phase 2 — unified client home at `/client/dashboard`, review-on-completion prompts in `/my-orders`, and an `appointmentReminderCron`.
- Phase 3 — consolidated `/pro/dashboard`, leads/earnings views, and a tier-gated Resource Center with an admin upload tool at `/admin/resources`.
- Phase 4 — Service Bureau Partner tier (4th plan), recurring Stripe subscription Cloud Functions (`createSubscriptionCheckout` + `createBillingPortalSession`) with a subscribe/manage-billing UI, a PTIN verification gate, and Service Bureau preparer-network management + reporting.
- Phase 5 — completed admin dashboard: subscription monitor, payout/commission monitor, review moderation, and an admin-tools hub (+ approval queue, user/membership management, announcements, support inbox that already existed).

See the per-phase sections below for specifics. **Operator steps remain:** create a recurring Stripe Product/Price per tier and set the `stripe.price_*` function config, then `firebase deploy --only functions,firestore:rules` (+ Storage rules).

**Everything through Phase 5 is now implemented in code.** Only **Phase 6 (post-launch wishlist)** remains as forward plan.

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

- [x] **Implemented the missing `refundGigOrder` Cloud Function** that `gigOrdersService.refundGigOrder` already calls — creates a Stripe refund on the stored PaymentIntent (reversing the Connect transfer + application fee on destination charges) and writes `refunded`/`cancelled` state back to the order. *(Deploy is an operator step.)*
- [x] **Fixed reviews:** `ReviewSubmissionForm`, `ReviewDisplay`, and `ReviewResponseForm` now use the new `reviewsService.ts` (Firestore `reviews` + `review_votes`); `professionals.rating` / `review_count` and per-review vote tallies are recomputed by the `onReviewWrite` / `onReviewVoteWrite` Cloud Function triggers.
- [x] **Removed launch-critical Supabase calls:** deleted `membershipCheckoutService.trySupabaseFallback` (dead) and the `ProfessionalContactForm` Supabase inquiry path (the Firebase `mail` queue already covers it). *(~19 secondary call-sites still no-op against the stub; migrated within phases 2–4.)*
- [x] **Reconciled Firestore rules:** `firestore.rules` now covers every collection actually used (`gigs`, `gig_orders`, `platform_settings`, `reviews`, `review_votes`, `promo_codes`, `crm_sync_log`, `landing_analytics`, `user_credits`, `email_verification_tokens`, `user_account_status`, `stripe_webhook_events`) plus an `isAdmin()` helper. *(Redeploy the ruleset; Storage rules for new paths come with the Phase 3 Resource Center.)*

### Phase 1 — LAUNCH CRITICAL: Auto profile + slug landing page + directory *(~1.5–2 weeks)*
- [x] Added a `slug` field to the `Professional` model; generated from the name via `slugify` with a numeric suffix on collision (`generateUniqueSlug`). *(Add a Firestore single-field index on `slug` once the directory grows.)*
- [x] On `AuthContext.register` for `role=professional`, `createProfessionalListing` immediately creates a free **Directory Listing** `professionals/{uid}` doc — published & searchable — and assigns the slug.
- [x] Added a `/preparer/:slug` route that looks up by slug and reuses `ProfessionalProfile.tsx`; `/professional/:id` kept as a working alias.
- [x] Surfaced a **"copy your shareable link"** action (`ShareableProfileLink`) on the profile page and at onboarding completion.
- [x] Extended the directory: added `service_modality` (virtual / in-person / both) + a `service_categories` taxonomy to the data model, exposed as a modality dropdown + category chips in `FindProfessionals` (with active-filter badges), and added SEO `<title>` + meta description on profile pages. Cards/map now link to `/preparer/:slug`.

### Phase 2 — Client portal completion *(~1.5 weeks)* — ✅ done in code
- [x] **Unified client home** at `/client/dashboard` (alias `/dashboard`) — `ClientDashboard.tsx`: tabbed hub (Overview with live order/review counts, Orders summary + deep-link to the full `/my-orders` workspace, Appointments, Messages, Documents, Reviews-you've-written). New `client/ClientAppointmentsList.tsx` queries `appointments` by `client_id`; Header gained a **My Dashboard** link for client accounts.
- [x] **Reviews end-to-end** — `MyOrders` now shows a "Leave a review" prompt on delivered/completed orders (opens `ReviewSubmissionForm` in a dialog, prefilled with the order's pro), and marks pros you've already reviewed (`reviewsService.getReviewsByClient`). This closes the loop opened by the Phase 0 reviews migration.
- [x] **Booking polish** — added the `appointmentReminderCron` Cloud Function (emails clients a reminder for appointments in the next ~36h, dedup-stamped via `reminder_sent_at`, delivered through Gmail + the `mail` Trigger-Email queue). Availability calendar (`AvailabilityCalendar`) and secure document sharing already existed and are surfaced through the dashboard. *(Operator: deploy functions so the cron schedules.)*

### Phase 3 — Professional dashboard + resource center *(~2 weeks)* — ✅ done in code
- [x] **Consolidated pro dashboard** at `/pro/dashboard` (`ProDashboard.tsx`): one tabbed hub for Profile & Services, Leads & Inquiries, Appointments, Messages, Documents, Earnings + Commissions, Reviews, and the Resource Center, with an Overview that links out to the standalone Gigs / Orders / Payouts tools (consolidates rather than duplicates). New pieces: `pro/ProLeadsInbox.tsx` (queries `contact_submissions` by `professional_id` via `getLeadsForProfessional`, with a new→in-progress→resolved pipeline) and `pro/ProEarningsSummary.tsx` (gross / platform-commission / net split computed from gig orders at the live `platform_settings/fees` percent). `ServiceManagementDashboard` migrated off the Supabase stub to Firestore (`professionals/{uid}.services`). Header gained a **Pro Dashboard** link.
- [x] **Resource Center**: `resources` Firestore collection + `resources/{id}/` Storage prefix via new `resourcesService.ts` (file upload / external link / video URL, 7 categories, tier-gated by `min_tier`); admin upload UI at `/admin/resources` (`AdminResources.tsx`, admin-gated); tier-gated pro library component `ResourceCenter.tsx` (locked cards show an upgrade CTA). Tier ranking helpers (`getTierRank` / `meetsTier` / `RESOURCE_TIER_OPTIONS`) added to `membershipLevels.ts`. `firestore.rules` adds a `resources` block (signed-in read, admin write); `FIREBASE_STORAGE_RULES.txt` adds a `resources/{id}/` block (signed-in read, admin write ≤ 50 MB). *(Operator: redeploy rules + Storage rules; consider a `created_at` index on `resources` as it grows.)*

### Phase 4 — Membership + subscriptions + Service Bureau tier *(~2 weeks)* — ✅ done in code
- [x] **Service Bureau Partner tier** added to `membershipLevels` (`MembershipLevel.SERVICE_BUREAU`, rank 4, `isServiceBureau()` helper) and the checkout maps (`membershipCheckoutService` `TIER_LEVEL`/`TIER_PRICE` → `service_bureau` @ $1,499.95). Surfaced as a 4th plan card + comparison column on the `/pricing` page (4-up grid, "Enterprise" badge). Preparer-network management (sub-accounts) + advanced cross-network reporting via new `preparerNetworkService.ts` + `pro/ServiceBureauPanel.tsx`, shown as a **Service Bureau** tab in `/pro/dashboard` (gated to the tier). `preparer_network` Firestore rules added (owner-scoped read/write, owner immutable).
- [x] **Recurring Stripe subscriptions**: new Cloud Functions `createSubscriptionCheckout` (Checkout in `subscription` mode, stamps `subscription_data.metadata.{professional_id, membership_tier}` so the existing `customer.subscription.*` webhook handlers flip the doc on renewal/cancel) + `createBillingPortalSession` (Stripe Customer Portal). Frontend `subscriptionService.ts` + `pro/SubscriptionBilling.tsx` (subscribe per tier / manage billing / shows live subscription status), surfaced on `/pricing` ("Prefer automatic renewal?") and the dashboard **Billing** tab. *(Operator: create one recurring Product/Price per tier and set `firebase functions:config:set stripe.price_associate=… price_professional=… price_premier=… price_service_bureau=…`, then deploy functions.)*
- [x] **PTIN verification gate**: `ptinService.ts` (format-validates `P########`, stores `ptin`/`ptin_verified` on the pro's own `professionals/{uid}` doc) + `pro/PtinVerificationDialog.tsx`; the subscription flow blocks subscribing to a paid tier until a valid PTIN is on file. *(Tier names already read "Premier Partner" / "Service Bureau Partner"; true IRS directory verification is a future server-side flip of `ptin_verified`.)*

### Phase 5 — Admin dashboard completion *(~1.5 weeks)* — ✅ done in code
- [x] The `/admin` dashboard (`AdminDashboard.tsx`) now has tabs for **Applications**, **Professionals** (approval queue via `ProfessionalListingManager` — approve/reject/publish), **Memberships** (user management via `UserMembershipManager`), plus new Phase-5 tabs:
  - **Subscriptions** — `admin/AdminSubscriptionsManager.tsx` lists every member's Stripe subscription status/tier/renewal (synced by the `customer.subscription.*` webhook), with a deep-link to the Stripe customer.
  - **Payouts** — `admin/AdminPayoutsMonitor.tsx` aggregates platform commission / pro-net / refunds across all gig orders at the live fee, with a per-pro breakdown (`adminReportingService.ts`).
  - **Reviews** — `admin/AdminReviewModeration.tsx` lists all reviews with hide/unhide + delete (`reviewsService` gained `getAllReviews` / `adminSetReviewHidden` / `adminDeleteReview` + an `is_hidden` flag filtered from public display).
  - **Tools** — `admin/AdminToolsGrid.tsx` links the standalone admin pages: support-ticket inbox (`/admin/contact-submissions`), announcements/broadcast (`/admin/crm-broadcast`), CRM contacts, Resource Center upload (`/admin/resources`), platform fees, enrollments, signed agreements, landing analytics, notifications, and Stripe/Firestore health.
- Rules: `gig_orders` read now also allows `isAdmin()` (commission monitor); `reviews` update/delete now also allow `isAdmin()` (moderation).

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
