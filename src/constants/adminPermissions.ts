// ============================================================================
// adminPermissions — granular permission model for the admin area.
//
// Two admin tiers (stored as users/{uid}.role):
//   • 'admin'      — full platform control. Implies EVERY permission below.
//   • 'help_desk'  — admin-area staff with an explicit, admin-configurable
//                    subset of permissions (users/{uid}.helpDeskPermissions).
//
// Gating uses these keys everywhere: the AdminDashboard tabs, the standalone
// /admin/* pages, the Header menu, and firestore.rules (which mirrors the
// 'content' permission for member_content writes). A full admin always passes;
// a help-desk user passes only for the keys they were granted.
// ============================================================================

export type AdminPermission =
  | 'applications'   // review pro applications + manage professional listings
  | 'memberships'    // change user membership levels
  | 'subscriptions'  // manage recurring subscriptions
  | 'payouts'        // payouts / commission monitor
  | 'reviews'        // moderate client reviews
  | 'content'        // member content management (mirrored in firestore.rules)
  | 'tools'          // misc admin tools (CRM, analytics, fees, etc.)
  | 'admins';        // manage admins + help-desk permissions (sensitive)

export interface AdminPermissionMeta {
  key: AdminPermission;
  label: string;
  description: string;
}

export const ADMIN_PERMISSIONS: AdminPermissionMeta[] = [
  { key: 'applications', label: 'Applications & Professionals', description: 'Review pro applications and manage directory listings.' },
  { key: 'memberships', label: 'Memberships', description: 'Change a user’s membership level.' },
  { key: 'subscriptions', label: 'Subscriptions', description: 'Manage recurring membership subscriptions.' },
  { key: 'payouts', label: 'Payouts', description: 'View the payouts / commission monitor.' },
  { key: 'reviews', label: 'Reviews', description: 'Moderate client reviews.' },
  { key: 'content', label: 'Content', description: 'Upload and manage member content (gated in DB rules).' },
  { key: 'tools', label: 'Tools', description: 'CRM, analytics, platform fees and other admin tools.' },
  { key: 'admins', label: 'Admin Management', description: 'Add admins and configure help-desk permissions (sensitive).' },
];

export const ALL_ADMIN_PERMISSION_KEYS: AdminPermission[] = ADMIN_PERMISSIONS.map((p) => p.key);

export const adminPermissionLabel = (key: string): string =>
  ADMIN_PERMISSIONS.find((p) => p.key === key)?.label || key;

/**
 * Resolve the effective permission set for an account.
 *   - full admin  → every permission
 *   - help desk   → exactly the granted keys
 *   - anyone else → none
 */
export const resolveAdminPermissions = (
  role: string | undefined,
  helpDeskPermissions: string[] | undefined,
): Set<AdminPermission> => {
  if (role === 'admin') return new Set(ALL_ADMIN_PERMISSION_KEYS);
  if (role === 'help_desk') {
    return new Set(
      (helpDeskPermissions || []).filter((p): p is AdminPermission =>
        (ALL_ADMIN_PERMISSION_KEYS as string[]).includes(p),
      ),
    );
  }
  return new Set();
};

/** True when the role can reach the admin area at all (full admin or help desk). */
export const canAccessAdminArea = (role: string | undefined): boolean =>
  role === 'admin' || role === 'help_desk';
