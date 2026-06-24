// ============================================================================
// AdminResources — /admin/resources
//
// Admin-only upload UI for the Phase 3 Resource Center. Admins publish entries
// to the Firestore `resources` collection: either an uploaded file (stored in
// Firebase Storage under `resources/{id}/`) or an external link / video URL.
// Each entry is gated to a minimum membership tier, which the pro-facing
// ResourceCenter then enforces.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShieldAlert,
  Library,
  Upload,
  Link as LinkIcon,
  PlayCircle,
  FileText,
  Trash2,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  listAllResources,
  createResource,
  deleteResource,
  setResourcePublished,
  RESOURCE_CATEGORIES,
  resourceCategoryLabel,
  type ProResource,
  type ResourceCategory,
  type ResourceType,
} from '@/services/resourcesService';
import { RESOURCE_TIER_OPTIONS, MembershipLevel } from '@/constants/membershipLevels';

const TYPE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: 'file', label: 'File upload' },
  { value: 'link', label: 'External link' },
  { value: 'video', label: 'Video URL' },
];

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary';

export default function AdminResources() {
  const { user, isAdmin, loading } = useAuth();
  const { toast } = useToast();

  const [resources, setResources] = useState<ProResource[]>([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ResourceCategory>('guides');
  const [type, setType] = useState<ResourceType>('file');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [minTier, setMinTier] = useState<string>(MembershipLevel.DIRECTORY_LISTING);
  const [published, setPublished] = useState(true);

  const load = async () => {
    setFetching(true);
    try {
      setResources(await listAllResources());
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('guides');
    setType('file');
    setUrl('');
    setFile(null);
    setMinTier(MembershipLevel.DIRECTORY_LISTING);
    setPublished(true);
  };

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (type === 'file') return !!file;
    return !!url.trim();
  }, [title, type, file, url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const created = await createResource({
        title,
        description,
        category,
        type,
        url: type === 'file' ? undefined : url,
        file: type === 'file' ? file : null,
        min_tier: minTier,
        is_published: published,
        created_by: user?.uid ?? null,
      });
      setResources((prev) => [created, ...prev]);
      toast({ title: 'Resource published', description: `"${created.title}" is now in the library.` });
      resetForm();
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err?.message || 'Could not publish the resource. Check Storage/rules.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (resource: ProResource) => {
    if (!confirm(`Delete "${resource.title}"? This removes the file and cannot be undone.`)) return;
    try {
      await deleteResource(resource);
      setResources((prev) => prev.filter((r) => r.id !== resource.id));
      toast({ title: 'Deleted', description: `"${resource.title}" removed.` });
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleTogglePublished = async (resource: ProResource) => {
    try {
      await setResourcePublished(resource.id, !resource.is_published);
      setResources((prev) =>
        prev.map((r) => (r.id === resource.id ? { ...r, is_published: !r.is_published } : r)),
      );
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  // ── Auth gates ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24 text-slate-600">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      </Shell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <Shell>
        <Card className="mx-auto mt-12 max-w-2xl border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              Admin only
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-slate-600">
              The Resource Center upload tool is restricted to platform administrators.
            </p>
            <Button asChild variant="outline">
              <Link to="/admin">Back to admin</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/admin" className="hover:text-slate-700">
            Admin
          </Link>
          <span>/</span>
          <span className="text-slate-700">Resource Center</span>
        </div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
          <Library className="h-8 w-8 text-blue-600" />
          Resource Center
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Publish training material, guides, compliance docs, marketing assets, video training,
          forms/checklists, and manuals to the tier-gated professional library.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Upload form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-blue-600" />
              Add a resource
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="res-title">Title *</Label>
                <Input
                  id="res-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 2025 Tax-Season Prep Checklist"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="res-desc">Description</Label>
                <Textarea
                  id="res-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What this resource covers…"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="res-cat">Category</Label>
                  <select
                    id="res-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                    className={`${selectClass} mt-1.5`}
                  >
                    {RESOURCE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="res-type">Type</Label>
                  <select
                    id="res-type"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as ResourceType);
                      setFile(null);
                      setUrl('');
                    }}
                    className={`${selectClass} mt-1.5`}
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {type === 'file' ? (
                <div>
                  <Label htmlFor="res-file">File *</Label>
                  <Input
                    id="res-file"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="mt-1.5"
                  />
                  {file && (
                    <p className="mt-1 text-xs text-slate-500">
                      {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <Label htmlFor="res-url">{type === 'video' ? 'Video URL *' : 'Link URL *'}</Label>
                  <Input
                    id="res-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="res-tier">Access tier</Label>
                <select
                  id="res-tier"
                  value={minTier}
                  onChange={(e) => setMinTier(e.target.value)}
                  className={`${selectClass} mt-1.5`}
                >
                  {RESOURCE_TIER_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <div>
                  <Label htmlFor="res-pub" className="cursor-pointer">
                    Published
                  </Label>
                  <p className="text-xs text-slate-500">Visible to pros immediately</p>
                </div>
                <Switch id="res-pub" checked={published} onCheckedChange={setPublished} />
              </div>

              <Button type="submit" disabled={!canSubmit || submitting} className="w-full">
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Publish resource
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing resources */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Library{' '}
                <span className="text-sm font-normal text-slate-400">({resources.length})</span>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={load} disabled={fetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fetching ? (
              <div className="py-12 text-center text-slate-500">Loading…</div>
            ) : resources.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No resources yet. Add your first one with the form on the left.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {resources.map((r) => {
                  const TypeIcon =
                    r.type === 'video' ? PlayCircle : r.type === 'link' ? LinkIcon : FileText;
                  const tierLabel =
                    RESOURCE_TIER_OPTIONS.find((t) => t.value === r.min_tier)?.label || r.min_tier;
                  return (
                    <div key={r.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-slate-900">{r.title}</span>
                            {!r.is_published && (
                              <Badge variant="outline" className="border-slate-300 text-slate-500">
                                Draft
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <Badge variant="secondary" className="font-normal">
                              {resourceCategoryLabel(r.category)}
                            </Badge>
                            <span>· {tierLabel}</span>
                            {r.url && (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                preview
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublished(r)}
                          title={r.is_published ? 'Unpublish' : 'Publish'}
                        >
                          {r.is_published ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-slate-400" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AdminLayout>{children}</AdminLayout>
);
