
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import ReferralCapture from "./components/ReferralCapture";
import ErrorBoundary from "./components/ErrorBoundary";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { MessagingProvider } from "@/contexts/MessagingContext";
import Index from "./pages/Index";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmailChange from "./pages/VerifyEmailChange";

import UserProfile from "./pages/UserProfile";
import UpgradeMembership from "./pages/UpgradeMembership";
import MembershipSuccess from "./pages/MembershipSuccess";




import FindProfessionals from "./pages/FindProfessionals";
import TaxGigs from "./pages/TaxGigs";
import ProGigsManager from "./pages/ProGigsManager";
import ProOrdersInbox from "./pages/ProOrdersInbox";
import MyOrders from "./pages/MyOrders";
import ProPayouts from "./pages/ProPayouts";
import ProDocumentsInbox from "./pages/ProDocumentsInbox";
import ProDashboard from "./pages/ProDashboard";
import ClientDashboard from "./pages/ClientDashboard";


import ProfessionalProfile from "./pages/ProfessionalProfile";



import MemberPortalPage from "./pages/MemberPortal";
import HowItWorks from "./pages/HowItWorks";
import TaxResources from "./pages/TaxResources";
import Support from "./pages/Support";
import About from "./pages/About";

import OurStory from "./pages/OurStory";
import JoinPlatform from "./pages/JoinPlatform";
import Pricing from "./pages/Pricing";
import ComingSoon from "./pages/ComingSoon";

import TaxProfessionalOnboarding from "./components/TaxProfessionalOnboarding";
import AdminPanel from "./pages/AdminPanel";
import AdminNotifications from "./pages/AdminNotifications";
import ContactSubmissions from "./pages/ContactSubmissions";
import EnrollmentSubmissions from "./pages/EnrollmentSubmissions";
import LandingAnalytics from "./pages/LandingAnalytics";
import SignedAgreements from "./pages/SignedAgreements";
import EnrollmentFormPreview from "./pages/EnrollmentFormPreview";
import StripeTest from "./pages/StripeTest";
import StripeTestCheckout from "./pages/StripeTestCheckout";
import StripeHealth from "./pages/StripeHealth";
import FirestoreHealth from "./pages/FirestoreHealth";

import PaymentSplitTest from "./pages/PaymentSplitTest";
import AdminPlatformFees from "./pages/AdminPlatformFees";
import AdminCrmContacts from "./pages/AdminCrmContacts";
import AdminCrmBroadcast from "./pages/AdminCrmBroadcast";
import AdminResources from "./pages/AdminResources";

// Admin console sections (rendered inside AdminLayout via AdminPanel's <Outlet />).
import AdminOverview from "./components/admin/AdminOverview";
import AdminApplicationsSection from "./components/admin/AdminApplicationsSection";
import AdminSectionGuard from "./components/admin/AdminSectionGuard";
import { ProfessionalListingManager } from "./components/ProfessionalListingManager";
import { UserMembershipManager } from "./components/UserMembershipManager";
import AdminSubscriptionsManager from "./components/admin/AdminSubscriptionsManager";
import AdminReviewModeration from "./components/admin/AdminReviewModeration";
import AdminPayoutsMonitor from "./components/admin/AdminPayoutsMonitor";
import AdminContentManager from "./components/admin/AdminContentManager";
import AdminManagement from "./components/admin/AdminManagement";
import AdminToolsGrid from "./components/admin/AdminToolsGrid";









import ExternalRedirect from "./components/ExternalRedirect";
import NotFound from "./pages/NotFound";
import { startProfileSyncRunner } from "./services/profileSyncQueue";

// Kick off the background retry queue that re-attempts any profile syncs that
// were saved to the device after a permission-denied write, so the
// "Saved on this device" warning clears automatically once syncing succeeds.
startProfileSyncRunner();

const queryClient = new QueryClient();

