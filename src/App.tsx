
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import ReferralCapture from "./components/ReferralCapture";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
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
import Refer from "./pages/Refer";

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









import ExternalRedirect from "./components/ExternalRedirect";
import NotFound from "./pages/NotFound";
import { startProfileSyncRunner } from "./services/profileSyncQueue";

// Kick off the background retry queue that re-attempts any profile syncs that
// were saved to the device after a permission-denied write, so the
// "Saved on this device" warning clears automatically once syncing succeeds.
startProfileSyncRunner();

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <ReferralCapture />

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
              <Route path="/join" element={<ExternalRedirect url="https://www.refund-connect.com/join-platform" />} />
              <Route path="/onboarding" element={<TaxProfessionalOnboarding />} />
              <Route path="/admin" element={<AdminPanel />} />
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
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);


export default App;
