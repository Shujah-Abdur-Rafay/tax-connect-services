// Membership Level Enumeration
//
// Canonical user-level structure (1 customer + 5 professional + 2 admin):
//   • Tax Client            — role 'client' (not a membershipLevel)
//   • Free Directory Listing — $0      (DIRECTORY_LISTING)
//   • Associate Partner      — $99.95  (ACQUISITION)
//   • Professional Partner   — $299.95 (PROFESSIONAL_PACKAGE)
//   • Premier Partner        — $499.95 (PREMIUM_PARTNER)
//   • Service Bureau Partner — consultation only, hidden from public selection
//   • Admin / Help Desk      — admin tiers (role-based, see adminPermissions.ts)
//
// ⚠️ BACK-COMPAT: the string VALUES below are what new accounts store in
// users/{uid}.membershipLevel. Several of them were renamed (e.g. "Associate
// (Entry Level)" → "Associate Partner", "Professional" → "Professional
// Partner", "Directory Listing" → "Free Directory Listing"). Existing user docs
// still hold the OLD strings, so every comparison goes through getTierRank(),
// and MEMBERSHIP_TIER_RANK lists the legacy strings as aliases. The
// firestore.rules member_content read rule lists the same literal strings (new
// + legacy) so DB-level content gating stays in sync.
export enum MembershipLevel {
  DIRECTORY_LISTING = "Free Directory Listing",
  ACQUISITION = "Associate Partner",
  PROFESSIONAL_PACKAGE = "Professional Partner",

  PREMIUM_PARTNER = "Premier Partner",
  // Phase 4 — top operator tier. Runs a preparer network (sub-accounts),
  // gets advanced cross-network reporting, and platform/office admin tools.
  // Hidden from public plan pickers (consultation only); admin-assignable.
  SERVICE_BUREAU = "Service Bureau Partner",
  ADMIN = "Admin"
}

// Array for displaying options in UI (dropdowns, filters, etc.). Includes
// Service Bureau + Admin — used by the ADMIN-side membership manager where every
// level is assignable. For public-facing pickers use PUBLIC_MEMBERSHIP_LEVELS.
export const ALL_MEMBERSHIP_LEVELS = [
  MembershipLevel.DIRECTORY_LISTING,
  MembershipLevel.ACQUISITION,
  MembershipLevel.PROFESSIONAL_PACKAGE,
  MembershipLevel.PREMIUM_PARTNER,
  MembershipLevel.SERVICE_BUREAU,
  MembershipLevel.ADMIN
];

// Annual price for each professional tier. `null` = not publicly purchasable
// (Service Bureau is consultation-only). Used wherever a price is rendered.
export const MEMBERSHIP_LEVEL_PRICE: Record<string, number | null> = {
  [MembershipLevel.DIRECTORY_LISTING]: 0,
  [MembershipLevel.ACQUISITION]: 99.95,
  [MembershipLevel.PROFESSIONAL_PACKAGE]: 299.95,
  [MembershipLevel.PREMIUM_PARTNER]: 499.95,
  [MembershipLevel.SERVICE_BUREAU]: null,
};

/**
 * True for levels a member can publicly select / purchase. Service Bureau is
 * consultation-only and Admin is never self-selectable, so both are excluded.
 * Public plan pickers must filter on this (the Service Bureau tier still exists
 * in the backend and is assignable by an admin).
 */
export const isPubliclySelectableLevel = (level: string | undefined): boolean =>
  level !== MembershipLevel.SERVICE_BUREAU && level !== MembershipLevel.ADMIN;

/** Professional levels offered in public pricing/upgrade selectors (no SB/Admin). */
export const PUBLIC_MEMBERSHIP_LEVELS = [
  MembershipLevel.DIRECTORY_LISTING,
  MembershipLevel.ACQUISITION,
  MembershipLevel.PROFESSIONAL_PACKAGE,
  MembershipLevel.PREMIUM_PARTNER,
];

