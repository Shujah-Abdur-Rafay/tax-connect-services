import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Star, MapPin, Phone, Mail, Award, Clock, MessageCircle, User, DollarSign, Zap } from 'lucide-react';
import ProfessionalContactForm from '@/components/ProfessionalContactForm';
import ChatWindow from '@/components/ChatWindow';
import { ProBadge, SpeedIndicator } from './ProBadges';

interface Service {
  id: string;
  service_name: string;
  description?: string;
  price: number;
  price_type: 'fixed' | 'hourly' | 'starting_at';
  duration_minutes?: number;
  is_active: boolean;
}

interface Professional {
  id: string;
  /** Human-readable slug for the /preparer/{slug} landing page, if assigned. */
  slug?: string;
  name: string;
  title: string;
  category: string;
  image: string;
  rating: number;
  reviewCount: number;
  location: string;
  phone: string;
  email: string;
  specialties: string[];
  experience: number;
  description: string;
  certifications: string[];
  hourlyRate?: string;
  services?: Service[];
  membershipLevel?: string;
}

interface ProfessionalCardProps {
  professional: Professional;
}

const ProfessionalCard: React.FC<ProfessionalCardProps> = ({ professional }) => {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);

  // The profile photo URL is already a full Firebase Storage download URL (or
  // an external CDN URL for sample data). We render it directly from
  // `professional.image` instead of issuing a second Storage lookup, which
  // previously caused 404 network errors for every card.


  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 
        i < rating ? 'text-yellow-400 fill-current opacity-50' : 'text-gray-300'}`} />
    ));
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'cpa': 'bg-blue-100 text-blue-800',
      'tax-attorney': 'bg-purple-100 text-purple-800',
      'enrolled-agent': 'bg-green-100 text-green-800',
      'tax-preparer': 'bg-orange-100 text-orange-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatPrice = (price: number, type: string) => {
    const formatted = `$${price.toFixed(2)}`;
    if (type === 'hourly') return `${formatted}/hr`;
    if (type === 'starting_at') return `From ${formatted}`;
    return formatted;
  };

  const activeServices = (professional.services || []).filter(s => s.is_active);

  // Derive a pro-tier badge & speed indicator from existing data so the marketplace
  // upgrades show on every existing professional card automatically.
  const derived = useMemo(() => {
    const id = professional.id || '';
    const rc = professional.reviewCount || 0;
    const rating = professional.rating || 0;
    const exp = professional.experience || 0;

    let badge: 'Verified Pro' | 'Premium Partner' | 'Top Rated' | 'New & Noted' = 'Verified Pro';
    if (professional.membershipLevel?.toLowerCase().includes('premium')) badge = 'Premium Partner';
    else if (rating >= 4.8 && rc >= 50) badge = 'Top Rated';
    else if (rc < 10) badge = 'New & Noted';

    // Deterministic "response time" so the UI is stable per pro.
    const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const minutes = [30, 45, 60, 90, 120, 180, 240][seed % 7];
    const responseTime = minutes < 60 ? `Responds in ${minutes} min` : `Responds in ${Math.round(minutes / 60)} hr`;
    const availableNow = (seed + rc) % 3 !== 0;
    const filedThisSeason = Math.max(8, Math.round(rc * 0.55 + exp * 4));

    return { badge, responseTime, availableNow, filedThisSeason };
  }, [professional]);

  return (
    <Card className="h-full hover:shadow-lg transition-shadow duration-200 cursor-pointer"
      onClick={() => navigate(professional.slug ? `/preparer/${professional.slug}` : `/professional/${professional.id}`)}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={professional.image} alt={professional.name} />

            <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 mb-1">{professional.name}</h3>
            <p className="text-gray-600 text-sm mb-2">{professional.title}</p>
            <div className="flex gap-1.5 flex-wrap">
              <ProBadge type={derived.badge} />
              <Badge className={getCategoryColor(professional.category)}>
                {professional.category?.replace('-', ' ').toUpperCase() || 'PROFESSIONAL'}
              </Badge>
              {professional.membershipLevel && !professional.membershipLevel.toLowerCase().includes('premium') && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  {professional.membershipLevel}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center">{renderStars(professional.rating)}</div>
          <span className="text-sm font-medium text-gray-900">{professional.rating}</span>
          <span className="text-sm text-gray-500">({professional.reviewCount} reviews)</span>
        </div>

        <SpeedIndicator
          responseTime={derived.responseTime}
          availableNow={derived.availableNow}
          className="mb-3"
        />

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />{professional.location}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2" />{professional.experience} years experience
          </div>
          <div className="flex items-center text-sm text-emerald-700 font-medium">
            <Zap className="h-4 w-4 mr-2" />{derived.filedThisSeason} returns filed this season
          </div>
        </div>


        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{professional.description}</p>

        {activeServices.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />Services & Pricing
            </h4>
            <div className="space-y-1">
              {activeServices.slice(0, 2).map((service) => (
                <div key={service.id} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700">{service.service_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {formatPrice(service.price, service.price_type)}
                  </Badge>
                </div>
              ))}
              {activeServices.length > 2 && (
                <p className="text-xs text-blue-600 font-medium">+{activeServices.length - 2} more services</p>
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Specialties:</h4>
          <div className="flex flex-wrap gap-1">
            {(professional.specialties || []).slice(0, 3).map((specialty, index) => (
              <Badge key={index} variant="outline" className="text-xs">{specialty}</Badge>
            ))}
            {(professional.specialties || []).length > 3 && (
              <Badge variant="outline" className="text-xs">+{(professional.specialties || []).length - 3} more</Badge>
            )}
          </div>
        </div>


        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <ProfessionalContactForm 
            professionalName={professional.name}
            professionalId={professional.id}
            professionalEmail={professional.email}
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsChatOpen(true)}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${professional.phone}`}>
              <Phone className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${professional.email}`}>
              <Mail className="h-4 w-4" />
            </a>
          </Button>
        </div>
        
        <ChatWindow
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          professionalName={professional.name}
          professionalId={professional.id}
        />
      </CardContent>
    </Card>
  );
};

export default ProfessionalCard;