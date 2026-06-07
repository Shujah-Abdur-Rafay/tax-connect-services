import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { slugify } from '@/services/gigsService';

/** How a professional delivers their services. */
export type ServiceModality = 'virtual' | 'in_person' | 'both';

/**
 * First-class service taxonomy for category filtering & SEO. Kept in one place
 * so the directory filters, onboarding, and profile pages stay in lockstep.
 */
export const SERVICE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'tax-preparation', label: 'Tax Preparation' },
  { value: 'tax-planning', label: 'Tax Planning' },
  { value: 'bookkeeping', label: 'Bookkeeping' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'tax-resolution', label: 'Tax Resolution / IRS Representation' },
  { value: 'business-formation', label: 'Business Formation' },
  { value: 'financial-services', label: 'Financial Services' },
];

export const SERVICE_MODALITY_OPTIONS: { value: ServiceModality; label: string }[] = [
  { value: 'both', label: 'Virtual & In-person' },
  { value: 'virtual', label: 'Virtual only' },
  { value: 'in_person', label: 'In-person only' },
];

export interface Professional {
  id: string;
  /**
   * Human-readable, URL-safe handle used for the public landing page at
   * `/preparer/{slug}` (e.g. "john-smith"). Unique across all professionals.
   * Assigned automatically at registration; `/professional/{uid}` remains a
   * working alias.
   */
  slug?: string;
  email: string;
  full_name: string;
  business_name?: string;
  phone?: string;
  location: string;
  /**
   * How the pro delivers service: remotely, on-site, or both. Powers the
   * "virtual vs in-person" directory filter. Defaults to 'both'.
   */
  service_modality?: ServiceModality;
  /**
   * First-class service taxonomy tags (Tax Prep, Bookkeeping, Payroll, …) used
   * for category filtering & SEO, distinct from the free-text `services` list.
   */
  service_categories?: string[];
  /** City portion of the address (e.g. "Dearborn") */
  city?: string;
  /** State abbreviation (e.g. "MI") */
  state?: string;
  /** ZIP / postal code */
  zip_code?: string;
  bio: string;
  credentials?: any;
  services?: string[];
  specializations?: string[];
  pricing?: any;
  availability?: any;
  years_experience: number;
  rating: number;
  review_count: number;
  is_published: boolean;
  profile_image_url?: string;
  membership_level?: string;
  /** 'pending' | 'approved' | 'rejected' — admin moderation status */
  approval_status?: 'pending' | 'approved' | 'rejected';
  approval_notes?: string;
  approved_at?: string;
  rejected_at?: string;
  created_at?: string;
  /** Geocoded latitude (cached on the doc once resolved). */
  latitude?: number | null;
  /** Geocoded longitude (cached on the doc once resolved). */
  longitude?: number | null;
  // ─ Stripe Connect (Express) fields ──────────────────────────────────
  /**
   * The pro's Stripe Connect Express account id (`acct_xxx`). Persisted
   * the moment the pro starts onboarding so that abandoning/resuming the
   * Stripe-hosted flow reuses the same account instead of creating a new
   * one. When set AND `stripe_charges_enabled` is true, the checkout flow
   * in `gigOrdersService.requestOrderPayment` will route payments to this
   * account as a destination charge (platform takes an application fee,
   * the rest pays out to the pro automatically).
   */
  stripe_account_id?: string | null;
  /** Mirrored from Stripe — Stripe has approved the account to accept charges. */
  stripe_charges_enabled?: boolean;
  /** Mirrored from Stripe — Stripe will pay this account out to a bank. */
  stripe_payouts_enabled?: boolean;
  /** Mirrored from Stripe — the pro has finished the onboarding flow at least once. */
  stripe_details_submitted?: boolean;
}



const COLLECTION = 'professionals';

