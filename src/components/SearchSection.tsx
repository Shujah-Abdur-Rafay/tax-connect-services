import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ProfessionalCard from './ProfessionalCard';
import { getProfessionals } from '@/services/professionalsService';
import { Search, MapPin, Filter, Star, Verified, Loader2 } from 'lucide-react';

const SearchSection: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('');
  const [featuredProfessionals, setFeaturedProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeaturedProfessionals = async () => {
      try {
        setLoading(true);
        const data = await getProfessionals();
        const transformed = data.map((prof: any) => ({
          id: prof.id,
          name: prof.full_name,
          title: prof.specializations?.[0] || prof.business_name || 'Tax Professional',
          image: prof.profile_image_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop',
          rating: prof.rating || 4.5,
          reviewCount: prof.review_count || 0,
          location: prof.location || 'United States',
          phone: prof.phone || '',
          email: prof.email,
          specialties: prof.specializations || prof.services || [],
          experience: prof.years_experience || 5,
          description: prof.bio || 'Experienced tax professional ready to help with your tax needs.',
          certifications: prof.credentials?.certifications || [],
          hourlyRate: prof.pricing?.hourlyRate || 150,
          category: 'cpa',
          membershipLevel: prof.membership_level
        }));
        
        // Sort by rating and take top 3
        const sorted = transformed.sort((a: any, b: any) => b.rating - a.rating);
        setFeaturedProfessionals(sorted.slice(0, 3));
      } catch (error) {
        console.error('Error loading featured professionals:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadFeaturedProfessionals();
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.append('search', searchTerm.trim());
    if (location.trim()) params.append('location', location.trim());
    navigate(`/find-professionals?${params.toString()}`);
  };

  const handleQuickSearch = (service: string) => {
    navigate(`/find-professionals?search=${encodeURIComponent(service)}`);
  };

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Find Tax Professionals Near You
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Connect with verified tax experts in your area. All professionals are background-checked and highly rated.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-12 border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="What service do you need?" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg" />
            </div>
            <div className="flex-1 relative">
              <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Enter your city or zip code" value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg" />
            </div>
            <Button onClick={handleSearch} className="px-8 py-4 text-lg bg-blue-600 hover:bg-blue-700 rounded-xl">
              <Search className="w-5 h-5 mr-2" />Search Professionals
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-100">
            <span className="text-gray-600 font-medium">Popular searches:</span>
            {['Individual Tax Prep', 'Business Taxes', 'Tax Resolution', 'Bookkeeping', 'IRS Representation', 'Estate Planning'].map((filter) => (
              <button key={filter} onClick={() => handleQuickSearch(filter)}
                className="px-4 py-2 bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded-full text-sm transition-colors">
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center items-center gap-8 mb-12 text-gray-600 flex-wrap">
          <div className="flex items-center"><Verified className="w-5 h-5 text-green-500 mr-2" /><span>Background Verified</span></div>
          <div className="flex items-center"><Star className="w-5 h-5 text-yellow-500 mr-2" /><span>Top Rated Professionals</span></div>
          <div className="flex items-center"><Filter className="w-5 h-5 text-blue-500 mr-2" /><span>Specialized Expertise</span></div>
        </div>

        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900">Featured Tax Professionals</h3>
          <Button 
            variant="link" 
            onClick={() => navigate('/find-professionals')}
            className="text-blue-600 hover:text-blue-700"
          >
            View All →
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Loading featured professionals...</span>
          </div>
        ) : featuredProfessionals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProfessionals.map((professional) => (
              <ProfessionalCard key={professional.id} professional={professional} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-500 mb-4">No featured professionals available at the moment.</p>
            <Button onClick={() => navigate('/find-professionals')} variant="outline">
              Browse All Professionals
            </Button>
          </div>
        )}

        <div className="text-center mt-12">
          <Button onClick={() => navigate('/find-professionals')} variant="outline" size="lg" className="px-8 py-4 text-lg border-2">
            View All Professionals
          </Button>
        </div>
      </div>
    </section>
  );
};

export default SearchSection;
