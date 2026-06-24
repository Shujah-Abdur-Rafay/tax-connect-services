import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Circle, Clock, RotateCcw } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc as fsDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface WorkflowStep {
  key: string;
  label: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedBy?: string;
  completedAt?: string;
  note?: string;
}

interface DocumentWorkflowProps {
  documentId: string;
  documentName: string;
  currentUser: string;
  onApprovalComplete?: () => void;
}

// Canonical approval pipeline for a tax document. Persisted to
// `client_documents/{docId}.workflow` so progress survives reloads and is
// visible to anyone with access to the document.
const DEFAULT_STEPS: WorkflowStep[] = [
  { key: 'prepared', label: 'Prepared', description: 'Document drafted and ready for review.', status: 'pending' },
  { key: 'reviewed', label: 'Reviewed', description: 'Reviewed by a tax professional for accuracy.', status: 'pending' },
  { key: 'approved', label: 'Approved', description: 'Approved and signed off for filing.', status: 'pending' },
  { key: 'filed', label: 'Filed', description: 'Submitted / filed with the relevant authority.', status: 'pending' },
];

export default function DocumentWorkflow({
  documentId,
  documentName,
  currentUser,
  onApprovalComplete,
}: DocumentWorkflowProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>(DEFAULT_STEPS);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadWorkflow = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(fsDoc(db, 'client_documents', documentId));
      const stored = snap.exists() ? (snap.data() as any).workflow?.steps : null;
      if (Array.isArray(stored) && stored.length > 0) {
        // Merge stored progress onto the canonical step definitions so label
        // changes ship without losing recorded progress.
        setSteps(
          DEFAULT_STEPS.map((def) => {
            const match = stored.find((s: WorkflowStep) => s.key === def.key);
            return match ? { ...def, ...match } : def;
          }),
        );
      } else {
        setSteps(DEFAULT_STEPS);
      }
    } catch (err) {
      console.warn('[DocumentWorkflow] failed to load workflow:', err);
      setSteps(DEFAULT_STEPS);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const persist = async (next: WorkflowStep[]) => {
    setSaving(true);
    try {
      await updateDoc(fsDoc(db, 'client_documents', documentId), {
        workflow: { steps: next, updated_at: new Date().toISOString() },
        updated_at: serverTimestamp(),
      });
      setSteps(next);
      if (next.every((s) => s.status === 'completed')) {
        toast.success('Workflow complete — document approved');
        onApprovalComplete?.();
      }
    } catch (err) {
      console.error('[DocumentWorkflow] failed to persist workflow:', err);
      toast.error('Failed to update workflow');
    } finally {
      setSaving(false);
    }
  };

  const currentIndex = steps.findIndex((s) => s.status !== 'completed');

  const completeStep = (index: number) => {
    const next = steps.map((s, i) => {
      if (i < index) return s.status === 'completed' ? s : { ...s, status: 'completed' as const };
      if (i === index) {
        return {
          ...s,
          status: 'completed' as const,
          completedBy: currentUser,
          completedAt: new Date().toISOString(),
          note: note.trim() || s.note,
        };
      }
      return s;
    });
    setNote('');
    persist(next);
  };

  const resetWorkflow = () => {
    persist(DEFAULT_STEPS.map((s) => ({ ...s, status: 'pending', completedBy: undefined, completedAt: undefined, note: undefined })));
  };

  const allDone = steps.every((s) => s.status === 'completed');

  const stepIcon = (status: WorkflowStep['status']) => {
    if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (status === 'in_progress') return <Clock className="h-5 w-5 text-amber-500" />;
    return <Circle className="h-5 w-5 text-gray-300" />;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Approval pipeline for <span className="font-medium text-gray-700">{documentName}</span>.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading workflow…</p>
      ) : (
        <>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isCurrent = index === currentIndex;
              return (
                <Card key={step.key} className={isCurrent ? 'border-blue-400' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        {stepIcon(step.status)}
                        {step.label}
                      </span>
                      <Badge
                        variant={
                          step.status === 'completed'
                            ? 'default'
                            : isCurrent
                            ? 'outline'
                            : 'secondary'
                        }
                      >
                        {step.status === 'completed' ? 'Completed' : isCurrent ? 'Current' : 'Pending'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <p className="text-sm text-gray-500">{step.description}</p>
                    {step.status === 'completed' && (
                      <p className="text-xs text-gray-400">
                        By {step.completedBy || 'Unknown'}
                        {step.completedAt ? ` • ${new Date(step.completedAt).toLocaleDateString()}` : ''}
                        {step.note ? ` — ${step.note}` : ''}
                      </p>
                    )}
                    {isCurrent && (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          placeholder="Optional note for this step…"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                        />
                        <Button size="sm" disabled={saving} onClick={() => completeStep(index)}>
                          {saving ? 'Saving…' : `Mark "${step.label}" complete`}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            {allDone ? (
              <Badge className="bg-green-600">All steps approved</Badge>
            ) : (
              <span className="text-sm text-gray-500">
                {steps.filter((s) => s.status === 'completed').length} of {steps.length} steps complete
              </span>
            )}
            <Button variant="ghost" size="sm" disabled={saving} onClick={resetWorkflow}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