// Sample professionals data for fallback when Firestore is unavailable / empty
const sampleProfessionals: Professional[] = [
  {
    id: 'gerald-shava-001',
    email: 'info@alliance-tax.com',
    full_name: 'Gerald Shava, Tax Advisor',
    business_name: 'Shava Tax Consulting',
    phone: '(800) 408-1040',
    location: 'Dearborn, MI',
    bio: 'Experienced Tax Advisor specializing in corporate tax planning and international tax compliance. Over 23 years helping businesses and individuals optimize their tax strategies.',
    credentials: { certifications: ['Tax Advisor'], licenses: [{ type: 'Tax Advisor', state: 'Michigan', number: 'MI-123456' }] },
    services: ['Tax Preparation', 'Tax Planning', 'Business Tax', 'International Tax', 'IRS Representation'],
    specializations: ['Corporate Tax', 'International Tax', 'Tax Compliance'],
    pricing: { hourlyRate: 250, consultationFee: 150 },
    years_experience: 23,
    rating: 4.9,
    review_count: 47,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://d64gsuwffb70l.cloudfront.net/68a37e37fed4ba77da23cd1a_1765245488325_eb4bc028.jpg',
    membership_level: 'Premium Partner'
  },
  {
    id: '1',
    email: 'sarah.johnson@taxexperts.com',
    full_name: 'Sarah Johnson, CPA',
    business_name: 'Johnson Tax Services',
    phone: '(555) 123-4567',
    location: 'New York, NY',
    bio: 'CPA with 15 years of experience in individual and business tax preparation.',
    credentials: { certifications: ['CPA', 'EA'] },
    services: ['Tax Preparation', 'Tax Planning', 'IRS Representation'],
    specializations: ['Individual Tax Returns', 'Business Tax Returns'],
    pricing: { hourlyRate: 175 },
    years_experience: 15,
    rating: 4.9,
    review_count: 127,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
    membership_level: 'Premier Partner'
  },
  {
    id: '2',
    email: 'michael.chen@taxsolutions.com',
    full_name: 'Michael Chen, EA',
    business_name: 'Chen Tax Solutions',
    phone: '(555) 234-5678',
    location: 'Los Angeles, CA',
    bio: 'Enrolled Agent specializing in small business taxation and bookkeeping services.',
    credentials: { certifications: ['EA', 'QuickBooks ProAdvisor'] },
    services: ['Business Tax Returns', 'Bookkeeping', 'Payroll Services'],
    specializations: ['Business Tax Returns', 'Bookkeeping'],
    pricing: { hourlyRate: 150 },
    years_experience: 12,
    rating: 4.8,
    review_count: 98,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
    membership_level: 'Professional'
  },
  {
    id: '3',
    email: 'emily.rodriguez@taxadvisors.com',
    full_name: 'Emily Rodriguez, CPA, CFP',
    business_name: 'Rodriguez Financial Advisors',
    phone: '(555) 345-6789',
    location: 'Chicago, IL',
    bio: 'Dual-certified professional offering comprehensive tax planning and financial advisory services.',
    credentials: { certifications: ['CPA', 'CFP', 'PFS'] },
    services: ['Tax Planning', 'Estate Planning', 'Financial Advisory'],
    specializations: ['Tax Planning', 'Estate Planning'],
    pricing: { hourlyRate: 225 },
    years_experience: 18,
    rating: 4.9,
    review_count: 156,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop',
    membership_level: 'Premier Partner'
  },
  {
    id: '4',
    email: 'david.williams@internationaltax.com',
    full_name: 'David Williams, CPA',
    business_name: 'International Tax Specialists',
    phone: '(555) 456-7890',
    location: 'Miami, FL',
    bio: 'International tax expert with extensive experience in cross-border taxation.',
    credentials: { certifications: ['CPA'] },
    services: ['International Tax', 'Expatriate Services', 'FBAR Compliance'],
    specializations: ['International Tax'],
    pricing: { hourlyRate: 200 },
    years_experience: 14,
    rating: 4.7,
    review_count: 84,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    membership_level: 'Professional'
  },
  {
    id: '5',
    email: 'jennifer.martinez@taxhelp.com',
    full_name: 'Jennifer Martinez, EA',
    business_name: 'Martinez Tax Help',
    phone: '(555) 567-8901',
    location: 'Houston, TX',
    bio: 'Enrolled Agent dedicated to helping individuals and families with tax preparation.',
    credentials: { certifications: ['EA'] },
    services: ['Tax Preparation', 'IRS Representation', 'Tax Resolution'],
    specializations: ['Individual Tax Returns'],
    pricing: { hourlyRate: 125 },
    years_experience: 10,
    rating: 4.8,
    review_count: 112,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&h=400&fit=crop',
    membership_level: 'Professional'
  },
  {
    id: '6',
    email: 'robert.thompson@businesstax.com',
    full_name: 'Robert Thompson, CPA, MBA',
    business_name: 'Thompson Business Tax',
    phone: '(555) 678-9012',
    location: 'Seattle, WA',
    bio: 'Business tax specialist focusing on corporate taxation and strategic tax planning.',
    credentials: { certifications: ['CPA', 'MBA'] },
    services: ['Business Tax Returns', 'Corporate Tax Planning'],
    specializations: ['Business Tax Returns'],
    pricing: { hourlyRate: 250 },
    years_experience: 20,
    rating: 4.9,
    review_count: 89,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop',
    membership_level: 'Premier Partner'
  },
  {
    id: '7',
    email: 'amanda.lee@taxconsulting.com',
    full_name: 'Amanda Lee, CPA',
    business_name: 'Lee Tax Consulting',
    phone: '(555) 789-0123',
    location: 'San Francisco, CA',
    bio: 'Tech industry tax specialist helping startups with stock options and equity compensation.',
    credentials: { certifications: ['CPA'] },
    services: ['Tech Tax Planning', 'Stock Option Taxation'],
    specializations: ['Individual Tax Returns'],
    pricing: { hourlyRate: 200 },
    years_experience: 11,
    rating: 4.8,
    review_count: 76,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=400&h=400&fit=crop',
    membership_level: 'Professional'
  },
  {
    id: '8',
    email: 'james.wilson@estatetax.com',
    full_name: 'James Wilson, JD, CPA',
    business_name: 'Wilson Estate Tax Planning',
    phone: '(555) 890-1234',
    location: 'Boston, MA',
    bio: 'Attorney and CPA specializing in estate and trust taxation.',
    credentials: { certifications: ['JD', 'CPA'] },
    services: ['Estate Planning', 'Trust Taxation'],
    specializations: ['Estate Planning'],
    pricing: { hourlyRate: 300 },
    years_experience: 22,
    rating: 5.0,
    review_count: 64,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop',
    membership_level: 'Premier Partner'
  },
  {
    id: '9',
    email: 'lisa.brown@payrolltax.com',
    full_name: 'Lisa Brown, EA',
    business_name: 'Brown Payroll Services',
    phone: '(555) 901-2345',
    location: 'Denver, CO',
    bio: 'Payroll and employment tax specialist helping small to medium businesses.',
    credentials: { certifications: ['EA', 'CPP'] },
    services: ['Payroll Services', 'Employment Tax'],
    specializations: ['Payroll Services'],
    pricing: { hourlyRate: 135 },
    years_experience: 9,
    rating: 4.7,
    review_count: 93,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=400&h=400&fit=crop',
    membership_level: 'Professional'
  },
  {
    id: '10',
    email: 'kevin.patel@realestatetax.com',
    full_name: 'Kevin Patel, CPA',
    business_name: 'Patel Real Estate Tax',
    phone: '(555) 012-3456',
    location: 'Phoenix, AZ',
    bio: 'Real estate tax expert specializing in 1031 exchanges and rental property taxation.',
    credentials: { certifications: ['CPA'] },
    services: ['Real Estate Tax', '1031 Exchanges'],
    specializations: ['Tax Planning'],
    pricing: { hourlyRate: 175 },
    years_experience: 13,
    rating: 4.8,
    review_count: 71,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    membership_level: 'Professional'
  },
  {
    id: '11',
    email: 'maria.garcia@nonprofittax.com',
    full_name: 'Maria Garcia, CPA',
    business_name: 'Garcia Nonprofit Tax Services',
    phone: '(555) 123-4568',
    location: 'Atlanta, GA',
    bio: 'Nonprofit tax specialist with expertise in 501(c)(3) compliance.',
    credentials: { certifications: ['CPA'] },
    services: ['Nonprofit Tax', 'Form 990'],
    specializations: ['Business Tax Returns'],
    pricing: { hourlyRate: 165 },
    years_experience: 16,
    rating: 4.9,
    review_count: 58,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop',
    membership_level: 'Premier Partner'
  },
  {
    id: '12',
    email: 'thomas.anderson@cryptotax.com',
    full_name: 'Thomas Anderson, CPA',
    business_name: 'Anderson Crypto Tax',
    phone: '(555) 234-5679',
    location: 'Austin, TX',
    bio: 'Cryptocurrency and digital asset tax specialist.',
    credentials: { certifications: ['CPA'] },
    services: ['Crypto Tax', 'Digital Asset Reporting'],
    specializations: ['Individual Tax Returns'],
    pricing: { hourlyRate: 185 },
    years_experience: 8,
    rating: 4.7,
    review_count: 45,
    is_published: true,
    approval_status: 'approved',
    profile_image_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
    membership_level: 'Professional'
  }
];

