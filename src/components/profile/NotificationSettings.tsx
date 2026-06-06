import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Bell } from 'lucide-react';

interface NotificationPreferences {
  emailNotifications: boolean;
  appointmentReminders: boolean;
  marketingEmails: boolean;
  documentUpdates: boolean;
  messageNotifications: boolean;
}

const NotificationSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    appointmentReminders: true,
    marketingEmails: false,
    documentUpdates: true,
    messageNotifications: true
  });

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user || !db) {
      setInitialLoad(false);
      return;
    }
    
    try {
      console.log('Loading notification preferences for:', user.id);
      const docRef = doc(db, 'users', user.id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().notificationPreferences) {
        console.log('Preferences loaded:', docSnap.data().notificationPreferences);
        setPreferences(docSnap.data().notificationPreferences);
      } else {
        console.log('No saved preferences, using defaults');
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setInitialLoad(false);
    }
  };

  const handleSave = async () => {
    if (!user || !db) {
      toast({
        title: 'Error',
        description: 'You must be logged in to save preferences',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Saving notification preferences:', preferences);
      
      await updateDoc(doc(db, 'users', user.id), {
        notificationPreferences: preferences,
        updatedAt: new Date().toISOString()
      });

      console.log('Preferences saved successfully');

      toast({
        title: 'Success!',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Notification preferences updated</span>
          </div>
        )
      });

      // Reload to confirm save
      await loadPreferences();
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update preferences. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Manage how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Email Notifications</Label>
            <p className="text-sm text-gray-500">Receive general email notifications</p>
          </div>
          <Switch
            checked={preferences.emailNotifications}
            onCheckedChange={(checked) => 
              setPreferences({ ...preferences, emailNotifications: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Appointment Reminders</Label>
            <p className="text-sm text-gray-500">Get reminders before appointments</p>
          </div>
          <Switch
            checked={preferences.appointmentReminders}
            onCheckedChange={(checked) => 
              setPreferences({ ...preferences, appointmentReminders: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Marketing Emails</Label>
            <p className="text-sm text-gray-500">Receive promotional content</p>
          </div>
          <Switch
            checked={preferences.marketingEmails}
            onCheckedChange={(checked) => 
              setPreferences({ ...preferences, marketingEmails: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Document Updates</Label>
            <p className="text-sm text-gray-500">Notifications about document changes</p>
          </div>
          <Switch
            checked={preferences.documentUpdates}
            onCheckedChange={(checked) => 
              setPreferences({ ...preferences, documentUpdates: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Message Notifications</Label>
            <p className="text-sm text-gray-500">Get notified of new messages</p>
          </div>
          <Switch
            checked={preferences.messageNotifications}
            onCheckedChange={(checked) => 
              setPreferences({ ...preferences, messageNotifications: checked })
            }
          />
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
