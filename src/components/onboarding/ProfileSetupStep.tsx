import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile } from '@/services/firebaseStorageService';
import { useToast } from '@/hooks/use-toast';

interface ProfileSetupStepProps {
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    bio: string;
    profileImage: string;
    businessName: string;
    businessAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack?: () => void;
}

export default function ProfileSetupStep({ data, onUpdate, onNext, onBack }: ProfileSetupStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    onUpdate({ ...data, [field]: value });
  };

  // Resize image to a max 400x400 square JPEG before uploading
  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        const targetSize = 400;
        canvas.width = targetSize;
        canvas.height = targetSize;

        const scale = Math.max(targetSize / img.width, targetSize / img.height);
        const x = (targetSize - img.width * scale) / 2;
        const y = (targetSize - img.height * scale) / 2;

        ctx?.drawImage(img, x, y, img.width * scale, img.height * scale);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to resize image'));
          },
          'image/jpeg',
          0.9
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image.', variant: 'destructive' });
      return;
    }

    if (!user?.uid) {
      toast({
        title: 'Sign in first',
        description: 'You need to be signed in to upload a profile photo.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const resizedBlob = await resizeImage(file);
      const resizedFile = new File([resizedBlob], 'avatar.jpg', { type: 'image/jpeg' });

      // Cache-bust the path so the new image replaces the old one immediately
      const path = `professionals/${user.uid}/avatar-${Date.now()}.jpg`;
      const result = await uploadFile(resizedFile, path);

      handleInputChange('profileImage', result.url);
      toast({ title: 'Photo uploaded', description: 'Your profile photo has been saved to Firebase.' });
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast({
        title: 'Upload failed',
        description:
          error?.message ||
          'Could not upload your photo. Please check that Firebase Storage is enabled and try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingPhoto(false);
      // Reset the input so the same file can be re-selected if needed
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isValid = data.firstName && data.lastName && data.email && data.phone && data.businessName;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Professional Profile Setup
        </CardTitle>
        <CardDescription>
          Tell us about yourself and your tax practice
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={data.profileImage} />
              <AvatarFallback>{data.firstName?.[0]}{data.lastName?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <input
                type="file"
                id="profileImageUpload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => document.getElementById('profileImageUpload')?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {data.profileImage ? 'Change Photo' : 'Upload Photo'}
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                JPG or PNG, saved to Firebase Storage
              </p>
            </div>
          </div>




          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={data.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={data.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={data.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={data.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="bio">Professional Bio</Label>
            <Textarea
              id="bio"
              value={data.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell clients about your experience and expertise..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="businessAddress">Business Address</Label>
            <Input
              id="businessAddress"
              value={data.businessAddress}
              onChange={(e) => handleInputChange('businessAddress', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={data.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={data.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                value={data.zipCode}
                onChange={(e) => handleInputChange('zipCode', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
            <Button type="submit" disabled={!isValid} className="ml-auto">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}