import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import type { GigTier } from '@/data/taxGigs';
import { gigCategories } from '@/data/taxGigs';
import type { GigInput, GigRecord } from '@/services/gigsService';
import { emptyTiers, slugify } from '@/services/gigsService';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: GigInput) => Promise<void>;
  initial?: GigRecord | null;
  defaultPro: {
    proId: string;
    proEmail?: string;
    proName?: string;
    proTitle?: string;
    proAvatar?: string;
  };
}

const CATEGORIES = gigCategories.filter((c) => c.id !== 'all');

const GigFormModal: React.FC<Props> = ({ open, onClose, onSave, initial, defaultPro }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('individual');
  const [image, setImage] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tiers, setTiers] = useState<GigTier[]>(emptyTiers());
  const [responseTime, setResponseTime] = useState('Responds in 1 hr');
  const [availableNow, setAvailableNow] = useState(true);
  const [status, setStatus] = useState<'draft' | 'published' | 'paused'>('draft');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setCategory(initial.category || 'individual');
      setImage(initial.image || '');
      setShortDescription(initial.short_description || '');
      setTags(Array.isArray(initial.tags) ? initial.tags : []);
      setTiers(Array.isArray(initial.tiers) && initial.tiers.length === 3 ? initial.tiers : emptyTiers());
      setResponseTime(initial.response_time || 'Responds in 1 hr');
      setAvailableNow(!!initial.available_now);
      setStatus((initial.status as any) || 'draft');
    } else {
      setTitle('');
      setCategory('individual');
      setImage('');
      setShortDescription('');
      setTags([]);
      setTiers(emptyTiers());
      setResponseTime('Responds in 1 hr');
      setAvailableNow(true);
      setStatus('draft');
    }
  }, [open, initial]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setTagInput('');
      return;
    }
    setTags([...tags, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const updateTier = (idx: number, patch: Partial<GigTier>) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const addFeature = (idx: number) => {
    updateTier(idx, { features: [...tiers[idx].features, ''] });
  };

  const updateFeature = (tIdx: number, fIdx: number, value: string) => {
    const feats = [...tiers[tIdx].features];
    feats[fIdx] = value;
    updateTier(tIdx, { features: feats });
  };

  const removeFeature = (tIdx: number, fIdx: number) => {
    const feats = tiers[tIdx].features.filter((_, i) => i !== fIdx);
    updateTier(tIdx, { features: feats.length ? feats : [''] });
  };

  const handleImageFile = (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Please use an image under 4 MB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImage(String(e.target?.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (publishStatus?: 'draft' | 'published' | 'paused') => {
    const nextStatus = publishStatus || status;
    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    if (!shortDescription.trim()) {
      toast({ title: 'Short description is required', variant: 'destructive' });
      return;
    }
    const cleanedTiers: GigTier[] = tiers.map((t) => ({
      ...t,
      price: Number(t.price) || 0,
      deliveryDays: Number(t.deliveryDays) || 1,
      features: t.features.map((f) => f.trim()).filter(Boolean),
      description: t.description || '',
    }));
    if (cleanedTiers.some((t) => t.price <= 0)) {
      toast({ title: 'Each tier needs a price', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const input: GigInput = {
        proId: defaultPro.proId,
        proEmail: defaultPro.proEmail,
        proName: defaultPro.proName,
        proTitle: defaultPro.proTitle,
        proAvatar: defaultPro.proAvatar,
        proBadge: initial?.pro_badge || 'New & Noted',
        slug: initial?.slug || slugify(title),
        title: title.trim(),
        category,
        image: image || undefined,
        shortDescription: shortDescription.trim(),
        tags,
        tiers: cleanedTiers,
        responseTime,
        availableNow,
        status: nextStatus,
      };
      await onSave(input);
      onClose();
    } catch (e: any) {
      toast({ title: 'Could not save gig', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit gig' : 'Create a new gig'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <Label htmlFor="gig-title">Gig title</Label>
            <Input
              id="gig-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="I will file your simple W-2 tax return accurately"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">Start with "I will…" — exactly like Fiverr.</p>
          </div>

          {/* Category */}
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image */}
          <div>
            <Label>Cover image</Label>
            <div className="mt-1 flex items-start gap-3">
              {image ? (
                <div className="relative h-28 w-44 overflow-hidden rounded-lg border bg-gray-50">
                  <img src={image} alt="cover" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-gray-700 hover:bg-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-28 w-44 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-600 hover:bg-gray-100">
                  <Upload className="h-4 w-4" />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
                  />
                </label>
              )}
              <div className="flex-1">
                <Input
                  placeholder="…or paste an image URL"
                  value={image && image.startsWith('http') ? image : ''}
                  onChange={(e) => setImage(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">PNG/JPG up to 4 MB. 16:9 looks best.</p>
              </div>
            </div>
          </div>

          {/* Short description */}
          <div>
            <Label htmlFor="gig-desc">Short description</Label>
            <Textarea
              id="gig-desc"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="What clients will get and why you're the right pro for the job."
              rows={3}
              maxLength={280}
              className="mt-1"
            />
            <p className="mt-1 text-right text-xs text-gray-500">{shortDescription.length}/280</p>
          </div>

          {/* Tags */}
          <div>
            <Label>Search tags</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-1 text-gray-500 hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="W-2, 1040, Crypto…"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                Add
              </Button>
            </div>
          </div>

          {/* Response & availability */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Response time</Label>
              <Select value={responseTime} onValueChange={setResponseTime}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Responds in 30 min">Responds in 30 min</SelectItem>
                  <SelectItem value="Responds in 1 hr">Responds in 1 hr</SelectItem>
                  <SelectItem value="Responds in 2 hrs">Responds in 2 hrs</SelectItem>
                  <SelectItem value="Responds in a few hours">Responds in a few hours</SelectItem>
                  <SelectItem value="Responds within a day">Responds within a day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <div className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2">
                <Switch checked={availableNow} onCheckedChange={setAvailableNow} id="avail" />
                <Label htmlFor="avail" className="cursor-pointer">
                  Available now
                </Label>
              </div>
            </div>
          </div>

          {/* Tiers */}
          <div>
            <Label className="mb-2 block">Packages</Label>
            <Tabs defaultValue="0">
              <TabsList className="grid w-full grid-cols-3">
                {tiers.map((t, i) => (
                  <TabsTrigger key={i} value={String(i)}>
                    {t.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tiers.map((tier, idx) => (
                <TabsContent key={idx} value={String(idx)} className="mt-3 space-y-3 rounded-lg border bg-gray-50 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <Label className="text-xs">Price (USD)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={tier.price}
                        onChange={(e) => updateTier(idx, { price: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Delivery (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={tier.deliveryDays}
                        onChange={(e) => updateTier(idx, { deliveryDays: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Revisions</Label>
                      <Select
                        value={String(tier.revisions)}
                        onValueChange={(v) =>
                          updateTier(idx, { revisions: v === 'Unlimited' ? 'Unlimited' : Number(v) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['1', '2', '3', '5', 'Unlimited'].map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Package summary</Label>
                    <Input
                      value={tier.description}
                      onChange={(e) => updateTier(idx, { description: e.target.value })}
                      placeholder="One-line description of what's included"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Features</Label>
                    <div className="space-y-2">
                      {tier.features.map((f, fIdx) => (
                        <div key={fIdx} className="flex gap-2">
                          <Input
                            value={f}
                            onChange={(e) => updateFeature(idx, fIdx, e.target.value)}
                            placeholder="e.g. Federal e-file included"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeFeature(idx, fIdx)}
                          >
                            <Trash2 className="h-4 w-4 text-gray-500" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => addFeature(idx)}>
                        <Plus className="mr-1 h-3 w-3" /> Add feature
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => handleSubmit('draft')} disabled={saving}>
            Save as draft
          </Button>
          <Button onClick={() => handleSubmit('published')} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Saving…' : initial ? 'Save & publish' : 'Publish gig'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GigFormModal;
