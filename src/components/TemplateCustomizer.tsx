import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Download, Upload, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import html2canvas from 'html2canvas';
import { TemplateRenderer } from './templates/TemplateRenderer';


interface TemplateCustomizerProps {
  template: {
    id: string;
    name: string;
    type: string;
  };
  onClose: () => void;
}

export const TemplateCustomizer = ({ template, onClose }: TemplateCustomizerProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.displayName || '',
    title: 'Tax Professional',
    phone: '',
    email: user?.email || '',
    website: 'www.taxconnect.com',
    photo: user?.photoURL || ''
  });

  const handleDownload = async () => {
    const element = document.getElementById('template-preview');
    if (!element) return;

    const canvas = await html2canvas(element, { scale: 2 });
    const link = document.createElement('a');
    link.download = `${template.name}-customized.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-auto bg-white">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Customize {template.name}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Editor Form */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Your Information</h3>
              
              <div>
                <Label>Full Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>

              <div>
                <Label>Professional Title</Label>
                <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
              </div>

              <div>
                <Label>Phone Number</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>

              <div>
                <Label>Email Address</Label>
                <Input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>

              <div>
                <Label>Website</Label>
                <Input value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} />
              </div>

              <div>
                <Label>Profile Photo URL</Label>
                <Input value={formData.photo} onChange={(e) => setFormData({...formData, photo: e.target.value})} placeholder="Enter image URL" />
              </div>

              <Button onClick={handleDownload} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Customized Template
              </Button>
            </div>

            {/* Live Preview */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Live Preview</h3>
              <div id="template-preview">
                <TemplateRenderer type={template.type} formData={formData} />
              </div>
            </div>

          </div>
        </div>
      </Card>
    </div>
  );
};
