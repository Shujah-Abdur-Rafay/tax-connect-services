import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Inbox,
  Mail,
  Phone,
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  Clock,
  CircleDot,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getLeadsForProfessional,
  updateSubmissionStatus,
  type ContactSubmission,
} from '@/services/contactFormService';

const STATUS_META: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: CircleDot },
  in_progress: { label: 'In progress', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
};

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

interface ProLeadsInboxProps {
  professionalId: string;
}

/**
 * Phase 3 — Leads & Inquiries view for the consolidated pro dashboard.
 *
 * Surfaces the contact-form submissions that came in through the pro's public
 * profile (queried by professional_id), with a lightweight new → in-progress →
 * resolved pipeline and a deep-link to continue the conversation in the portal.
 */
const ProLeadsInbox: React.FC<ProLeadsInboxProps> = ({ professionalId }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setLeads(await getLeadsForProfessional(professionalId));
    } catch (e) {
      console.error('[ProLeadsInbox] load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (professionalId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  const setStatus = async (lead: ContactSubmission, status: 'new' | 'in_progress' | 'resolved') => {
    if (!lead.id) return;
    setUpdatingId(lead.id);
    try {
      await updateSubmissionStatus(lead.id, status);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
      toast({ title: 'Lead updated', description: `Marked as ${STATUS_META[status].label}.` });
    } catch (e: any) {
      toast({
        title: 'Could not update',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const newCount = leads.filter((l) => (l.status || 'new') === 'new').length;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-48" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Inbox className="h-5 w-5 text-blue-600" />
            Leads &amp; Inquiries
          </h2>
          <p className="text-sm text-slate-600">
            {leads.length === 0
              ? 'Inquiries from your public profile land here.'
              : `${leads.length} total${newCount ? ` · ${newCount} new` : ''}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Inbox className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No leads yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              When a client uses the Contact form on your{' '}
              <span className="font-medium">/preparer</span> profile, their inquiry shows up here
              so you can follow up fast.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const status = (lead.status || 'new') as keyof typeof STATUS_META;
            const meta = STATUS_META[status] || STATUS_META.new;
            const StatusIcon = meta.icon;
            return (
              <Card key={lead.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{lead.name || 'Unknown'}</CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="inline-flex items-center gap-1 hover:text-blue-600"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {lead.email}
                          </a>
                        )}
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="inline-flex items-center gap-1 hover:text-blue-600"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {lead.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={meta.className}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {lead.service_type && (
                      <Badge variant="secondary" className="font-normal">
                        {lead.service_type}
                      </Badge>
                    )}
                    {lead.preferred_contact && <span>Prefers: {lead.preferred_contact}</span>}
                    <span className="ml-auto">{fmtDate(lead.created_at)}</span>
                  </div>

                  {lead.message && (
                    <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{lead.message}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {lead.conversation_id && (
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(`/member-portal?tab=messages&conversation=${lead.conversation_id}`)
                        }
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open conversation
                      </Button>
                    )}
                    {status !== 'in_progress' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === lead.id}
                        onClick={() => setStatus(lead, 'in_progress')}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Mark in progress
                      </Button>
                    )}
                    {status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === lead.id}
                        onClick={() => setStatus(lead, 'resolved')}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark resolved
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProLeadsInbox;
