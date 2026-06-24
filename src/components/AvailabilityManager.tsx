import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Clock, Save } from 'lucide-react';

interface DayAvailability {
  day: number;
  name: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface AvailabilityManagerProps {
  professionalId: string;
}

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({
  professionalId,
}) => {
  const { toast } = useToast();
  const [availability, setAvailability] = useState<DayAvailability[]>([
    { day: 1, name: 'Monday', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 2, name: 'Tuesday', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 3, name: 'Wednesday', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 4, name: 'Thursday', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 5, name: 'Friday', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 6, name: 'Saturday', enabled: false, startTime: '09:00', endTime: '13:00' },
    { day: 0, name: 'Sunday', enabled: false, startTime: '09:00', endTime: '13:00' },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  const loadAvailability = async () => {
    try {
      const q = query(
        collection(db, 'professional_availability'),
        where('professional_id', '==', professionalId),
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));

      if (rows.length > 0) {
        setAvailability((prev) =>
          prev.map((day) => {
            const saved = rows.find((r) => Number(r.day_of_week) === day.day);
            if (!saved) return day;
            const startStr = (saved.start_time as string) || '09:00:00';
            const endStr = (saved.end_time as string) || '17:00:00';
            return {
              ...day,
              enabled: saved.is_available === true,
              startTime: startStr.substring(0, 5),
              endTime: endStr.substring(0, 5),
            };
          }),
        );
      }
    } catch (error) {
      console.error('[AvailabilityManager] load failed:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Delete existing availability docs for this pro in a batch.
      const existingQ = query(
        collection(db, 'professional_availability'),
        where('professional_id', '==', professionalId),
      );
      const existingSnap = await getDocs(existingQ);

      const batch = writeBatch(db);
      existingSnap.docs.forEach((d) => batch.delete(d.ref));

      // 2. Insert the new 7-day schedule in the same batch.
      availability.forEach((day) => {
        const newRef = doc(collection(db, 'professional_availability'));
        batch.set(newRef, {
          professional_id: professionalId,
          day_of_week: day.day,
          start_time: `${day.startTime}:00`,
          end_time: `${day.endTime}:00`,
          is_available: day.enabled,
          updated_at: serverTimestamp(),
          created_at: serverTimestamp(),
        });
      });

      await batch.commit();

      toast({
        title: 'Saved',
        description: 'Your availability has been updated.',
      });
    } catch (error: any) {
      console.error('[AvailabilityManager] save failed:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save availability.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDay = (index: number, field: string, value: any) => {
    setAvailability((prev) =>
      prev.map((day, i) => (i === index ? { ...day, [field]: value } : day)),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Manage Availability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {availability.map((day, index) => (
          <div key={day.day} className="flex items-center gap-4 p-3 border rounded">
            <Switch
              checked={day.enabled}
              onCheckedChange={(checked) => updateDay(index, 'enabled', checked)}
            />
            <Label className="w-24">{day.name}</Label>
            {day.enabled && (
              <>
                <input
                  type="time"
                  value={day.startTime}
                  onChange={(e) => updateDay(index, 'startTime', e.target.value)}
                  className="border rounded px-2 py-1"
                />
                <span>to</span>
                <input
                  type="time"
                  value={day.endTime}
                  onChange={(e) => updateDay(index, 'endTime', e.target.value)}
                  className="border rounded px-2 py-1"
                />
              </>
            )}
          </div>
        ))}
        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Availability'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AvailabilityManager;
