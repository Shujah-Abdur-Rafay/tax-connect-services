import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Check, X, User, Award, DollarSign, Calendar, Loader2 } from 'lucide-react';
import {
  updateApplicationStatus,
  saveApplicationNotes,
  createProfessionalFromApplication,
  EnrollmentApplication,
} from '@/services/enrollmentService';
import { useToast } from '@/hooks/use-toast';
import { sendApplicationStatusEmail } from '@/services/applicationNotificationService';


interface Application {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  profile: any;
  credentials: any;
  services: any;
  pricing: any;
  availability: any;
  reviewNotes?: string;
}

interface ApplicationReviewProps {
  application: Application;
  onBack: () => void;
}

export function ApplicationReview({ application, onBack }: ApplicationReviewProps) {
  const [reviewNotes, setReviewNotes] = useState(application.reviewNotes || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStatusChange = async (newStatus: 'approved' | 'rejected') => {
    if (!confirm(`Are you sure you want to ${newStatus === 'approved' ? 'approve' : 'reject'} this application?`)) {
      return;
    }

    setLoading(true);
    try {
      // Update Firestore application status
      await updateApplicationStatus(application.id, newStatus, reviewNotes);

      // If approved, create/update professional listing in Firestore
      if (newStatus === 'approved') {
        await createProfessionalFromApplication(application as EnrollmentApplication);
      }

      // Send email notification
      const name = `${application.profile?.firstName || ''} ${application.profile?.lastName || ''}`.trim() || 'Tax Professional';
      try {
        await sendApplicationStatusEmail({
          email: application.email,
          name,
          status: newStatus,
          reviewNotes
        });
      } catch (emailErr) {
        console.warn('Email notification failed (non-fatal):', emailErr);
      }

      toast({
        title: 'Success',
        description: `Application ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully. ${newStatus === 'approved' ? 'Professional listing created.' : ''} Email notification sent.`,
      });

      setTimeout(() => onBack(), 1500);
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update application status.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };




  const saveNotes = async () => {
    setLoading(true);
    try {
      await saveApplicationNotes(application.id, reviewNotes);

      toast({
        title: 'Success',
        description: 'Review notes saved successfully.',
      });
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to save review notes.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };


  const name = `${application.profile?.firstName || ''} ${application.profile?.lastName || ''}`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Applications
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          <p className="text-gray-600">Application Review</p>
        </div>
        <div className="ml-auto">
          <Badge className={`${application.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                             application.status === 'approved' ? 'bg-green-100 text-green-800' :
                             'bg-red-100 text-red-800'}`}>
            {application.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-gray-700">Business Name</label>
                  <p className="text-gray-900">{application.profile?.businessName || 'N/A'}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Email</label>
                  <p className="text-gray-900">{application.email}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Phone</label>
                  <p className="text-gray-900">{application.profile?.phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Location</label>
                  <p className="text-gray-900">{application.profile?.city}, {application.profile?.state}</p>
                </div>
              </div>
              <div>
                <label className="font-medium text-gray-700">Professional Bio</label>
                <p className="text-gray-900">{application.profile?.bio || 'No bio provided'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Credentials & Licenses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="font-medium text-gray-700">Professional Licenses</label>
                {application.credentials?.licenses?.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-900">
                    {application.credentials.licenses.map((license: any, idx: number) => (
                      <li key={idx}>{license.type} - {license.number}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No licenses provided</p>
                )}
              </div>
              <div>
                <label className="font-medium text-gray-700">Certifications</label>
                {application.credentials?.certifications?.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-900">
                    {application.credentials.certifications.map((cert: string, idx: number) => (
                      <li key={idx}>{cert}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No certifications provided</p>
                )}
              </div>
              <div>
                <label className="font-medium text-gray-700">EIN</label>
                <p className="text-gray-900">{application.credentials?.ein || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Services & Pricing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="font-medium text-gray-700">Services Offered</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {application.services?.services?.map((service: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{service}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Hourly Rate</label>
                  <p className="text-gray-900">${application.pricing?.hourlyRate || 'N/A'}/hour</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Consultation Fee</label>
                  <p className="text-gray-900">${application.pricing?.consultationFee || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleStatusChange('approved')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={application.status === 'approved' || loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Approve
                </Button>
                <Button 
                  onClick={() => handleStatusChange('rejected')}
                  variant="destructive"
                  className="flex-1"
                  disabled={application.status === 'rejected' || loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Add review notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={6}
              />
              <Button onClick={saveNotes} variant="outline" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Notes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <label className="font-medium text-gray-700">Working Days</label>
                <p className="text-gray-900">{application.availability?.workingDays?.join(', ') || 'N/A'}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Timezone</label>
                <p className="text-gray-900">{application.availability?.timezone || 'N/A'}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Max Daily Appointments</label>
                <p className="text-gray-900">{application.availability?.maxDailyAppointments || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
