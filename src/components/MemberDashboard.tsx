import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  User, FileText, MessageSquare, Calendar, Download, 
  Bell, Settings, Star, TrendingUp, Clock, Users,
  BookOpen, Shield, Award, ChevronRight, Lock, Briefcase
} from 'lucide-react';

import { NotificationCenter } from '@/components/NotificationCenter';
import { EmailVerificationStatus } from '@/components/EmailVerificationStatus';
import { ServiceManagementDashboard } from '@/components/ServiceManagementDashboard';
import PackageManagementDashboard from '@/components/PackageManagementDashboard';

import { useAuth } from '@/contexts/AuthContext';
import { MembershipLevel, hasUpgradedAccess, hasPremiumAccess } from '@/constants/membershipLevels';
import PersonalInfoForm from '@/components/profile/PersonalInfoForm';
import ProfessionalProfileForm from '@/components/profile/ProfessionalProfileForm';
import ProfilePhotoUpload from '@/components/profile/ProfilePhotoUpload';
import PasswordChangeForm from '@/components/profile/PasswordChangeForm';
import NotificationSettings from '@/components/profile/NotificationSettings';
import ProfileDiagnostics from '@/components/profile/ProfileDiagnostics';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchMemberStats, type MemberStats } from '@/services/memberStatsService';




const MemberDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isProfessional } = useAuth();
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  
  // Get membership level with default
  const membershipLevel = user?.membershipLevel || MembershipLevel.DIRECTORY_LISTING;
  const hasUpgraded = hasUpgradedAccess(membershipLevel as string);
  const hasPremium = hasPremiumAccess(membershipLevel as string);


  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // Live per-user stats (Documents / Connections / Messages / Courses) + the
  // recent-activity feed, all computed from real Firestore collections.
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setIsEmailVerified(user.emailVerified);
      if (isProfessional) {
        fetchProfessionalId();
      }
      let active = true;
      setStatsLoading(true);
      fetchMemberStats(user.uid)
        .then((s) => {
          if (active) setStats(s);
        })
        .finally(() => {
          if (active) setStatsLoading(false);
        });
      return () => {
        active = false;
      };
    }
  }, [user, isProfessional]);

  const recentActivity = stats?.recentActivity ?? [];

  const fetchProfessionalId = async () => {
    if (!user?.uid) return;
    try {
      // The professionals collection uses Firebase UID as the document ID
      const ref = doc(db, 'professionals', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setProfessionalId(user.uid);
      }
    } catch (err) {
      console.warn('Could not load professional profile:', err);
    }
  };



  const handleRestrictedAction = () => {
    // This function is called when user tries to access restricted features
    return;
  };

  const isFeatureRestricted = isProfessional && !isEmailVerified;


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Professionals get a full, tier-gated dashboard at /pro/dashboard.
            This portal view stays focused on membership; the banner routes pros
            to the real tool so the two surfaces don't compete/duplicate. */}
        {isProfessional && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">Your Pro Dashboard</p>
              <p className="text-sm text-slate-600">
                Manage leads, appointments, messages, documents and earnings in your full
                professional workspace.
              </p>
            </div>
            <Button onClick={() => navigate('/pro/dashboard')} className="bg-blue-600 hover:bg-blue-700">
              Open Pro Dashboard
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.photoURL} alt={user?.name} />
                <AvatarFallback>
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name || 'User'}!</h1>
                <p className="text-gray-600 mt-1">Here's what's happening with your membership</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className={!hasUpgraded ? 'bg-gray-50 text-gray-700 border-gray-200' : 'bg-green-50 text-green-700 border-green-200'}>
                <Shield className="w-3 h-3 mr-1" />
                {membershipLevel}

              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>


        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Documents</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsLoading ? '—' : stats?.documents.total ?? 0}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {statsLoading ? ' ' : `+${stats?.documents.deltaWeek ?? 0} this week`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Connections</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsLoading ? '—' : stats?.connections.total ?? 0}
                  </p>
                </div>
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {statsLoading ? ' ' : `+${stats?.connections.deltaMonth ?? 0} this month`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Messages</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsLoading ? '—' : stats?.messages.total ?? 0}
                  </p>
                </div>
                <MessageSquare className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {statsLoading ? ' ' : `${stats?.messages.unread ?? 0} unread`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Courses</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsLoading ? '—' : stats?.courses.total ?? 0}
                  </p>
                </div>
                <BookOpen className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {statsLoading ? ' ' : `${stats?.courses.inProgress ?? 0} in progress`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={`grid w-full ${isProfessional ? 'grid-cols-7' : 'grid-cols-5'}`}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {isProfessional && <TabsTrigger value="services">Services</TabsTrigger>}
            {isProfessional && <TabsTrigger value="packages">Packages</TabsTrigger>}
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>



          <TabsContent value="overview" className="space-y-6">
            {/* Upgrade Membership Banner */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-600 text-white p-3 rounded-full">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Upgrade Your Membership</h3>
                      <p className="text-gray-600 mt-1">Unlock premium features and grow your tax business</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => navigate('/upgrade-membership')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Upgrade Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Email Verification Status */}
            <EmailVerificationStatus />

            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statsLoading ? (
                      <p className="text-sm text-gray-500 py-4 text-center">Loading activity…</p>
                    ) : recentActivity.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center">
                        No recent activity yet. Uploads, connections, courses and
                        messages will show up here.
                      </p>
                    ) : (
                      recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{activity.action} {activity.item}</p>
                            <p className="text-xs text-gray-500">{activity.timeLabel}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
              {/* Firebase Notifications */}
              <NotificationCenter />

            </div>


            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                {isFeatureRestricted && (
                  <Alert className="mt-4">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      Some features are restricted until you verify your email address.
                    </AlertDescription>
                  </Alert>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col relative"
                    disabled={isFeatureRestricted}
                    onClick={handleRestrictedAction}
                  >
                    {isFeatureRestricted && <Lock className="absolute top-2 right-2 w-4 h-4 text-gray-400" />}
                    <FileText className="w-6 h-6 mb-2" />
                    Upload Document
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col relative"
                    disabled={isFeatureRestricted}
                    onClick={handleRestrictedAction}
                  >
                    {isFeatureRestricted && <Lock className="absolute top-2 right-2 w-4 h-4 text-gray-400" />}
                    <MessageSquare className="w-6 h-6 mb-2" />
                    New Message
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col relative"
                    disabled={isFeatureRestricted}
                    onClick={handleRestrictedAction}
                  >
                    {isFeatureRestricted && <Lock className="absolute top-2 right-2 w-4 h-4 text-gray-400" />}
                    <Calendar className="w-6 h-6 mb-2" />
                    Schedule Meeting
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <Download className="w-6 h-6 mb-2" />
                    Download Forms
                  </Button>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {isProfessional && professionalId && (
            <>
              <TabsContent value="services">
                <ServiceManagementDashboard professionalId={professionalId} />
              </TabsContent>
              
              <TabsContent value="packages">
                <PackageManagementDashboard professionalId={professionalId} />
              </TabsContent>
            </>
          )}


          <TabsContent value="documents">
            {isFeatureRestricted ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-orange-600" />
                    My Documents - Restricted
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertDescription>
                      Please verify your email address to access document management features.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>My Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-600">
                    Document handling lives in your full Pro Dashboard, alongside client files and
                    secure sharing.
                  </p>
                  <Button onClick={() => navigate('/pro/dashboard?tab=documents')} variant="outline">
                    <FileText className="mr-2 h-4 w-4" /> Open Documents
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>



          <TabsContent value="connections">
            {isFeatureRestricted ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-orange-600" />
                    Professional Connections - Restricted
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertDescription>
                      Please verify your email address to connect with other professionals.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Professional Connections</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-600">
                    Connect with clients and respond to leads from your Pro Dashboard.
                  </p>
                  <Button onClick={() => navigate('/pro/dashboard?tab=leads')} variant="outline">
                    <User className="mr-2 h-4 w-4" /> Open Leads &amp; Connections
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>


          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <CardTitle>Continuing Education</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Course catalog and progress tracking would be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            {isProfessional ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Update Your Professional Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-blue-900">
                      To update your professional profile and ensure all information is published correctly, 
                      please use our comprehensive onboarding flow. This will guide you through updating 
                      all aspects of your profile including services, pricing, and availability.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">Ready to update your profile?</h3>
                      <p className="text-gray-600">
                        Click the button below to be redirected to the profile update page where you can 
                        review and edit all your professional information.
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => navigate('/onboarding')}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Briefcase className="w-4 h-4 mr-2" />
                      Update Professional Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <ProfileDiagnostics />
                <PersonalInfoForm />
                <ProfilePhotoUpload />
                <PasswordChangeForm />
                <NotificationSettings />
              </div>
            )}
          </TabsContent>




        </Tabs>
      </div>
    </div>
  );
};

export default MemberDashboard;