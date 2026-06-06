import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Award, Users, Clock, CheckCircle, Star } from 'lucide-react';

const TrustSection: React.FC = () => {
  const trustMetrics = [
    {
      icon: Users,
      value: '156,000+',
      label: 'Happy Clients',
      description: 'Trusted by thousands nationwide'
    },
    {
      icon: Award,
      value: '4.9/5',
      label: 'Average Rating',
      description: 'Based on verified reviews'
    },
    {
      icon: Shield,
      value: '100%',
      label: 'Verified Pros',
      description: 'Background checked experts'
    },
    {
      icon: Clock,
      value: '24/7',
      label: 'Support',
      description: 'Always here to help'
    }
  ];

  const features = [
    'IRS-certified tax professionals',
    'Secure document handling',
    'Maximum refund guarantee',
    'Year-round tax support',
    'Audit protection included',
    'Mobile-friendly platform'
  ];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Why Choose Refund Connect?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We're committed to providing you with the highest quality tax services and professional expertise you can trust.
          </p>
        </div>

        {/* Trust Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {trustMetrics.map((metric, index) => {
            const IconComponent = metric.icon;
            return (
              <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-4">
                    <IconComponent className="w-8 h-8" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-2">{metric.value}</div>
                  <div className="text-lg font-semibold text-gray-700 mb-2">{metric.label}</div>
                  <div className="text-sm text-gray-600">{metric.description}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center p-4 bg-gray-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" />
              <span className="text-gray-700 font-medium">{feature}</span>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <Card className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 border-0">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="flex justify-center mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
              ))}
            </div>
            <blockquote className="text-xl md:text-2xl text-gray-700 mb-6 italic">
              "Refund Connect helped me find an amazing tax professional who saved me thousands. The platform is easy to use and all the pros are verified."
            </blockquote>
            <div className="text-gray-600">
              <div className="font-semibold">Jennifer Martinez</div>
              <div>Small Business Owner, Miami FL</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default TrustSection;