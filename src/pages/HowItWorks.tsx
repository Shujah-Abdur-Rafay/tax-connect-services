import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Calendar, CreditCard, FileText } from 'lucide-react';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: Search,
      title: "Search & Find",
      description: "Browse certified tax professionals in your area. Filter by services, ratings, and availability."
    },
    {
      icon: Calendar,
      title: "Book Appointment",
      description: "Schedule a consultation at your convenience. Choose in-person or virtual meetings."
    },
    {
      icon: FileText,
      title: "Upload Documents",
      description: "Securely share your tax documents and forms through our encrypted platform."
    },
    {
      icon: CreditCard,
      title: "Secure Payment",
      description: "Pay safely through our platform with multiple payment options and buyer protection."
    }
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                How Refund Connect Works
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Getting professional tax help has never been easier. Follow these simple steps to connect with qualified tax professionals.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <step.icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-16 bg-white rounded-lg shadow-md p-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Ready to Get Started?
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  Join thousands of satisfied clients who found their perfect tax professional through our platform.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/find-professionals" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-center">
                    Find Professionals
                  </Link>
                  <Link to="/join-platform" className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors text-center">
                    Join as Professional
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default HowItWorks;