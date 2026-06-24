import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import BookingPaymentForm from './BookingPaymentForm';

interface BookingFormProps {
  professionalId: string;
  professionalName: string;
  professionalEmail: string;
  selectedDate?: Date;
  selectedTime?: string;
  onClose: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({
  professionalId,
  professionalName,
  professionalEmail,
  selectedDate,
  selectedTime,
  onClose,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.displayName || '',
    email: user?.email || '',
    phone: '',
    serviceType: '',
    message: '',
  });
  const [showPayment, setShowPayment] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const serviceDeposits: Record<string, number> = {
    consultation: 50,
    'tax-prep': 100,
    planning: 75,
    audit: 150,
  };

  const convertTo24Hour = (time12: string): string => {
    const [time, period] = time12.split(' ');
    const [hours] = time.split(':');
    let hour = parseInt(hours, 10);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00:00`;
  };

  const addHour = (time: string): string => {
    const hour = parseInt(time.split(':')[0], 10) + 1;
    return `${hour.toString().padStart(2, '0')}:00:00`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!selectedDate || !selectedTime) {
        throw new Error('Please pick a date and time before continuing.');
      }
      if (!formData.serviceType) {
        throw new Error('Please choose a service type.');
      }

      const depositAmount = serviceDeposits[formData.serviceType] || 50;
      const startTime = convertTo24Hour(selectedTime);
      const endTime = addHour(startTime);
      const appointmentDate = selectedDate.toISOString().split('T')[0];

      // ── Sync the lead into the Famous CRM (every email collection MUST
      //    go to /api/crm/.../subscribe). Best-effort — never blocks booking.
      try {
        await fetch(
          'https://famous.ai/api/crm/68a3939608e7f1e2bfd480c9/subscribe',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              name: formData.name,
              source: 'booking-form',
              tags: ['booking', 'appointment-deposit', formData.serviceType],
            }),
          },
        );
      } catch (crmErr) {
        console.warn('[BookingForm] CRM sync failed (non-fatal):', crmErr);
      }

      // ── Write the appointment to Firestore ───────────────────────────────
      const ref = await addDoc(collection(db, 'appointments'), {
        professional_id: professionalId,
        professional_name: professionalName,
        professional_email: professionalEmail,
        client_id: user?.uid || 'guest',
        client_name: formData.name,
        client_email: formData.email,
        client_phone: formData.phone,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
        service_type: formData.serviceType,
        notes: formData.message,
        deposit_amount: depositAmount,
        deposit_paid: false,
        status: 'pending',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setAppointmentId(ref.id);
      setShowPayment(true);
    } catch (error: any) {
      console.error('[BookingForm] submit failed:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create appointment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (showPayment) {
    return (
      <BookingPaymentForm
        appointmentId={appointmentId}
        amount={serviceDeposits[formData.serviceType]}
        professionalName={professionalName}
        professionalEmail={professionalEmail}
        professionalId={professionalId}
        clientName={formData.name}
        clientEmail={formData.email}
        appointmentDate={selectedDate!.toLocaleDateString()}
        startTime={selectedTime!}
        serviceType={formData.serviceType}
        onSuccess={onClose}
        onCancel={() => setShowPayment(false)}
      />
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Book with {professionalName}
        </CardTitle>
        <div className="text-sm text-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4" />
            {selectedDate?.toLocaleDateString()}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {selectedTime}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="serviceType">Service Type</Label>
            <Select
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, serviceType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">
                  Initial Consultation ($50)
                </SelectItem>
                <SelectItem value="tax-prep">Tax Preparation ($100)</SelectItem>
                <SelectItem value="planning">Tax Planning ($75)</SelectItem>
                <SelectItem value="audit">Audit Support ($150)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="message">Additional Notes</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, message: e.target.value }))
              }
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Processing...' : 'Continue to Payment'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BookingForm;