/**
 * US state name -> abbreviation (and vice-versa) lookup used for
 * smart location matching. Tax pros store `state` as an abbreviation
 * (e.g. "MI") but a client might type "Michigan" into the search box.
 */
const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI',
  idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME',
  maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE',
  nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY',
};
const STATE_ABBR_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr.toLowerCase(), name])
);

/**
 * Try to extract city / state abbreviation from a combined "City, ST" string.
 */
function parseLocationString(loc: string): { city?: string; state?: string } {
  if (!loc) return {};
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) {
    // Could be a state name, an abbreviation, or just a city
    const lower = parts[0].toLowerCase();
    if (STATE_NAME_TO_ABBR[lower]) return { state: STATE_NAME_TO_ABBR[lower] };
    if (parts[0].length === 2 && STATE_ABBR_TO_NAME[lower]) return { state: parts[0].toUpperCase() };
    return { city: parts[0] };
  }
  // "Dearborn, MI" or "Dearborn, Michigan"
  const [city, stateRaw, ...rest] = parts;
  const stateLower = stateRaw.toLowerCase();
  let state = stateRaw;
  if (STATE_NAME_TO_ABBR[stateLower]) state = STATE_NAME_TO_ABBR[stateLower];
  else if (stateRaw.length === 2) state = stateRaw.toUpperCase();
  return { city, state };
}

