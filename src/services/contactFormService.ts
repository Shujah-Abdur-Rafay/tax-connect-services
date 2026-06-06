import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export interface ContactSubmission {
  id?: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  phone?: string;
  service_type?: string;
  preferred_contact?: string;
  professional_id?: string;
  professional_name?: string;
  form_type: 'support' | 'professional_contact';
  created_at?: string;
  status?: 'new' | 'in_progress' | 'resolved';
  client_id?: string;
  conversation_id?: string;
}

const tsToIso = (value: unknown): string => {
  if (!value) return new Date().toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'seconds' in (value as any)) {
    return new Date(((value as any).seconds as number) * 1000).toISOString();
  }
  return new Date().toISOString();
};

/**
 * Persist a contact-form submission to Firestore. Returns the new doc id.
 */
export const submitContactForm = async (
  data: ContactSubmission,
): Promise<{ id: string }> => {
  const payload = {
    name: data.name,
    email: data.email,
    subject: data.subject || null,
    message: data.message,
    phone: data.phone || null,
    service_type: data.service_type || null,
    preferred_contact: data.preferred_contact || null,
    professional_id: data.professional_id || null,
    professional_name: data.professional_name || null,
    form_type: data.form_type,
    status: 'new' as const,
    client_id: data.client_id || null,
    conversation_id: data.conversation_id || null,
    created_at: serverTimestamp(),
  };

  const result = await addDoc(collection(db, 'contact_submissions'), payload);
  return { id: result.id };
};

export const getContactSubmissions = async (): Promise<ContactSubmission[]> => {
  try {
    const q = query(collection(db, 'contact_submissions'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: (raw.name as string) || '',
        email: (raw.email as string) || '',
        subject: (raw.subject as string) || undefined,
        message: (raw.message as string) || '',
        phone: (raw.phone as string) || undefined,
        service_type: (raw.service_type as string) || undefined,
        preferred_contact: (raw.preferred_contact as string) || undefined,
        professional_id: (raw.professional_id as string) || undefined,
        professional_name: (raw.professional_name as string) || undefined,
        form_type:
          ((raw.form_type as string) || 'professional_contact') as ContactSubmission['form_type'],
        status: ((raw.status as string) || 'new') as ContactSubmission['status'],
        client_id: (raw.client_id as string) || undefined,
        conversation_id: (raw.conversation_id as string) || undefined,
        created_at: tsToIso(raw.created_at),
      };
    });
  } catch (err) {
    console.warn('getContactSubmissions failed:', (err as Error).message);
    return [];
  }
};

export const updateSubmissionStatus = async (
  id: string,
  status: 'new' | 'in_progress' | 'resolved',
): Promise<void> => {
  await updateDoc(doc(db, 'contact_submissions', id), {
    status,
    updated_at: serverTimestamp(),
  });
};
