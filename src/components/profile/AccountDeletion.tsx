import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Download, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { supabase } from '@/lib/supabase';

export default function AccountDeletion() {
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to export data',
          variant: 'destructive'
        });
        return;
      }

      console.log('Exporting user data for:', user.uid);

      const { data, error } = await supabase.functions.invoke('export-user-data', {
        body: { userId: user.uid }
      });

      if (error) {
        console.error('Export error:', error);
        throw error;
      }

      console.log('Data exported successfully');

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success!',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Your data has been downloaded successfully</span>
          </div>
        )
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!password) {
      toast({
        title: 'Password required',
        description: 'Please enter your password to confirm deletion',
        variant: 'destructive'
      });
      return;
    }

    setIsDeleting(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        toast({
          title: 'Error',
          description: 'You must be logged in to delete your account',
          variant: 'destructive'
        });
        return;
      }

      console.log('Attempting to delete account for:', user.uid);

      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      console.log('Reauthentication successful');

      const { error } = await supabase.functions.invoke('deactivate-account', {
        body: { userId: user.uid, reason: 'User requested deletion' }
      });

      if (error) {
        console.error('Deactivation error:', error);
        throw error;
      }

      console.log('Account deactivated successfully');

      toast({
        title: 'Success!',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Account deactivated. You have 30 days to recover it.</span>
          </div>
        )
      });

      setShowConfirmDialog(false);
      setPassword('');
    } catch (error: any) {
      console.error('Deletion error:', error);
      let errorMessage = 'Failed to delete account. Please try again.';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Deletion failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your data in JSON format (GDPR compliance)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExportData} disabled={isExporting} variant="outline">
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExporting ? 'Exporting...' : 'Download My Data'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your account will be deactivated immediately and scheduled for permanent deletion in 30 days. 
              During this period, you can recover your account by logging in.
            </AlertDescription>
          </Alert>

          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete My Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will deactivate your account. You have 30 days to recover it before permanent deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="confirm-password">Enter your password to confirm *</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="mt-2"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !password}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
