import React from 'react';
import AppLayout from '@/components/AppLayout';
import PressStrip from '@/components/about/PressStrip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  Target,
  Wrench,
  TrendingUp,
  GraduationCap,
  LineChart,
  Megaphone,
  Briefcase,
  HeartHandshake,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

// Enhanced event photos provided by the client. These versions are fully branded
// with the official Refund Connect identity, so no blur overlays are needed.
const PHOTOS = [
  {
    src: 'https://d64gsuwffb70l.cloudfront.net/68a37e37fed4ba77da23cd1a_1779988592622_dd1d115a.png',
    alt: 'Refund Connect training event with engaged tax professionals',
  },
  {
    src: 'https://d64gsuwffb70l.cloudfront.net/68a37e37fed4ba77da23cd1a_1779988594305_f66a891c.png',
    alt: 'Refund Connect leader presenting at a live training session',
  },
  {
    src: 'https://d64gsuwffb70l.cloudfront.net/68a37e37fed4ba77da23cd1a_1779988595630_922c29c3.png',
    alt: 'Packed room of tax preparers at a Refund Connect onboarding event',
  },
];


const STATS = [
  { value: '20+', label: 'Years in the tax industry', icon: Briefcase },
  { value: '60+', label: 'Retail tax offices operated', icon: Building2 },
  { value: '1,600+', label: 'Tax preparers trained & supported', icon: Users },
  { value: '2003', label: 'Operating since', icon: TrendingUp },
];

const OFFERINGS = [
  {
    icon: Wrench,
    title: 'Professional Tax Software',
    description: 'Enterprise-grade tax software and technology built for high-volume offices.',
  },
  {
    icon: Megaphone,
    title: 'Marketing & Client Acquisition',
    description: 'Proven marketing tools and strategies to fill your pipeline every season.',
  },
  {
    icon: GraduationCap,
    title: 'Training & Onboarding',
    description: 'Structured preparer training and onboarding support for new and seasoned teams.',
  },
  {
    icon: HeartHandshake,
    title: 'Mentorship & Guidance',
    description: 'Ongoing operational guidance from leaders who have run real tax offices.',
  },
  {
    icon: LineChart,
    title: 'Bank Products & Revenue',
    description: 'Bank product integration and additional revenue opportunities baked in.',
  },
  {
    icon: Briefcase,
    title: 'CRM & Business Tools',
    description: 'CRM systems and business management tools to run a tighter operation.',
  },
];

const GROWTH_PATHS = [
  'Starting your first tax business',
  'Operating as an independent tax preparer',
  'Managing a growing office',
  'Expanding into a service bureau model',
];

const About: React.FC = () => {
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-medium mb-6">
                About Refund Connect
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                More than software — a complete tax business support network.
              </h1>
              <p className="text-lg sm:text-xl text-blue-100 mb-8 leading-relaxed">
                Refund Connect is built by experienced industry professionals who have operated,
                managed, and scaled real tax offices for over two decades. We provide independent
                preparers, office owners, and growing service bureaus with the tools, training,
                infrastructure, and support that have powered one of the industry's
                top-performing tax networks for more than a decade.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-500">
                  <Link to="/join-platform">
                    Join the Network <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Link to="/how-it-works">How It Works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Press / Trust Strip */}
        <PressStrip />


        {/* Stats */}
        <section className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100"
                  >
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white mb-3">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold text-slate-900">
                      {stat.value}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Photo Gallery */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                Built by Real Operators
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Our leadership has trained and supported thousands of tax professionals across the
                country at live events, onboarding sessions, and ongoing in-season support.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PHOTOS.map((photo) => (
                <div
                  key={photo.src}
                  className="relative overflow-hidden rounded-2xl shadow-lg group bg-slate-200"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="w-full h-64 object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}

            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white">
              <CardContent className="p-10 lg:p-14">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-white/15 rounded-xl mr-4">
                    <Target className="h-7 w-7" />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold">Our Mission</h2>
                </div>
                <p className="text-xl text-blue-50 leading-relaxed mb-4">
                  To empower tax professionals and entrepreneurs with the tools, training,
                  technology, and support needed to build successful and profitable tax businesses.
                </p>
                <p className="text-lg text-blue-100 leading-relaxed">
                  Success in the tax industry requires far more than software alone. It requires
                  ongoing education, marketing support, operational systems, industry knowledge,
                  responsive leadership, and a network that is truly invested in your growth.
                  That is exactly what Refund Connect was built to provide.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* What Makes Us Different */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                What Makes Refund Connect Different
              </h2>
              <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                Unlike traditional software providers, we're built by real operators with
                extensive experience running high-volume tax offices. We understand the
                challenges tax professionals face — because we've lived them.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {OFFERINGS.map((offering) => {
                const Icon = offering.icon;
                return (
                  <Card
                    key={offering.title}
                    className="border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-white"
                  >
                    <CardContent className="p-6">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 text-blue-700 mb-4">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {offering.title}
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {offering.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Built for Growth */}
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                  Built for Growth
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                  Wherever you are in your tax business journey, we meet you there.
                </h2>
                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  Refund Connect provides the infrastructure and support needed to help you grow
                  with confidence. We're committed to building long-term partnerships and creating
                  opportunities for tax professionals nationwide to succeed in an increasingly
                  competitive industry.
                </p>
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <Link to="/join-platform">
                    Become a Partner <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="space-y-4">
                {GROWTH_PATHS.map((path) => (
                  <div
                    key={path}
                    className="flex items-start p-5 bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl border border-blue-100"
                  >
                    <CheckCircle2 className="h-6 w-6 text-blue-600 mr-4 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-800 font-medium">{path}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Join the Refund Connect Network
            </h2>
            <p className="text-lg sm:text-xl text-blue-100 mb-8 leading-relaxed">
              At Refund Connect, our success is built on the success of the professionals within
              our network. We're proud to support the next generation of tax entrepreneurs with
              the systems, support, and experience needed to build lasting businesses.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-500">
                <Link to="/join-platform">
                  Apply to Join <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Link to="/support">Talk to Our Team</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default About;
