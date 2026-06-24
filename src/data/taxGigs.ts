// Sample gig marketplace data — Fiverr-style tiered tax service packages.
// Each gig has Basic / Standard / Premium tiers with deliverables & turnaround.

export interface GigTier {
  name: 'Basic' | 'Standard' | 'Premium';
  price: number;
  deliveryDays: number;
  revisions: number | 'Unlimited';
  features: string[];
  description: string;
}

export interface TaxGig {
  id: string;
  slug: string;
  title: string;
  category: 'individual' | 'business' | 'specialty' | 'audit' | 'planning' | 'crypto';
  proId: string;
  proName: string;
  proTitle: string;
  proAvatar: string;
  proBadge: 'Verified Pro' | 'Premium Partner' | 'Top Rated' | 'New & Noted';
  responseTime: string; // e.g. "Responds in 1 hr"
  rating: number;
  reviewCount: number;
  ordersInQueue: number;
  filedThisSeason: number;
  image: string;
  shortDescription: string;
  tags: string[];
  tiers: GigTier[];
  availableNow: boolean;
}

const stockImages = [
  'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1778859891827_b72c9aac.jpg',
  'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1778859896656_0d141524.png',
  'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1778859897033_3f70ca25.png',
  'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1778859899492_443a90a3.png',
  'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1778859898857_99086912.png',
  'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1778859899220_ff2ab7ad.png',
];

