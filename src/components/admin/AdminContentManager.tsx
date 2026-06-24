// ============================================================================
// AdminContentManager — Admin Content Management module UI
//
// Self-contained upload form + library list for the `member_content`
// collection. Admins publish a file / external link / video and assign it to one
// or more audience categories (Users, Professionals, Associates, Premium
// Partners). Embedded both in the Admin Dashboard "Content" tab and the
// standalone /admin/content page, so it assumes the caller already gated on
// isAdmin.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Upload,
  Link as LinkIcon,
  PlayCircle,
  FileText,
  Trash2,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  Users as UsersIcon,
} from 'lucide-react';
import {
  listAllContent,
  createContent,
  deleteContent,
  setContentPublished,
  type MemberContent,
  type ContentType,
} from '@/services/contentLibraryService';
import {
  CONTENT_CATEGORIES,
  contentCategoryLabel,
  type ContentCategory,
} from '@/constants/contentCategories';

const TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'file', label: 'File upload' },
  { value: 'link', label: 'External link' },
  { value: 'video', label: 'Video URL' },
];

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary';

const AdminContentManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<MemberContent[]>([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [type, setType] = useState<ContentType>('file');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [published, setPublished] = useState(true);

  const load = async () => {
    setFetching(true);
    try {
      setItems(await listAllContent());
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategories([]);
    setType('file');
    setUrl('');
    setFile(null);
    setPublished(true);
  };

  const toggleCategory = (value: ContentCategory) => {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  };

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (categories.length === 0) return false;
    if (type === 'file') return !!file;
    return !!url.trim();
  }, [title, categories, type, file, url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const created = await createContent({
        title,
        description,
        categories,
        type,
        url: type === 'file' ? undefined : url,
        file: type === 'file' ? file : null,
        is_published: published,
        created_by: user?.uid ?? null,
      });
      setItems((prev) => [created, ...prev]);
      toast({ title: 'Content published', description: `"${created.title}" is now available.` });
      resetForm();
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err?.message || 'Could not publish the content. Check Storage/rules.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: MemberContent) => {
    if (!confirm(`Delete "${item.title}"? This removes the file and cannot be undone.`)) return;
    try {
      await deleteContent(item);
      setItems((prev) => prev.filter((c) => c.id !== item.id));
      toast({ title: 'Deleted', description: `"${item.title}" removed.` });
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleTogglePublished = async (item: MemberContent) => {
    try {
      await setContentPublished(item.id, !item.is_published);
      setItems((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, is_published: !c.is_published } : c)),
      );
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Upload form */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-blue-600" />
            Add content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="content-title">Title *</Label>
              <Input
                id="content-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2025 Member Onboarding Guide"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="content-desc">Description</Label>
              <Textarea
                id="content-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What this content covers…"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="flex items-center gap-1.5">
                <UsersIcon className="h-4 w-4" />
                Assign to categories *
              </Label>
              <p className="mb-1.5 mt-0.5 text-xs text-slate-500">
                Only members in the selected categories can see this.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_CATEGORIES.map((cat) => {
                  const checked = categories.includes(cat.value);
                  return (
                    <label
                      key={cat.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={checked}
                        onChange={() => toggleCategory(cat.value)}
                      />
                      {cat.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="content-type">Type</Label>
              <select
                id="content-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ContentType);
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

            {type === 'file' ? (
              <div>
                <Label htmlFor="content-file">File *</Label>
                <Input
                  id="content-file"
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
                <Label htmlFor="content-url">{type === 'video' ? 'Video URL *' : 'Link URL *'}</Label>
                <Input
                  id="content-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1.5"
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
              <div>
                <Label htmlFor="content-pub" className="cursor-pointer">
                  Published
                </Label>
                <p className="text-xs text-slate-500">Visible to members immediately</p>
              </div>
              <Switch id="content-pub" checked={published} onCheckedChange={setPublished} />
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
                  Publish content
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing content */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Library <span className="text-sm font-normal text-slate-400">({items.length})</span>
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
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No content yet. Add your first item with the form on the left.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((c) => {
                const TypeIcon =
                  c.type === 'video' ? PlayCircle : c.type === 'link' ? LinkIcon : FileText;
                return (
                  <div key={c.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-slate-900">{c.title}</span>
                          {!c.is_published && (
                            <Badge variant="outline" className="border-slate-300 text-slate-500">
                              Draft
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          {c.categories.length === 0 ? (
                            <Badge variant="outline" className="border-amber-300 text-amber-600">
                              No category
                            </Badge>
                          ) : (
                            c.categories.map((cat) => (
                              <Badge key={cat} variant="secondary" className="font-normal">
                                {contentCategoryLabel(cat)}
                              </Badge>
                            ))
                          )}
                          {c.url && (
                            <a
                              href={c.url}
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
                        onClick={() => handleTogglePublished(c)}
                        title={c.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {c.is_published ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-slate-400" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c)}>
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
  );
};

export default AdminContentManager;
