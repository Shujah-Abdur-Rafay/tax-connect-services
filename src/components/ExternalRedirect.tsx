import { useEffect } from 'react';

interface ExternalRedirectProps {
  url: string;
}

const ExternalRedirect = ({ url }: ExternalRedirectProps) => {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
};

export default ExternalRedirect;