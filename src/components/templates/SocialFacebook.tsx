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

export const SocialFacebook = ({ formData }: TemplateProps) => (
  <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-10 rounded-lg text-white aspect-square">
    <div className="flex flex-col justify-center items-center h-full text-center">
      {formData.photo && (
        <img src={formData.photo} alt="Profile" className="w-32 h-32 rounded-full border-4 border-white mb-6 shadow-xl" />
      )}
      <h1 className="text-4xl font-bold mb-3">Need Tax Help?</h1>
      <p className="text-2xl mb-6">I'm here to help!</p>
      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">{formData.name || 'Your Name'}</h2>
        <p className="text-lg opacity-90 mb-3">{formData.title}</p>
        <p className="text-lg">{formData.phone}</p>
      </div>
    </div>
  </div>
);
