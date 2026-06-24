import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, User, CalendarX2 } from 'lucide-react';

interface ClientAppointment {
  id: string;
  professional_name: string;
  appointment_date: string;
  start_time: string;
  service_type: string;
  status: string;
}

const statusColor = (status: string) =>
  ({
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
  })[status] || 'bg-gray-100 text-gray-800';

/**
 * Phase 2 — client-side appointments. Queries `appointments` by client_id so a
 * client sees the bookings they made (the pro-facing AppointmentsList queries
 * by professional_id). Read access is granted by the appointments rule
 * (client_id == uid).
 */
const ClientAppointmentsList: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!db || !clientId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'appointments'), where('client_id', '==', clientId)),
        );
        const rows: ClientAppointment[] = snap.docs.map((d) => {
          const v = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            professional_name:
              (v.professional_name as string) || (v.pro_name as string) || 'Your tax pro',
            appointment_date: (v.appointment_date as string) || '',
            start_time: (v.start_time as string) || '',
            service_type: (v.service_type as string) || '',
            status: (v.status as string) || 'pending',
          };
        });
        rows.sort((a, b) => (a.appointment_date || '').localeCompare(b.appointment_date || ''));
        if (!cancelled) setAppointments(rows);
      } catch (e) {
        console.warn('[ClientAppointmentsList] load failed:', (e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CalendarX2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <h3 className="font-semibold text-slate-900">No appointments yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            When you book a consultation with a tax pro, it'll show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((apt) => (
        <Card key={apt.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                {apt.professional_name}
              </CardTitle>
              <Badge className={statusColor(apt.status)}>{apt.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {apt.appointment_date ? new Date(apt.appointment_date).toLocaleDateString() : '—'}
              <Clock className="ml-3 h-4 w-4" />
              {apt.start_time ? apt.start_time.substring(0, 5) : '—'}
            </div>
            {apt.service_type && (
              <div>
                <span className="font-medium text-slate-700">Service:</span> {apt.service_type}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ClientAppointmentsList;
