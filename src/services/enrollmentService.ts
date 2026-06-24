import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  queueFirebaseEmail,
  buildBrandedEmail,
  ADMIN_NOTIFICATION_EMAIL,
} from '@/services/firebaseEmailService';
import { syncContactToCrm } from '@/services/crmSyncService';

const ADMIN_EMAIL = ADMIN_NOTIFICATION_EMAIL; // info@alliance-tax.com


/**
 * Send admin notification email when a new application is submitted.
 * Uses Firebase (Firestore `mail` collection) — no Supabase dependency.
 * Wrapped in try/catch so email failures never block form submission.
 */
async function sendAdminApplicationNotification(
  applicationId: string,
  data: Omit<EnrollmentApplication, 'id' | 'status' | 'submittedAt'>
): Promise<void> {
  try {
    const firstName = data.profile?.firstName || '';
    const lastName = data.profile?.lastName || '';
    const applicantName = `${firstName} ${lastName}`.trim() || 'Not provided';
    const location = [data.profile?.city, data.profile?.state]
      .filter(Boolean)
      .join(', ');

    const services = Array.isArray(data.services?.services)
      ? data.services.services.join(', ')
      : data.services?.services || 'Not specified';

    const specializations = Array.isArray(data.services?.specializations)
      ? data.services.specializations.join(', ')
      : '';

    const reviewUrl = `${
      typeof window !== 'undefined' ? window.location.origin : ''
    }/admin?tab=applications&id=${applicationId}`;

    const submittedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const html = buildBrandedEmail({
      title: 'New Tax Professional Application',
      intro: `${applicantName} has just submitted a new application to join Refund Connect. Review their details below and take action in the admin dashboard.`,
      rows: [
        { label: 'Applicant', value: applicantName },
        { label: 'Email', value: data.email },
        { label: 'Phone', value: data.profile?.phone || 'Not provided' },
        { label: 'Business', value: data.profile?.businessName || '—' },
        { label: 'Location', value: location || '—' },
        {
          label: 'Years of Experience',
          value: String(data.profile?.yearsExperience ?? '—'),
        },
        { label: 'Services Offered', value: services },
        ...(specializations
          ? [{ label: 'Specializations', value: specializations }]
          : []),
        { label: 'Submitted', value: submittedAt },
      ],
      ctaLabel: 'Review in Admin Dashboard',
      ctaUrl: reviewUrl,
      footer:
        'You are receiving this because you are listed as an admin for Refund Connect.',
      accentColor: '#2563eb',
    });

    await queueFirebaseEmail({
      to: ADMIN_EMAIL,
      subject: `New Application: ${applicantName}`,
      html,
      category: 'professional_application',
      meta: {
        applicationId,
        applicantName,
        applicantEmail: data.email,
        applicantPhone: data.profile?.phone || '',
        businessName: data.profile?.businessName || '',
        location,
        yearsExperience: data.profile?.yearsExperience || '',
        servicesOffered: services,
        specializations,
        reviewUrl,
      },
    });
    console.log(
      '✅ Admin notification queued (Firebase) for application',
      applicationId,
    );
  } catch (err) {
    // Never block form submission on email failures.
    console.warn('⚠️ Admin notification email failed (non-blocking):', err);
  }
}




export interface EnrollmentApplication {
  id?: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  profile: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    businessName?: string;
    website?: string;
    bio?: string;
    profilePhoto?: string;
    yearsExperience?: number;
    experienceLevel?: string;
    priorYearBankProducts?: string;
  };

  credentials?: any;
  services?: any;
  pricing?: any;
  availability?: any;
}

const COLLECTION_NAME = 'tax_professional_applications';

/**
 * Submit a new enrollment application to Firestore.
 * This is used by the public enrollment form.
 */
