import { Bell, Check, CreditCard, MessageSquare, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { markAsRead } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'subscription': return <CreditCard className="h-4 w-4" />;
    case 'payment': return <CreditCard className="h-4 w-4" />;
    case 'message': return <MessageSquare className="h-4 w-4" />;
    default: return <AlertCircle className="h-4 w-4" />;
  }
};

export const NotificationCenter = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, loading } = useNotifications(user?.id || null);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
        </div>
      </div>

      <ScrollArea className="h-[400px]">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-lg border ${!notif.read ? 'bg-blue-50' : 'bg-background'}`}
              >
                <div className="flex items-start gap-3">
                  <NotificationIcon type={notif.type} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{notif.title}</p>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                    </p>
                  </div>
                  {!notif.read && (
                    <Button size="sm" variant="ghost" onClick={() => handleMarkAsRead(notif.id!)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
