import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

export interface UploadResult {
  url: string;
  path: string;
  name: string;
}

// Check if Firebase Storage is properly configured
const isStorageAvailable = (): boolean => {
  return storage && typeof storage.app !== 'undefined';
};

/**
 * Upload a file to Firebase Storage
 * @param file - File to upload
 * @param path - Storage path (e.g., 'documents/user123/file.pdf')
 * @returns Upload result with download URL
 */
export const uploadFile = async (file: File, path: string): Promise<UploadResult> => {
  if (!isStorageAvailable()) {
    throw new Error('Firebase Storage not configured. Please enable Storage in Firebase Console.');
  }
  
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    
    return {
      url,
      path: snapshot.ref.fullPath,
      name: file.name
    };
  } catch (error: any) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file. Firebase Storage may not be enabled.');
  }
};



/**
 * Get download URL for a file
 */
export const getFileURL = async (path: string): Promise<string> => {
  if (!isStorageAvailable()) {
    throw new Error('Firebase Storage not configured. Please enable Storage in Firebase Console.');
  }
  
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error: any) {
    console.error('Error getting file URL:', error);
    throw new Error('Failed to get file URL. Firebase Storage may not be enabled.');
  }
};



/**
 * Delete a file from Firebase Storage
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
};

/**
 * List all files in a directory
 */
export const listFiles = async (path: string): Promise<string[]> => {
  try {
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    return result.items.map(item => item.fullPath);
  } catch (error) {
    console.error('Error listing files:', error);
    throw new Error('Failed to list files');
  }
};

/**
 * Upload profile image for a user
 * @param userId - User ID
 * @param file - Image file to upload
 * @returns Upload result with download URL
 */
export const uploadProfileImage = async (userId: string, file: File): Promise<UploadResult> => {
  const path = `profiles/${userId}/avatar.jpg`;
  return uploadFile(file, path);
};

/**
 * Get profile image URL for a user
 * @param userId - User ID
 * @returns Download URL or null if not found
 */
export const getProfileImageURL = async (userId: string): Promise<string | null> => {
  try {
    // Skip if storage not available
    if (!isStorageAvailable()) {
      return null;
    }
    const path = `profiles/${userId}/avatar.jpg`;
    const storageRef = ref(storage, path);
    // Set a timeout to prevent long retries
    const urlPromise = getDownloadURL(storageRef);
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 3000)
    );
    return await Promise.race([urlPromise, timeoutPromise]) as string;
  } catch (error) {
    // Silently return null for missing files or errors
    return null;
  }
};

/**
 * Delete profile image for a user
 */
export const deleteProfileImage = async (userId: string): Promise<void> => {
  const path = `profiles/${userId}/avatar.jpg`;
  return deleteFile(path);
};

// ─────────────────────────────────────────────────────────────────────────────
// Gig-order deliverables (completed tax returns, signed 8879, schedules, etc.)
// Files live under `gig_orders/{orderId}/deliverables/{timestamp}_{filename}`.
// Read access is gated by Storage rules to the order's client_uid + pro_id
// (see FIREBASE_STORAGE_RULES.txt for the matching rule).
// ─────────────────────────────────────────────────────────────────────────────

export interface GigDeliverableFile {
  name: string;            // original filename, e.g. "2024-1040.pdf"
  size: number;            // bytes
  contentType: string;     // MIME, e.g. "application/pdf"
  storagePath: string;     // full path in Storage, e.g. "gig_orders/abc/deliverables/171..._2024-1040.pdf"
  downloadURL: string;     // long-lived download URL token
  uploadedAt: string;      // ISO timestamp
}

/**
 * Client-uploaded source documents attached to a gig order's brief
 * (W-2s, 1099s, prior-year return, receipts, etc.). Structurally identical
 * to GigDeliverableFile but stored under a different Storage prefix:
 *   gig_orders/{orderId}/source-docs/{timestamp}_{filename}
 *
 * Reads are gated by Storage rules to client_uid + pro_id; writes are
 * gated to client_uid only.
 */
export type GigSourceFile = GigDeliverableFile;

const sanitizeFilename = (name: string): string =>
  name
    .replace(/[^\w.\-]+/g, '_') // collapse anything non-alphanumeric/_/.- to _
    .replace(/_+/g, '_')
    .slice(0, 120) || 'file';

/**
 * Internal helper — uploads one file to a gig-order subpath and returns the
 * metadata blob the caller persists to Firestore.
 */
