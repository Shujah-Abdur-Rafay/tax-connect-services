// ============================================================================
// ComingSoon — friendly placeholder for features that aren't live yet.
//
// Used for /refer (Refer & Earn) which is linked in the header but not built
// out yet, so it shows this instead of a 404. Pass a title/description to reuse
// it for any other "coming soon" route.
// ============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Gift, Clock, ArrowLeft } from 'lucide-react';

interface ComingSoonProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const ComingSoon: React.FC<ComingSoonProps> = ({
  title = 'Refer & Earn',
  description = 'Our referral rewards program is on its way. Soon you’ll be able to invite friends and earn for every successful referral.',
  icon: Icon = Gift,
}) => {
  return (
    <AppLayout>
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
        <div className="relative mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
            <Icon className="h-10 w-10" />
          </div>
          <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
            <Clock className="h-3 w-3" /> Soon
          </span>
        </div>

        <h1 className="text-4xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 inline-block rounded-full bg-blue-50 px-4 py-1 text-sm font-semibold text-blue-700">
          Coming soon
        </p>
        <p className="mt-4 max-w-md text-gray-600">{description}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/find-professionals">Find a tax pro</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ComingSoon;
