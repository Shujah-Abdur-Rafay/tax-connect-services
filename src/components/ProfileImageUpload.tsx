import { useState, useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile } from '@/services/firebaseStorageService';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface ProfileImageUploadProps {
  currentImageUrl?: string;
  onUploadComplete?: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function ProfileImageUpload({ 
  currentImageUrl, 
  onUploadComplete,
  size = 'lg' 
}: ProfileImageUploadProps) {
  const { user } = useAuth();
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32'
  };

  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        const size = 400;
        canvas.width = size;
        canvas.height = size;

        const scale = Math.max(size / img.width, size / img.height);
        const x = (size - img.width * scale) / 2;
        const y = (size - img.height * scale) / 2;

        ctx?.drawImage(img, x, y, img.width * scale, img.height * scale);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to resize'));
        }, 'image/jpeg', 0.9);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    try {
      setUploading(true);
      
      // Create local preview immediately
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      
      // Try to upload to Firebase Storage
      try {
        const resizedBlob = await resizeImage(file);
        const resizedFile = new File([resizedBlob], 'avatar.jpg', { type: 'image/jpeg' });
        
        const path = `profiles/${user.id}/avatar.jpg`;
        const result = await uploadFile(resizedFile, path);
        
        // Update Firestore with the new photo URL
        if (db) {
          await updateDoc(doc(db, 'users', user.id), {
            photoURL: result.url
          });
        }
        
        setPreview(result.url);
        onUploadComplete?.(result.url);
        toast.success('Profile image updated!');
      } catch (storageError: any) {
        console.error('Storage error:', storageError);
        // Keep local preview but warn user
        toast.warning('Image preview set locally. Firebase Storage needs to be configured for permanent storage.');
        onUploadComplete?.(previewUrl);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to process image');
    } finally {
      setUploading(false);
    }
  };



  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage src={preview || undefined} />
          <AvatarFallback>
            <Camera className="h-8 w-8 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        
        <Button
          size="icon"
          variant="secondary"
          className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full shadow-lg"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploading && (
        <p className="text-sm text-muted-foreground">Uploading...</p>
      )}
    </div>
  );
}
