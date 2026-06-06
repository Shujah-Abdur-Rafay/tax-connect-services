import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';

interface AvailabilityStepProps {
  data: {
    workingDays: string[];
    workingHours: {
      [key: string]: { start: string; end: string; available: boolean };
    };
    timezone: string;
    seasonalAvailability: string;
    appointmentBuffer: string;
    maxDailyAppointments: string;
    specialNotes: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function AvailabilityStep({ data, onUpdate, onNext, onBack }: AvailabilityStepProps) {
  const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  const handleDayToggle = (day: string, available: boolean) => {
    const updatedHours = { ...data.workingHours };
    if (!updatedHours[day]) {
      updatedHours[day] = { start: '9:00 AM', end: '5:00 PM', available: false };
    }
    updatedHours[day].available = available;
    onUpdate({ ...data, workingHours: updatedHours });
  };

  const handleTimeUpdate = (day: string, field: 'start' | 'end', value: string) => {
    const updatedHours = { ...data.workingHours };
    if (!updatedHours[day]) {
      updatedHours[day] = { start: '9:00 AM', end: '5:00 PM', available: true };
    }
    updatedHours[day][field] = value;
    onUpdate({ ...data, workingHours: updatedHours });
  };

  const isValid = data.timezone && Object.values(data.workingHours).some(day => day.available);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Availability & Schedule
        </CardTitle>
        <CardDescription>
          Set your working hours and availability preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="timezone" className="text-base font-medium">Timezone *</Label>
          <Input
            id="timezone"
            value={data.timezone}
            onChange={(e) => onUpdate({...data, timezone: e.target.value})}
            placeholder="e.g., Eastern Time (ET), Pacific Time (PT)"
            className="mt-2"
          />
        </div>

        <div>
          <Label className="text-base font-medium">Working Hours</Label>
          <div className="space-y-3 mt-2">
            {daysOfWeek.map((day) => {
              const dayData = data.workingHours[day] || { start: '9:00 AM', end: '5:00 PM', available: false };
              return (
                <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={dayData.available}
                      onCheckedChange={(checked) => handleDayToggle(day, checked)}
                    />
                    <Label className="w-20 text-sm font-medium">{day}</Label>
                  </div>
                  
                  {dayData.available && (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={dayData.start}
                        onChange={(e) => handleTimeUpdate(day, 'start', e.target.value)}
                        placeholder="9:00 AM"
                        className="w-32"
                      />
                      <span className="text-sm text-gray-500">to</span>
                      <Input
                        value={dayData.end}
                        onChange={(e) => handleTimeUpdate(day, 'end', e.target.value)}
                        placeholder="5:00 PM"
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="buffer">Appointment Buffer (minutes)</Label>
            <Input
              id="buffer"
              type="number"
              value={data.appointmentBuffer}
              onChange={(e) => onUpdate({...data, appointmentBuffer: e.target.value})}
              placeholder="15"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="maxAppointments">Max Daily Appointments</Label>
            <Input
              id="maxAppointments"
              type="number"
              value={data.maxDailyAppointments}
              onChange={(e) => onUpdate({...data, maxDailyAppointments: e.target.value})}
              placeholder="5"
              className="mt-2"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="seasonal">Seasonal Availability</Label>
          <Input
            id="seasonal"
            value={data.seasonalAvailability}
            onChange={(e) => onUpdate({...data, seasonalAvailability: e.target.value})}
            placeholder="e.g., Year-Round, Tax Season Only (Jan-Apr)"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="notes">Availability Notes</Label>
          <Textarea
            id="notes"
            value={data.specialNotes}
            onChange={(e) => onUpdate({...data, specialNotes: e.target.value})}
            placeholder="Any special scheduling requirements, vacation periods, or availability notes..."
            rows={3}
            className="mt-2"
          />
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button disabled={!isValid} onClick={onNext}>
            Complete Setup
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}