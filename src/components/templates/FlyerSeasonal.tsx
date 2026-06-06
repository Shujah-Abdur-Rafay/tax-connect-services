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

export const FlyerSeasonal = ({ formData }: TemplateProps) => (
  <div className="bg-gradient-to-br from-green-600 to-red-600 p-10 rounded-lg text-white aspect-[8.5/11]">
    <div className="text-center space-y-6">
      <h1 className="text-5xl font-bold">Tax Season 2025</h1>
      <p className="text-2xl">Get Your Refund Faster!</p>
      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-8 my-8">
        {formData.photo && (
          <img src={formData.photo} alt="Profile" className="w-32 h-32 rounded-full border-4 border-white mx-auto mb-4" />
        )}
        <h2 className="text-3xl font-bold mb-2">{formData.name || 'Your Name'}</h2>
        <p className="text-xl mb-4">{formData.title}</p>
        <div className="space-y-2 text-lg">
          {formData.phone && <p>📞 {formData.phone}</p>}
          {formData.email && <p>✉️ {formData.email}</p>}
          {formData.website && <p>🌐 {formData.website}</p>}
        </div>
      </div>
      <p className="text-xl font-semibold">Schedule Your Appointment Today!</p>
    </div>
  </div>
);
