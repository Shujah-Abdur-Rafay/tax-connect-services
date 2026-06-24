import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface AvailabilityCalendarProps {
  professionalId: string;
  onTimeSlotSelect: (date: Date, time: string) => void;
}

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  professionalId,
  onTimeSlotSelect,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, professionalId]);

  const loadAvailableSlots = async (date: Date) => {
    setLoading(true);
    try {
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];

      // ── Professional's weekly availability for this day ──────────────────
      const availQ = query(
        collection(db, 'professional_availability'),
        where('professional_id', '==', professionalId),
        where('day_of_week', '==', dayOfWeek),
        where('is_available', '==', true),
      );
      const availSnap = await getDocs(availQ);
      const availability = availSnap.docs.map((d) => d.data() as Record<string, unknown>);

      // ── Existing appointments on this date (any active status) ───────────
      const apptQ = query(
        collection(db, 'appointments'),
        where('professional_id', '==', professionalId),
        where('appointment_date', '==', dateStr),
      );
      const apptSnap = await getDocs(apptQ);
      const bookedTimes = new Set<string>();
      apptSnap.docs.forEach((d) => {
        const v = d.data() as Record<string, unknown>;
        const status = (v.status as string) || '';
        if (status === 'pending' || status === 'confirmed') {
          const st = (v.start_time as string) || '';
          if (st) bookedTimes.add(st);
        }
      });

      // ── Build hourly slots in the configured window ──────────────────────
      const slots: TimeSlot[] = [];
      if (availability.length > 0) {
        const avail = availability[0];
        const startStr = (avail.start_time as string) || '09:00:00';
        const endStr = (avail.end_time as string) || '17:00:00';
        const startHour = parseInt(startStr.split(':')[0], 10);
        const endHour = parseInt(endStr.split(':')[0], 10);

        for (let hour = startHour; hour < endHour; hour++) {
          const time24 = `${hour.toString().padStart(2, '0')}:00:00`;
          slots.push({
            time: formatTime12Hour(hour),
            available: !bookedTimes.has(time24),
          });
        }
      }

      setTimeSlots(slots);
    } catch (error) {
      console.error('[AvailabilityCalendar] failed to load slots:', error);
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime12Hour = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${hour12}:00 ${period}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Select Appointment Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => date < new Date() || date.getDay() === 0}
            className="rounded-md border"
          />
          <div>
            <h4 className="font-medium mb-4">
              Available Times for {selectedDate?.toLocaleDateString()}
            </h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No available times</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot.time}
                    variant={slot.available ? 'outline' : 'ghost'}
                    size="sm"
                    disabled={!slot.available}
                    onClick={() => onTimeSlotSelect(selectedDate!, slot.time)}
                  >
                    {slot.time}
                    {!slot.available && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Booked
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AvailabilityCalendar;
