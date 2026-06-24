import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, CheckCircle2, Camera } from 'lucide-react';

const ProfilePhotoUpload = () => {
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to upload a photo',
        variant: 'destructive'
      });
      return;
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file (JPG, PNG, or GIF)',
        variant: 'destructive'
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be less than 5MB',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Check if storage is available
      if (!storage || typeof storage.app === 'undefined') {
        toast({
          title: 'Storage Not Available',
          description: 'Firebase Storage is not configured. Please contact support.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Upload to Firebase Storage
      const storageRef = ref(storage, `profile-photos/${user.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      // Update user profile using AuthContext method
      await updateUserProfile({ photoURL });

      setPreview(photoURL);
      toast({
        title: 'Success!',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Profile photo updated successfully</span>
          </div>
        )
      });
    } catch (error: any) {
      console.error('Photo upload error:', error);
      let errorMessage = 'Failed to upload photo. Please try again.';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Firebase Storage not enabled. Please enable it in Firebase Console.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Profile Photo
        </CardTitle>
        <CardDescription>Upload a profile picture</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={preview || user?.photoURL} />
            <AvatarFallback className="text-2xl">{user?.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="photo-upload"
              disabled={loading}
            />
            <label htmlFor="photo-upload">
              <Button asChild disabled={loading}>
                <span className="cursor-pointer">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {loading ? 'Uploading...' : 'Upload Photo'}
                </span>
              </Button>
            </label>
            <p className="text-sm text-gray-500 mt-2">JPG, PNG or GIF. Max 5MB.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfilePhotoUpload;
