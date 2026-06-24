import React from 'react';

interface PressLogo {
  name: string;
  src: string;
}

// Industry partners, certifications, and press affiliations. Logos use
// placeholder URLs (placehold.co) and can be swapped for real brand assets
// later without changing layout.
const LOGOS: PressLogo[] = [
  {
    name: 'IRS e-file Authorized Provider',
    src: 'https://placehold.co/200x80/1e3a8a/ffffff?text=IRS+e-file',
  },
  {
    name: 'NATP — National Association of Tax Professionals',
    src: 'https://placehold.co/200x80/0f766e/ffffff?text=NATP',
  },
  {
    name: 'NAEA — National Association of Enrolled Agents',
    src: 'https://placehold.co/200x80/7c2d12/ffffff?text=NAEA',
  },
  {
    name: 'EFIN Certified',
    src: 'https://placehold.co/200x80/1e293b/ffffff?text=EFIN',
  },
  {
    name: 'Bank Products Partner',
    src: 'https://placehold.co/200x80/4338ca/ffffff?text=Bank+Products',
  },
  {
    name: 'CTEC Approved',
    src: 'https://placehold.co/200x80/0369a1/ffffff?text=CTEC',
  },
  {
    name: 'Accounting Today',
    src: 'https://placehold.co/200x80/52525b/ffffff?text=Accounting+Today',
  },
  {
    name: 'Drake Software Partner',
    src: 'https://placehold.co/200x80/166534/ffffff?text=Drake+Partner',
  },
];

const LogoItem: React.FC<{ logo: PressLogo }> = ({ logo }) => (
  <div
    className="flex-shrink-0 mx-6 lg:mx-0 flex items-center justify-center h-16 lg:h-20"
    title={logo.name}
  >
    <img
      src={logo.src}
      alt={logo.name}
      className="max-h-12 lg:max-h-14 w-auto object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
      loading="lazy"
    />
  </div>
);

const PressStrip: React.FC = () => {
  return (
    <section
      className="bg-white border-b border-slate-200 py-10"
      aria-labelledby="press-strip-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2
          id="press-strip-heading"
          className="text-center text-xs sm:text-sm font-semibold tracking-widest uppercase text-slate-500 mb-6"
        >
          As Seen In &amp; Trusted By
        </h2>

        {/* Marquee on mobile/tablet */}
        <div className="lg:hidden relative overflow-hidden">
          {/* edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent z-10" />

          <div className="flex w-max animate-press-marquee">
            {/* Duplicate the list so the loop is seamless */}
            {[...LOGOS, ...LOGOS].map((logo, idx) => (
              <LogoItem key={`${logo.name}-${idx}`} logo={logo} />
            ))}
          </div>
        </div>

        {/* Static evenly-spaced row on desktop */}
        <div className="hidden lg:grid grid-cols-4 xl:grid-cols-8 gap-6 items-center">
          {LOGOS.map((logo) => (
            <LogoItem key={logo.name} logo={logo} />
          ))}
        </div>
      </div>

      {/* Keyframes for the mobile marquee. Scoped via a unique class name. */}
      <style>{`
        @keyframes press-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-press-marquee {
          animation: press-marquee 30s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-press-marquee { animation: none; }
        }
      `}</style>
    </section>
  );
};

export default PressStrip;
