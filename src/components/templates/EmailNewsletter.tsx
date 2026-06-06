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

export const EmailNewsletter = ({ formData }: TemplateProps) => (
  <div className="bg-white p-8 rounded-lg aspect-[8.5/11] border-2 border-gray-200">
    <div className="border-b-4 border-blue-600 pb-4 mb-6">
      <h1 className="text-3xl font-bold text-gray-900">Tax Tips Newsletter</h1>
      <p className="text-gray-600">Your Monthly Tax Planning Update</p>
    </div>
    <div className="space-y-4 mb-6">
      <div className="bg-blue-50 p-4 rounded">
        <h3 className="font-bold text-lg mb-2">Tax Deadline Reminder</h3>
        <p className="text-sm text-gray-700">Important dates you need to know...</p>
      </div>
      <div className="bg-blue-50 p-4 rounded">
        <h3 className="font-bold text-lg mb-2">Deduction Strategies</h3>
        <p className="text-sm text-gray-700">Maximize your tax savings this year...</p>
      </div>
    </div>
    <div className="border-t-2 border-gray-200 pt-6">
      <div className="flex items-center gap-4">
        {formData.photo && (
          <img src={formData.photo} alt="Profile" className="w-16 h-16 rounded-full" />
        )}
        <div>
          <h2 className="text-xl font-bold">{formData.name || 'Your Name'}</h2>
          <p className="text-sm text-gray-600">{formData.title}</p>
          <div className="text-xs text-gray-600 mt-1">
            {formData.phone} | {formData.email}
          </div>
        </div>
      </div>
    </div>
  </div>
);
