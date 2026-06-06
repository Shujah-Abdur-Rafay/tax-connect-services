import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Users, Award } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start mb-6">
              <Shield className="w-8 h-8 text-orange-400 mr-3" />
              <span className="text-orange-400 font-semibold">Trusted Tax Professionals</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Expert Tax Help
              <span className="text-orange-400 block">Made Simple</span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 text-blue-100 leading-relaxed">
              Connect with verified tax professionals in your area. Get expert help with tax preparation, business taxes, audit support, and more.
            </p>
            
            {/* Stats */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-8 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400">156K</div>
                <div className="text-blue-200">Happy Clients</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400">500+</div>
                <div className="text-blue-200">Tax Pros</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400">4.9</div>

                <div className="text-blue-200">Star Rating</div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/find-professionals">
                <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg group">
                  Find Tax Help
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/join-platform">
                <Button size="lg" variant="outline" className="border-2 border-white bg-transparent text-white hover:bg-white hover:text-blue-900 px-8 py-4 text-lg">
                  Join as Professional
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Hero Image */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img 
                src="https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756152640535_a9b46aeb.webp" 
                alt="Professional Tax Services" 
                className="w-full h-96 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            
            {/* Floating Cards */}
            <div className="absolute -top-4 -left-4 bg-white text-gray-900 p-4 rounded-lg shadow-lg">
              <div className="flex items-center">
                <Users className="w-6 h-6 text-blue-600 mr-2" />
                <div>
                  <div className="font-bold">Verified Pros</div>
                  <div className="text-sm text-gray-600">Background Checked</div>
                </div>
              </div>
            </div>
            
            <div className="absolute -bottom-4 -right-4 bg-orange-500 text-white p-4 rounded-lg shadow-lg">
              <div className="flex items-center">
                <Award className="w-6 h-6 mr-2" />
                <div>
                  <div className="font-bold">Top Rated</div>
                  <div className="text-sm opacity-90">4.9/5 Average</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;