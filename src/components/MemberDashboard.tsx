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




const MemberDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isProfessional } = useAuth();
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  
  // Get membership level with default
  const membershipLevel = user?.membershipLevel || MembershipLevel.DIRECTORY_LISTING;
  const hasUpgraded = hasUpgradedAccess(membershipLevel as string);
  const hasPremium = hasPremiumAccess(membershipLevel as string);


  const [isEmailVerified, setIsEmailVerified] = useState(false);
  
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'message', content: 'New message from Sarah Johnson, CPA', time: '2 hours ago', unread: true },
    { id: 2, type: 'document', content: 'Tax form template updated', time: '1 day ago', unread: true },
    { id: 3, type: 'system', content: 'Your membership expires in 30 days', time: '2 days ago', unread: false }
  ]);

  const [recentActivity] = useState([
    { action: 'Downloaded', item: 'Form 1040 Template', time: '3 hours ago' },
    { action: 'Connected with', item: 'Michael Chen, EA', time: '1 day ago' },
    { action: 'Completed', item: 'Tax Law Update Course', time: '2 days ago' },
    { action: 'Uploaded', item: 'Client Document', time: '3 days ago' }
  ]);

  useEffect(() => {
    if (user) {
      setIsEmailVerified(user.emailVerified);
      if (isProfessional) {
        fetchProfessionalId();
      }
    }
  }, [user, isProfessional]);

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



  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, unread: false } : n
    ));
  };

  const handleRestrictedAction = () => {
    // This function is called when user tries to access restricted features
    return;
  };

  const isFeatureRestricted = isProfessional && !isEmailVerified;


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
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
                  <p className="text-2xl font-bold text-gray-900">24</p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">+3 this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Connections</p>
                  <p className="text-2xl font-bold text-gray-900">12</p>
                </div>
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">+2 this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Messages</p>
                  <p className="text-2xl font-bold text-gray-900">8</p>
                </div>
                <MessageSquare className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">2 unread</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Courses</p>
                  <p className="text-2xl font-bold text-gray-900">6</p>
                </div>
                <BookOpen className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">1 in progress</p>
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
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{activity.action} {activity.item}</p>
                          <p className="text-xs text-gray-500">{activity.time}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    ))}
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
                <CardContent>
                  <p className="text-gray-600">Document management interface would be implemented here.</p>
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
                <CardContent>
                  <p className="text-gray-600">Professional network interface would be implemented here.</p>
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