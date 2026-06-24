import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMessaging } from '@/contexts/MessagingContext';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Bell, X } from 'lucide-react';


interface MessageNotificationsProps {
  isVisible: boolean;
  onClose: () => void;
}

export const MessageNotifications: React.FC<MessageNotificationsProps> = ({ isVisible, onClose }) => {
  const { totalUnreadCount, conversations } = useMessaging();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Don't show if user is not logged in or not visible
  if (!user || totalUnreadCount === 0 || !isVisible) return null;

  const handleViewMessages = () => {
    navigate('/member-portal?tab=messages');
    onClose();
  };


  return (
    <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2">
      <Card className="w-80 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="font-medium">New Messages</span>
              <Badge variant="destructive">{totalUnreadCount}</Badge>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {conversations
              .filter(conv => conv.unreadCount > 0)
              .slice(0, 3)
              .map((conv) => (
                <div key={conv.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{conv.otherPartyName}</span>
                  </div>
                  <Badge variant="secondary">{conv.unreadCount}</Badge>
                </div>
              ))}
          </div>

          
          <Button className="w-full mt-3" size="sm" onClick={handleViewMessages}>
            View All Messages
          </Button>

        </CardContent>
      </Card>
    </div>
  );
};

interface MessageIndicatorProps {
  onClick: () => void;
}

export const MessageIndicator: React.FC<MessageIndicatorProps> = ({ onClick }) => {
  const { totalUnreadCount } = useMessaging();
  const { user, isProfessional, canAccessAdmin } = useAuth();
  const navigate = useNavigate();

  // Only show if user is logged in. Admins/help-desk have no messaging inbox, so
  // the icon would be a dead end for them — hide it.
  if (!user || canAccessAdmin) return null;

  // Go straight to the user's Messages view. This always works, regardless of
  // unread count or which page rendered the header (the old onToggle popup only
  // appeared when there were unread messages, so it looked "broken" otherwise).
  const handleClick = () => {
    navigate(
      isProfessional ? '/pro/dashboard?tab=messages' : '/member-portal?tab=messages',
    );
    onClick?.();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      onClick={handleClick}
    >
      <MessageCircle className="h-5 w-5" />
      {totalUnreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
        </Badge>
      )}
    </Button>
  );
};
