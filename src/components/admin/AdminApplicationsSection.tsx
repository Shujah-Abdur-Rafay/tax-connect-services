// ============================================================================
// AdminApplicationsSection — the "Applications" console section.
//
// Extracted verbatim from the old AdminDashboard tab so the routed admin
// console reuses the exact same review workflow (search/filter list →
// ApplicationReview detail). Lives behind the 'applications' permission.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Filter, Loader2 } from 'lucide-react';
import { ApplicationReview } from '../ApplicationReview';
import { getAllApplications } from '@/services/enrollmentService';

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const AdminApplicationsSection: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const data = await getAllApplications();
      setApplications(
        data.map((app) => ({
          id: app.id!,
          email: app.email,
          status: app.status,
          submittedAt: app.submittedAt,
          profile: app.profile,
          credentials: app.credentials,
          services: app.services,
          pricing: app.pricing,
          availability: app.availability,
          reviewNotes: app.reviewNotes,
        })),
      );
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const filteredApplications = applications.filter((app) => {
    const name = `${app.profile?.firstName || ''} ${app.profile?.lastName || ''}`;
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (selectedApp) {
    return (
      <ApplicationReview
        application={selectedApp}
        onBack={() => {
          setSelectedApp(null);
          fetchApplications();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
        <p className="text-sm text-slate-500">Review professional applications and onboarding.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredApplications.map((application) => {
          const name = `${application.profile?.firstName || ''} ${application.profile?.lastName || ''}`;
          const services = application.services?.services || [];
          const credentials = application.credentials?.licenses || [];

          return (
            <Card key={application.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{name || 'No Name'}</h3>
                      <Badge className={getStatusColor(application.status)}>{application.status}</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-4 text-sm text-gray-600 md:grid-cols-3">
                      <div>
                        <p>
                          <strong>Email:</strong> {application.email}
                        </p>
                        <p>
                          <strong>Phone:</strong> {application.profile?.phone || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p>
                          <strong>Submitted:</strong>{' '}
                          {new Date(application.submittedAt).toLocaleDateString()}
                        </p>
                        <p>
                          <strong>Business:</strong> {application.profile?.businessName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p>
                          <strong>Services:</strong> {services.length} offered
                        </p>
                        <p>
                          <strong>Credentials:</strong> {credentials.length} licenses
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => setSelectedApp(application)} variant="outline" className="ml-4">
                    <Eye className="mr-2 h-4 w-4" />
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredApplications.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-500">No applications found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default AdminApplicationsSection;
