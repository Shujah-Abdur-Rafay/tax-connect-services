import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, EyeOff, Eye, Trash2, Search, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getAllReviews,
  adminSetReviewHidden,
  adminDeleteReview,
  type Review,
} from '@/services/reviewsService';

/**
 * Phase 5 — admin review moderation. Lists every review (incl. hidden), with
 * search + hide/unhide + delete. Hidden reviews are withheld from public
 * display by getReviewsForProfessional.
 */
const AdminReviewModeration: React.FC = () => {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setReviews(await getAllReviews());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (filter === 'visible' && r.is_hidden) return false;
      if (filter === 'hidden' && !r.is_hidden) return false;
      if (!term) return true;
      return (
        r.client_name.toLowerCase().includes(term) ||
        r.title.toLowerCase().includes(term) ||
        r.review_text.toLowerCase().includes(term) ||
        r.professional_id.toLowerCase().includes(term)
      );
    });
  }, [reviews, search, filter]);

  const hiddenCount = reviews.filter((r) => r.is_hidden).length;

  const toggleHidden = async (r: Review) => {
    setBusyId(r.id);
    try {
      await adminSetReviewHidden(r.id, !r.is_hidden);
      setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_hidden: !x.is_hidden } : x)));
      toast({ title: r.is_hidden ? 'Review restored' : 'Review hidden' });
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: Review) => {
    if (!confirm(`Permanently delete this review by ${r.client_name}? This cannot be undone.`)) return;
    setBusyId(r.id);
    try {
      await adminDeleteReview(r.id);
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
      toast({ title: 'Review deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Review moderation</h2>
          <p className="text-sm text-slate-500">
            {reviews.length} review{reviews.length === 1 ? '' : 's'} · {hiddenCount} hidden
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search reviews, reviewer, or pro id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'visible', 'hidden'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">No reviews match.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className={r.is_hidden ? 'border-amber-200 bg-amber-50/40' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{r.client_name}</span>
                      <span className="inline-flex items-center gap-0.5 text-amber-500">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                          />
                        ))}
                      </span>
                      {r.is_verified && (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                      {r.is_hidden && (
                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    {r.title && <div className="mt-1 font-medium text-slate-800">{r.title}</div>}
                    <p className="mt-1 line-clamp-3 text-sm text-slate-600">{r.review_text}</p>
                    <div className="mt-1 text-xs text-slate-400">
                      pro: {r.professional_id} · {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => toggleHidden(r)}
                    >
                      {r.is_hidden ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}
                      {r.is_hidden ? 'Unhide' : 'Hide'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      disabled={busyId === r.id}
                      onClick={() => remove(r)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReviewModeration;
