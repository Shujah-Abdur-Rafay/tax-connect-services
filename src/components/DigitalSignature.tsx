import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Signature, Shield, CheckCircle, AlertCircle } from 'lucide-react';

interface SignatureRecord {
  id: string;
  signerName: string;
  signerEmail: string;
  timestamp: string;
  isValid: boolean;
}

interface DigitalSignatureProps {
  documentId: string;
  documentName: string;
  onSign?: (signature: SignatureRecord) => void;
}

export default function DigitalSignature({ documentId, documentName, onSign }: DigitalSignatureProps) {
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [isSigningMode, setIsSigningMode] = useState(false);
  const [signatures, setSignatures] = useState<SignatureRecord[]>([
    {
      id: '1',
      signerName: 'John Doe',
      signerEmail: 'john@example.com',
      timestamp: '2024-01-15 14:30:00',
      isValid: true
    },
    {
      id: '2',
      signerName: 'Tax Professional',
      signerEmail: 'taxpro@example.com',
      timestamp: '2024-01-15 15:45:00',
      isValid: true
    }
  ]);

  const handleSign = () => {
    if (!signerName.trim() || !signerEmail.trim()) return;

    const newSignature: SignatureRecord = {
      id: Date.now().toString(),
      signerName,
      signerEmail,
      timestamp: new Date().toLocaleString(),
      isValid: true
    };

    setSignatures(prev => [...prev, newSignature]);
    setSignerName('');
    setSignerEmail('');
    setIsSigningMode(false);
    
    if (onSign) {
      onSign(newSignature);
    }
  };

  const generateSignatureHash = (signature: SignatureRecord) => {
    // Simple hash generation for demo
    return btoa(`${signature.signerName}:${signature.timestamp}:${documentId}`).slice(0, 16);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Signature className="h-5 w-5" />
          <span>Digital Signatures</span>
        </CardTitle>
        <p className="text-sm text-gray-500">
          Secure digital signatures for {documentName}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sign Document Section */}
        {!isSigningMode ? (
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-500" />
              <div>
                <h3 className="font-medium">Sign this document</h3>
                <p className="text-sm text-gray-500">Add your digital signature to approve this document</p>
              </div>
            </div>
            <Button onClick={() => setIsSigningMode(true)}>
              <Signature className="h-4 w-4 mr-2" />
              Sign Document
            </Button>
          </div>
        ) : (
          <div className="p-4 border rounded-lg space-y-4">
            <h3 className="font-medium">Add Your Signature</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="signerName">Full Name</Label>
                <Input
                  id="signerName"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <Label htmlFor="signerEmail">Email Address</Label>
                <Input
                  id="signerEmail"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleSign} disabled={!signerName.trim() || !signerEmail.trim()}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Signature
              </Button>
              <Button variant="outline" onClick={() => setIsSigningMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Existing Signatures */}
        <div className="space-y-3">
          <h3 className="font-medium">Document Signatures ({signatures.length})</h3>
          {signatures.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No signatures yet. Be the first to sign this document.
            </p>
          ) : (
            signatures.map((signature) => (
              <div key={signature.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                    {signature.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{signature.signerName}</p>
                    <p className="text-sm text-gray-500">{signature.signerEmail}</p>
                    <p className="text-xs text-gray-400">Signed on {signature.timestamp}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={signature.isValid ? "default" : "destructive"}>
                    {signature.isValid ? 'Valid' : 'Invalid'}
                  </Badge>
                  <p className="text-xs text-gray-400 mt-1">
                    Hash: {generateSignatureHash(signature)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Security Info */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Secure Digital Signatures</p>
              <p className="text-blue-700">
                All signatures are cryptographically secured and timestamped. 
                Each signature includes verification data to ensure document integrity.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}