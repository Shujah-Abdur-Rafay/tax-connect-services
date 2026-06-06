import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Check, X, Mail, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  completionRate: number;
  services: string[];
  credentials: string[];
  reviewNotes?: string;
}

interface ApprovalWorkflowProps {
  application: Application;
  action: 'approve' | 'reject';
  notes: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ApprovalWorkflow({ application, action, notes, onConfirm, onCancel }: ApprovalWorkflowProps) {
  const [emailSubject, setEmailSubject] = useState(
    action === 'approve' 
      ? `Welcome to RefundConnect - Application Approved!`
      : `RefundConnect Application Update`
  );
  const [emailMessage, setEmailMessage] = useState(
    action === 'approve'
      ? `Dear ${application.name},\n\nCongratulations! Your application to join RefundConnect as a tax professional has been approved.\n\nYou can now access your professional dashboard and start connecting with clients. We're excited to have you on our platform!\n\nBest regards,\nThe RefundConnect Team`
      : `Dear ${application.name},\n\nThank you for your interest in joining RefundConnect. After careful review, we are unable to approve your application at this time.\n\n${notes ? `Feedback: ${notes}` : ''}\n\nYou're welcome to reapply in the future once you've addressed any concerns.\n\nBest regards,\nThe RefundConnect Team`
  );
  const [sendNotification, setSendNotification] = useState(true);
  const [createAccount, setCreateAccount] = useState(action === 'approve');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    
    // Simulate API calls
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (sendNotification) {
      console.log('Sending notification email:', {
        to: application.email,
        subject: emailSubject,
        message: emailMessage
      });
    }
    
    if (createAccount && action === 'approve') {
      console.log('Creating professional account for:', application.email);
    }
    
    setIsProcessing(false);
    onConfirm();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {action === 'approve' ? 'Approve Application' : 'Reject Application'}
        </h1>
        <p className="text-gray-600">
          {action === 'approve' 
            ? 'Review the approval details and notification before confirming.'
            : 'Provide feedback and notification details for the rejection.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {action === 'approve' ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <X className="h-5 w-5 text-red-600" />
                )}
                Application Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="font-medium">Applicant</Label>
                <p className="text-gray-900">{application.name}</p>
              </div>
              <div>
                <Label className="font-medium">Email</Label>
                <p className="text-gray-900">{application.email}</p>
              </div>
              <div>
                <Label className="font-medium">Services</Label>
                <p className="text-gray-900">{application.services.join(', ')}</p>
              </div>
              <div>
                <Label className="font-medium">Credentials</Label>
                <p className="text-gray-900">{application.credentials.join(', ')}</p>
              </div>
              {notes && (
                <div>
                  <Label className="font-medium">Review Notes</Label>
                  <p className="text-gray-900 text-sm bg-gray-50 p-2 rounded">{notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Action Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendNotification"
                  checked={sendNotification}
                  onCheckedChange={(checked) => setSendNotification(checked as boolean)}
                />
                <Label htmlFor="sendNotification" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send email notification
                </Label>
              </div>
              
              {action === 'approve' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createAccount"
                    checked={createAccount}
                    onCheckedChange={(checked) => setCreateAccount(checked as boolean)}
                  />
                  <Label htmlFor="createAccount">Create professional account</Label>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {sendNotification && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Email Notification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="emailSubject">Subject</Label>
                  <Input
                    id="emailSubject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="emailMessage">Message</Label>
                  <Textarea
                    id="emailMessage"
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={8}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {action === 'approve' 
                ? 'This action will approve the application and grant the professional access to the platform.'
                : 'This action will reject the application. The applicant will be notified and can reapply in the future.'}
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button
              onClick={handleConfirm}
              disabled={isProcessing}
              className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isProcessing ? 'Processing...' : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}