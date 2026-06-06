import { BusinessCardModern } from './BusinessCardModern';
import { BusinessCardClassic } from './BusinessCardClassic';
import { BusinessCardMinimalist } from './BusinessCardMinimalist';
import { FlyerSeasonal } from './FlyerSeasonal';
import { FlyerPromotional } from './FlyerPromotional';
import { FlyerService } from './FlyerService';
import { EmailNewsletter } from './EmailNewsletter';
import { Letterhead } from './Letterhead';
import { SocialLinkedIn } from './SocialLinkedIn';
import { SocialFacebook } from './SocialFacebook';
import { SocialInstagram } from './SocialInstagram';

interface TemplateRendererProps {
  type: string;
  formData: {
    name: string;
    title: string;
    phone: string;
    email: string;
    website: string;
    photo: string;
  };
}

export const TemplateRenderer = ({ type, formData }: TemplateRendererProps) => {
  const templates: Record<string, JSX.Element> = {
    'business-card-modern': <BusinessCardModern formData={formData} />,
    'business-card-classic': <BusinessCardClassic formData={formData} />,
    'business-card-minimalist': <BusinessCardMinimalist formData={formData} />,
    'flyer-seasonal': <FlyerSeasonal formData={formData} />,
    'flyer-promotional': <FlyerPromotional formData={formData} />,
    'flyer-service': <FlyerService formData={formData} />,
    'email-newsletter': <EmailNewsletter formData={formData} />,
    'letterhead': <Letterhead formData={formData} />,
    'social-linkedin': <SocialLinkedIn formData={formData} />,
    'social-facebook': <SocialFacebook formData={formData} />,
    'social-instagram': <SocialInstagram formData={formData} />,
  };

  return templates[type] || <BusinessCardModern formData={formData} />;
};