const uploadGigOrderFile = async (
  orderId: string,
  subpath: 'deliverables' | 'source-docs',
  file: File
): Promise<GigDeliverableFile> => {
  if (!isStorageAvailable()) {
    throw new Error('Firebase Storage not configured. Please enable Storage in Firebase Console.');
  }
  if (!orderId) throw new Error('Missing orderId for upload.');

  const safeName = sanitizeFilename(file.name);
  const path = `gig_orders/${orderId}/${subpath}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);

  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      orderId,
      originalName: file.name,
      kind: subpath,
    },
  });
  const downloadURL = await getDownloadURL(snapshot.ref);

  return {
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
    storagePath: snapshot.ref.fullPath,
    downloadURL,
    uploadedAt: new Date().toISOString(),
  };
};

/**
 * Upload one delivery file for a gig order. Returns the metadata that the
 * caller should append to the order's `delivery_files` array in Firestore.
 *
 * This intentionally does NOT touch Firestore — the caller does the array
 * write (and we batch multiple uploads into a single updateOrderStatus call).
 */
export const uploadGigDeliverable = (
  orderId: string,
  file: File
): Promise<GigDeliverableFile> => uploadGigOrderFile(orderId, 'deliverables', file);

/**
 * Convenience: upload an array of files sequentially (so we surface per-file
 * errors). Returns successful uploads; throws on the first failure so the
 * caller can decide whether to retry.
 */
export const uploadGigDeliverables = async (
  orderId: string,
  files: File[]
): Promise<GigDeliverableFile[]> => {
  const results: GigDeliverableFile[] = [];
  for (const f of files) {
    results.push(await uploadGigDeliverable(orderId, f));
  }
  return results;
};

/**
 * Remove a single deliverable from Storage. Used if the pro removes a file
 * from the staging list before sending the delivery.
 */
export const deleteGigDeliverable = async (storagePath: string): Promise<void> => {
  if (!storagePath) return;
  return deleteFile(storagePath);
};

// ─────────────────────────────────────────────────────────────────────────────
// Gig-order source documents (W-2s, 1099s, prior-year returns, receipts, etc.)
// Uploaded by the CLIENT and read by both parties. Lives at:
//   gig_orders/{orderId}/source-docs/{timestamp}_{filename}
// Storage rule gates write→client_uid, read→{client_uid|pro_id}.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload one source document for a gig order. Returns metadata to append to
 * the order's `source_files` array in Firestore. Firestore write is done by
 * the caller (see gigOrdersService.addOrderSourceFiles).
 */
export const uploadGigSourceDoc = (
  orderId: string,
  file: File
): Promise<GigSourceFile> => uploadGigOrderFile(orderId, 'source-docs', file);

/**
 * Convenience: upload a batch of source documents sequentially.
 */
export const uploadGigSourceDocs = async (
  orderId: string,
  files: File[]
): Promise<GigSourceFile[]> => {
  const results: GigSourceFile[] = [];
  for (const f of files) {
    results.push(await uploadGigSourceDoc(orderId, f));
  }
  return results;
};

/**
 * Remove a source document from Storage (used when the client removes a file
 * they previously attached, or cleans up a failed-Firestore-commit upload).
 */
export const deleteGigSourceDoc = async (storagePath: string): Promise<void> => {
  if (!storagePath) return;
  return deleteFile(storagePath);
};

// ─────────────────────────────────────────────────────────────────────────────
// Client tax documents (W-2s, 1099s, receipts, statements, etc.)
// Uploaded by a CLIENT (the document owner) to their own private workspace,
// optionally shared with one or more tax professionals. Lives at:
//   client-documents/{ownerId}/{folder}/{timestamp}_{filename}
//
// Read access in Storage rules should be gated to:
//   - request.auth.uid == ownerId  (the client themselves), OR
//   - request.auth.uid in resource.metadata.sharedWith (pros the doc is shared with)
//
// The matching Firestore collection is `client_documents`, with fields:
//   owner_id, professional_id, file_name, storage_path, status, uploaded_at,
//   plus convenience fields (file_type, file_size, folder, download_url,
//   shared_with[]). Security rules for that collection live in firestore.rules.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientDocumentFile {
  name: string;
  size: number;
  contentType: string;
  storagePath: string;
  downloadURL: string;
  uploadedAt: string;
}

/**
 * Upload one client tax document. Returns the metadata the caller persists
 * to the `client_documents` Firestore collection. Storage write is gated by
 * the rule: only the owner (request.auth.uid == ownerId) can write.
 */
export const uploadClientDocument = async (
  ownerId: string,
  folder: string,
  file: File
): Promise<ClientDocumentFile> => {
  if (!isStorageAvailable()) {
    throw new Error('Firebase Storage not configured. Please enable Storage in Firebase Console.');
  }
  if (!ownerId) throw new Error('Missing ownerId for client document upload.');

  const safeFolder = sanitizeFilename(folder || 'general');
  const safeName = sanitizeFilename(file.name);
  const path = `client-documents/${ownerId}/${safeFolder}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);

  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      ownerId,
      folder: safeFolder,
      originalName: file.name,
    },
  });
  const downloadURL = await getDownloadURL(snapshot.ref);

  return {
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
    storagePath: snapshot.ref.fullPath,
    downloadURL,
    uploadedAt: new Date().toISOString(),
  };
};

/**
 * Get a fresh download URL for a client document. The token embedded in the
 * URL persists across sessions, so callers should normally just use the
 * `download_url` field stored on the Firestore doc — this helper exists for
 * cases where that URL has been revoked / lost.
 */
export const getClientDocumentURL = async (storagePath: string): Promise<string> => {
  return getFileURL(storagePath);
};

/**
 * Delete a client document from Storage. Caller is responsible for also
 * deleting the matching Firestore doc in `client_documents`.
 */
export const deleteClientDocument = async (storagePath: string): Promise<void> => {
  if (!storagePath) return;
  return deleteFile(storagePath);
};
