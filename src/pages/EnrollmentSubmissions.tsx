import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Enrollment {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  experience_level: string;
  prior_year_bank_products: string;
  membership_level: string;
  stripe_session_id: string;
  status: string;
  created_at: string;
}

const EnrollmentSubmissions = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Enrollment Submissions</h1>
        <p className="text-muted-foreground">
          View and manage membership enrollments
        </p>
      </div>

      {enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No enrollments yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      {enrollment.first_name} {enrollment.last_name}
                    </CardTitle>
                    <CardDescription>
                      {new Date(enrollment.created_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge variant={enrollment.status === 'pending' ? 'secondary' : 'default'}>
                    {enrollment.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{enrollment.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{enrollment.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Experience Level</p>
                    <p className="text-sm text-muted-foreground">{enrollment.experience_level}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Membership Level</p>
                    <p className="text-sm text-muted-foreground">{enrollment.membership_level}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">{enrollment.address}</p>
                  </div>
                  {enrollment.prior_year_bank_products && (
                    <div>
                      <p className="text-sm font-medium">Prior Year Bank Products</p>
                      <p className="text-sm text-muted-foreground">{enrollment.prior_year_bank_products}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnrollmentSubmissions;
