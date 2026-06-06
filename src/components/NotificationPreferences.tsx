import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, FileText, Calendar, CreditCard } from 'lucide-react';

interface NotificationSettings {
  documentUpload: boolean;
  documentReview: boolean;
  appointmentBooked: boolean;
  appointmentCancelled: boolean;
  appointmentReminder: boolean;
  paymentProcessed: boolean;
  paymentFailed: boolean;
  messageReceived: boolean;
}

export default function NotificationPreferences() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>({
    documentUpload: true,
    documentReview: true,
    appointmentBooked: true,
    appointmentCancelled: true,
    appointmentReminder: true,
    paymentProcessed: true,
    paymentFailed: true,
    messageReceived: true,
  });

  useEffect(() => {
    // Load saved preferences from localStorage
    const saved = localStorage.getItem('notificationPreferences');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    localStorage.setItem('notificationPreferences', JSON.stringify(settings));
    toast({
      title: 'Preferences Saved',
      description: 'Your notification preferences have been updated.',
    });
  };

  const notificationGroups = [
    {
      title: 'Document Notifications',
      icon: FileText,
      items: [
        { key: 'documentUpload', label: 'New document uploaded', description: 'When a client uploads a new document' },
        { key: 'documentReview', label: 'Document reviewed', description: 'When a professional reviews your document' },
      ]
    },
    {
      title: 'Appointment Notifications',
      icon: Calendar,
      items: [
        { key: 'appointmentBooked', label: 'Appointment booked', description: 'When an appointment is confirmed' },
        { key: 'appointmentCancelled', label: 'Appointment cancelled', description: 'When an appointment is cancelled' },
        { key: 'appointmentReminder', label: 'Appointment reminders', description: '24 hours before your appointment' },
      ]
    },
    {
      title: 'Payment Notifications',
      icon: CreditCard,
      items: [
        { key: 'paymentProcessed', label: 'Payment processed', description: 'When a payment is successfully processed' },
        { key: 'paymentFailed', label: 'Payment failed', description: 'When a payment fails or requires attention' },
      ]
    },
    {
      title: 'Communication',
      icon: Mail,
      items: [
        { key: 'messageReceived', label: 'New messages', description: 'When you receive a new message' },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold">Notification Preferences</h2>
          <p className="text-gray-600">Manage how you receive email notifications</p>
        </div>
      </div>

      {notificationGroups.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <group.icon className="h-5 w-5 text-blue-600" />
              <CardTitle>{group.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <Label htmlFor={item.key} className="text-base font-medium cursor-pointer">
                    {item.label}
                  </Label>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
                <Switch
                  id={item.key}
                  checked={settings[item.key as keyof NotificationSettings]}
                  onCheckedChange={() => handleToggle(item.key as keyof NotificationSettings)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Button onClick={handleSave} className="w-full">
        Save Preferences
      </Button>
    </div>
  );
}
