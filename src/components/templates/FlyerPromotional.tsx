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

export const FlyerPromotional = ({ formData }: TemplateProps) => (
  <div className="bg-yellow-400 p-10 rounded-lg aspect-[8.5/11]">
    <div className="bg-white rounded-lg p-8 h-full flex flex-col justify-between">
      <div>
        <div className="bg-red-600 text-white px-6 py-3 rounded-full inline-block mb-6">
          <span className="text-2xl font-bold">SPECIAL OFFER!</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">20% OFF Tax Preparation</h1>
        <p className="text-xl text-gray-700 mb-6">New Clients Only - Limited Time</p>
      </div>
      <div className="bg-gray-100 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          {formData.photo && (
            <img src={formData.photo} alt="Profile" className="w-20 h-20 rounded-full border-2 border-gray-300" />
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{formData.name || 'Your Name'}</h2>
            <p className="text-gray-600">{formData.title}</p>
          </div>
        </div>
        <div className="space-y-1 text-sm text-gray-700">
          {formData.phone && <p>📞 {formData.phone}</p>}
          {formData.email && <p>✉️ {formData.email}</p>}
          {formData.website && <p>🌐 {formData.website}</p>}
        </div>
      </div>
    </div>
  </div>
);
