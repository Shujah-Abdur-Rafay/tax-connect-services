import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  Globe,
  GlobeLock,
  Loader2,
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  Mail,
  Phone,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getAllProfessionalsForAdmin,
  approveProfessional,
  rejectProfessional,
  setProfessionalPublished,
  Professional,
} from '@/services/professionalsService';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'all';

export function ProfessionalListingManager() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reject confirmation dialog state
  const [rejectTarget, setRejectTarget] = useState<Professional | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const data = await getAllProfessionalsForAdmin();
      setProfessionals(data);
    } catch (error) {
      console.error('Error fetching professionals:', error);
      toast({
        title: 'Error',
        description: 'Failed to load professionals from Firebase.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (prof: Professional) => {
    if (!confirm(`Approve ${prof.full_name}? They will become publicly visible in the directory.`)) {
      return;
    }
    setActionLoading(prof.id);
    try {
      await approveProfessional(prof.id);
      setProfessionals((prev) =>
        prev.map((p) =>
          p.id === prof.id
            ? { ...p, approval_status: 'approved', is_published: true }
            : p
        )
      );
      toast({
        title: 'Approved',
        description: `${prof.full_name} has been approved and published.`,
      });
    } catch (error: any) {
      console.error('Approve error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to approve professional.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (prof: Professional) => {
    setRejectTarget(prof);
    setRejectNotes(prof.approval_notes || '');
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      await rejectProfessional(rejectTarget.id, rejectNotes);
      setProfessionals((prev) =>
        prev.map((p) =>
          p.id === rejectTarget.id
            ? {
                ...p,
                approval_status: 'rejected',
                is_published: false,
                approval_notes: rejectNotes,
              }
            : p
        )
      );
      toast({
        title: 'Rejected',
        description: `${rejectTarget.full_name} has been rejected and removed from the directory.`,
      });
      setRejectTarget(null);
      setRejectNotes('');
    } catch (error: any) {
      console.error('Reject error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to reject professional.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const togglePublish = async (prof: Professional) => {
    setActionLoading(prof.id);
    try {
      const next = !prof.is_published;
      await setProfessionalPublished(prof.id, next);
      setProfessionals((prev) =>
        prev.map((p) => (p.id === prof.id ? { ...p, is_published: next } : p))
      );
      toast({
        title: 'Success',
        description: `Professional ${next ? 'published' : 'unpublished'}.`,
      });
    } catch (error: any) {
      console.error('Publish toggle error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update publish status.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = professionals.filter((p) => {
    const matchesSearch =
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.business_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (p.approval_status || 'pending') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: professionals.length,
    pending: professionals.filter((p) => (p.approval_status || 'pending') === 'pending').length,
    approved: professionals.filter((p) => p.approval_status === 'approved').length,
    rejected: professionals.filter((p) => p.approval_status === 'rejected').length,
  };

  const renderStatusBadge = (status?: string) => {
    const s = status || 'pending';
    if (s === 'approved') {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    }
    if (s === 'rejected') {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all', label: 'All', count: counts.all },
          { key: 'pending', label: 'Pending Review', count: counts.pending },
          { key: 'approved', label: 'Approved', count: counts.approved },
          { key: 'rejected', label: 'Rejected', count: counts.rejected },
        ] as { key: ApprovalStatus; label: string; count: number }[]).map((opt) => (
          <Button
            key={opt.key}
            variant={statusFilter === opt.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(opt.key)}
          >
            {opt.label}
            <Badge variant="secondary" className="ml-2">
              {opt.count}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search professionals by name, email, or business..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4">
        {filtered.map((prof) => {
          const isBusy = actionLoading === prof.id;
          const status = prof.approval_status || 'pending';
          return (
            <Card key={prof.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={prof.profile_image_url} alt={prof.full_name} />
                      <AvatarFallback>
                        {prof.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold truncate">{prof.full_name || 'Unnamed'}</h3>
                        {renderStatusBadge(status)}
                        {prof.is_published ? (
                          <Badge variant="outline" className="text-green-700 border-green-300">
                            <Globe className="h-3 w-3 mr-1" />
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">
                            <GlobeLock className="h-3 w-3 mr-1" />
                            Unpublished
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {prof.business_name && (
                          <p className="font-medium text-gray-800">{prof.business_name}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {prof.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {prof.email}
                            </span>
                          )}
                          {prof.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {prof.phone}
                            </span>
                          )}
                          {prof.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {prof.location}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {prof.services?.length || 0} services offered
                          {prof.approval_notes && status === 'rejected' && (
                            <> · Notes: <span className="italic">{prof.approval_notes}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:items-end lg:min-w-[260px]">
                    <div className="flex gap-2 flex-wrap">
                      {status !== 'approved' && (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(prof)}
                          disabled={isBusy}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                      )}
                      {status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(prof)}
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {status === 'approved' && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>Published</span>
                        <Switch
                          checked={prof.is_published}
                          onCheckedChange={() => togglePublish(prof)}
                          disabled={isBusy}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-500">
            {professionals.length === 0
              ? 'No professionals in Firebase yet. Approve an application to create one.'
              : 'No professionals match the selected filter.'}
          </p>
        </div>
      )}

      {/* Reject confirmation dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectNotes('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.full_name}?</DialogTitle>
            <DialogDescription>
              This professional will be marked as rejected and removed from the public
              directory. You can optionally include a note explaining the reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={actionLoading === rejectTarget?.id}
            >
              {actionLoading === rejectTarget?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
