import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Star, MapPin, Phone, Mail, Clock, User, DollarSign, Edit, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProfilePreviewProps {
  profileData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    bio: string;
    profileImage: string;
    businessName: string;
    businessAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
  servicesData: Array<{
    name: string;
    description: string;
    selected: boolean;
    price: string;
  }>;
  onEditProfile: () => void;
  onEditServices: () => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function ProfilePreviewStep({
  profileData,
  servicesData,
  onEditProfile,
  onEditServices,
  onContinue,
  onBack
}: ProfilePreviewProps) {
  const selectedServices = servicesData.filter(s => s.selected);
  const fullName = `${profileData.firstName} ${profileData.lastName}`.trim();
  const location = `${profileData.city}, ${profileData.state}`.trim().replace(/^,|,$/g, '') || 'Location not set';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Preview Your Profile
        </CardTitle>
        <p className="text-sm text-gray-600">
          This is how clients will see your profile. Review everything carefully before continuing.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            Take a moment to review your information. You can edit any section before submitting your application.
          </AlertDescription>
        </Alert>

        {/* Profile Preview Card */}
        <div className="border-2 border-blue-200 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-start gap-4 mb-4">
            <Avatar className="h-20 w-20 border-2 border-blue-300">
              <AvatarImage src={profileData.profileImage} alt={fullName} />
              <AvatarFallback className="bg-blue-100">
                <User className="h-10 w-10 text-blue-600" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-bold text-xl text-gray-900 mb-1">{fullName || 'Your Name'}</h3>
              <p className="text-gray-600 mb-2">{profileData.businessName || 'Business Name'}</p>
              <Badge className="bg-blue-100 text-blue-800">TAX PROFESSIONAL</Badge>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
              {location}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
              {profileData.phone || 'Phone not set'}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
              {profileData.email || 'Email not set'}
            </div>
          </div>

          {profileData.bio && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">About Me:</h4>
              <p className="text-sm text-gray-600">{profileData.bio}</p>
            </div>
          )}

          {selectedServices.length > 0 && (
            <div className="p-4 bg-white rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <DollarSign className="h-4 w-4 mr-1" />
                Services & Pricing
              </h4>
              <div className="space-y-2">
                {selectedServices.map((service, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{service.name}</p>
                      {service.description && (
                        <p className="text-xs text-gray-600">{service.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-sm whitespace-nowrap">
                      ${service.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Edit Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onEditProfile} className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
          <Button variant="outline" onClick={onEditServices} className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Edit Services
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onContinue} className="flex-1">
            Looks Good, Continue to Application
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
