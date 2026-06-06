interface TemplateProps {
  formData: {
    name: string;
    title: string;
    phone: string;
    email: string;
    website: string;
    photo: string;
  };
}

export const BusinessCardMinimalist = ({ formData }: TemplateProps) => (
  <div className="bg-gray-50 p-8 rounded-lg aspect-[3.5/2] flex flex-col justify-between">
    <div>
      <h2 className="text-3xl font-light text-gray-900">{formData.name || 'Your Name'}</h2>
      <p className="text-sm text-gray-500 mt-1">{formData.title}</p>
    </div>
    <div className="space-y-1 text-xs text-gray-600">
      {formData.phone && <p>{formData.phone}</p>}
      {formData.email && <p>{formData.email}</p>}
      {formData.website && <p>{formData.website}</p>}
    </div>
  </div>
);
