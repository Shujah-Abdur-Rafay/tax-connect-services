import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getProfessionals,
  matchesLocationQuery,
  SERVICE_CATEGORIES,
  SERVICE_MODALITY_OPTIONS,
  type ServiceModality,
} from '@/services/professionalsService';
import ProfessionalCard from '@/components/ProfessionalCard';
import AdvancedFilters from '@/components/AdvancedFilters';
import ProfessionalMapView from '@/components/ProfessionalMapView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, AlertCircle, CheckCircle, Users, Filter, X, MapPin, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
const FindProfessionals = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [modalityFilter, setModalityFilter] = useState<ServiceModality | 'all'>(
    (searchParams.get('modality') as ServiceModality) || 'all'
  );
  const [categoryFilters, setCategoryFilters] = useState<string[]>(
    searchParams.get('category') ? [searchParams.get('category') as string] : []
  );
  const [priceRange, setPriceRange] = useState<[number, number]>([50, 500]);
  const [experienceRange, setExperienceRange] = useState<[number, number]>([0, 40]);
  const [minRating, setMinRating] = useState(0);
  const [availability, setAvailability] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('rating');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>(() => {
    return (searchParams.get('view') === 'map' ? 'map' : 'grid');
  });
  const specialties = [
    'Individual Tax Returns', 
    'Business Tax Returns', 
    'Tax Planning',
    'IRS Representation', 
    'Bookkeeping', 
    'Payroll Services', 
    'Estate Planning', 
    'International Tax'
  ];

  useEffect(() => { 
    fetchProfessionals(); 
  }, []);

  const fetchProfessionals = async () => {
    try {
      setLoading(true); 
      setError(null);
      const data = await getProfessionals();
      const transformed = data.map((prof: any) => ({
        id: prof.id,
        slug: prof.slug || '',
        name: prof.full_name,
        title: prof.specializations?.[0] || prof.business_name || 'Tax Professional',
        image: prof.profile_image_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop',
        rating: prof.rating || 4.5,
        reviewCount: prof.review_count || 0,
        location: prof.location || 'United States',
        city: prof.city || '',
        state: prof.state || '',
        zip_code: prof.zip_code || '',
        phone: prof.phone || '',
        email: prof.email,
        specialties: prof.specializations || prof.services || [],
        experience: prof.years_experience || 5,
        description: prof.bio || 'Experienced tax professional ready to help with your tax needs.',
        certifications: prof.credentials?.certifications || [],
        hourlyRate: prof.pricing?.hourlyRate || 150,
        category: 'cpa',
        services: prof.services || [],
        serviceCategories: prof.service_categories || [],
        serviceModality: (prof.service_modality as ServiceModality) || 'both',
        membershipLevel: prof.membership_level,
      }));
      setProfessionals(transformed);
    } catch (error: any) {
      console.error('Error fetching professionals:', error);
      setError(error.message || 'Failed to load professionals');
    } finally { 
      setLoading(false); 
    }
  };

  const handleSearch = () => {
    // No-op: filtering is live as the user types. Kept for the explicit
    // "Search" button so pressing it doesn't feel like nothing happens.
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Build a Professional-shaped object that matchesLocationQuery understands.
  // The grid uses a flattened "transformed" shape, so we adapt on the fly.
  const toLocationProf = (prof: any) => ({
    id: prof.id,
    email: prof.email,
    full_name: prof.name,
    location: prof.location || '',
    city: prof.city || '',
    state: prof.state || '',
    zip_code: prof.zip_code || '',
    bio: prof.description || '',
    years_experience: prof.experience || 0,
    rating: prof.rating || 0,
    review_count: prof.reviewCount || 0,
    is_published: true,
  });

  const filtered = professionals.filter(prof => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      prof.name?.toLowerCase().includes(term) ||
      prof.description?.toLowerCase().includes(term) ||
      prof.title?.toLowerCase().includes(term) ||
      prof.specialties?.some((s: string) => s.toLowerCase().includes(term)) ||
      prof.services?.some((s: string) => s.toLowerCase().includes(term)) ||
      // Allow the main search box to also match a location query like
      // "Michigan" or "48126" so it always returns something useful.
      matchesLocationQuery(toLocationProf(prof), searchTerm);

    const matchesLocation = !locationFilter.trim() ||
      matchesLocationQuery(toLocationProf(prof), locationFilter);

    const matchesSpecialty = !specialtyFilter || specialtyFilter === 'all' ||
      prof.specialties?.includes(specialtyFilter);
    // Virtual / in-person filter. A pro set to 'both' always matches; an
    // explicit virtual/in_person filter matches that exact modality OR 'both'.
    const matchesModality = modalityFilter === 'all' ||
      prof.serviceModality === modalityFilter ||
      prof.serviceModality === 'both';
    // Service-category taxonomy filter (any selected category matches).
    const matchesCategories = categoryFilters.length === 0 ||
      categoryFilters.some((c) => prof.serviceCategories?.includes(c));
    const matchesPrice = prof.hourlyRate >= priceRange[0] && prof.hourlyRate <= priceRange[1];
    const matchesExperience = prof.experience >= experienceRange[0] && prof.experience <= experienceRange[1];
    const matchesRating = prof.rating >= minRating;
    const matchesCertifications = certifications.length === 0 ||
      certifications.some(cert => prof.certifications?.includes(cert));
    return matchesSearch && matchesLocation && matchesSpecialty && matchesModality &&
           matchesCategories && matchesPrice &&
           matchesExperience && matchesRating && matchesCertifications;
  });


  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'rating': return b.rating - a.rating;
      case 'reviews': return b.reviewCount - a.reviewCount;
      case 'price-low': return a.hourlyRate - b.hourlyRate;
      case 'price-high': return b.hourlyRate - a.hourlyRate;
      case 'experience': return b.experience - a.experience;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  const toggleCategory = (value: string) => {
    setCategoryFilters((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const resetFilters = () => {
    setSearchTerm('');
    setLocationFilter('');
    setSpecialtyFilter('');
    setModalityFilter('all');
    setCategoryFilters([]);
    setPriceRange([50, 500]);
    setExperienceRange([0, 40]);
    setMinRating(0);
    setAvailability([]);
    setCertifications([]);
    setSortBy('rating');
  };

  const hasActiveFilters = searchTerm || locationFilter || specialtyFilter ||
    modalityFilter !== 'all' || categoryFilters.length > 0 ||
    priceRange[0] !== 50 || priceRange[1] !== 500 || minRating !== 0 ||
    certifications.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Find Tax Professionals
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Connect with verified CPAs, Enrolled Agents, and Tax Attorneys. 
            Search by specialty, location, or name to find the perfect match for your tax needs.
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search by name or keyword..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="City, State, or ZIP (e.g. Michigan, 48126)" 
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>

            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select specialty..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                {specialties.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">Quick filters:</span>
            <Button
              variant={minRating >= 4.5 ? "default" : "outline"}
              size="sm"
              onClick={() => setMinRating(minRating >= 4.5 ? 0 : 4.5)}
            >
              Top Rated (4.5+)
            </Button>
            <Button
              variant={experienceRange[0] >= 10 ? "default" : "outline"}
              size="sm"
              onClick={() => setExperienceRange(experienceRange[0] >= 10 ? [0, 40] : [10, 40])}
            >
              10+ Years Experience
            </Button>
            <Button
              variant={priceRange[1] <= 150 ? "default" : "outline"}
              size="sm"
              onClick={() => setPriceRange(priceRange[1] <= 150 ? [50, 500] : [50, 150])}
            >
              Budget Friendly
            </Button>

            {/* Virtual / in-person modality */}
            <Select value={modalityFilter} onValueChange={(v) => setModalityFilter(v as ServiceModality | 'all')}>
              <SelectTrigger className="h-9 w-auto min-w-[150px]">
                <SelectValue placeholder="How they work" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Virtual or In-person</SelectItem>
                {SERVICE_MODALITY_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="ml-auto"
            >
              <Filter className="mr-2 h-4 w-4" />
              Advanced Filters
            </Button>
          </div>

          {/* Service-category taxonomy chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-sm text-gray-500">Services:</span>
            {SERVICE_CATEGORIES.map((cat) => {
              const active = categoryFilters.includes(cat.value);
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => toggleCategory(cat.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="mb-6">
          <AdvancedFilters 
            priceRange={priceRange} 
            setPriceRange={setPriceRange}
            experienceRange={experienceRange} 
            setExperienceRange={setExperienceRange}
            minRating={minRating} 
            setMinRating={setMinRating}
            availability={availability} 
            setAvailability={setAvailability}
            certifications={certifications} 
            setCertifications={setCertifications}
            sortBy={sortBy} 
            setSortBy={setSortBy}
            isOpen={filtersOpen} 
            setIsOpen={setFiltersOpen} 
          />
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-sm text-gray-500">Active filters:</span>
            {searchTerm && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Search: {searchTerm}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchTerm('')} />
              </Badge>
            )}
            {locationFilter && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Location: {locationFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setLocationFilter('')} />
              </Badge>
            )}
            {specialtyFilter && specialtyFilter !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {specialtyFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSpecialtyFilter('')} />
              </Badge>
            )}
            {minRating > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Rating: {minRating}+
                <X className="h-3 w-3 cursor-pointer" onClick={() => setMinRating(0)} />
              </Badge>
            )}
            {modalityFilter !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {SERVICE_MODALITY_OPTIONS.find((m) => m.value === modalityFilter)?.label || modalityFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setModalityFilter('all')} />
              </Badge>
            )}
            {categoryFilters.map((c) => (
              <Badge key={c} variant="secondary" className="flex items-center gap-1">
                {SERVICE_CATEGORIES.find((sc) => sc.value === c)?.label || c}
                <X className="h-3 w-3 cursor-pointer" onClick={() => toggleCategory(c)} />
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-red-600 hover:text-red-700">
              Clear All
            </Button>
          </div>
        )}

        {/* Results Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
            <span className="text-gray-600 text-lg">Loading tax professionals...</span>
          </div>
        ) : error ? (
          <Alert className="mb-8 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Professionals</AlertTitle>
            <AlertDescription>
              {error}
              <Button variant="link" onClick={fetchProfessionals} className="ml-2">
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Results Count + View Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-gray-700">
                  Found <span className="font-semibold text-gray-900">{sorted.length}</span> verified professionals
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Grid / Map view toggle */}
                <div
                  role="tablist"
                  aria-label="View mode"
                  className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'grid'}
                    onClick={() => setViewMode('grid')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Grid
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'map'}
                    onClick={() => setViewMode('map')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      viewMode === 'map'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <MapIcon className="h-4 w-4" />
                    Map
                  </button>
                </div>

                {viewMode === 'grid' && (
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rating">Highest Rated</SelectItem>
                      <SelectItem value="reviews">Most Reviews</SelectItem>
                      <SelectItem value="experience">Most Experience</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="name">Name A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Results body — grid OR map */}
            {sorted.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sorted.map((professional) => (
                    <ProfessionalCard key={professional.id} professional={professional} />
                  ))}
                </div>
              ) : (
                <ProfessionalMapView
                  professionals={sorted.map((p) => ({
                    id: p.id,
                    name: p.name,
                    rating: p.rating,
                    reviewCount: p.reviewCount,
                    specialties: p.specialties,
                    city: p.city,
                    state: p.state,
                    zip_code: p.zip_code,
                    location: p.location,
                  }))}
                  onViewProfile={(id) => {
                    const p = sorted.find((x) => x.id === id);
                    navigate(p?.slug ? `/preparer/${p.slug}` : `/professional/${id}`);
                  }}
                />
              )
            ) : (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No professionals found</h3>
                <p className="text-gray-500 mb-4 max-w-md mx-auto">
                  Try adjusting your search criteria or filters to find more tax professionals.
                </p>
                <Button onClick={resetFilters} variant="outline">
                  Reset All Filters
                </Button>
              </div>
            )}
          </>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Need Help Finding the Right Professional?
            </h2>
            <p className="text-gray-600 mb-6">
              Our team can help match you with the perfect tax professional based on your specific needs, 
              budget, and preferences.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Get Personalized Recommendations
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindProfessionals;
