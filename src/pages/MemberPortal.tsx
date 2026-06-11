import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import MemberDashboard from '@/components/MemberDashboard';
import MemberProfile from '@/components/MemberProfile';
import DocumentManager from '@/components/DocumentManager';
import EnhancedDocumentManager from '@/components/EnhancedDocumentManager';
import ProfessionalDocumentViewer from '@/components/ProfessionalDocumentViewer';
import LoginDialog from '@/components/LoginDialog';
import SignUpDialog from '@/components/SignUpDialog';
import MarketingMaterials from '@/components/MarketingMaterials';
import UpgradePrompt from '@/components/UpgradePrompt';
import { ProfessionalAnalyticsDashboard } from '@/components/ProfessionalAnalyticsDashboard';
import MessagingCenter from '@/components/MessagingCenter';
import PaymentHistory from '@/components/PaymentHistory';
import BillingManagement from '@/components/BillingManagement';
import DocumentPricingCard from '@/components/DocumentPricingCard';
import NotificationPreferences from '@/components/NotificationPreferences';
import { User, FileText, MessageSquare, CreditCard, Settings, Receipt, DollarSign, Bell, Upload, Lock, Megaphone, BarChart3, LogOut } from 'lucide-react';

const MemberPortal: React.FC = () => {
  const { user, isLoading, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginOpen, setLoginOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const membershipLevel = user?.membershipLevel || 'Listing';
  const hasUpgradedAccess = membershipLevel !== 'Listing';

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  // Analytics & Marketing are admin-only — keep non-admins off them even if they
  // arrive via ?tab=analytics (otherwise the tab body would render blank).
  useEffect(() => {
    if (!isAdmin && (activeTab === 'analytics' || activeTab === 'marketing')) {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Member Portal Access</CardTitle>
            <p className="text-gray-600 mt-2">Please log in to access your member portal</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setLoginOpen(true)} className="w-full" size="lg">Log In</Button>
            <Button onClick={() => setSignUpOpen(true)} variant="outline" className="w-full" size="lg">Create Account</Button>
            <div className="text-center"><Link to="/" className="text-sm text-blue-600 hover:underline">Return to Homepage</Link></div>
          </CardContent>
        </Card>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
        <SignUpDialog open={signUpOpen} onOpenChange={setSignUpOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {user.name}</h1>
            <p className="text-gray-600 mt-2">Manage your account, documents, and billing</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="shrink-0">
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList
            className="grid w-full lg:w-auto lg:inline-flex"
            style={{ gridTemplateColumns: `repeat(${isAdmin ? 11 : 9}, minmax(0, 1fr))` }}
          >
            <TabsTrigger value="dashboard"><User className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
            {/* Analytics & Marketing are admin-only */}
            {isAdmin && (
              <>
                <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Analytics</span></TabsTrigger>
                <TabsTrigger value="marketing"><Megaphone className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Marketing</span></TabsTrigger>
              </>
            )}
            <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Documents</span></TabsTrigger>
            <TabsTrigger value="tax-docs"><Upload className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Tax Docs</span></TabsTrigger>
            <TabsTrigger value="services"><DollarSign className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Services</span></TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Messages</span></TabsTrigger>
            <TabsTrigger value="billing"><CreditCard className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Billing</span></TabsTrigger>
            <TabsTrigger value="payments"><Receipt className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Payments</span></TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Notifications</span></TabsTrigger>
            <TabsTrigger value="profile"><Settings className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Profile</span></TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><MemberDashboard /></TabsContent>
          {/* Analytics & Marketing are admin-only */}
          {isAdmin && (
            <>
              <TabsContent value="analytics"><ProfessionalAnalyticsDashboard /></TabsContent>
              <TabsContent value="marketing"><MarketingMaterials /></TabsContent>
            </>
          )}
          <TabsContent value="documents">{hasUpgradedAccess ? <DocumentManager conversationId={user.id} currentUser={user.name} /> : <UpgradePrompt feature="Document Management" />}</TabsContent>
          <TabsContent value="tax-docs">{hasUpgradedAccess ? (user.role === 'professional' ? <ProfessionalDocumentViewer /> : <EnhancedDocumentManager />) : <UpgradePrompt feature="Tax Documents" />}</TabsContent>
          <TabsContent value="services">{hasUpgradedAccess ? <Card><CardHeader><CardTitle>Document Processing Services</CardTitle><p className="text-gray-600">Professional document processing with usage-based pricing</p></CardHeader><CardContent><DocumentPricingCard /></CardContent></Card> : <UpgradePrompt feature="Services" />}</TabsContent>
          <TabsContent value="messages"><MessagingCenter currentUserId={user.id} /></TabsContent>

          <TabsContent value="billing">{hasUpgradedAccess ? <BillingManagement /> : <UpgradePrompt feature="Billing Management" />}</TabsContent>
          <TabsContent value="payments">{hasUpgradedAccess ? <PaymentHistory /> : <UpgradePrompt feature="Payment History" />}</TabsContent>
          <TabsContent value="notifications">{hasUpgradedAccess ? <NotificationPreferences /> : <UpgradePrompt feature="Notifications" />}</TabsContent>
          <TabsContent value="profile"><MemberProfile /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MemberPortal;
