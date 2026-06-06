import React from 'react';
import AppLayout from '@/components/AppLayout';
import Hero from '@/components/Hero';
import SearchSection from '@/components/SearchSection';
import PopularServices from '@/components/PopularServices';
import MemberPortal from '@/components/MemberPortal';
import TrustSection from '@/components/TrustSection';
import SocialProofStats from '@/components/SocialProofStats';
import { AppProvider } from '@/contexts/AppContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Sparkles } from 'lucide-react';

const Index: React.FC = () => {
  return (
    <AppProvider>
      <AppLayout>
        <Hero />

        {/* Browse Gigs CTA banner */}
        <section className="border-y bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-100">New on Refund Connect</span>
              </div>
              <h2 className="text-2xl font-bold md:text-3xl">Tax Services: fixed-price packages from vetted pros</h2>
              <p className="mt-1 text-blue-100">Browse 100+ tax services with transparent Basic / Standard / Premium tiers. Book instantly.</p>
            </div>
            <Button asChild size="lg" className="bg-white text-blue-700 hover:bg-blue-50">
              <Link to="/tax-gigs">
                Browse Tax Gigs <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <SocialProofStats />
        <SearchSection />
        <PopularServices />
        <TrustSection />
        <MemberPortal />
      </AppLayout>
    </AppProvider>
  );
};

export default Index;
