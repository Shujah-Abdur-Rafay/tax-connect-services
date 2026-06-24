import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, User, Briefcase, Building, BookOpen, Calculator, FileText, CreditCard, DollarSign } from 'lucide-react';

const services = [
  {
    title: 'Individual Tax Preparation',
    description: 'Expert preparation of personal tax returns with maximum refunds',
    icon: User,
    image: 'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756152644596_ee4b6eab.webp',
    color: 'from-blue-500 to-blue-600'
  },
  {
    title: 'Self-Employment Tax Preparation',
    description: 'Specialized tax services for freelancers and contractors',
    icon: Briefcase,
    image: 'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756152650650_dd4e4caa.webp',
    color: 'from-green-500 to-green-600'
  },
  {
    title: 'Business Tax Preparation',
    description: 'Comprehensive business tax filing and planning services',
    icon: Building,
    image: 'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756152655093_d0b74100.webp',
    color: 'from-purple-500 to-purple-600'
  },
  {
    title: 'Bookkeeping',
    description: 'Professional bookkeeping and financial record management',
    icon: BookOpen,
    image: 'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756152661738_7dbd6848.webp',
    color: 'from-orange-500 to-orange-600'
  },
  {
    title: 'Accounting Services',
    description: 'Full-service accounting and financial management solutions',
    icon: Calculator,
    image: 'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756152666326_d138d99f.webp',
    color: 'from-teal-500 to-teal-600'
  },
  {
    title: 'Incorporation Services',
    description: 'Business formation and corporate structure assistance',
    icon: FileText,
    image: 'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756152671714_12ea7e0e.webp',
    color: 'from-indigo-500 to-indigo-600'
  },
  {
    title: 'Credit Repair',
    description: 'Professional credit restoration and improvement services',
    icon: CreditCard,
    image: 'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756152674982_93c89f44.webp',
    color: 'from-red-500 to-red-600'
  },
  {
    title: 'Business Funding',
    description: 'Access capital and funding solutions for your business growth',
    icon: DollarSign,
    image: 'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1756153459295_c2ed1048.webp',
    color: 'from-yellow-500 to-yellow-600'
  }
];

const PopularServices: React.FC = () => {
  const navigate = useNavigate();

  const handleServiceClick = (serviceTitle: string) => {
    navigate(`/find-professionals?service=${encodeURIComponent(serviceTitle)}`);
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Popular Services
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Find specialized tax professionals for your specific needs. Our experts are ready to help you maximize your refunds and minimize your stress.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {services.map((service, index) => {
            const IconComponent = service.icon;
            return (
              <Card key={index} className="group hover:shadow-2xl transition-all duration-500 cursor-pointer border-0 overflow-hidden bg-white">
                <div className="relative">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={service.image} 
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${service.color} opacity-80`}></div>
                  </div>
                  <div className="absolute top-4 left-4">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {service.description}
                  </p>
                  <Button 
                    onClick={() => handleServiceClick(service.title)}
                    className="w-full bg-gray-900 hover:bg-blue-600 text-white group-hover:bg-blue-600 transition-all duration-300"
                  >
                    Find Specialists
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PopularServices;