// ============================================================================
// contentLibraryService — Admin Content Management module
//
// A `member_content` Firestore collection backs the admin-managed, category-
// gated content library. Admins upload entries (file → Firebase Storage under
// the `member-content/{id}/` prefix, or an external link / embedded video URL)
// and assign each to one or more audience categories (Users, Professionals,
// Associates, Premium Partners — see contentCategories.ts).
//
// Members only see content for the categories they belong to. The UI filters by
// category and the Firestore read rules enforce the same gate at the DB layer.
// Writes are admin-only at the rules layer.
//
// This mirrors resourcesService.ts (the tier-gated pro Resource Center) but uses
// an explicit, non-hierarchical category array rather than a single min-tier.
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadFile, deleteFile } from '@/services/firebaseStorageService';
import type { ContentCategory } from '@/constants/contentCategories';

export const MEMBER_CONTENT_COLLECTION = 'member_content';
const STORAGE_PREFIX = 'member-content';

/** Where the asset lives: an uploaded file, an external link, or a video URL. */
export type ContentType = 'file' | 'link' | 'video';

export interface MemberContent {
  id: string;
  title: string;
  description: string;
  /** Audience categories this content is assigned to (one or more). */
  categories: ContentCategory[];
  type: ContentType;
  /** Download URL (file) or external/embed URL (link / video). */
  url: string;
  /** Storage path — set only when type==='file' so we can delete the object. */
  storage_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  content_type?: string | null;
  is_published: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateContentInput {
  title: string;
  description?: string;
  categories: ContentCategory[];
  type: ContentType;
  /** Required for type 'link' / 'video'. Ignored for 'file' (the upload sets it). */
  url?: string;
  /** Required for type 'file'. */
  file?: File | null;
  is_published?: boolean;
  created_by?: string | null;
}

const tsToIso = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as any)?.toDate === 'function') {
    try {
      return (v as any).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof v === 'string') return v;
  return undefined;
};

const normalize = (id: string, raw: any): MemberContent => ({
  id,
  title: raw.title || 'Untitled content',
  description: raw.description || '',
  categories: Array.isArray(raw.categories) ? (raw.categories as ContentCategory[]) : [],
  type: (raw.type as ContentType) || (raw.storage_path ? 'file' : 'link'),
  url: raw.url || '',
  storage_path: raw.storage_path ?? null,
  file_name: raw.file_name ?? null,
  file_size: typeof raw.file_size === 'number' ? raw.file_size : null,
  content_type: raw.content_type ?? null,
  is_published: raw.is_published !== false,
  created_by: raw.created_by ?? null,
  created_at: tsToIso(raw.created_at),
  updated_at: tsToIso(raw.updated_at),
});

const sortByNewest = (rows: MemberContent[]): MemberContent[] =>
  [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

/** Ordered query with an unordered fallback (so a missing index never 500s). */
async function fetchAll(): Promise<MemberContent[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, MEMBER_CONTENT_COLLECTION), orderBy('created_at', 'desc')),
    );
    return snap.docs.map((d) => normalize(d.id, d.data()));
  } catch (e) {
    console.warn('[contentLibraryService] ordered query failed, retrying unordered:', e);
    const snap = await getDocs(collection(db, MEMBER_CONTENT_COLLECTION));
    return sortByNewest(snap.docs.map((d) => normalize(d.id, d.data())));
  }
}

/** Admin view: every content item regardless of published state. */
export const listAllContent = async (): Promise<MemberContent[]> => {
  try {
    return await fetchAll();
  } catch (e) {
    console.warn('[contentLibraryService] listAllContent failed:', (e as Error).message);
    return [];
  }
};

/**
 * Member view: published content assigned to any of the given categories.
 * Tries an indexed query first; on failure (e.g. missing composite index) falls
 * back to fetching everything and filtering client-side so the section never
 * hard-fails. Returns [] when `categories` is empty (no audience to match).
 */
export const listContentForCategories = async (
  categories: string[],
): Promise<MemberContent[]> => {
  if (!db || categories.length === 0) return [];
  // array-contains-any accepts at most 10 values; our taxonomy has 4.
  const cats = categories.slice(0, 10);
  try {
    const snap = await getDocs(
      query(
        collection(db, MEMBER_CONTENT_COLLECTION),
        where('is_published', '==', true),
        where('categories', 'array-contains-any', cats),
        orderBy('created_at', 'desc'),
      ),
    );
    return snap.docs.map((d) => normalize(d.id, d.data()));
  } catch (e) {
    console.warn('[contentLibraryService] category query failed, filtering client-side:', e);
    const all = await fetchAll();
    return all.filter(
      (c) => c.is_published && c.categories.some((cat) => cats.includes(cat)),
    );
  }
};

const sanitizeFilename = (name: string): string =>
  name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'file';

/**
 * Create a content item. For type 'file', uploads to
 * `member-content/{id}/{filename}` first and stores the download URL + storage
 * path. For 'link'/'video', persists the supplied `url`.
 */
export const createContent = async (input: CreateContentInput): Promise<MemberContent> => {
  if (!db) throw new Error('Firestore is not initialized');
  if (!input.title?.trim()) throw new Error('A title is required.');
  if (!input.categories || input.categories.length === 0) {
    throw new Error('Select at least one audience category.');
  }

  // Pre-allocate the doc id so the Storage path is stable + collision-free.
  const ref = doc(collection(db, MEMBER_CONTENT_COLLECTION));

  let url = (input.url || '').trim();
  let storage_path: string | null = null;
  let file_name: string | null = null;
  let file_size: number | null = null;
  let content_type: string | null = null;

  if (input.type === 'file') {
    if (!input.file) throw new Error('Select a file to upload.');
    const path = `${STORAGE_PREFIX}/${ref.id}/${Date.now()}_${sanitizeFilename(input.file.name)}`;
    const uploaded = await uploadFile(input.file, path);
    url = uploaded.url;
    storage_path = uploaded.path;
    file_name = input.file.name;
    file_size = input.file.size;
    content_type = input.file.type || 'application/octet-stream';
  } else {
    if (!url) throw new Error('Enter a URL for this content.');
  }

  const payload = {
    title: input.title.trim(),
    description: (input.description || '').trim(),
    categories: input.categories,
    type: input.type,
    url,
    storage_path,
    file_name,
    file_size,
    content_type,
    is_published: input.is_published !== false,
    created_by: input.created_by ?? null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(ref, payload);
  const snap = await getDoc(ref);
  return normalize(ref.id, snap.data() || payload);
};

/** Patch metadata (title / description / categories / published / url). */
export const updateContent = async (
  id: string,
  patch: Partial<
    Pick<MemberContent, 'title' | 'description' | 'categories' | 'is_published' | 'url'>
  >,
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  await updateDoc(doc(db, MEMBER_CONTENT_COLLECTION, id), {
    ...patch,
    updated_at: serverTimestamp(),
  });
};

/** Toggle the published flag. */
export const setContentPublished = async (id: string, isPublished: boolean): Promise<void> =>
  updateContent(id, { is_published: isPublished });

/**
 * Delete a content item. Removes the backing Storage object first (best-effort —
 * a failed Storage delete must not orphan the Firestore record), then the doc.
 */
export const deleteContent = async (content: MemberContent): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  if (content.storage_path) {
    try {
      await deleteFile(content.storage_path);
    } catch (e) {
      console.warn('[contentLibraryService] storage delete failed (continuing):', (e as Error).message);
    }
  }
  await deleteDoc(doc(db, MEMBER_CONTENT_COLLECTION, content.id));
};
