import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getContactSubmissions, updateSubmissionStatus, ContactSubmission } from '@/services/contactFormService';
import { useToast } from '@/hooks/use-toast';
import { Mail, Phone, Calendar, User } from 'lucide-react';

const ContactSubmissions: React.FC = () => {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      const data = await getContactSubmissions();
      setSubmissions(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: 'new' | 'in_progress' | 'resolved') => {
    try {
      await updateSubmissionStatus(id, status);
      setSubmissions(prev =>
        prev.map(sub => sub.id === id ? { ...sub, status } : sub)
      );
      toast({
        title: "Status Updated",
        description: "Submission status has been updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-lg">Loading submissions...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Contact Submissions</h1>
            <p className="text-gray-600">Manage and respond to customer inquiries</p>
          </div>

          <div className="grid gap-6">
            {submissions.map((submission) => (
              <Card key={submission.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {submission.name}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {submission.form_type === 'support' ? 'Support Request' : `Contact for ${submission.professional_name}`}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(submission.status)}>
                      {submission.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span>{submission.email}</span>
                      </div>
                      {submission.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span>{submission.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{new Date(submission.created_at!).toLocaleString()}</span>
                      </div>
                    </div>

                    {submission.subject && (
                      <div>
                        <p className="font-medium text-sm mb-1">Subject:</p>
                        <p className="text-sm text-gray-700">{submission.subject}</p>
                      </div>
                    )}

                    <div>
                      <p className="font-medium text-sm mb-1">Message:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{submission.message}</p>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        size="sm"
                        variant={submission.status === 'new' ? 'default' : 'outline'}
                        onClick={() => handleStatusChange(submission.id!, 'new')}
                      >
                        New
                      </Button>
                      <Button
                        size="sm"
                        variant={submission.status === 'in_progress' ? 'default' : 'outline'}
                        onClick={() => handleStatusChange(submission.id!, 'in_progress')}
                      >
                        In Progress
                      </Button>
                      <Button
                        size="sm"
                        variant={submission.status === 'resolved' ? 'default' : 'outline'}
                        onClick={() => handleStatusChange(submission.id!, 'resolved')}
                      >
                        Resolved
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {submissions.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">No submissions yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ContactSubmissions;
