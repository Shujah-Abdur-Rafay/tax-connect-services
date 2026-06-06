import React, { useState } from 'react';
import { MessagingProvider } from '@/contexts/MessagingContext';
import Header from './Header';
import Footer from './Footer';
import { MessageNotifications } from './MessageNotifications';
import AccountRecoveryBanner from './AccountRecoveryBanner';
import TaxAssistantChat from './TaxAssistantChat';


interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <MessagingProvider>
      <div className="min-h-screen bg-gray-50">
        <Header onToggleNotifications={() => setShowNotifications(!showNotifications)} />
        <AccountRecoveryBanner />
        <main>
          {children}
        </main>
        <Footer />
        <MessageNotifications 
          isVisible={showNotifications} 
          onClose={() => setShowNotifications(false)} 
        />
        <TaxAssistantChat />
      </div>
    </MessagingProvider>
  );

};

export { AppLayout };
export default AppLayout;

