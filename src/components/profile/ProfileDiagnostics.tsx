import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const ProfileDiagnostics = () => {
  const { user, firebaseUser } = useAuth();
  const [checks, setChecks] = useState({
    userExists: false,
    firebaseUserExists: false,
    dbExists: false,
    canRead: false,
    canWrite: false
  });
  const [testing, setTesting] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, [user, firebaseUser]);

  const runDiagnostics = async () => {
    const results = {
      userExists: !!user,
      firebaseUserExists: !!firebaseUser,
      dbExists: !!db,
      canRead: false,
      canWrite: false
    };

    if (user && db) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        results.canRead = true;
        
        await setDoc(doc(db, 'users', user.id), { 
          diagnosticTest: new Date().toISOString() 
        }, { merge: true });
        results.canWrite = true;
      } catch (error) {
        console.error('Diagnostic error:', error);
      }
    }

    setChecks(results);
    setTesting(false);
  };

  if (testing) return null;

  const allGood = Object.values(checks).every(v => v);

  if (allGood) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="font-semibold mb-2">Profile Save Issues Detected:</div>
        <ul className="space-y-1 text-sm">
          {!checks.userExists && <li>❌ User not loaded</li>}
          {!checks.firebaseUserExists && <li>❌ Firebase user not authenticated</li>}
          {!checks.dbExists && <li>❌ Database not initialized</li>}
          {!checks.canRead && checks.dbExists && <li>❌ Cannot read from database</li>}
          {!checks.canWrite && checks.dbExists && <li>❌ Cannot write to database</li>}
        </ul>
        <p className="mt-2 text-sm">Please try logging out and back in.</p>
      </AlertDescription>
    </Alert>
  );
};

export default ProfileDiagnostics;
