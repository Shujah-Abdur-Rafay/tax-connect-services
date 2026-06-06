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

export const SocialLinkedIn = ({ formData }: TemplateProps) => (
  <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-12 rounded-lg text-white aspect-[1200/627]">
    <div className="flex flex-col justify-center h-full">
      <h1 className="text-5xl font-bold mb-4">Tax Planning Made Simple</h1>
      <p className="text-2xl mb-8 opacity-90">Expert guidance for your financial success</p>
      <div className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-lg p-6 inline-block">
        {formData.photo && (
          <img src={formData.photo} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white" />
        )}
        <div>
          <h2 className="text-3xl font-bold">{formData.name || 'Your Name'}</h2>
          <p className="text-xl opacity-90">{formData.title}</p>
          <p className="text-lg mt-2">{formData.website}</p>
        </div>
      </div>
    </div>
  </div>
);