/**
 * Smart location matcher. Returns true when the user's free-text query
 * matches the professional's city, state (abbreviation OR full name),
 * ZIP code, or combined location string.
 *
 * Examples that should all match a pro in Dearborn, MI 48126:
 *   - "Dearborn"
 *   - "MI"
 *   - "Michigan"
 *   - "48126"
 *   - "Dearborn, MI"
 *   - "dearborn mi"
 */
export function matchesLocationQuery(prof: Professional, query: string): boolean {
  const raw = (query || '').trim().toLowerCase();
  if (!raw) return true;

  const city = (prof.city || '').toLowerCase();
  const state = (prof.state || '').toLowerCase();
  const zip = (prof.zip_code || '').toLowerCase();
  const location = (prof.location || '').toLowerCase();

  // Derive city/state from the combined location string when not stored
  // separately (e.g. legacy / sample data).
  let derivedCity = city;
  let derivedState = state;
  if ((!derivedCity || !derivedState) && location) {
    const parsed = parseLocationString(prof.location || '');
    if (!derivedCity && parsed.city) derivedCity = parsed.city.toLowerCase();
    if (!derivedState && parsed.state) derivedState = parsed.state.toLowerCase();
  }

  // Pure-digit query → match against ZIP only
  if (/^\d{3,5}$/.test(raw)) {
    return zip.startsWith(raw);
  }

  // Full state name (e.g. "michigan") → translate to abbreviation
  if (STATE_NAME_TO_ABBR[raw]) {
    const abbr = STATE_NAME_TO_ABBR[raw].toLowerCase();
    return derivedState === abbr || state === abbr || location.includes(`, ${abbr}`);
  }

  // 2-letter state abbreviation
  if (raw.length === 2 && STATE_ABBR_TO_NAME[raw]) {
    return derivedState === raw || state === raw || location.includes(`, ${raw}`);
  }

  // Tokenized contains-match: every whitespace-or-comma separated token
  // must appear somewhere in the searchable haystack.
  const tokens = raw.split(/[\s,]+/).filter(Boolean);
  const haystackParts = [
    city,
    state,
    zip,
    location,
    derivedCity,
    derivedState,
    STATE_ABBR_TO_NAME[derivedState] || '',
    STATE_ABBR_TO_NAME[state] || '',
  ];
  const haystack = haystackParts.filter(Boolean).join(' | ');
  return tokens.every((t) => haystack.includes(t));
}

