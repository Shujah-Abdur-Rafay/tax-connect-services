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

export const Letterhead = ({ formData }: TemplateProps) => (
  <div className="bg-white p-10 rounded-lg aspect-[8.5/11] border border-gray-300">
    <div className="border-b-2 border-blue-600 pb-6 mb-8 flex justify-between items-start">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{formData.name || 'Your Name'}</h1>
        <p className="text-gray-600 mt-1">{formData.title}</p>
        <div className="text-sm text-gray-600 mt-3 space-y-1">
          {formData.phone && <p>{formData.phone}</p>}
          {formData.email && <p>{formData.email}</p>}
          {formData.website && <p>{formData.website}</p>}
        </div>
      </div>
      {formData.photo && (
        <img src={formData.photo} alt="Profile" className="w-20 h-20 rounded-lg" />
      )}
    </div>
    <div className="space-y-4 text-gray-700">
      <p className="text-sm">Date: {new Date().toLocaleDateString()}</p>
      <div className="h-64 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400">
        Letter Content Area
      </div>
    </div>
  </div>
);