// Routes wrapped in an ErrorBoundary keyed on the current path, so a render
// error on one page shows a recovery card (never a blank screen) and clears
// automatically when the user navigates elsewhere.
const AppRoutes = () => {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/find-professionals" element={<FindProfessionals />} />
              <Route path="/tax-gigs" element={<TaxGigs />} />
              <Route path="/gigs" element={<TaxGigs />} />
              <Route path="/pro/gigs" element={<ProGigsManager />} />
              <Route path="/pro/orders" element={<ProOrdersInbox />} />
              <Route path="/pro/documents" element={<ProDocumentsInbox />} />
              <Route path="/pro/dashboard" element={<ProDashboard />} />
              <Route path="/pro-dashboard" element={<ProDashboard />} />
              <Route path="/pro-payouts" element={<ProPayouts />} />
              <Route path="/pro/payouts" element={<ProPayouts />} />
              <Route path="/my-orders" element={<MyOrders />} />
              <Route path="/client/dashboard" element={<ClientDashboard />} />
              <Route path="/dashboard" element={<ClientDashboard />} />




              <Route path="/preparer/:slug" element={<ProfessionalProfile />} />
              <Route path="/professional/:id" element={<ProfessionalProfile />} />
              <Route path="/member-portal" element={<MemberPortalPage />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/tax-resources" element={<TaxResources />} />
              <Route path="/support" element={<Support />} />
              <Route path="/about" element={<About />} />
              <Route path="/our-story" element={<OurStory />} />
              <Route path="/join-platform" element={<JoinPlatform />} />
              <Route path="/pricing" element={<Pricing />} />
              {/* Refer & Earn is linked in the header but not built yet — show a
                  friendly Coming Soon page instead of falling through to 404. */}
              <Route path="/refer" element={<ComingSoon />} />
              <Route path="/join" element={<ExternalRedirect url="https://refund-connect.com/join-platform" />} />
              <Route path="/onboarding" element={<TaxProfessionalOnboarding />} />
              {/* Admin console — AdminPanel renders the dark AdminLayout shell;
                  these nested routes fill its <Outlet />. Each section is gated
                  by AdminSectionGuard so help-desk users only see what they're
                  granted (the whole branch is already behind canAccessAdmin). */}
              <Route path="/admin" element={<AdminPanel />}>
                <Route index element={<AdminOverview />} />
                <Route path="applications" element={<AdminSectionGuard perm="applications"><AdminApplicationsSection /></AdminSectionGuard>} />
                <Route path="professionals" element={<AdminSectionGuard perm="applications"><ProfessionalListingManager /></AdminSectionGuard>} />
                <Route path="memberships" element={<AdminSectionGuard perm="memberships"><UserMembershipManager /></AdminSectionGuard>} />
                <Route path="subscriptions" element={<AdminSectionGuard perm="subscriptions"><AdminSubscriptionsManager /></AdminSectionGuard>} />
                <Route path="payouts" element={<AdminSectionGuard perm="payouts"><AdminPayoutsMonitor /></AdminSectionGuard>} />
                <Route path="reviews" element={<AdminSectionGuard perm="reviews"><AdminReviewModeration /></AdminSectionGuard>} />
                <Route path="content" element={<AdminSectionGuard perm="content"><AdminContentManager /></AdminSectionGuard>} />
                <Route path="admins" element={<AdminSectionGuard perm="admins"><AdminManagement /></AdminSectionGuard>} />
                <Route path="tools" element={<AdminSectionGuard perm="tools"><AdminToolsGrid /></AdminSectionGuard>} />
              </Route>
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/contact-submissions" element={<ContactSubmissions />} />
              <Route path="/admin/enrollments" element={<EnrollmentSubmissions />} />
              <Route path="/admin/landing-analytics" element={<LandingAnalytics />} />
              <Route path="/admin/signed-agreements" element={<SignedAgreements />} />



              <Route path="/enrollment-form-preview" element={<EnrollmentFormPreview />} />
              <Route path="/enrollment-preview" element={<EnrollmentFormPreview />} />



              <Route path="/profile" element={<UserProfile />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/upgrade-membership" element={<UpgradeMembership />} />
              <Route path="/membership-success" element={<MembershipSuccess />} />
              <Route path="/verify-email-change" element={<VerifyEmailChange />} />
              <Route path="/stripe-test" element={<StripeTest />} />
              <Route path="/admin/stripe-test" element={<StripeTest />} />
              <Route path="/stripe-test-checkout" element={<StripeTestCheckout />} />
              <Route path="/admin/stripe-test-checkout" element={<StripeTestCheckout />} />
              <Route path="/admin/payment-split-test" element={<PaymentSplitTest />} />
              <Route path="/payment-split-test" element={<PaymentSplitTest />} />
              <Route path="/admin/platform-fees" element={<AdminPlatformFees />} />
              <Route path="/admin/crm-contacts" element={<AdminCrmContacts />} />
              <Route path="/admin/crm-broadcast" element={<AdminCrmBroadcast />} />
              <Route path="/admin/resources" element={<AdminResources />} />
              <Route path="/admin/stripe-health" element={<StripeHealth />} />
              <Route path="/stripe-health" element={<StripeHealth />} />
              <Route path="/admin/firestore-health" element={<FirestoreHealth />} />
              <Route path="/firestore-health" element={<FirestoreHealth />} />

















              <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
};

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* MessagingProvider is hoisted to the app root (inside AuthProvider,
            which it depends on) so every page that renders <Header> — many do
            so directly, outside AppLayout — has a provider for useMessaging().
            Previously only AppLayout supplied it, so direct-Header pages such as
            ProfessionalProfile crashed to a blank screen for logged-in users. */}
        <MessagingProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <ReferralCapture />
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </MessagingProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);


export default App;
