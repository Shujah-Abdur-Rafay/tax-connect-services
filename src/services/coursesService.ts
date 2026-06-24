// ============================================================================
// coursesService — continuing-education enrollments, backed by Firestore
// `course_enrollments`. Powers the "Courses" tile + count on the member
// dashboard (total enrolled + how many are in progress).
//
// Firestore schema (course_enrollments/{id}):
//   user_id       — uid of the enrolled member (rule: own rows only)
//   course_id     — stable id/slug of the course
//   course_title  — display title
//   status        — 'enrolled' | 'in_progress' | 'completed'
//   progress      — 0..100
//   created_at / updated_at — serverTimestamp
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COLLECTION = 'course_enrollments';

export type CourseStatus = 'enrolled' | 'in_progress' | 'completed';

export interface CourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  status: CourseStatus;
  progress: number;
  created_at?: string;
  updated_at?: string;
}

const tsToIso = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as any)?.toDate === 'function') {
    try {
      return (v as any).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof v === 'string') return v;
  return undefined;
};

const docToEnrollment = (id: string, data: any): CourseEnrollment => ({
  id,
  user_id: data.user_id || '',
  course_id: data.course_id || '',
  course_title: data.course_title || 'Course',
  status: (data.status as CourseStatus) || 'enrolled',
  progress: Math.max(0, Math.min(100, Number(data.progress || 0))),
  created_at: tsToIso(data.created_at),
  updated_at: tsToIso(data.updated_at),
});

export async function enrollInCourse(input: {
  userId: string;
  courseId: string;
  courseTitle: string;
}): Promise<CourseEnrollment> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!input.userId) throw new Error('You must be signed in to enroll.');
  const payload = {
    user_id: input.userId,
    course_id: input.courseId,
    course_title: input.courseTitle,
    status: 'enrolled' as CourseStatus,
    progress: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return docToEnrollment(ref.id, { ...payload, created_at: new Date(), updated_at: new Date() });
}

export async function updateCourseProgress(
  enrollmentId: string,
  progress: number,
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const status: CourseStatus =
    clamped >= 100 ? 'completed' : clamped > 0 ? 'in_progress' : 'enrolled';
  await updateDoc(doc(db, COLLECTION, enrollmentId), {
    progress: clamped,
    status,
    updated_at: serverTimestamp(),
  });
}

/** A member's course enrollments, newest first. */
export async function fetchEnrollmentsForUser(uid: string): Promise<CourseEnrollment[]> {
  if (!db || !uid) return [];
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('user_id', '==', uid)),
    );
    return snap.docs
      .map((d) => docToEnrollment(d.id, d.data()))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch (e) {
    console.warn('[coursesService] fetchEnrollmentsForUser failed:', e);
    return [];
  }
}