/** Normalize a Firestore document into a Professional object. */
function normalizeProfessional(id: string, raw: any): Professional {
  const toIso = (v: any) =>
    v instanceof Timestamp ? v.toDate().toISOString() : v || undefined;

  // Build location from city/state if not pre-built
  const location =
    raw.location ||
    [raw.city, raw.state].filter(Boolean).join(', ') ||
    '';

  // If we only have a combined location, try to back-fill city/state
  let city = raw.city || '';
  let state = raw.state || '';
  if ((!city || !state) && location) {
    const parsed = parseLocationString(location);
    if (!city && parsed.city) city = parsed.city;
    if (!state && parsed.state) state = parsed.state;
  }

  return {
    id,
    slug: raw.slug || '',
    email: raw.email || '',
    full_name:
      raw.full_name ||
      [raw.first_name, raw.last_name].filter(Boolean).join(' ') ||
      '',
    business_name: raw.business_name || '',
    phone: raw.phone || '',
    location,
    service_modality: (raw.service_modality as ServiceModality) || 'both',
    service_categories: Array.isArray(raw.service_categories)
      ? raw.service_categories
      : [],
    city,
    state,
    zip_code: raw.zip_code || raw.zipCode || '',
    bio: raw.bio || '',
    credentials: raw.credentials || {},
    services: Array.isArray(raw.services) ? raw.services : [],
    specializations: Array.isArray(raw.specializations) ? raw.specializations : [],
    pricing: raw.pricing || {},
    availability: raw.availability || {},
    years_experience: raw.years_experience || 0,
    rating: typeof raw.rating === 'number' ? raw.rating : 0,
    review_count: typeof raw.review_count === 'number' ? raw.review_count : 0,
    is_published: raw.is_published !== false,
    profile_image_url: raw.profile_image_url || raw.profile_image || '',
    membership_level: raw.membership_level || 'Professional',
    approval_status: raw.approval_status || 'pending',
    approval_notes: raw.approval_notes || '',
    approved_at: toIso(raw.approved_at),
    rejected_at: toIso(raw.rejected_at),
    created_at: toIso(raw.created_at),
    latitude:
      typeof raw.latitude === 'number'
        ? raw.latitude
        : raw.latitude != null
        ? parseFloat(raw.latitude)
        : null,
    longitude:
      typeof raw.longitude === 'number'
        ? raw.longitude
        : raw.longitude != null
        ? parseFloat(raw.longitude)
        : null,
    stripe_account_id: raw.stripe_account_id || null,
    stripe_charges_enabled: !!raw.stripe_charges_enabled,
    stripe_payouts_enabled: !!raw.stripe_payouts_enabled,
    stripe_details_submitted: !!raw.stripe_details_submitted,
  };
}



/**
 * Detect a Firestore permission-denied error and log a clear, actionable
 * message exactly once per page load so the dev console doesn't get flooded.
 */
let warnedAboutPermissions = false;
function isPermissionError(error: any): boolean {
  const code = error?.code || '';
  const msg = String(error?.message || '');
  return (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    msg.includes('Missing or insufficient permissions')
  );
}
function logFirestoreError(context: string, error: any) {
  if (isPermissionError(error)) {
    if (!warnedAboutPermissions) {
      warnedAboutPermissions = true;
      console.warn(
        `[professionalsService] ${context}: Firestore security rules are blocking read access to the "professionals" collection. ` +
          `Falling back to sample data. To fix, publish the rules in FIRESTORE_SECURITY_RULES.md ` +
          `(allow read on /professionals/{id}: if true).`
      );
    }
    return;
  }
  console.error(`[professionalsService] ${context}:`, error);
}

/**
 * Public list — every professional who isn't explicitly rejected.
 *
 * A tax professional should be searchable in the directory as soon as they
 * complete onboarding, so we include both `approved` listings and any docs
 * without an `approval_status` field. We only hide listings that have been
 * explicitly rejected by an admin, or that have been unpublished
 * (`is_published === false`).
 *
 * Falls back to sample data if Firestore is empty or unreachable.
 */
