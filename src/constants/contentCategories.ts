// ============================================================================
// contentCategories — audience taxonomy for the Admin Content Management module
//
// Admins assign each piece of uploaded content (PDF / link / video) to one or
// more of four audience categories. A signed-in member only ever sees content
// for the categories they belong to, derived from their role + membership tier
// via getUserContentCategories below (the "overlapping by role + tier" model).
// ============================================================================

import { MembershipLevel, getTierRank } from '@/constants/membershipLevels';

export type ContentCategory = 'users' | 'professionals' | 'associates' | 'premium_partners';

export const CONTENT_CATEGORIES: {
  value: ContentCategory;
  label: string;
  description: string;
}[] = [
  { value: 'users', label: 'Users', description: 'Regular member accounts (clients).' },
  { value: 'professionals', label: 'Professionals', description: 'All tax professionals.' },
  { value: 'associates', label: 'Associates', description: 'Associate Partner members.' },
  { value: 'premium_partners', label: 'Premium Partners', description: 'Premier Partner members.' },
];

export const ALL_CONTENT_CATEGORY_VALUES: ContentCategory[] = CONTENT_CATEGORIES.map((c) => c.value);

export const contentCategoryLabel = (value: string): string =>
  CONTENT_CATEGORIES.find((c) => c.value === value)?.label || value;

/** Minimal user shape needed to categorize — avoids importing the AuthContext type. */
interface CategorizableUser {
  role?: string;
  membershipLevel?: string;
}

// Rank of the exact tiers that unlock the Associates / Premium Partners buckets.
// Comparing by rank (not raw string) tolerates the legacy membership aliases
// catalogued in membershipLevels.ts (e.g. "Associate", "Premium Partner").
const ASSOCIATE_RANK = getTierRank(MembershipLevel.ACQUISITION); // 1
const PREMIER_RANK = getTierRank(MembershipLevel.PREMIUM_PARTNER); // 3

/**
 * The categories a signed-in person belongs to (overlapping, non-hierarchical):
 *   - admin        → every category
 *   - professional → 'professionals', plus 'associates' if their tier is exactly
 *                    Associate (Entry Level), plus 'premium_partners' if their
 *                    tier is exactly Premier Partner
 *   - everyone else (clients / unknown role) → 'users'
 *
 * A professional is intentionally NOT also a "Users" member, and tiers do not
 * cascade (a Premier Partner does not automatically see Associates content).
 */
export const getUserContentCategories = (
  user: CategorizableUser | null | undefined,
): ContentCategory[] => {
  if (!user) return [];
  if (user.role === 'admin') return [...ALL_CONTENT_CATEGORY_VALUES];

  if (user.role === 'professional') {
    const categories: ContentCategory[] = ['professionals'];
    const rank = getTierRank(user.membershipLevel);
    if (rank === ASSOCIATE_RANK) categories.push('associates');
    if (rank === PREMIER_RANK) categories.push('premium_partners');
    return categories;
  }

  return ['users'];
};