export async function submitEnrollmentApplication(
  data: Omit<EnrollmentApplication, 'id' | 'status' | 'submittedAt'>
): Promise<{ id: string }> {
  try {
    const payload = {
      ...data,
      status: 'pending' as const,
      submittedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    console.log('✅ Enrollment application submitted to Firestore:', docRef.id);

    // Fire-and-forget admin notification email. Never blocks submission.
    sendAdminApplicationNotification(docRef.id, data).catch((err) => {
      console.warn('⚠️ Admin email notification failed:', err);
    });

    // Fire-and-forget CRM sync — pushes the enrollee into the Famous CRM
    // as a "Directory Listing" lead until they upgrade. Never blocks.
    const applicantName = `${data.profile?.firstName || ''} ${data.profile?.lastName || ''}`.trim();
    syncContactToCrm({
      email: data.email,
      name: applicantName || undefined,
      phone: data.profile?.phone,
      enrollmentLevel: 'Directory Listing',
      source: 'enrollment-application',
      extraTags: ['pending-application'],
      internalId: docRef.id,
    }).catch((err) => {
      console.warn('⚠️ CRM sync failed (non-blocking):', err);
    });

    return { id: docRef.id };

  } catch (error: any) {
    console.error('❌ Error submitting enrollment application:', error);
    throw new Error(
      error?.message ||
        'Failed to submit your application. Please check your internet connection and try again.'
    );
  }
}

/**
 * Get all enrollment applications (admin only).
 */
export async function getAllApplications(): Promise<EnrollmentApplication[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('submittedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const raw = d.data() as any;
      const submittedAt =
        raw.submittedAt instanceof Timestamp
          ? raw.submittedAt.toDate().toISOString()
          : raw.submittedAt || new Date().toISOString();
      return {
        id: d.id,
        email: raw.email || '',
        status: raw.status || 'pending',
        submittedAt,
        reviewedAt: raw.reviewedAt,
        reviewNotes: raw.reviewNotes,
        profile: raw.profile || {},
        credentials: raw.credentials || {},
        services: raw.services || {},
        pricing: raw.pricing || {},
        availability: raw.availability || {},
      } as EnrollmentApplication;
    });
  } catch (error) {
    console.error('❌ Error fetching applications:', error);
    return [];
  }
}

/**
 * Update an application's status (approve/reject) and review notes.
 */
export async function updateApplicationStatus(
  applicationId: string,
  status: 'approved' | 'rejected',
  reviewNotes?: string
): Promise<void> {
  try {
    const ref = doc(db, COLLECTION_NAME, applicationId);
    await updateDoc(ref, {
      status,
      reviewNotes: reviewNotes || '',
      reviewedAt: new Date().toISOString(),
    });
    console.log(`✅ Application ${applicationId} marked as ${status}`);
  } catch (error: any) {
    console.error('❌ Error updating application status:', error);
    throw new Error(error?.message || 'Failed to update application status');
  }
}

/**
 * Save just the review notes without changing status.
 */
export async function saveApplicationNotes(
  applicationId: string,
  reviewNotes: string
): Promise<void> {
  try {
    const ref = doc(db, COLLECTION_NAME, applicationId);
    await updateDoc(ref, { reviewNotes });
  } catch (error: any) {
    console.error('❌ Error saving notes:', error);
    throw new Error(error?.message || 'Failed to save review notes');
  }
}

/**
 * Create a professional listing in Firestore when application is approved.
 */
export async function createProfessionalFromApplication(
  application: EnrollmentApplication
): Promise<void> {
  try {
    const professionalData = {
      application_id: application.id,
      email: application.email,
      full_name: `${application.profile?.firstName || ''} ${
        application.profile?.lastName || ''
      }`.trim(),
      first_name: application.profile?.firstName || '',
      last_name: application.profile?.lastName || '',
      business_name: application.profile?.businessName || null,
      phone: application.profile?.phone || null,
      city: application.profile?.city || '',
      state: application.profile?.state || '',
      location: `${application.profile?.city || ''}${
        application.profile?.city && application.profile?.state ? ', ' : ''
      }${application.profile?.state || ''}`.trim(),
      bio: application.profile?.bio || null,
      profile_image_url: application.profile?.profilePhoto || '',
      credentials: application.credentials || {},
      services: application.services?.services || [],
      specializations: application.services?.specializations || [],
      pricing: {
        hourlyRate: application.pricing?.hourlyRate || null,
        consultationFee: application.pricing?.consultationFee || null,
        packagePricing: application.pricing?.packagePricing || [],
      },
      availability: {
        workingDays: application.availability?.workingDays || [],
        timezone: application.availability?.timezone || null,
        maxDailyAppointments:
          application.availability?.maxDailyAppointments || null,
      },
      years_experience: application.profile?.yearsExperience || 0,
      rating: 0,
      review_count: 0,
      membership_level: 'Professional',
      // Approving an application publishes the pro and marks them approved
      approval_status: 'approved',
      is_published: true,
      approved_at: serverTimestamp(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    // Use the application ID as the doc ID so we can upsert idempotently
    const profRef = doc(db, 'professionals', application.id!);
    await setDoc(profRef, professionalData, { merge: true });
    console.log('✅ Professional listing created in Firestore (approved + published)');
  } catch (error: any) {
    console.error('❌ Error creating professional listing:', error);
    throw new Error(
      error?.message || 'Failed to create professional listing'
    );
  }
}