// ─────────────────────────────────────────────────────────────────────────────
// Tier ranking — used for tier-gated features such as the Phase 3 Resource
// Center. A higher rank unlocks everything a lower rank can see. Stored
// membership_level strings are messy in the wild (legacy "Listing", "Directory
// Listing", "Associate (Entry Level)", "Professional", "Premium Partner", …),
// so the rank lookup tolerates aliases and falls back to the free Directory
// Listing rank (0) for anything unknown.
// ─────────────────────────────────────────────────────────────────────────────
export const MEMBERSHIP_TIER_RANK: Record<string, number> = {
  // Free directory listing (and legacy aliases) — the entry point.
  [MembershipLevel.DIRECTORY_LISTING]: 0, // "Free Directory Listing"
  'Directory Listing': 0,                 // legacy enum value
  'Listing': 0,
  'Free': 0,
  // Associate Partner (and legacy aliases).
  [MembershipLevel.ACQUISITION]: 1,       // "Associate Partner"
  'Associate (Entry Level)': 1,           // legacy enum value
  'Associate': 1,
  // Professional Partner (and legacy aliases).
  [MembershipLevel.PROFESSIONAL_PACKAGE]: 2, // "Professional Partner"
  'Professional': 2,                         // legacy enum value
  'Professional Package': 2,
  // Premier Partner (and legacy aliases).
  [MembershipLevel.PREMIUM_PARTNER]: 3,   // "Premier Partner"
  'Premium Partner': 3,
  // Service Bureau Partner (and legacy aliases).
  [MembershipLevel.SERVICE_BUREAU]: 4,    // "Service Bureau Partner"
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

// Canonical display label for any stored level string (maps legacy → new).
const CANONICAL_LABEL_BY_RANK: Record<number, MembershipLevel> = {
  0: MembershipLevel.DIRECTORY_LISTING,
  1: MembershipLevel.ACQUISITION,
  2: MembershipLevel.PROFESSIONAL_PACKAGE,
  3: MembershipLevel.PREMIUM_PARTNER,
  4: MembershipLevel.SERVICE_BUREAU,
  99: MembershipLevel.ADMIN,
};

/**
 * The canonical, user-facing label for a (possibly legacy) stored level string.
 * e.g. "Associate (Entry Level)" → "Associate Partner". Falls back to the raw
 * value (or Free Directory Listing) when unmapped.
 */
export const membershipLevelLabel = (level: string | undefined): string =>
  CANONICAL_LABEL_BY_RANK[getTierRank(level)] || level || MembershipLevel.DIRECTORY_LISTING;

// Helper function to check if a membership level has upgraded access
// (Professional Partner and above). Rank-based so it tolerates legacy strings.
export const hasUpgradedAccess = (level: string | undefined): boolean =>
  getTierRank(level) >= getTierRank(MembershipLevel.PROFESSIONAL_PACKAGE);

// Helper function to check if a membership level has premium access
// (Premier Partner and above). Rank-based so it tolerates legacy strings.
export const hasPremiumAccess = (level: string | undefined): boolean =>
  getTierRank(level) >= getTierRank(MembershipLevel.PREMIUM_PARTNER);

// Helper function to check if a membership level is admin
export const isAdmin = (level: string | undefined): boolean => {
  return level === MembershipLevel.ADMIN;
};

// True for the Service Bureau Partner tier (or admin) — unlocks the
// preparer-network management + advanced reporting tools. Rank-based so it
// tolerates the legacy "Service Bureau" string.
export const isServiceBureau = (level: string | undefined): boolean =>
  getTierRank(level) >= getTierRank(MembershipLevel.SERVICE_BUREAU);

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
 * `Free Directory Listing` means "visible to every signed-in professional".
 */
export const RESOURCE_TIER_OPTIONS: { value: MembershipLevel; label: string }[] = [
  { value: MembershipLevel.DIRECTORY_LISTING, label: 'All professionals (free)' },
  { value: MembershipLevel.ACQUISITION, label: 'Associate Partner & above' },
  { value: MembershipLevel.PROFESSIONAL_PACKAGE, label: 'Professional Partner & above' },
  { value: MembershipLevel.PREMIUM_PARTNER, label: 'Premier Partner & above' },
  { value: MembershipLevel.SERVICE_BUREAU, label: 'Service Bureau Partner only' },
];
