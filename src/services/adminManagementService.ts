// ============================================================================
// adminManagementService — Admin Management module
//
// Supports multiple admins, "add admin by email", and self password changes.
//
// Admin-by-email model (rules-guarded self-elevation):
//   - An `admin_allowlist` collection holds one doc per allowlisted email
//     (doc id = normalized email). Only admins can write it (enforced in rules).
//   - On every sign-in, AuthContext calls checkAndApplyAdminElevation(). If the
//     user's email is allowlisted and they are not yet an admin, the app sets
//     their own users/{uid}.role to 'admin'. A Firestore rule only permits that
//     self-elevation when the caller's email is allowlisted, so a user can never
//     grant themselves admin arbitrarily.
//   - This covers existing accounts (promoted on next login) and future signups
//     (the same listener runs after registration).
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { ALL_ADMIN_PERMISSION_KEYS, type AdminPermission } from '@/constants/adminPermissions';

export const ADMIN_ALLOWLIST_COLLECTION = 'admin_allowlist';
const USERS_COLLECTION = 'users';

/**
 * Platform owners seeded as full admins. These emails are promoted to admin on
 * their next login even before any admin exists to write the allowlist (the
 * firestore.rules isBootstrapAdminEmail() function mirrors this list so the
 * self-elevation write is permitted). Keep in sync with firestore.rules.
 */
export const BOOTSTRAP_ADMIN_EMAILS = [
  // Primary platform admin. Seeded as a verified full admin via
  // scripts/seedPrimaryAdmin.mjs and promoted on login by the rule below.
  'admin@gmail.com',
  'info@alliance-tax.com',
  'geraldgaraba@gmail.com',
];

export type AdminRole = 'admin' | 'help_desk';

/** Normalize an email to use as a stable, case-insensitive allowlist doc id. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isBootstrapEmail = (email?: string | null): boolean =>
  !!email && BOOTSTRAP_ADMIN_EMAILS.includes(normalizeEmail(email));

export interface AdminAllowlistEntry {
  email: string;
  /** 'admin' (full) or 'help_desk' (granular). Defaults to 'admin' for legacy docs. */
  role: AdminRole;
  /** Granted permission keys — only meaningful when role === 'help_desk'. */
  permissions: AdminPermission[];
  added_by?: string | null;
  created_at?: string;
}

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
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

const sanitizePermissions = (raw: any): AdminPermission[] =>
  Array.isArray(raw)
    ? raw.filter((p): p is AdminPermission => (ALL_ADMIN_PERMISSION_KEYS as string[]).includes(p))
    : [];

/** Every allowlisted email (admin-only read in rules). Newest first. */
export const listAdminAllowlist = async (): Promise<AdminAllowlistEntry[]> => {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, ADMIN_ALLOWLIST_COLLECTION));
    return snap.docs
      .map((d) => {
        const data = d.data() as any;
        const role: AdminRole = data.role === 'help_desk' ? 'help_desk' : 'admin';
        return {
          email: (data.email as string) || d.id,
          role,
          permissions: role === 'help_desk' ? sanitizePermissions(data.permissions) : [],
          added_by: data.added_by ?? null,
          created_at: tsToIso(data.created_at),
        };
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch (e) {
    console.warn('[adminManagementService] listAdminAllowlist failed:', (e as Error).message);
    return [];
  }
};

const assertValidEmail = (normalized: string) => {
  if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new Error('Enter a valid email address.');
  }
};

/** Add an email to the allowlist as a FULL admin. Idempotent (doc id = email). */
export const addAdminEmail = async (email: string, addedByUid?: string | null): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  const normalized = normalizeEmail(email);
  assertValidEmail(normalized);
  await setDoc(doc(db, ADMIN_ALLOWLIST_COLLECTION, normalized), {
    email: normalized,
    role: 'admin',
    permissions: [],
    added_by: addedByUid ?? null,
    created_at: serverTimestamp(),
  });
};

/**
 * Add an email to the allowlist as a HELP DESK user with a specific set of
 * permissions. They are promoted to role 'help_desk' on their next login and
 * receive exactly the granted permissions.
 */
export const addHelpDeskEmail = async (
  email: string,
  permissions: AdminPermission[],
  addedByUid?: string | null,
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  const normalized = normalizeEmail(email);
  assertValidEmail(normalized);
  await setDoc(doc(db, ADMIN_ALLOWLIST_COLLECTION, normalized), {
    email: normalized,
    role: 'help_desk',
    permissions: sanitizePermissions(permissions),
    added_by: addedByUid ?? null,
    created_at: serverTimestamp(),
  });
};

/**
 * Update a help-desk user's granted permissions (admin-only via rules). Takes
 * effect on the user's next login (re-running checkAndApplyAdminElevation syncs
 * users/{uid}.helpDeskPermissions from this allowlist entry).
 */
export const updateHelpDeskPermissions = async (
  email: string,
  permissions: AdminPermission[],
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  const normalized = normalizeEmail(email);
  await setDoc(
    doc(db, ADMIN_ALLOWLIST_COLLECTION, normalized),
    { role: 'help_desk', permissions: sanitizePermissions(permissions) },
    { merge: true },
  );
};

/** Remove an email from the allowlist. Does not demote an already-promoted admin. */
export const removeAdminEmail = async (email: string): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  await deleteDoc(doc(db, ADMIN_ALLOWLIST_COLLECTION, normalizeEmail(email)));
};

