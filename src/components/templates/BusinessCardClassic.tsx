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

export const BusinessCardClassic = ({ formData }: TemplateProps) => (
  <div className="bg-white border-4 border-gray-800 p-8 rounded-lg aspect-[3.5/2] flex flex-col justify-center">
    <div className="text-center space-y-3">
      {formData.photo && (
        <img src={formData.photo} alt="Profile" className="w-20 h-20 rounded-full mx-auto border-2 border-gray-800 mb-4" />
      )}
      <h2 className="text-2xl font-bold text-gray-900">{formData.name || 'Your Name'}</h2>
      <p className="text-sm text-gray-600 uppercase tracking-wide">{formData.title}</p>
      <div className="border-t-2 border-gray-300 pt-3 space-y-1 text-xs text-gray-700">
        {formData.phone && <p>{formData.phone}</p>}
        {formData.email && <p>{formData.email}</p>}
        {formData.website && <p>{formData.website}</p>}
      </div>
    </div>
  </div>
);
