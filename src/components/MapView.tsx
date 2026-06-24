import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Phone, Mail, Navigation } from 'lucide-react';

interface Professional {
  id: string;
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
  hourlyRate: string;
}

interface MapViewProps {
  professionals: Professional[];
  onProfessionalSelect: (professional: Professional) => void;
}

const MapView: React.FC<MapViewProps> = ({ professionals, onProfessionalSelect }) => {
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);

  // Mock coordinates for demonstration
  const mockCoordinates = [
    { lat: 40.7128, lng: -74.0060 }, // New York
    { lat: 34.0522, lng: -118.2437 }, // Los Angeles
    { lat: 41.8781, lng: -87.6298 }, // Chicago
    { lat: 29.7604, lng: -95.3698 }, // Houston
    { lat: 33.4484, lng: -112.0740 }, // Phoenix
    { lat: 39.9526, lng: -75.1652 }  // Philadelphia
  ];

  const handleMarkerClick = (professional: Professional) => {
    setSelectedProfessional(professional);
    onProfessionalSelect(professional);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'cpa': 'bg-blue-500',
      'tax-attorney': 'bg-purple-500',
      'enrolled-agent': 'bg-green-500',
      'tax-preparer': 'bg-orange-500'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
      {/* Mock Map Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 400 300">
            {/* Mock map lines */}
            <g stroke="#cbd5e1" strokeWidth="1" fill="none">
              <path d="M50,50 Q200,100 350,50" />
              <path d="M50,150 Q200,200 350,150" />
              <path d="M50,250 Q200,200 350,250" />
              <path d="M100,0 Q150,150 100,300" />
              <path d="M200,0 Q250,150 200,300" />
              <path d="M300,0 Q350,150 300,300" />
            </g>
          </svg>
        </div>
      </div>

      {/* Professional Markers */}
      {professionals.slice(0, 6).map((professional, index) => {
        const coord = mockCoordinates[index];
        const x = (coord.lng + 180) * (400 / 360);
        const y = (90 - coord.lat) * (300 / 180);
        
        return (
          <div
            key={professional.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
            style={{ left: `${(x / 400) * 100}%`, top: `${(y / 300) * 100}%` }}
            onClick={() => handleMarkerClick(professional)}
          >
            <div className={`w-8 h-8 rounded-full ${getCategoryColor(professional.category)} 
              border-2 border-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform`}>
              <MapPin className="h-4 w-4 text-white" />
            </div>
            
            {selectedProfessional?.id === professional.id && (
              <Card className="absolute top-10 left-1/2 transform -translate-x-1/2 w-64 shadow-xl z-20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={professional.image}
                      alt={professional.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <CardTitle className="text-sm">{professional.name}</CardTitle>
                      <p className="text-xs text-gray-600">{professional.title}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">{professional.rating}</span>
                    <span className="text-xs text-gray-500">({professional.reviewCount})</span>
                  </div>
                  
                  <div className="flex items-center gap-1 mb-2">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{professional.location}</span>
                  </div>
                  
                  <div className="text-xs font-medium text-green-600 mb-2">
                    {professional.hourlyRate}/hour
                  </div>
                  
                  <div className="flex gap-1 mb-3">
                    {professional.specialties.slice(0, 2).map((specialty, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs px-1 py-0">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 text-xs h-7">
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-7">
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button size="sm" variant="outline" className="bg-white">
          <Navigation className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg">
        <h4 className="text-xs font-medium mb-2">Professional Types</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs">CPA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-xs">Tax Attorney</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs">Enrolled Agent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs">Tax Preparer</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;