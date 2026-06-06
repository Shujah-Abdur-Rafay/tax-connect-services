import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Gift, GraduationCap, Shield, Star, ArrowRight } from 'lucide-react';

const MemberPortal: React.FC = () => {
  const redirect = () => {
    window.location.href = '/onboarding';
  };

  const benefits = [
    {
      icon: BookOpen,
      title: 'Tax Resource Library',
      description: 'Access comprehensive tax guides, forms, and educational materials',
      color: 'text-blue-600 bg-blue-100'
    },
    {
      icon: Users,
      title: 'Professional Network',
      description: 'Connect with certified tax professionals and industry experts',
      color: 'text-green-600 bg-green-100'
    },
    {
      icon: Gift,
      title: 'Exclusive Member Offers',
      description: 'Special discounts on tax services and professional consultations',
      color: 'text-purple-600 bg-purple-100'
    },
    {
      icon: GraduationCap,
      title: 'Continuing Education',
      description: 'Stay updated with latest tax laws and professional development',
      color: 'text-orange-600 bg-orange-100'
    }
  ];

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20"></div>
      
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center bg-orange-500/20 text-orange-300 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Shield className="w-4 h-4 mr-2" />
            Exclusive Member Benefits
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Join Our Professional Community
          </h2>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Unlock premium resources, connect with industry experts, and advance your tax knowledge with our comprehensive member portal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.icon;
            return (
              <Card key={index} className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-all duration-300 group">
                <CardContent className="p-6 text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${benefit.color} mb-4 group-hover:scale-110 transition-transform`}>
                    <IconComponent className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold mb-3">{benefit.title}</h3>
                  <p className="text-blue-100 text-sm leading-relaxed">{benefit.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main CTA Section */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-8 md:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center mb-6">
                <Star className="w-6 h-6 text-yellow-400 mr-2" />
                <span className="text-yellow-400 font-semibold">Premium Membership</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-6">
                Ready to Level Up Your Tax Knowledge?
              </h3>
              <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                Join thousands of tax professionals and individuals who trust our platform for comprehensive tax resources, expert guidance, and professional networking opportunities.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                  <span className="text-blue-100">Unlimited access to tax resources</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                  <span className="text-blue-100">Direct connection with tax experts</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                  <span className="text-blue-100">Exclusive member-only content</span>
                </div>
              </div>
            </div>
            
            <div className="text-center lg:text-left">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 mb-8">
                <div className="text-2xl font-bold text-orange-400 mb-2">Start Your FREE</div>
                <div className="text-xl font-bold text-orange-400 mb-2">Free Tax Pro Directory Listing!</div>
                <div className="text-sm text-blue-200">No credit card required • Cancel anytime</div>
              </div>
              
              <Button 
                onClick={redirect}
                size="lg" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg font-semibold group"
              >
                Join As Tax Professional
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              <p className="text-blue-200 text-sm mt-4">
                No commitment • Full directory access
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default MemberPortal;
