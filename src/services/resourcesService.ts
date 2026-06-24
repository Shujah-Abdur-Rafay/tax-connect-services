// ============================================================================
// resourcesService — Phase 3 Resource Center / Document Library
//
// A `resources` Firestore collection backs a tier-gated, pro-facing library of
// training material, tax-prep guides, compliance docs, marketing assets, video
// training, forms/checklists and operations manuals. Admins upload entries
// (file → Firebase Storage under the `resources/{id}/` prefix, or an external
// link / embedded video URL) and gate each one to a minimum membership tier.
//
// Tier-gating is enforced in the UI (a pro only ever sees download/open links
// for resources their tier unlocks — see meetsTier). The Firestore + Storage
// read rules keep the metadata/assets to signed-in users; the real entitlement
// gate is the tier check, mirroring how the rest of the app gates premium
// features (UpgradePrompt). Writes are admin-only at the rules layer.
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
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadFile, deleteFile } from '@/services/firebaseStorageService';
import { MembershipLevel } from '@/constants/membershipLevels';

export const RESOURCES_COLLECTION = 'resources';
const STORAGE_PREFIX = 'resources';

/** Library section a resource belongs to. */
export type ResourceCategory =
  | 'training'
  | 'guides'
  | 'compliance'
  | 'marketing'
  | 'video'
  | 'forms'
  | 'manuals';

/** Where the asset lives: an uploaded file, an external link, or a video URL. */
export type ResourceType = 'file' | 'link' | 'video';

export interface ProResource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  type: ResourceType;
  /** Download URL (file) or external/embed URL (link / video). */
  url: string;
  /** Storage path — set only when type==='file' so we can delete the object. */
  storage_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  content_type?: string | null;
  /**
   * Minimum membership level required to access this resource. A pro can open
   * it when getTierRank(theirLevel) >= getTierRank(min_tier). Defaults to the
   * free Directory Listing tier (visible to everyone).
   */
  min_tier: string;
  is_published: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateResourceInput {
  title: string;
  description?: string;
  category: ResourceCategory;
  type: ResourceType;
  /** Required for type 'link' / 'video'. Ignored for 'file' (the upload sets it). */
  url?: string;
  /** Required for type 'file'. */
  file?: File | null;
  min_tier?: string;
  is_published?: boolean;
  created_by?: string | null;
}

export const RESOURCE_CATEGORIES: { value: ResourceCategory; label: string; description: string }[] = [
  { value: 'training', label: 'Training', description: 'Onboarding & skill-building courses' },
  { value: 'guides', label: 'Tax-Prep Guides', description: 'Step-by-step preparation playbooks' },
  { value: 'compliance', label: 'Compliance', description: 'Regulatory & due-diligence references' },
  { value: 'marketing', label: 'Marketing', description: 'Promote your practice & win clients' },
  { value: 'video', label: 'Video Training', description: 'Recorded walkthroughs & webinars' },
  { value: 'forms', label: 'Forms & Checklists', description: 'Reusable client-intake templates' },
  { value: 'manuals', label: 'Manuals', description: 'Operations & software reference manuals' },
];

export const resourceCategoryLabel = (cat: string): string =>
  RESOURCE_CATEGORIES.find((c) => c.value === cat)?.label || cat;

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

const normalize = (id: string, raw: any): ProResource => ({
  id,
  title: raw.title || 'Untitled resource',
  description: raw.description || '',
  category: (raw.category as ResourceCategory) || 'guides',
  type: (raw.type as ResourceType) || (raw.storage_path ? 'file' : 'link'),
  url: raw.url || '',
  storage_path: raw.storage_path ?? null,
  file_name: raw.file_name ?? null,
  file_size: typeof raw.file_size === 'number' ? raw.file_size : null,
  content_type: raw.content_type ?? null,
  min_tier: raw.min_tier || MembershipLevel.DIRECTORY_LISTING,
  is_published: raw.is_published !== false,
  created_by: raw.created_by ?? null,
  created_at: tsToIso(raw.created_at),
  updated_at: tsToIso(raw.updated_at),
});

const sortByNewest = (rows: ProResource[]): ProResource[] =>
  [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

/** Ordered query with an unordered fallback (so a missing index never 500s). */
async function fetchAll(): Promise<ProResource[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, RESOURCES_COLLECTION), orderBy('created_at', 'desc')),
    );
    return snap.docs.map((d) => normalize(d.id, d.data()));
  } catch (e) {
    console.warn('[resourcesService] ordered query failed, retrying unordered:', e);
    const snap = await getDocs(collection(db, RESOURCES_COLLECTION));
    return sortByNewest(snap.docs.map((d) => normalize(d.id, d.data())));
  }
}

/** Admin view: every resource regardless of published state. */
export const listAllResources = async (): Promise<ProResource[]> => {
  try {
    return await fetchAll();
  } catch (e) {
    console.warn('[resourcesService] listAllResources failed:', (e as Error).message);
    return [];
  }
};

/** Pro view: only published resources (the UI then tier-gates each card). */
export const listPublishedResources = async (): Promise<ProResource[]> => {
  try {
    return (await fetchAll()).filter((r) => r.is_published);
  } catch (e) {
    console.warn('[resourcesService] listPublishedResources failed:', (e as Error).message);
    return [];
  }
};

const sanitizeFilename = (name: string): string =>
  name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'file';

/**
 * Create a resource. For type 'file', uploads to
 * `resources/{resourceId}/{filename}` first and stores the download URL +
 * storage path. For 'link'/'video', persists the supplied `url`.
 */
export const createResource = async (input: CreateResourceInput): Promise<ProResource> => {
  if (!db) throw new Error('Firestore is not initialized');
  if (!input.title?.trim()) throw new Error('A title is required.');

  // Pre-allocate the doc id so the Storage path is stable + collision-free.
  const ref = doc(collection(db, RESOURCES_COLLECTION));

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
    if (!url) throw new Error('Enter a URL for this resource.');
  }

  const payload = {
    title: input.title.trim(),
    description: (input.description || '').trim(),
    category: input.category,
    type: input.type,
    url,
    storage_path,
    file_name,
    file_size,
    content_type,
    min_tier: input.min_tier || MembershipLevel.DIRECTORY_LISTING,
    is_published: input.is_published !== false,
    created_by: input.created_by ?? null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(ref, payload);
  const snap = await getDoc(ref);
  return normalize(ref.id, snap.data() || payload);
};

/** Patch metadata (title / description / category / tier / published). */
export const updateResource = async (
  id: string,
  patch: Partial<Pick<ProResource, 'title' | 'description' | 'category' | 'min_tier' | 'is_published' | 'url'>>,
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  await updateDoc(doc(db, RESOURCES_COLLECTION, id), {
    ...patch,
    updated_at: serverTimestamp(),
  });
};

/** Toggle the published flag. */
export const setResourcePublished = async (id: string, isPublished: boolean): Promise<void> =>
  updateResource(id, { is_published: isPublished });

/**
 * Delete a resource. Removes the backing Storage object first (best-effort —
 * a failed Storage delete must not orphan the Firestore record), then the doc.
 */
export const deleteResource = async (resource: ProResource): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  if (resource.storage_path) {
    try {
      await deleteFile(resource.storage_path);
    } catch (e) {
      console.warn('[resourcesService] storage delete failed (continuing):', (e as Error).message);
    }
  }
  await deleteDoc(doc(db, RESOURCES_COLLECTION, resource.id));
};
