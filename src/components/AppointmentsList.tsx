import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Mail, Phone, DollarSign } from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  service_type: string;
  status: string;
  deposit_amount: number;
  deposit_paid: boolean;
  notes: string;
}

interface AppointmentsListProps {
  professionalId: string;
}

const AppointmentsList: React.FC<AppointmentsListProps> = ({ professionalId }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'appointments'),
        where('professional_id', '==', professionalId),
        orderBy('appointment_date', 'asc'),
        orderBy('start_time', 'asc'),
      );
      const snap = await getDocs(q);
      const rows: Appointment[] = snap.docs.map((d) => {
        const v = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          client_name: (v.client_name as string) || '',
          client_email: (v.client_email as string) || '',
          client_phone: (v.client_phone as string) || '',
          appointment_date: (v.appointment_date as string) || '',
          start_time: (v.start_time as string) || '',
          end_time: (v.end_time as string) || '',
          service_type: (v.service_type as string) || '',
          status: (v.status as string) || 'pending',
          deposit_amount: Number(v.deposit_amount || 0),
          deposit_paid: v.deposit_paid === true,
          notes: (v.notes as string) || '',
        };
      });
      setAppointments(rows);
    } catch (error: any) {
      console.error('[AppointmentsList] load failed:', error);
      toast({
        title: 'Error',
        description:
          error?.message ||
          'Failed to load appointments. The required Firestore index may still be building.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status,
        updated_at: serverTimestamp(),
      });
      toast({ title: 'Updated', description: `Appointment ${status}` });
      loadAppointments();
    } catch (error: any) {
      console.error('[AppointmentsList] update failed:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update appointment.',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) return <div>Loading appointments...</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Your Appointments</h3>
      {appointments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No appointments scheduled yet
          </CardContent>
        </Card>
      ) : (
        appointments.map((apt) => (
          <Card key={apt.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {apt.client_name}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {apt.client_email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {apt.client_phone}
                    </div>
                  </div>
                </div>
                <Badge className={getStatusColor(apt.status)}>{apt.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {apt.appointment_date
                    ? new Date(apt.appointment_date).toLocaleDateString()
                    : '—'}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {apt.start_time ? apt.start_time.substring(0, 5) : '—'}
                </div>
              </div>
              <div>
                <strong>Service:</strong> {apt.service_type}
              </div>
              {apt.deposit_amount ? (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Deposit: ${apt.deposit_amount}
                  {apt.deposit_paid ? ' (Paid)' : ' (Pending)'}
                </div>
              ) : null}
              {apt.notes && (
                <div>
                  <strong>Notes:</strong> {apt.notes}
                </div>
              )}
              {apt.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={() => updateStatus(apt.id, 'confirmed')}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateStatus(apt.id, 'cancelled')}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {apt.status === 'confirmed' && (
                <Button
                  size="sm"
                  onClick={() => updateStatus(apt.id, 'completed')}
                >
                  Mark Complete
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default AppointmentsList;
