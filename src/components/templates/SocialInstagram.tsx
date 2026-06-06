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

export const SocialInstagram = ({ formData }: TemplateProps) => (
  <div className="bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 p-8 rounded-lg text-white aspect-[9/16]">
    <div className="flex flex-col justify-between h-full">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-3">Tax Tips</h1>
        <p className="text-xl">Swipe for more!</p>
      </div>
      <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 text-center">
        {formData.photo && (
          <img src={formData.photo} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white mx-auto mb-4" />
        )}
        <h2 className="text-2xl font-bold mb-2">{formData.name || 'Your Name'}</h2>
        <p className="text-lg mb-3">{formData.title}</p>
        <p className="text-sm">Follow for daily tax tips!</p>
        <p className="text-lg font-semibold mt-2">{formData.website}</p>
      </div>
    </div>
  </div>
);
