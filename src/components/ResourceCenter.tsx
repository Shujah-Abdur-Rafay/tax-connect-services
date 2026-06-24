import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen,
  Download,
  ExternalLink,
  PlayCircle,
  Lock,
  FileText,
  ShieldCheck,
  Megaphone,
  GraduationCap,
  ClipboardList,
  BookMarked,
  Library,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  listPublishedResources,
  RESOURCE_CATEGORIES,
  type ProResource,
  type ResourceCategory,
} from '@/services/resourcesService';
import { getTierRank, meetsTier } from '@/constants/membershipLevels';

const CATEGORY_ICON: Record<ResourceCategory, React.ComponentType<{ className?: string }>> = {
  training: GraduationCap,
  guides: BookOpen,
  compliance: ShieldCheck,
  marketing: Megaphone,
  video: PlayCircle,
  forms: ClipboardList,
  manuals: BookMarked,
};

const TYPE_LABEL: Record<string, string> = { file: 'Download', link: 'Open', video: 'Watch' };

const formatSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

/**
 * Tier label for the locked-card "Upgrade to …" prompt. Keeps the messaging
 * human even though min_tier stores the raw membership-level string.
 */
const tierLabel = (minTier: string): string => minTier;

/**
 * Phase 3 — Resource Center / Document Library (pro-facing).
 *
 * Lists published resources grouped by category. Each resource is gated to a
 * minimum membership tier: a pro sees the open/download action only when their
 * tier unlocks it, otherwise a locked card with an upgrade CTA. Admins (and the
 * top "Premier Partner" tier) see everything.
 */
const ResourceCenter: React.FC = () => {
  const { user } = useAuth();
  const userLevel = user?.membershipLevel ? String(user.membershipLevel) : undefined;

  const [resources, setResources] = useState<ProResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ResourceCategory | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listPublishedResources();
        if (!cancelled) setResources(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (activeCategory === 'all' ? resources : resources.filter((r) => r.category === activeCategory)),
    [resources, activeCategory],
  );

  // Only show category chips that actually have content.
  const populatedCategories = useMemo(() => {
    const present = new Set(resources.map((r) => r.category));
    return RESOURCE_CATEGORIES.filter((c) => present.has(c.value));
  }, [resources]);

  const unlockedCount = useMemo(
    () => resources.filter((r) => meetsTier(userLevel, r.min_tier)).length,
    [resources, userLevel],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Library className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No resources yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Training material, guides, compliance docs, and marketing assets will appear here as
            soon as the team publishes them.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">Resource Center</h2>
        </div>
        <p className="text-sm text-slate-600">
          {unlockedCount} of {resources.length} resources unlocked on your{' '}
          <span className="font-medium">{userLevel || 'Directory Listing'}</span> plan.
        </p>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label="All"
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
          count={resources.length}
        />
        {populatedCategories.map((c) => (
          <CategoryChip
            key={c.value}
            label={c.label}
            active={activeCategory === c.value}
            onClick={() => setActiveCategory(c.value)}
            count={resources.filter((r) => r.category === c.value).length}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => (
          <ResourceTile key={r.id} resource={r} unlocked={meetsTier(userLevel, r.min_tier)} />
        ))}
      </div>
    </div>
  );
};

const CategoryChip: React.FC<{
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}> = ({ label, active, count, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ' +
      (active
        ? 'border-blue-600 bg-blue-600 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')
    }
  >
    {label}
    <span className={'text-xs ' + (active ? 'text-blue-100' : 'text-slate-400')}>{count}</span>
  </button>
);

const ResourceTile: React.FC<{ resource: ProResource; unlocked: boolean }> = ({
  resource,
  unlocked,
}) => {
  const Icon = CATEGORY_ICON[resource.category] || FileText;
  const catLabel = RESOURCE_CATEGORIES.find((c) => c.value === resource.category)?.label || resource.category;
  const gated = getTierRank(resource.min_tier) > 0;

  return (
    <Card className={'flex flex-col ' + (unlocked ? '' : 'opacity-90')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {catLabel}
          </Badge>
        </div>
        <CardTitle className="mt-3 text-base leading-snug">{resource.title}</CardTitle>
        {resource.description && (
          <CardDescription className="line-clamp-3">{resource.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
          {resource.type === 'video' ? (
            <PlayCircle className="h-3.5 w-3.5" />
          ) : resource.type === 'link' ? (
            <ExternalLink className="h-3.5 w-3.5" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          <span className="capitalize">{resource.type}</span>
          {resource.file_size ? <span>· {formatSize(resource.file_size)}</span> : null}
          {gated && (
            <span className="ml-auto inline-flex items-center gap-1 text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              {tierLabel(resource.min_tier)}
            </span>
          )}
        </div>

        {unlocked ? (
          <Button asChild className="w-full" size="sm">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              {...(resource.type === 'file' ? { download: resource.file_name || true } : {})}
            >
              {resource.type === 'file' ? (
                <Download className="mr-2 h-4 w-4" />
              ) : resource.type === 'video' ? (
                <PlayCircle className="mr-2 h-4 w-4" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {TYPE_LABEL[resource.type] || 'Open'}
            </a>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
            <Link to="/upgrade-membership">
              <Lock className="mr-2 h-4 w-4" />
              Upgrade to unlock
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ResourceCenter;
