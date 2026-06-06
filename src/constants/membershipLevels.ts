// Membership Level Enumeration
export enum MembershipLevel {
  DIRECTORY_LISTING = "Directory Listing",
  ACQUISITION = "Associate (Entry Level)",
  PROFESSIONAL_PACKAGE = "Professional",

  PREMIUM_PARTNER = "Premier Partner",
  ADMIN = "Admin"
}

// Array for displaying options in UI (dropdowns, filters, etc.)
export const ALL_MEMBERSHIP_LEVELS = [
  MembershipLevel.DIRECTORY_LISTING,
  MembershipLevel.ACQUISITION,
  MembershipLevel.PROFESSIONAL_PACKAGE,
  MembershipLevel.PREMIUM_PARTNER,
  MembershipLevel.ADMIN
];

// Helper function to check if a membership level has upgraded access
export const hasUpgradedAccess = (level: string | undefined): boolean => {
  if (!level) return false;
  return [
    MembershipLevel.PROFESSIONAL_PACKAGE,
    MembershipLevel.PREMIUM_PARTNER,
    MembershipLevel.ADMIN
  ].includes(level as MembershipLevel);
};

// Helper function to check if a membership level has premium access
export const hasPremiumAccess = (level: string | undefined): boolean => {
  if (!level) return false;
  return [
    MembershipLevel.PREMIUM_PARTNER,
    MembershipLevel.ADMIN
  ].includes(level as MembershipLevel);
};

// Helper function to check if a membership level is admin
export const isAdmin = (level: string | undefined): boolean => {
  return level === MembershipLevel.ADMIN;
};
