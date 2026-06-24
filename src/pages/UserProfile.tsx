import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PersonalInfoForm from '@/components/profile/PersonalInfoForm';
import ProfilePhotoUpload from '@/components/profile/ProfilePhotoUpload';
import PasswordChangeForm from '@/components/profile/PasswordChangeForm';
import NotificationSettings from '@/components/profile/NotificationSettings';
import AccountDeletion from '@/components/profile/AccountDeletion';
import ProfessionalProfileForm from '@/components/profile/ProfessionalProfileForm';
import { EmailChangeForm } from '@/components/profile/EmailChangeForm';
import { User, Lock, Bell, Camera, Trash2, Briefcase, Mail } from 'lucide-react';




const UserProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">Profile Settings</h1>
          
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-7 mb-8">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="professional" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Professional
              </TabsTrigger>
              <TabsTrigger value="photo" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Photo
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Password
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="account" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Account
              </TabsTrigger>


            </TabsList>

            <TabsContent value="personal">
              <PersonalInfoForm />
            </TabsContent>

            <TabsContent value="professional">
              <ProfessionalProfileForm />
            </TabsContent>


            <TabsContent value="photo">
              <ProfilePhotoUpload />
            </TabsContent>

            <TabsContent value="email">
              <EmailChangeForm />
            </TabsContent>

            <TabsContent value="password">
              <PasswordChangeForm />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="account">
              <AccountDeletion />
            </TabsContent>

          </Tabs>
        </div>
      </main>
      <Footer />

      <Footer />
    </div>
  );
};

export default UserProfile;
