import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Star, DollarSign, MapPin, Calendar, Award, Briefcase, ArrowUpDown } from 'lucide-react';

interface AdvancedFiltersProps {
  priceRange: [number, number];
  setPriceRange: (range: [number, number]) => void;
  experienceRange: [number, number];
  setExperienceRange: (range: [number, number]) => void;
  minRating: number;
  setMinRating: (rating: number) => void;
  availability: string[];
  setAvailability: (availability: string[]) => void;
  certifications: string[];
  setCertifications: (certifications: string[]) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  priceRange, setPriceRange, experienceRange, setExperienceRange,
  minRating, setMinRating, availability, setAvailability,
  certifications, setCertifications, sortBy, setSortBy, isOpen, setIsOpen
}) => {
  const availabilityOptions = ['Weekdays', 'Weekends', 'Evenings', 'Same Day', 'Next Day'];
  const certificationOptions = ['CPA', 'EA', 'JD', 'LLM Tax', 'CFP', 'PTIN'];

  const handleAvailabilityChange = (option: string, checked: boolean) => {
    setAvailability(checked ? [...availability, option] : availability.filter(a => a !== option));
  };

  const handleCertificationChange = (option: string, checked: boolean) => {
    setCertifications(checked ? [...certifications, option] : certifications.filter(c => c !== option));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Advanced Filters
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-4">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Sort By */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium">Sort By</label>
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Highest Rating</SelectItem>
                    <SelectItem value="reviews">Most Reviews</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="experience">Most Experience</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium">Price Range (per hour)</label>
                </div>
                <div className="px-2">
                  <Slider value={priceRange} onValueChange={(v) => setPriceRange([v[0], v[1]])}
                    max={500} min={50} step={25} className="w-full" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>${priceRange[0]}</span>
                    <span>${priceRange[1]}</span>
                  </div>
                </div>
              </div>

              {/* Experience Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium">Years of Experience</label>
                </div>
                <div className="px-2">
                  <Slider value={experienceRange} onValueChange={(v) => setExperienceRange([v[0], v[1]])}
                    max={40} min={0} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{experienceRange[0]} yrs</span>
                    <span>{experienceRange[1]}+ yrs</span>
                  </div>
                </div>
              </div>

              {/* Rating Filter */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium">Minimum Rating</label>
                </div>
                <Select value={minRating.toString()} onValueChange={(v) => setMinRating(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any Rating</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="4.5">4.5+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Availability */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium">Availability</label>
                </div>
                <div className="space-y-2">
                  {availabilityOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox id={`availability-${option}`} checked={availability.includes(option)}
                        onCheckedChange={(checked) => handleAvailabilityChange(option, !!checked)} />
                      <label htmlFor={`availability-${option}`} className="text-sm">{option}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium">Certifications</label>
                </div>
                <div className="space-y-2">
                  {certificationOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox id={`cert-${option}`} checked={certifications.includes(option)}
                        onCheckedChange={(checked) => handleCertificationChange(option, !!checked)} />
                      <label htmlFor={`cert-${option}`} className="text-sm">{option}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AdvancedFilters;
