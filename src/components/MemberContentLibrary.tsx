// ============================================================================
// MemberContentLibrary — member-facing view of the Content Management module
//
// Shows the signed-in member the content an admin assigned to the categories
// they belong to (see getUserContentCategories). Renders one dedicated section
// per category so each audience has its own clearly-labelled area, satisfying
// the "separate section for each category" requirement.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Link as LinkIcon,
  PlayCircle,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  Lock,
} from 'lucide-react';
import {
  listContentForCategories,
  type MemberContent,
} from '@/services/contentLibraryService';
import {
  getUserContentCategories,
  contentCategoryLabel,
} from '@/constants/contentCategories';

const typeIconFor = (type: MemberContent['type']) =>
  type === 'video' ? PlayCircle : type === 'link' ? LinkIcon : FileText;

const MemberContentLibrary: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<MemberContent[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = useMemo(() => getUserContentCategories(user), [user]);
  // Stable dependency key so the effect re-runs only when the category set changes.
  const categoriesKey = categories.join(',');

  useEffect(() => {
    let active = true;
    setLoading(true);
    listContentForCategories(categories)
      .then((data) => {
        if (active) setItems(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesKey]);

  // One section per category the member belongs to that actually has content.
  const sections = useMemo(
    () =>
      categories
        .map((cat) => ({ cat, items: items.filter((i) => i.categories.includes(cat)) }))
        .filter((s) => s.items.length > 0),
    [categories, items],
  );

  if (!user) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Lock className="mb-3 h-10 w-10 text-gray-400" />
          <p className="text-gray-600">Please log in to view your resources.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading resources…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="mb-3 h-10 w-10 text-gray-400" />
          <h3 className="mb-1 text-lg font-medium text-gray-900">No resources yet</h3>
          <p className="max-w-sm text-sm text-gray-600">
            Content shared with your account by the team will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map(({ cat, items: sectionItems }) => (
        <section key={cat}>
          <div className="mb-3 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">{contentCategoryLabel(cat)}</h2>
            <Badge variant="secondary" className="ml-1">
              {sectionItems.length}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectionItems.map((item) => {
              const TypeIcon = typeIconFor(item.type);
              const isFile = item.type === 'file';
              return (
                <Card key={`${cat}-${item.id}`} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1 font-medium text-gray-900">{item.title}</h3>
                    {item.description && (
                      <p className="mb-4 line-clamp-3 flex-1 text-sm text-gray-600">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-auto pt-2">
                      <Button asChild variant="outline" size="sm" className="w-full" disabled={!item.url}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {isFile ? (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {item.type === 'video' ? 'Watch' : 'Open'}
                            </>
                          )}
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default MemberContentLibrary;