/** Whether a given email is currently allowlisted. */
export const isEmailAllowlisted = async (email: string): Promise<boolean> => {
  if (!db || !email) return false;
  try {
    const snap = await getDoc(doc(db, ADMIN_ALLOWLIST_COLLECTION, normalizeEmail(email)));
    return snap.exists();
  } catch (e) {
    console.warn('[adminManagementService] isEmailAllowlisted failed:', (e as Error).message);
    return false;
  }
};

/** Current admins (users whose role == 'admin'). */
export const listAdmins = async (): Promise<AdminUser[]> => {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, USERS_COLLECTION), where('role', '==', 'admin')));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: d.id,
        email: (data.email as string) || '',
        name: (data.name as string) || 'Admin',
      };
    });
  } catch (e) {
    console.warn('[adminManagementService] listAdmins failed:', (e as Error).message);
    return [];
  }
};

export interface HelpDeskUser extends AdminUser {
  permissions: AdminPermission[];
}

/** Current help-desk users (users whose role == 'help_desk'). */
export const listHelpDeskUsers = async (): Promise<HelpDeskUser[]> => {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, USERS_COLLECTION), where('role', '==', 'help_desk')));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: d.id,
        email: (data.email as string) || '',
        name: (data.name as string) || 'Help Desk',
        permissions: sanitizePermissions(data.helpDeskPermissions),
      };
    });
  } catch (e) {
    console.warn('[adminManagementService] listHelpDeskUsers failed:', (e as Error).message);
    return [];
  }
};

export interface ResolvedAdminAccess {
  role: AdminRole;
  permissions: AdminPermission[];
}

/**
 * Resolve the access an email is entitled to: bootstrap owners → full admin;
 * otherwise read their admin_allowlist entry. Returns null when not allowlisted.
 */
export const resolveAdminAccess = async (
  email?: string | null,
): Promise<ResolvedAdminAccess | null> => {
  if (!email) return null;
  if (isBootstrapEmail(email)) return { role: 'admin', permissions: [] };
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, ADMIN_ALLOWLIST_COLLECTION, normalizeEmail(email)));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    const role: AdminRole = data.role === 'help_desk' ? 'help_desk' : 'admin';
    return {
      role,
      permissions: role === 'help_desk' ? sanitizePermissions(data.permissions) : [],
    };
  } catch (e) {
    console.warn('[adminManagementService] resolveAdminAccess failed:', (e as Error).message);
    return null;
  }
};

const ROLE_RANK: Record<string, number> = { client: 0, professional: 0, help_desk: 1, admin: 2 };

export interface ElevationResult {
  elevated: boolean;
  role?: AdminRole;
  permissions?: AdminPermission[];
}

/**
 * Promote / sync the signed-in user's admin access from the allowlist (or the
 * bootstrap owner list). Full admins keep all permissions; help-desk users get
 * exactly their granted set synced onto users/{uid}.helpDeskPermissions. Never
 * demotes a higher role automatically. Best-effort & non-fatal — a failure here
 * must never block sign-in.
 */
export const checkAndApplyAdminElevation = async (params: {
  uid: string;
  email?: string | null;
  currentRole?: string;
  currentPermissions?: string[];
}): Promise<ElevationResult> => {
  const { uid, email, currentRole, currentPermissions } = params;
  if (!db || !uid || !email) return { elevated: false };
  try {
    const desired = await resolveAdminAccess(email);
    if (!desired) return { elevated: false };

    const curRank = ROLE_RANK[currentRole || 'client'] ?? 0;
    const desiredRank = ROLE_RANK[desired.role] ?? 0;

    // Elevate role when the desired role outranks the current one.
    const roleNeedsElevation = desiredRank > curRank;

    // For help desk, keep the granted permissions in sync even if the role is
    // already correct (an admin may have changed the allowlist entry).
    const permsChanged =
      desired.role === 'help_desk' &&
      JSON.stringify([...(currentPermissions || [])].sort()) !==
        JSON.stringify([...desired.permissions].sort());

    if (!roleNeedsElevation && !permsChanged) {
      return { elevated: false, role: desired.role, permissions: desired.permissions };
    }

    const patch: Record<string, unknown> = {};
    if (roleNeedsElevation) patch.role = desired.role;
    if (desired.role === 'help_desk') patch.helpDeskPermissions = desired.permissions;
    await setDoc(doc(db, USERS_COLLECTION, uid), patch, { merge: true });

    return {
      elevated: roleNeedsElevation,
      role: roleNeedsElevation ? desired.role : (currentRole as AdminRole) || desired.role,
      permissions: desired.permissions,
    };
  } catch (e) {
    console.warn('[adminManagementService] admin elevation failed (non-fatal):', (e as Error).message);
    return { elevated: false };
  }
};

/**
 * Change the signed-in admin's own password. Re-authenticates with the current
 * password first (Firebase requires a recent login for updatePassword).
 */
export const changeOwnPassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const current = auth?.currentUser;
  if (!current || !current.email) {
    throw new Error('You must be signed in to change your password.');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  const credential = EmailAuthProvider.credential(current.email, currentPassword);
  await reauthenticateWithCredential(current, credential);
  await updatePassword(current, newPassword);
};
