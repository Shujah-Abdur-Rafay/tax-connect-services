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

export const BusinessCardModern = ({ formData }: TemplateProps) => (
  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-lg text-white aspect-[3.5/2] flex items-center justify-between">
    <div className="space-y-2">
      <h2 className="text-2xl font-bold">{formData.name || 'Your Name'}</h2>
      <p className="text-sm opacity-90">{formData.title}</p>
      <div className="space-y-1 text-xs pt-3">
        {formData.phone && <p>📞 {formData.phone}</p>}
        {formData.email && <p>✉️ {formData.email}</p>}
        {formData.website && <p>🌐 {formData.website}</p>}
      </div>
    </div>
    {formData.photo && (
      <img src={formData.photo} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white shadow-lg" />
    )}
  </div>
);
