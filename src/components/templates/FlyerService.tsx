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

export const FlyerService = ({ formData }: TemplateProps) => (
  <div className="bg-blue-900 p-10 rounded-lg text-white aspect-[8.5/11]">
    <h1 className="text-4xl font-bold mb-6">Professional Tax Services</h1>
    <div className="space-y-4 mb-8">
      <div className="bg-white/10 p-4 rounded">✓ Individual Tax Returns</div>
      <div className="bg-white/10 p-4 rounded">✓ Business Tax Planning</div>
      <div className="bg-white/10 p-4 rounded">✓ IRS Representation</div>
      <div className="bg-white/10 p-4 rounded">✓ Tax Resolution Services</div>
    </div>
    <div className="bg-white text-gray-900 rounded-lg p-6">
      <div className="flex items-center gap-4 mb-4">
        {formData.photo && (
          <img src={formData.photo} alt="Profile" className="w-20 h-20 rounded-full" />
        )}
        <div>
          <h2 className="text-2xl font-bold">{formData.name || 'Your Name'}</h2>
          <p className="text-gray-600">{formData.title}</p>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        {formData.phone && <p>📞 {formData.phone}</p>}
        {formData.email && <p>✉️ {formData.email}</p>}
        {formData.website && <p>🌐 {formData.website}</p>}
      </div>
    </div>
  </div>
);
