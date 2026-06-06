import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export function EmailChangeForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingChange, setPendingChange] = useState<any>(null);
  const [checkingPending, setCheckingPending] = useState(true);

  useEffect(() => {
    checkPendingChange();
  }, [user]);

  const checkPendingChange = async () => {
    if (!user) {
      setCheckingPending(false);
      return;
    }
    
    setCheckingPending(true);
    try {
      console.log('Checking for pending email change for user:', user.id);
      const { data, error } = await supabase
        .from('email_change_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

      if (!error && data) {
        console.log('Found pending email change:', data);
        setPendingChange(data);
      } else {
        console.log('No pending email change found');
      }
    } catch (err) {
      console.error('Error checking pending change:', err);
    } finally {
      setCheckingPending(false);
    }
  };

  const handleInitiateChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEmail) {
      toast({
        title: 'Error',
        description: 'Please enter a new email address',
        variant: 'destructive'
      });
      return;
    }

    if (newEmail === user.email) {
      toast({
        title: 'Error',
        description: 'New email must be different from current email',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Initiating email change from', user.email, 'to', newEmail);
      
      const { data, error } = await supabase.functions.invoke('initiate-email-change', {
        body: {
          userId: user.id,
          oldEmail: user.email,
          newEmail: newEmail
        }
      });

      if (error) {
        console.error('Email change error:', error);
        throw error;
      }

      console.log('Email change initiated successfully');

      toast({
        title: 'Success!',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Verification emails sent. Please check both email addresses.</span>
          </div>
        )
      });

      setNewEmail('');
      await checkPendingChange();
    } catch (err: any) {
      console.error('Email change error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to initiate email change. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChange = async () => {
    if (!pendingChange) return;

    setLoading(true);
    try {
      console.log('Cancelling email change request:', pendingChange.id);
      
      const { error } = await supabase
        .from('email_change_requests')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingChange.id);

      if (error) {
        console.error('Cancel error:', error);
        throw error;
      }

      console.log('Email change cancelled successfully');

      toast({
        title: 'Success!',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Email change request cancelled</span>
          </div>
        )
      });

      setPendingChange(null);
    } catch (err: any) {
      console.error('Cancel error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to cancel email change. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingPending) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (pendingChange) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Change Pending
          </CardTitle>
          <CardDescription>Verification required to complete email change</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Current Email: {pendingChange.old_email}</p>
                <p className="font-medium">New Email: {pendingChange.new_email}</p>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2">
                    {pendingChange.old_email_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">
                      Current email {pendingChange.old_email_verified ? 'verified' : 'pending verification'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingChange.new_email_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">
                      New email {pendingChange.new_email_verified ? 'verified' : 'pending verification'}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
          <Button 
            variant="destructive" 
            onClick={handleCancelChange}
            disabled={loading}
            className="w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
            Cancel Email Change
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Change Email Address
        </CardTitle>
        <CardDescription>
          Update your email address. Verification required for both old and new emails.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInitiateChange} className="space-y-4">
          <div className="space-y-2">
            <Label>Current Email</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newEmail">New Email Address *</Label>
            <Input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email address"
              required
            />
          </div>
          <Button type="submit" disabled={loading || !newEmail} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Send Verification Emails
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
