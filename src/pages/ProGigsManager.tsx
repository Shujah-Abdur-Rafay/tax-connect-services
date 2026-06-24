import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import GigFormModal from '@/components/gigs/GigFormModal';
import {
  fetchGigsForPro,
  createGig,
  updateGig,
  deleteGig,
  setGigStatus,
  type GigRecord,
  type GigInput,
} from '@/services/gigsService';
import {
  Plus,
  Edit3,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  Loader2,
  LayoutDashboard,
  Eye,
  Clock,
  DollarSign,
} from 'lucide-react';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    published: 'bg-green-100 text-green-700 border-green-200',
    draft: 'bg-gray-100 text-gray-700 border-gray-200',
    paused: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return <Badge variant="outline" className={map[status] || map.draft}>{status}</Badge>;
};

const ProGigsManager: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [gigs, setGigs] = useState<GigRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GigRecord | null>(null);

  const load = async (uid: string) => {
    setLoading(true);
    try {
      const list = await fetchGigsForPro(uid);
      setGigs(list);
    } catch (e: any) {
      toast({
        title: 'Could not load gigs',
        description: e?.message || 'Make sure your Firestore "gigs" collection is accessible.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }

  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/');
      return;
    }
    load(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  const handleSave = async (input: GigInput) => {
    if (!user) return;
    if (editing) {
      const updated = await updateGig(editing.id, user.uid, input);
      setGigs((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      toast({ title: 'Gig updated' });
    } else {
      const created = await createGig(input);
      setGigs((prev) => [created, ...prev]);
      toast({ title: 'Gig created' });
    }
  };

  const togglePause = async (g: GigRecord) => {
    if (!user) return;
    const next = g.status === 'paused' ? 'published' : 'paused';
    try {
      await setGigStatus(g.id, user.uid, next);
      setGigs((prev) => prev.map((x) => (x.id === g.id ? { ...x, status: next } : x)));
      toast({ title: next === 'paused' ? 'Gig paused' : 'Gig published' });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
  };

  const publishDraft = async (g: GigRecord) => {
    if (!user) return;
    try {
      await setGigStatus(g.id, user.uid, 'published');
      setGigs((prev) => prev.map((x) => (x.id === g.id ? { ...x, status: 'published' } : x)));
      toast({ title: 'Gig published' });
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e?.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (g: GigRecord) => {
    if (!user) return;
    if (!confirm(`Delete "${g.title}"? This cannot be undone.`)) return;
    try {
      await deleteGig(g.id, user.uid);
      setGigs((prev) => prev.filter((x) => x.id !== g.id));
      toast({ title: 'Gig deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    }
  };

  const startingPrice = (g: GigRecord) => {
    if (!g.tiers || !g.tiers.length) return null;
    return Math.min(...g.tiers.map((t: any) => Number(t.price) || 0));
  };

  const published = gigs.filter((g) => g.status === 'published').length;
  const drafts = gigs.filter((g) => g.status === 'draft').length;
  const paused = gigs.filter((g) => g.status === 'paused').length;

  return (
    <AppLayout>
      <section className="border-b bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-10">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              <LayoutDashboard className="h-3 w-3" /> Pro Dashboard
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">My Gigs</h1>
            <p className="mt-1 text-blue-100">Create, edit, publish, and pause your tax service listings.</p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="bg-white text-slate-900 hover:bg-blue-50"
            size="lg"
          >
            <Plus className="mr-2 h-4 w-4" /> New gig
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
            <p className="mt-1 text-2xl font-bold">{gigs.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-green-600">Published</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{published}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Drafts</p>
            <p className="mt-1 text-2xl font-bold">{drafts}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-amber-600">Paused</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{paused}</p>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your gigs…
          </div>
        ) : gigs.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
            <LayoutDashboard className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <h3 className="text-lg font-semibold">No gigs yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first packaged tax service. Set Basic / Standard / Premium tiers like Fiverr.
            </p>
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="mt-5 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" /> Create my first gig
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {gigs.map((g) => {
              const price = startingPrice(g);
              return (
                <Card key={g.id} className="overflow-hidden">
                  <div className="flex flex-col gap-4 p-4 md:flex-row">
                    <div className="h-32 w-full overflow-hidden rounded-lg bg-gray-100 md:h-24 md:w-40">
                      {g.image ? (
                        <img src={g.image} alt={g.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          No cover
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={g.status} />
                        <Badge variant="outline" className="text-xs capitalize">
                          {g.category}
                        </Badge>
                        {g.available_now && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" /> Available now
                          </span>
                        )}
                      </div>
                      <h3 className="line-clamp-1 font-semibold text-gray-900">{g.title}</h3>
                      <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{g.short_description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {price !== null && (
                          <span className="inline-flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> From ${price}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {g.response_time}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {g.tiers?.length || 0} tiers
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {g.status === 'draft' && (
                        <Button size="sm" onClick={() => publishDraft(g)} className="bg-green-600 hover:bg-green-700">
                          <Play className="mr-1 h-3 w-3" /> Publish
                        </Button>
                      )}
                      {g.status !== 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => togglePause(g)}>
                          {g.status === 'paused' ? (
                            <>
                              <Play className="mr-1 h-3 w-3" /> Resume
                            </>
                          ) : (
                            <>
                              <Pause className="mr-1 h-3 w-3" /> Pause
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(g);
                          setShowForm(true);
                        }}
                      >
                        <Edit3 className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      {g.status === 'published' && (
                        <Button size="sm" variant="ghost" onClick={() => navigate('/tax-gigs')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(g)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {user && (
        <GigFormModal
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
          initial={editing}
          defaultPro={{
            proId: user.uid,
            proEmail: user.email,
            proName: user.name,
            proTitle: (user as any).title || 'Tax Professional',
            proAvatar: user.photoURL,
          }}
        />
      )}
    </AppLayout>
  );
};

export default ProGigsManager;
