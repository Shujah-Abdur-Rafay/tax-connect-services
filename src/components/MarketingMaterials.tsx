import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Image, FileText, Share2, Mail, Presentation, Palette, Edit } from 'lucide-react';
import { TemplateCustomizer } from './TemplateCustomizer';

const MarketingMaterials: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string; type: string } | null>(null);

  const customizableTemplates = [
    { id: '1', name: 'Business Card - Modern', size: '1.2 MB', type: 'business-card-modern', customizable: true },
    { id: '2', name: 'Business Card - Classic', size: '1.1 MB', type: 'business-card-classic', customizable: true },
    { id: '3', name: 'Business Card - Minimalist', size: '1.0 MB', type: 'business-card-minimalist', customizable: true },
    { id: '4', name: 'Flyer - Seasonal Tax', size: '4.2 MB', type: 'flyer-seasonal', customizable: true },
    { id: '5', name: 'Flyer - Promotional', size: '3.8 MB', type: 'flyer-promotional', customizable: true },
    { id: '6', name: 'Flyer - Service List', size: '3.5 MB', type: 'flyer-service', customizable: true },
    { id: '7', name: 'Email Newsletter', size: '2.1 MB', type: 'email-newsletter', customizable: true },
    { id: '8', name: 'Professional Letterhead', size: '1.5 MB', type: 'letterhead', customizable: true },
    { id: '9', name: 'LinkedIn Post', size: '2.8 MB', type: 'social-linkedin', customizable: true },
    { id: '10', name: 'Facebook Post', size: '2.5 MB', type: 'social-facebook', customizable: true },
    { id: '11', name: 'Instagram Story', size: '3.2 MB', type: 'social-instagram', customizable: true },
  ];


  const materials = [
    {
      category: 'Customizable Templates',
      icon: Edit,
      items: customizableTemplates
    },
    {
      category: 'Brand Assets',
      icon: Palette,
      items: [
        { id: '7', name: 'Logo Package (PNG, SVG)', size: '2.4 MB', type: 'logos', customizable: false },
        { id: '8', name: 'Brand Guidelines PDF', size: '1.8 MB', type: 'guidelines', customizable: false },
        { id: '9', name: 'Color Palette & Fonts', size: '500 KB', type: 'colors', customizable: false },
      ]
    },
    {
      category: 'Social Media',
      icon: Share2,
      items: [
        { id: '10', name: 'Facebook Cover Images', size: '2.7 MB', type: 'facebook', customizable: false },
      ]
    },
    {
      category: 'Email & Presentations',
      icon: Mail,
      items: [
        { id: '11', name: 'PowerPoint Presentation', size: '6.5 MB', type: 'ppt', customizable: false },
        { id: '12', name: 'Proposal Template', size: '1.9 MB', type: 'proposal', customizable: false },
      ]
    },
  ];


  const handleDownload = (type: string, name: string) => {
    console.log(`Downloading ${type}: ${name}`);
    // Implement actual download logic here
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Marketing Materials</CardTitle>
            <CardDescription>
              Download professional marketing materials to promote your services and build your brand. Customize templates with your information before downloading.
            </CardDescription>
          </CardHeader>
        </Card>

        {materials.map((section, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle className="text-xl">{section.category}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {section.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.size}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {item.customizable && (
                        <Button 
                          onClick={() => setSelectedTemplate({ id: item.id, name: item.name, type: item.type })} 
                          size="sm"
                          variant="outline"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Customize
                        </Button>
                      )}
                      <Button onClick={() => handleDownload(item.type, item.name)} size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTemplate && (
        <TemplateCustomizer 
          template={selectedTemplate} 
          onClose={() => setSelectedTemplate(null)} 
        />
      )}
    </>
  );
};

export default MarketingMaterials;
