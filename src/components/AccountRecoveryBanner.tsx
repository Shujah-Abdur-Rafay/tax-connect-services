import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { accountRecoveryService } from '@/services/accountRecoveryService';
import { useToast } from '@/hooks/use-toast';

export default function AccountRecoveryBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accountStatus, setAccountStatus] = useState<any>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (user) {
      checkStatus();
    }
  }, [user]);

  const checkStatus = async () => {
    if (!user) return;
    const status = await accountRecoveryService.checkAccountStatus(user.uid);
    if (status && status.status === 'deactivated') {
      setAccountStatus(status);
    }
  };

  const handleRecover = async () => {
    if (!user) return;
    setIsRecovering(true);
    try {
      await accountRecoveryService.recoverAccount(user.uid);
      toast({
        title: 'Account recovered',
        description: 'Your account has been successfully reactivated.'
      });
      setAccountStatus(null);
    } catch (error: any) {
      toast({
        title: 'Recovery failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsRecovering(false);
    }
  };

  if (!accountStatus || accountStatus.status !== 'deactivated') {
    return null;
  }

  const daysLeft = accountRecoveryService.getDaysUntilDeletion(accountStatus.scheduled_deletion_date);

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Account Scheduled for Deletion</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          Your account will be permanently deleted in {daysLeft} days. 
          You can recover it now to prevent deletion.
        </span>
        <Button 
          onClick={handleRecover} 
          disabled={isRecovering}
          variant="outline"
          size="sm"
        >
          {isRecovering ? 'Recovering...' : 'Recover Account'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
