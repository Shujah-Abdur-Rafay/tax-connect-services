import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { getProfessionalByEmail } from '@/services/professionalsService';
import { Loader2, Briefcase, Upload, CheckCircle2 } from 'lucide-react';

const ProfessionalProfileForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [isProfessional, setIsProfessional] = useState(false);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    businessName: '',
    bio: '',
    profileImage: '',
    businessAddress: '',
    city: '',
    state: '',
    zipCode: '',
    years_experience: 0,
    services: '',
    specializations: ''
  });

  useEffect(() => {
    loadProfessionalProfile();
  }, [user]);

  const loadProfessionalProfile = async () => {
    if (!user?.email) {
      setFetchingProfile(false);
      return;
    }
    
    setFetchingProfile(true);
    try {
      console.log('Loading professional profile for:', user.email);
      const professional = await getProfessionalByEmail(user.email);
      
      if (professional) {
        console.log('Professional profile found:', professional);
        setIsProfessional(true);
        setProfessionalId(professional.id);
        
        const nameParts = (professional.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        setFormData({
          firstName,
          lastName,
          email: user.email,
          phone: professional.phone || '',
          businessName: professional.business_name || '',
          bio: professional.bio || '',
          profileImage: professional.profile_image || '',
          businessAddress: professional.business_address || '',
          city: professional.city || '',
          state: professional.state || '',
          zipCode: professional.zip_code || '',
          years_experience: professional.years_experience || 0,
          services: professional.services?.join(', ') || '',
          specializations: professional.specializations?.join(', ') || ''
        });
      } else {
        console.log('No professional profile found');
        setFormData(prev => ({
          ...prev,
          email: user.email || ''
        }));
      }
    } catch (error) {
      console.error('Error loading professional profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile data',
        variant: 'destructive'
      });
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profileImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      toast({
        title: 'Error',
        description: 'You must be logged in to update your profile',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        business_name: formData.businessName,
        phone: formData.phone,
        location: `${formData.city}, ${formData.state}`.trim(),
        bio: formData.bio,
        profile_image: formData.profileImage,
        business_address: formData.businessAddress,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zipCode,
        years_experience: parseInt(formData.years_experience.toString()) || 0,
        services: formData.services.split(',').map(s => s.trim()).filter(s => s),
        specializations: formData.specializations.split(',').map(s => s.trim()).filter(s => s),
        is_published: true,
        updated_at: new Date().toISOString()
      };

      console.log('Saving profile data:', profileData);

      if (isProfessional && professionalId) {
        const { data, error } = await supabase
          .from('professionals')
          .update(profileData)
          .eq('id', professionalId)
          .select();

        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }
        console.log('Profile updated successfully:', data);
      } else {
        const { data, error } = await supabase
          .from('professionals')
          .insert({
            ...profileData,
            email: user.email,
            rating: 0,
            review_count: 0,
            created_at: new Date().toISOString()
          })
          .select();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }
        console.log('Profile created successfully:', data);
      }

      toast({
        title: 'Success!',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{isProfessional ? 'Profile updated successfully' : 'Profile created successfully'}</span>
          </div>
        )
      });
      
      // Reload profile to ensure UI reflects saved data
      await loadProfessionalProfile();
    } catch (error: any) {
      console.error('Profile save error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingProfile) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          {isProfessional ? 'Professional Profile' : 'Create Professional Profile'}
        </CardTitle>
        <CardDescription>
          {isProfessional 
            ? 'Update your professional information visible to clients' 
            : 'Create your professional profile to be listed in our directory'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={formData.profileImage} />
              <AvatarFallback>{formData.firstName?.[0]}{formData.lastName?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <input
                type="file"
                id="profileImageUpload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button 
                type="button" 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => document.getElementById('profileImageUpload')?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload Photo
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Professional Bio *</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell clients about your experience and expertise..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessAddress">Business Address</Label>
            <Input
              id="businessAddress"
              value={formData.businessAddress}
              onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="years_experience">Years of Experience *</Label>
            <Input
              id="years_experience"
              type="number"
              min="0"
              value={formData.years_experience}
              onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="services">Services (comma-separated)</Label>
            <Input
              id="services"
              value={formData.services}
              onChange={(e) => setFormData({ ...formData, services: e.target.value })}
              placeholder="Tax Preparation, Tax Planning, Business Tax"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specializations">Specializations (comma-separated)</Label>
            <Input
              id="specializations"
              value={formData.specializations}
              onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
              placeholder="Corporate Tax, International Tax"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProfessional ? 'Save Professional Profile' : 'Create Professional Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfessionalProfileForm;