const avatarSeed = (name: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=3b82f6,8b5cf6,06b6d4,10b981,f59e0b`;

export const taxGigs: TaxGig[] = [
  {
    id: 'gig-1', slug: 'simple-1040-w2-filing',
    title: 'I will file your simple 1040 W-2 tax return accurately',
    category: 'individual', proId: 'p1',
    proName: 'Sarah Chen, CPA', proTitle: 'Certified Public Accountant',
    proAvatar: avatarSeed('Sarah Chen'),
    proBadge: 'Top Rated', responseTime: 'Responds in 1 hr',
    rating: 4.9, reviewCount: 847, ordersInQueue: 3, filedThisSeason: 412,
    image: stockImages[0],
    shortDescription: 'Fast, accurate W-2 return filing with maximum standard refund. Perfect for employees with straightforward returns.',
    tags: ['W-2', '1040', 'Single State', 'E-File'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 89, deliveryDays: 3, revisions: 1, description: 'Federal + 1 state W-2 return',
        features: ['Federal 1040 prep', '1 state return', 'Standard deduction', 'E-file included', 'PDF copy'] },
      { name: 'Standard', price: 149, deliveryDays: 2, revisions: 2, description: 'Add itemized deductions & dependents',
        features: ['Everything in Basic', 'Itemized deductions', 'Up to 3 dependents', 'HSA / education credits', 'Audit-risk check'] },
      { name: 'Premium', price: 249, deliveryDays: 1, revisions: 'Unlimited', description: 'Rush filing + 30-min strategy call',
        features: ['Everything in Standard', '24-hour rush', '30-min strategy call', 'Multi-state (up to 3)', 'Next-year tax plan', 'Priority support'] },
    ],
  },
  {
    id: 'gig-2', slug: 'self-employed-schedule-c',
    title: 'I will prepare your self-employed Schedule C return',
    category: 'business', proId: 'p2',
    proName: 'Marcus Johnson, EA', proTitle: 'Enrolled Agent',
    proAvatar: avatarSeed('Marcus Johnson'),
    proBadge: 'Premium Partner', responseTime: 'Responds in 30 min',
    rating: 5.0, reviewCount: 521, ordersInQueue: 5, filedThisSeason: 287,
    image: stockImages[1],
    shortDescription: 'Maximize deductions for freelancers, contractors, gig workers, and side-hustles. QBI & home office covered.',
    tags: ['1099', 'Schedule C', 'Self-Employed', 'QBI'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 249, deliveryDays: 5, revisions: 1, description: 'Single 1099 / Schedule C',
        features: ['Schedule C prep', 'Up to $50k revenue', 'Standard deductions', 'SE tax calc', 'E-file'] },
      { name: 'Standard', price: 449, deliveryDays: 3, revisions: 2, description: 'Multi-1099 + home office + mileage',
        features: ['Everything in Basic', 'Up to $250k revenue', 'Home office deduction', 'Mileage / vehicle', 'QBI deduction', 'Quarterly est. plan'] },
      { name: 'Premium', price: 749, deliveryDays: 2, revisions: 'Unlimited', description: 'LLC / S-Corp election advice + 1-hr call',
        features: ['Everything in Standard', 'Unlimited revenue', '1-hour strategy call', 'S-Corp election advice', 'Bookkeeping cleanup', 'Quarterly check-ins (1 yr)'] },
    ],
  },
  {
    id: 'gig-3', slug: 'rental-property-schedule-e',
    title: 'I will file Schedule E for your rental property income',
    category: 'specialty', proId: 'p3',
    proName: 'Priya Patel, CPA', proTitle: 'Real Estate Tax Specialist',
    proAvatar: avatarSeed('Priya Patel'),
    proBadge: 'Verified Pro', responseTime: 'Responds in 2 hrs',
    rating: 4.8, reviewCount: 312, ordersInQueue: 2, filedThisSeason: 156,
    image: stockImages[2],
    shortDescription: 'Schedule E expert for landlords. Depreciation, passive loss rules, & 1031 strategy guidance.',
    tags: ['Schedule E', 'Rental', 'Depreciation', '1031'],
    availableNow: false,
    tiers: [
      { name: 'Basic', price: 199, deliveryDays: 5, revisions: 1, description: '1 rental property',
        features: ['Schedule E prep', '1 rental unit', 'Depreciation schedule', 'Federal + 1 state', 'E-file'] },
      { name: 'Standard', price: 399, deliveryDays: 4, revisions: 2, description: 'Up to 3 properties',
        features: ['Up to 3 rentals', 'Passive loss analysis', 'Cost segregation tip sheet', 'Multi-state', 'Audit-risk check'] },
      { name: 'Premium', price: 699, deliveryDays: 3, revisions: 'Unlimited', description: 'Portfolio + 1031 strategy call',
        features: ['Unlimited properties', '1-hour 1031 strategy call', 'Entity structure review', 'Year-end planning', 'Priority support'] },
    ],
  },
  {
    id: 'gig-4', slug: 'crypto-trader-tax-return',
    title: 'I will reconcile your crypto trades and file your return',
    category: 'crypto', proId: 'p4',
    proName: 'Diego Ramirez, CPA', proTitle: 'Crypto & Web3 Tax Pro',
    proAvatar: avatarSeed('Diego Ramirez'),
    proBadge: 'Top Rated', responseTime: 'Responds in 1 hr',
    rating: 4.9, reviewCount: 198, ordersInQueue: 4, filedThisSeason: 89,
    image: stockImages[3],
    shortDescription: 'Coinbase, Binance, MetaMask, DeFi — I reconcile it all and produce Form 8949 + Schedule D.',
    tags: ['Crypto', 'Form 8949', 'DeFi', 'NFT'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 299, deliveryDays: 4, revisions: 1, description: 'Up to 250 transactions',
        features: ['Up to 250 txns', 'Form 8949 + Schedule D', 'CSV import (Coinbase, Kraken)', 'Federal return', 'E-file'] },
      { name: 'Standard', price: 549, deliveryDays: 3, revisions: 2, description: 'Up to 2,500 txns + DeFi',
        features: ['Up to 2,500 txns', 'DeFi & staking income', 'NFT sales', 'Multi-wallet reconciliation', 'Cost basis cleanup'] },
      { name: 'Premium', price: 999, deliveryDays: 2, revisions: 'Unlimited', description: 'High-volume traders + audit support',
        features: ['Unlimited txns', '1-hour planning call', 'Wash-sale & loss harvest plan', 'IRS audit letter support', 'Quarterly est. payments'] },
    ],
  },
  {
    id: 'gig-5', slug: 'small-business-llc-return',
    title: 'I will prepare your LLC partnership or S-Corp return',
    category: 'business', proId: 'p5',
    proName: 'Aisha Williams, CPA', proTitle: 'Small Business Specialist',
    proAvatar: avatarSeed('Aisha Williams'),
    proBadge: 'Premium Partner', responseTime: 'Responds in 45 min',
    rating: 5.0, reviewCount: 634, ordersInQueue: 6, filedThisSeason: 218,
    image: stockImages[4],
    shortDescription: 'Form 1065 (Partnership) or 1120-S (S-Corp) prep with K-1s for all owners.',
    tags: ['1065', '1120-S', 'K-1', 'LLC'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 599, deliveryDays: 7, revisions: 1, description: 'Single-member LLC / 1120-S',
        features: ['1065 or 1120-S prep', 'Up to 2 owners', 'K-1 distribution', 'Federal + 1 state', 'E-file'] },
      { name: 'Standard', price: 1099, deliveryDays: 5, revisions: 2, description: 'Multi-owner + state nexus',
        features: ['Up to 10 owners', 'Multi-state nexus', 'Depreciation schedules', 'QBI optimization', 'Owner planning call'] },
      { name: 'Premium', price: 1899, deliveryDays: 4, revisions: 'Unlimited', description: 'Full advisory + quarterly reviews',
        features: ['Unlimited owners', 'Quarterly reviews (1 yr)', 'Reasonable comp analysis', 'Multi-entity strategy', 'Priority audit support'] },
    ],
  },
  {
    id: 'gig-6', slug: 'irs-audit-representation',
    title: 'I will represent you in an IRS audit or notice response',
    category: 'audit', proId: 'p6',
    proName: 'Robert Kim, JD', proTitle: 'Tax Attorney',
    proAvatar: avatarSeed('Robert Kim'),
    proBadge: 'Premium Partner', responseTime: 'Responds in 2 hrs',
    rating: 4.9, reviewCount: 89, ordersInQueue: 2, filedThisSeason: 34,
    image: stockImages[5],
    shortDescription: 'Got an IRS letter? I handle CP2000, audits, and tax court. 20+ years experience.',
    tags: ['Audit', 'CP2000', 'Tax Court', 'Representation'],
    availableNow: false,
    tiers: [
      { name: 'Basic', price: 499, deliveryDays: 5, revisions: 1, description: 'CP2000 / notice response letter',
        features: ['1 notice response', 'Document review', 'Draft response letter', '15-min call', 'Filing support'] },
      { name: 'Standard', price: 1499, deliveryDays: 10, revisions: 2, description: 'Correspondence audit representation',
        features: ['Full audit rep', 'POA filing', 'Document gathering', 'IRS negotiation', 'Up to 3 calls'] },
      { name: 'Premium', price: 4999, deliveryDays: 30, revisions: 'Unlimited', description: 'Field audit / appeals / tax court',
        features: ['Full field audit defense', 'Appeals representation', 'Tax court filing', 'Unlimited calls', 'Settlement negotiation'] },
    ],
  },
  {
    id: 'gig-7', slug: 'year-end-tax-planning',
    title: 'I will create your personalized year-end tax savings plan',
    category: 'planning', proId: 'p7',
    proName: 'Olivia Martinez, CPA', proTitle: 'Tax Planning Strategist',
    proAvatar: avatarSeed('Olivia Martinez'),
    proBadge: 'Top Rated', responseTime: 'Responds in 1 hr',
    rating: 4.8, reviewCount: 276, ordersInQueue: 3, filedThisSeason: 142,
    image: stockImages[0],
    shortDescription: 'Proactive tax planning to legally minimize your bill. Retirement, gifting, and entity strategy.',
    tags: ['Planning', 'Retirement', 'Strategy', 'Estate'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 199, deliveryDays: 5, revisions: 1, description: '30-min plan + checklist',
        features: ['30-min discovery call', 'Custom action checklist', 'Top 5 savings ideas', 'Tax projection', 'PDF report'] },
      { name: 'Standard', price: 449, deliveryDays: 7, revisions: 2, description: 'Full plan + 2 calls',
        features: ['Full written plan', '2x 45-min calls', 'Retirement contribution strategy', 'Roth conversion analysis', 'Charitable giving plan'] },
      { name: 'Premium', price: 999, deliveryDays: 14, revisions: 'Unlimited', description: 'Multi-year strategy + quarterly check-ins',
        features: ['3-year strategy', 'Quarterly check-ins', 'Entity structure review', 'Estate planning intro', 'Implementation support'] },
    ],
  },
  {
    id: 'gig-8', slug: 'prior-year-back-taxes',
    title: 'I will catch you up on unfiled back tax returns',
    category: 'individual', proId: 'p8',
    proName: 'James OConnor, EA', proTitle: 'IRS Resolution Specialist',
    proAvatar: avatarSeed('James OConnor'),
    proBadge: 'Verified Pro', responseTime: 'Responds in 3 hrs',
    rating: 4.7, reviewCount: 412, ordersInQueue: 4, filedThisSeason: 178,
    image: stockImages[1],
    shortDescription: 'Behind on filings? I prepare prior-year returns and negotiate penalty abatement with the IRS.',
    tags: ['Back Taxes', 'Prior Year', 'Penalty Abatement', 'IRS'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 179, deliveryDays: 7, revisions: 1, description: 'Per prior-year return',
        features: ['One prior-year 1040', 'Federal + 1 state', 'Wage transcript pull', 'Reasonable deductions', 'E-file or paper'] },
      { name: 'Standard', price: 599, deliveryDays: 14, revisions: 2, description: 'Up to 3 years caught up',
        features: ['Up to 3 prior years', 'IRS transcript analysis', 'Penalty abatement request', 'Payment plan setup', 'Status monitoring'] },
      { name: 'Premium', price: 1499, deliveryDays: 21, revisions: 'Unlimited', description: 'Full IRS resolution + Offer in Compromise',
        features: ['Up to 6 prior years', 'Offer in Compromise eval', 'Currently Not Collectible filing', 'Levy / lien negotiation', 'Power of Attorney rep'] },
    ],
  },
  {
    id: 'gig-9', slug: 'expat-international-tax',
    title: 'I will file your US expat tax return with FBAR and 8938',
    category: 'specialty', proId: 'p9',
    proName: 'Yuki Tanaka, CPA', proTitle: 'International Tax CPA',
    proAvatar: avatarSeed('Yuki Tanaka'),
    proBadge: 'Premium Partner', responseTime: 'Responds in 4 hrs',
    rating: 4.9, reviewCount: 167, ordersInQueue: 2, filedThisSeason: 73,
    image: stockImages[2],
    shortDescription: 'US citizens abroad: I handle FEIE, foreign tax credit, FBAR, Form 8938, and streamlined filing.',
    tags: ['Expat', 'FBAR', 'FEIE', 'Form 8938'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 399, deliveryDays: 7, revisions: 1, description: 'Simple expat 1040 + FEIE',
        features: ['Form 1040 + 2555 (FEIE)', '1 foreign country', 'FBAR if needed', 'Federal e-file', 'Email support'] },
      { name: 'Standard', price: 799, deliveryDays: 10, revisions: 2, description: 'Multi-country + foreign tax credit',
        features: ['Form 1116 (FTC)', 'Multi-country income', 'Form 8938 (FATCA)', 'State return if needed', '30-min call'] },
      { name: 'Premium', price: 1799, deliveryDays: 14, revisions: 'Unlimited', description: 'Streamlined filing + foreign corp',
        features: ['Streamlined catch-up (3 yrs)', 'Form 5471 / 8865', 'PFIC analysis', '1-hour planning call', 'Year-round support'] },
    ],
  },
  {
    id: 'gig-10', slug: 'estate-trust-1041',
    title: 'I will prepare your estate or trust Form 1041 return',
    category: 'specialty', proId: 'p10',
    proName: 'Margaret Foster, CPA', proTitle: 'Estate & Trust Tax CPA',
    proAvatar: avatarSeed('Margaret Foster'),
    proBadge: 'Verified Pro', responseTime: 'Responds in 5 hrs',
    rating: 4.8, reviewCount: 94, ordersInQueue: 1, filedThisSeason: 41,
    image: stockImages[3],
    shortDescription: 'Trustee or executor? I prepare 1041s, K-1s for beneficiaries, and final estate returns.',
    tags: ['1041', 'Trust', 'Estate', 'K-1'],
    availableNow: false,
    tiers: [
      { name: 'Basic', price: 449, deliveryDays: 10, revisions: 1, description: 'Simple trust return',
        features: ['Form 1041', 'Up to 3 beneficiaries', 'K-1 distribution', 'Federal + 1 state', 'E-file'] },
      { name: 'Standard', price: 899, deliveryDays: 14, revisions: 2, description: 'Complex trust / estate',
        features: ['Up to 10 beneficiaries', 'Multiple income streams', 'Capital gains allocation', 'Multi-state', 'Trustee consult'] },
      { name: 'Premium', price: 1899, deliveryDays: 21, revisions: 'Unlimited', description: 'Estate admin + final return',
        features: ['Final 1040 + 1041', 'Estate admin support', 'Form 706 (estate tax) eval', 'Beneficiary calls included', 'Year-end distribution plan'] },
    ],
  },
  {
    id: 'gig-11', slug: 'quarterly-estimated-taxes',
    title: 'I will calculate and set up your quarterly estimated taxes',
    category: 'planning', proId: 'p11',
    proName: 'Tony Russo, EA', proTitle: 'Small Biz & Freelancer EA',
    proAvatar: avatarSeed('Tony Russo'),
    proBadge: 'New & Noted', responseTime: 'Responds in 1 hr',
    rating: 4.9, reviewCount: 47, ordersInQueue: 3, filedThisSeason: 28,
    image: stockImages[4],
    shortDescription: 'Avoid underpayment penalties. I calculate Q1-Q4 estimates and set up IRS Direct Pay.',
    tags: ['1040-ES', 'Estimates', 'Quarterly', 'Freelance'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 99, deliveryDays: 2, revisions: 1, description: 'One-quarter calc',
        features: ['Single quarter estimate', 'Federal only', 'Voucher / EFTPS setup', 'Email summary'] },
      { name: 'Standard', price: 249, deliveryDays: 3, revisions: 2, description: 'Full-year Q1-Q4 plan',
        features: ['All 4 quarters', 'Federal + state', 'Auto-pay setup help', 'Income re-projection', 'Mid-year check-in'] },
      { name: 'Premium', price: 599, deliveryDays: 5, revisions: 'Unlimited', description: 'Year-long advisory subscription',
        features: ['Quarterly recalc all year', 'Real-time income tracking', 'Tax-saving alerts', 'Year-end true-up', 'Priority email/chat'] },
    ],
  },
  {
    id: 'gig-12', slug: 'amended-return-1040x',
    title: 'I will file an amended return (1040-X) to recover missed refunds',
    category: 'individual', proId: 'p12',
    proName: 'Linda Park, CPA', proTitle: 'Refund Recovery Specialist',
    proAvatar: avatarSeed('Linda Park'),
    proBadge: 'Top Rated', responseTime: 'Responds in 2 hrs',
    rating: 4.8, reviewCount: 213, ordersInQueue: 2, filedThisSeason: 87,
    image: stockImages[5],
    shortDescription: 'Forgot a deduction or credit? I amend prior returns up to 3 years back to claim missed refunds.',
    tags: ['1040-X', 'Amended', 'Refund', 'Prior Year'],
    availableNow: true,
    tiers: [
      { name: 'Basic', price: 159, deliveryDays: 4, revisions: 1, description: '1 amended return',
        features: ['Single 1040-X', 'Federal + 1 state', 'Refund eligibility check', 'E-file (post-2019)', 'Status tracking'] },
      { name: 'Standard', price: 299, deliveryDays: 5, revisions: 2, description: 'Multi-year amendments',
        features: ['Up to 3 amended years', 'Multi-state amendments', 'Documentation prep', 'IRS correspondence', '15-min call'] },
      { name: 'Premium', price: 599, deliveryDays: 7, revisions: 'Unlimited', description: 'Complex amendments + audit-proof packet',
        features: ['Unlimited amendments', 'Audit-proof documentation', 'IRS POA filing', 'Full-year support', 'Refund max strategy'] },
    ],
  },
];

export const gigCategories = [
  { id: 'all', label: 'All Services', emoji: null },
  { id: 'individual', label: 'Individual Returns' },
  { id: 'business', label: 'Business & Self-Employed' },
  { id: 'specialty', label: 'Specialty Returns' },
  { id: 'planning', label: 'Tax Planning' },
  { id: 'audit', label: 'Audit & Resolution' },
  { id: 'crypto', label: 'Crypto & Investments' },
];