export const getProfessionals = async (): Promise<Professional[]> => {
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    const all = snap.docs.map((d) => normalizeProfessional(d.id, d.data()));
    const visible = all.filter(
      (p) => p.is_published !== false && p.approval_status !== 'rejected'
    );
    if (visible.length === 0) {
      // Merge sample data so the directory never looks empty
      return sampleProfessionals;
    }
    // Merge real Firestore pros first, then sample pros that aren't duplicates by email
    const seenEmails = new Set(
      visible.map((p) => (p.email || '').toLowerCase()).filter(Boolean)
    );
    const extras = sampleProfessionals.filter(
      (p) => !seenEmails.has(p.email.toLowerCase())
    );
    return [...visible, ...extras].sort((a, b) => b.rating - a.rating);
  } catch (error) {
    logFirestoreError('getProfessionals', error);
    return sampleProfessionals;
  }
};


/**
 * Admin list — every professional regardless of approval status.
 */
export const getAllProfessionalsForAdmin = async (): Promise<Professional[]> => {
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs
      .map((d) => normalizeProfessional(d.id, d.data()))
      .sort((a, b) => {
        // Pending first, then approved, then rejected
        const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
        const ao = order[a.approval_status || 'pending'] ?? 0;
        const bo = order[b.approval_status || 'pending'] ?? 0;
        if (ao !== bo) return ao - bo;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  } catch (error) {
    logFirestoreError('getAllProfessionalsForAdmin', error);
    return [];
  }
};


export const getProfessionalById = async (id: string): Promise<Professional | null> => {
  try {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return normalizeProfessional(snap.id, snap.data());
    }
    // Fall back to sample data
    const samplePro = sampleProfessionals.find((p) => p.id === id);
    return samplePro || null;
  } catch (error) {
    console.error('Error fetching professional by id:', error);
    const samplePro = sampleProfessionals.find((p) => p.id === id);
    return samplePro || null;
  }
};

export const getProfessionalByEmail = async (
  email: string
): Promise<Professional | null> => {
  try {
    const q = query(collection(db, COLLECTION), where('email', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return normalizeProfessional(d.id, d.data());
    }
    const samplePro = sampleProfessionals.find((p) => p.email === email);
    return samplePro || null;
  } catch (error) {
    console.error('Error fetching professional by email:', error);
    const samplePro = sampleProfessionals.find((p) => p.email === email);
    return samplePro || null;
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Slug-based landing pages (`/preparer/{slug}`)
// ────────────────────────────────────────────────────────────────────────────

/** Look up a professional by their human-readable slug. */
export const getProfessionalBySlug = async (
  slug: string
): Promise<Professional | null> => {
  const clean = (slug || '').trim().toLowerCase();
  if (!clean) return null;
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('slug', '==', clean), fsLimit(1))
    );
    if (!snap.empty) {
      const d = snap.docs[0];
      return normalizeProfessional(d.id, d.data());
    }
  } catch (error) {
    console.warn('[professionalsService] getProfessionalBySlug failed:', error);
  }
  // Fall back to sample data (lets demo profiles resolve by slug too).
  const sample = sampleProfessionals.find((p) => slugify(p.full_name) === clean);
  return sample || null;
};

/**
 * True when `slug` is already taken by a DIFFERENT professional. Used to
 * guarantee uniqueness before assigning a slug.
 */
async function slugTaken(slug: string, excludeUid?: string): Promise<boolean> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('slug', '==', slug), fsLimit(2))
    );
    return snap.docs.some((d) => d.id !== excludeUid);
  } catch (error) {
    console.warn('[professionalsService] slugTaken check failed:', error);
    // On a read failure, assume not taken so registration isn't blocked; a
    // collision is extremely unlikely and the directory still works by uid.
    return false;
  }
}

/**
 * Generate a unique slug from a display name. Tries the bare slug first
 * ("john-smith"), then numeric suffixes ("john-smith-2", "-3", …). Falls back
 * to appending a short uid fragment if every candidate is somehow taken.
 */
