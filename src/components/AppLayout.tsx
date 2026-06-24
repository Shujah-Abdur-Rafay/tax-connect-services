import React, { useState } from 'react';
import Header from './Header';
import Footer from './Footer';
import { MessageNotifications } from './MessageNotifications';
import AccountRecoveryBanner from './AccountRecoveryBanner';
import TaxAssistantChat from './TaxAssistantChat';


interface AppLayoutProps {
  children: React.ReactNode;
}

// Note: MessagingProvider is supplied at the app root (App.tsx) so it also
// covers the many pages that render <Header> directly without AppLayout. No
// need to wrap it again here.
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
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
  );

};

export { AppLayout };
export default AppLayout;

