import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { gigCategories, type TaxGig, type GigTier } from '@/data/taxGigs';
import GigCard from '@/components/GigCard';
import GigDetailModal from '@/components/GigDetailModal';
import ProjectBriefModal from '@/components/ProjectBriefModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal, TrendingUp, Zap, ShieldCheck, Loader2 } from 'lucide-react';
import { fetchPublishedGigs } from '@/services/gigsService';

const TaxGigsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'recommended' | 'price-low' | 'price-high' | 'rating'>('recommended');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedGig, setSelectedGig] = useState<TaxGig | null>(null);
  const [briefGig, setBriefGig] = useState<TaxGig | null>(null);
  const [briefTier, setBriefTier] = useState<GigTier | null>(null);
  const [gigs, setGigs] = useState<TaxGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { gigs: list, usingFallback: fb } = await fetchPublishedGigs();
      if (cancelled) return;
      setGigs(list);
      setUsingFallback(fb);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = gigs.slice();
    if (category !== 'all') list = list.filter((g) => g.category === category);
    if (availableOnly) list = list.filter((g) => g.availableNow);
    if (verifiedOnly) list = list.filter((g) => g.proBadge === 'Verified Pro' || g.proBadge === 'Premium Partner' || g.proBadge === 'Top Rated');
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.proName.toLowerCase().includes(q) ||
          g.tags.some((t) => t.toLowerCase().includes(q)) ||
          g.shortDescription.toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case 'price-low':
        list.sort((a, b) => (a.tiers[0]?.price || 0) - (b.tiers[0]?.price || 0)); break;
      case 'price-high':
        list.sort((a, b) => (b.tiers[0]?.price || 0) - (a.tiers[0]?.price || 0)); break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating); break;
      default:
        list.sort((a, b) => b.filedThisSeason - a.filedThisSeason);
    }
    return list;
  }, [gigs, query, category, sort, availableOnly, verifiedOnly]);


  const toggleSave = (id: string) =>
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleStartBrief = (gig: TaxGig, tier: GigTier) => {
    setSelectedGig(null);
    setBriefGig(gig);
    setBriefTier(tier);
  };

  return (
    <AppLayout>
      {/* Hero strip */}
      <section className="border-b bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
          <div className="mb-6 flex flex-wrap gap-2">
            <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/25">
              <Zap className="mr-1 h-3 w-3" /> Instant booking
            </Badge>
            <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/25">
              <ShieldCheck className="mr-1 h-3 w-3" /> Vetted pros
            </Badge>
            <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/25">
              <TrendingUp className="mr-1 h-3 w-3" /> Fixed-price tiers
            </Badge>
          </div>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            Tax services, priced & packaged.
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-blue-100">
            Browse fixed-price tax gigs from vetted CPAs, EAs, and tax attorneys. Pick a package, send a brief, get it done.
          </p>

          <div className="mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 text-gray-900 shadow-lg">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try 'crypto', 'self-employed', 'rental'…"
              className="flex-1 bg-transparent outline-none placeholder:text-gray-400"
            />
            <Button onClick={() => { /* triggers filter via state */ }} className="rounded-full bg-blue-600 hover:bg-blue-700">
              Search
            </Button>
          </div>
        </div>
      </section>

      {/* Categories scroller */}
      <section className="sticky top-16 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4">
          <div className="flex gap-2 py-3">
            {gigCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  category === c.id
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filters + grid */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-gray-500" />
            <button
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                availableOnly ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
              }`}
            >
              Available now
            </button>
            <button
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                verifiedOnly ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
              }`}
            >
              Verified pros only
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{filtered.length} services</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="recommended">Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading gigs…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-12 text-center">
            <p className="text-lg font-medium text-gray-900">No services match those filters</p>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search or category.</p>
          </div>
        ) : (
          <>
            {usingFallback && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                Showing featured sample gigs. Be the first pro to publish — head to your dashboard.
              </div>
            )}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((g) => (
                <GigCard
                  key={g.id}
                  gig={g}
                  saved={savedIds.includes(g.id)}
                  onToggleSave={toggleSave}
                  onSelect={setSelectedGig}
                />
              ))}
            </div>
          </>
        )}
      </section>


      <GigDetailModal
        gig={selectedGig}
        open={!!selectedGig}
        onClose={() => setSelectedGig(null)}
        onStartBrief={handleStartBrief}
      />
      <ProjectBriefModal
        open={!!briefGig}
        onClose={() => { setBriefGig(null); setBriefTier(null); }}
        gig={briefGig}
        tier={briefTier}
      />
    </AppLayout>
  );
};

export default TaxGigsPage;
