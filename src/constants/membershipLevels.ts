// Membership Level Enumeration
export enum MembershipLevel {
  DIRECTORY_LISTING = "Directory Listing",
  ACQUISITION = "Associate (Entry Level)",
  PROFESSIONAL_PACKAGE = "Professional",

  PREMIUM_PARTNER = "Premier Partner",
  // Phase 4 — top operator tier. Runs a preparer network (sub-accounts),
  // gets advanced cross-network reporting, and platform/office admin tools.
  SERVICE_BUREAU = "Service Bureau Partner",
  ADMIN = "Admin"
}

// Array for displaying options in UI (dropdowns, filters, etc.)
export const ALL_MEMBERSHIP_LEVELS = [
  MembershipLevel.DIRECTORY_LISTING,
  MembershipLevel.ACQUISITION,
  MembershipLevel.PROFESSIONAL_PACKAGE,
  MembershipLevel.PREMIUM_PARTNER,
  MembershipLevel.SERVICE_BUREAU,
  MembershipLevel.ADMIN
];

// Helper function to check if a membership level has upgraded access
export const hasUpgradedAccess = (level: string | undefined): boolean => {
  if (!level) return false;
  return [
    MembershipLevel.PROFESSIONAL_PACKAGE,
    MembershipLevel.PREMIUM_PARTNER,
    MembershipLevel.SERVICE_BUREAU,
    MembershipLevel.ADMIN
  ].includes(level as MembershipLevel);
};

// Helper function to check if a membership level has premium access
export const hasPremiumAccess = (level: string | undefined): boolean => {
  if (!level) return false;
  return [
    MembershipLevel.PREMIUM_PARTNER,
    MembershipLevel.SERVICE_BUREAU,
    MembershipLevel.ADMIN
  ].includes(level as MembershipLevel);
};

// Helper function to check if a membership level is admin
export const isAdmin = (level: string | undefined): boolean => {
  return level === MembershipLevel.ADMIN;
};

// True for the Service Bureau Partner tier (or admin) — unlocks the
// preparer-network management + advanced reporting tools.
export const isServiceBureau = (level: string | undefined): boolean => {
  return level === MembershipLevel.SERVICE_BUREAU || level === MembershipLevel.ADMIN;
};

// ─────────────────────────────────────────────────────────────────────────────
// Tier ranking — used for tier-gated features such as the Phase 3 Resource
// Center. A higher rank unlocks everything a lower rank can see. Stored
// membership_level strings are messy in the wild (legacy "Listing",
// "Premium Partner", etc.), so the rank lookup tolerates aliases and falls back
// to the free Directory Listing rank (0) for anything unknown.
// ─────────────────────────────────────────────────────────────────────────────
export const MEMBERSHIP_TIER_RANK: Record<string, number> = {
  // Free directory listing (and legacy aliases) — the entry point.
  [MembershipLevel.DIRECTORY_LISTING]: 0,
  'Listing': 0,
  'Free': 0,
  // Paid tiers, ascending.
  [MembershipLevel.ACQUISITION]: 1,
  'Associate': 1,
  [MembershipLevel.PROFESSIONAL_PACKAGE]: 2,
  'Professional Package': 2,
  [MembershipLevel.PREMIUM_PARTNER]: 3,
  'Premium Partner': 3,
  [MembershipLevel.SERVICE_BUREAU]: 4,
  'Service Bureau': 4,
  // Admin sees everything.
  [MembershipLevel.ADMIN]: 99,
};

/**
 * Numeric rank for a membership level (0 = free Directory Listing). Unknown /
 * undefined levels rank as 0 so a misconfigured tier never accidentally unlocks
 * gated content.
 */
export const getTierRank = (level: string | undefined): number => {
  if (!level) return 0;
  return MEMBERSHIP_TIER_RANK[level] ?? 0;
};

/**
 * True when a user on `userLevel` is entitled to content requiring at least
 * `requiredLevel`. Admins always pass.
 */
export const meetsTier = (
  userLevel: string | undefined,
  requiredLevel: string | undefined,
): boolean => {
  return getTierRank(userLevel) >= getTierRank(requiredLevel);
};

/**
 * Tier options offered when an admin gates a resource. Ordered free → premium.
 * `Directory Listing` means "visible to every signed-in professional".
 */
export const RESOURCE_TIER_OPTIONS: { value: MembershipLevel; label: string }[] = [
  { value: MembershipLevel.DIRECTORY_LISTING, label: 'All professionals (free)' },
  { value: MembershipLevel.ACQUISITION, label: 'Associate & above' },
  { value: MembershipLevel.PROFESSIONAL_PACKAGE, label: 'Professional & above' },
  { value: MembershipLevel.PREMIUM_PARTNER, label: 'Premier Partner & above' },
  { value: MembershipLevel.SERVICE_BUREAU, label: 'Service Bureau Partner only' },
];
