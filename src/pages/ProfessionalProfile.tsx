import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Star, MapPin, Phone, Mail, Award, Clock, ArrowLeft, Calendar, Loader2, GraduationCap, DollarSign, Briefcase } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';
import BookingForm from '@/components/BookingForm';
import ProfessionalContactForm from '@/components/ProfessionalContactForm';
import ProfessionalServicesDisplay from '@/components/ProfessionalServicesDisplay';
import PackageComparisonDisplay from '@/components/PackageComparisonDisplay';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import { ReviewSubmissionForm } from '@/components/ReviewSubmissionForm';
import { getProfessionalById, sampleProfessionals } from '@/services/professionalsService';


const ProfessionalProfile: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [professional, setProfessional] = useState<any>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchProfessional = async () => {
      if (!id) return;
      setLoading(true);
      
      try {
        // First try to get from database
        const data = await getProfessionalById(id);
        
        if (data) {
          setProfessional({
            id: data.id,
            name: data.full_name,
            title: data.specializations?.[0] || data.business_name || 'Tax Professional',
            category: 'cpa',
            image: data.profile_image_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop',
            rating: data.rating || 4.5,
            reviewCount: data.review_count || 0,
            location: data.location || 'United States',
            phone: data.phone || '(555) 000-0000',
            email: data.email,
            specialties: data.specializations || data.services || [],
            experience: data.years_experience || 5,
            description: data.bio || 'Experienced tax professional ready to help with your tax needs.',
            certifications: data.credentials?.certifications || [],
            hourlyRate: data.pricing?.hourlyRate ? `$${data.pricing.hourlyRate}` : '$150',
            bio: data.bio || 'Experienced tax professional dedicated to helping clients with their tax needs.',
            services: data.services || [],
            packages: data.packages || [],
            membershipLevel: data.membership_level,
            education: [],
            testimonials: []
          });
        } else {
          // Check sample data as fallback
          const samplePro = sampleProfessionals.find(p => p.id === id);
          if (samplePro) {
            setProfessional({
              id: samplePro.id,
              name: samplePro.full_name,
              title: samplePro.specializations?.[0] || samplePro.business_name || 'Tax Professional',
              category: 'cpa',
              image: samplePro.profile_image_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop',
              rating: samplePro.rating || 4.5,
              reviewCount: samplePro.review_count || 0,
              location: samplePro.location || 'United States',
              phone: samplePro.phone || '(555) 000-0000',
              email: samplePro.email,
              specialties: samplePro.specializations || samplePro.services || [],
              experience: samplePro.years_experience || 5,
              description: samplePro.bio || 'Experienced tax professional ready to help with your tax needs.',
              certifications: samplePro.credentials?.certifications || [],
              hourlyRate: samplePro.pricing?.hourlyRate ? `$${samplePro.pricing.hourlyRate}` : '$150',
              bio: samplePro.bio || 'Experienced tax professional dedicated to helping clients with their tax needs.',
              services: samplePro.services || [],
              packages: [],
              membershipLevel: samplePro.membership_level,
              education: [],
              testimonials: []
            });
          }
        }
      } catch (error) {
        console.error('Error fetching professional:', error);
      }
      
      setLoading(false);
    };
    fetchProfessional();
  }, [id]);


  const handleTimeSlotSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setShowBookingForm(true);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onToggleNotifications={() => {}} />
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Loading professional profile...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onToggleNotifications={() => {}} />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Briefcase className="h-10 w-10 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Professional Not Found</h1>
            <p className="text-gray-600 mb-6">
              The professional you're looking for may have been removed or the link may be incorrect.
            </p>
            <Button onClick={() => navigate('/find-professionals')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Browse All Professionals
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onToggleNotifications={() => {}} />
      
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/find-professionals')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="mb-8">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                  <img 
                    src={professional.image} 
                    alt={professional.name} 
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg" 
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{professional.name}</h1>
                        <p className="text-xl text-gray-600 mb-3">{professional.title}</p>
                      </div>
                      {professional.membershipLevel && (
                        <Badge className="bg-purple-100 text-purple-800 text-sm">
                          {professional.membershipLevel}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mb-4 flex-wrap">
                      <div className="flex items-center">
                        {renderStars(professional.rating)}
                        <span className="ml-2 font-medium">{professional.rating.toFixed(1)}</span>
                        <span className="ml-1 text-gray-500">({professional.reviewCount} reviews)</span>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {professional.category.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-gray-600">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        {professional.location}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        {professional.experience} years experience
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        From {professional.hourlyRate}/hour
                      </div>
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="reviews">Reviews</TabsTrigger>
                    <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-6 pt-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">About</h3>
                      <p className="text-gray-700 leading-relaxed">{professional.bio}</p>
                    </div>
                    
                    {professional.specialties && professional.specialties.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Specialties</h3>
                        <div className="flex flex-wrap gap-2">
                          {professional.specialties.map((specialty: string, index: number) => (
                            <Badge key={index} variant="outline" className="px-3 py-1">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {professional.certifications && professional.certifications.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Certifications & Credentials</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {professional.certifications.map((cert: string, index: number) => (
                            <div key={index} className="flex items-center p-3 bg-green-50 rounded-lg border border-green-100">
                              <Award className="h-5 w-5 mr-3 text-green-600" />
                              <span className="font-medium text-green-800">{cert}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="reviews" className="space-y-4 pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Client Reviews</h3>
                      <Button onClick={() => setShowReviewForm(true)}>Write a Review</Button>
                    </div>
                    <ReviewDisplay professionalId={professional.id} />
                  </TabsContent>
                  
                  <TabsContent value="schedule" className="pt-6">
                    <AvailabilityCalendar professionalId={professional.id} onTimeSlotSelect={handleTimeSlotSelect} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {professional.services && professional.services.length > 0 && (
              <ProfessionalServicesDisplay services={professional.services} />
            )}
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="h-5 w-5 mr-2 text-blue-600" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="h-5 w-5 text-gray-600" />
                  <a href={`tel:${professional.phone}`} className="text-blue-600 hover:underline font-medium">
                    {professional.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="h-5 w-5 text-gray-600" />
                  <a href={`mailto:${professional.email}`} className="text-blue-600 hover:underline font-medium truncate">
                    {professional.email}
                  </a>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-700">{professional.location}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      <Calendar className="h-4 w-4 mr-2" />
                      Book Appointment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <AvailabilityCalendar professionalId={professional.id} onTimeSlotSelect={handleTimeSlotSelect} />
                  </DialogContent>
                </Dialog>
                <ProfessionalContactForm professionalName={professional.name} professionalId={professional.id} professionalEmail={professional.email} />

                <Button variant="outline" className="w-full" asChild>
                  <a href={`tel:${professional.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call Now
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {professional.packages && professional.packages.length > 0 && (
          <div className="mt-12">
            <PackageComparisonDisplay 
              packages={professional.packages} 
              services={professional.services}
              onSelectPackage={(pkg) => {
                setShowBookingForm(true);
              }}
            />
          </div>
        )}
      </main>


      <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
        <DialogContent>
          <BookingForm
            professionalId={professional.id}
            professionalName={professional.name}
            professionalEmail={professional.email}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onClose={() => setShowBookingForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showReviewForm} onOpenChange={setShowReviewForm}>
        <DialogContent className="max-w-2xl">
          <ReviewSubmissionForm
            professionalId={professional.id}
            professionalName={professional.name}
            onSuccess={() => {
              setShowReviewForm(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Footer />
    </div>

  );
};

export default ProfessionalProfile;