export async function generateUniqueSlug(
  name: string,
  uid?: string
): Promise<string> {
  const base = slugify(name || '') || 'preparer';
  if (!(await slugTaken(base, uid))) return base;
  for (let i = 2; i <= 9; i += 1) {
    const candidate = `${base}-${i}`;
    if (!(await slugTaken(candidate, uid))) return candidate;
  }
  const suffix = (uid || Math.random().toString(36).slice(2)).slice(0, 6).toLowerCase();
  return `${base}-${suffix}`;
}

/**
 * Backfill a slug onto an existing professional doc that predates the slug
 * feature. Safe to call repeatedly — only writes when the slug is missing.
 * Returns the resolved slug (existing or newly generated).
 */
export async function ensureProfessionalSlug(
  uid: string,
  name?: string
): Promise<string | null> {
  if (!db || !uid) return null;
  try {
    const ref = doc(db, COLLECTION, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    if (data.slug) return data.slug;
    const slug = await generateUniqueSlug(name || data.full_name || data.email || 'preparer', uid);
    await updateDoc(ref, { slug, updated_at: serverTimestamp() });
    return slug;
  } catch (error) {
    console.warn('[professionalsService] ensureProfessionalSlug failed:', error);
    return null;
  }
}

/**
 * LAUNCH-CRITICAL: create a free **Directory Listing** profile the moment a
 * professional registers, so they instantly have a shareable landing page.
 * Onboarding later enriches this same doc. Idempotent — if a doc already
 * exists for the uid it is left intact (only a missing slug is backfilled).
 *
 * Returns the resolved slug so the caller can show the shareable URL.
 */
export async function createProfessionalListing(input: {
  uid: string;
  name: string;
  email: string;
}): Promise<{ slug: string } | null> {
  if (!db) return null;
  if (!input.uid) throw new Error('createProfessionalListing requires a uid.');

  const ref = doc(db, COLLECTION, input.uid);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      // Already onboarding/registered — just make sure it has a slug.
      const slug = await ensureProfessionalSlug(input.uid, input.name);
      return { slug: slug || '' };
    }

    const slug = await generateUniqueSlug(input.name || input.email, input.uid);

    await setDoc(
      ref,
      {
        slug,
        email: input.email || '',
        full_name: input.name || '',
        bio: '',
        services: [],
        specializations: [],
        service_categories: [],
        service_modality: 'both' as ServiceModality,
        years_experience: 0,
        rating: 0,
        review_count: 0,
        // Free directory listing is live + searchable immediately (locked
        // roadmap decision). Onboarding enriches it; admin can still moderate.
        is_published: true,
        approval_status: 'approved',
        membership_level: 'Directory Listing',
        onboarding_completed: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    return { slug };
  } catch (error) {
    console.warn('[professionalsService] createProfessionalListing failed:', error);
    return null;
  }
}

export const searchProfessionals = async (
  searchTerm: string
): Promise<Professional[]> => {
  const all = await getProfessionals();
  if (!searchTerm) return all;
  const term = searchTerm.toLowerCase();
  return all.filter(
    (prof) =>
      prof.full_name.toLowerCase().includes(term) ||
      prof.business_name?.toLowerCase().includes(term) ||
      prof.bio.toLowerCase().includes(term) ||
      prof.location.toLowerCase().includes(term) ||
      prof.specializations?.some((s) => s.toLowerCase().includes(term)) ||
      prof.services?.some((s) => s.toLowerCase().includes(term)) ||
      matchesLocationQuery(prof, searchTerm)
  );
};


/**
 * Approve a professional listing (admin action). Marks them as approved + published.
 */
export const approveProfessional = async (
  id: string,
  notes?: string
): Promise<void> => {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    approval_status: 'approved',
    approval_notes: notes || '',
    is_published: true,
    approved_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
};

/**
 * Reject a professional listing (admin action). Hides them from the directory.
 */
export const rejectProfessional = async (
  id: string,
  notes?: string
): Promise<void> => {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    approval_status: 'rejected',
    approval_notes: notes || '',
    is_published: false,
    rejected_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
};

/**
 * Toggle whether a (already-approved) professional is publicly listed.
 */
export const setProfessionalPublished = async (
  id: string,
  isPublished: boolean
): Promise<void> => {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    is_published: isPublished,
    updated_at: serverTimestamp(),
  });
};

// Export sample data for use in other components
export { sampleProfessionals };
