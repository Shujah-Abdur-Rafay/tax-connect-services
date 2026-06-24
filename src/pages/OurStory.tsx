import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/AppLayout';

const OurStory: React.FC = () => {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">About Us</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-lg text-gray-700 mb-6">
            At Refund Connect, we believe that finding the right tax professional should be simple, reliable, and empowering—for both clients and preparers. Our platform was built by seasoned leaders in the tax industry who bring over 50 years of combined experience to the table.
          </p>

          <p className="text-gray-700 mb-6">
            Over the course of our careers, we have:
          </p>

          <ul className="list-disc pl-6 mb-8 text-gray-700">
            <li>Hired, trained, and supervised over 1,600 tax preparers</li>
            <li>Managed more than 100 tax offices nationwide</li>
            <li>Prepared over 86,000 tax returns</li>
          </ul>

          <p className="text-gray-700 mb-8">
            This wealth of experience has taught us what works—and what doesn't—when it comes to building and growing a successful tax practice.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
          
          <p className="text-gray-700 mb-4">
            Refund Connect was created with a clear purpose:
          </p>

          <p className="text-gray-700 mb-2">
            <strong>For Clients:</strong> To connect individuals and businesses with trusted, local tax professionals who can deliver expert service, peace of mind, and maximum refunds.
          </p>

          <p className="text-gray-700 mb-8">
            <strong>For Tax Professionals:</strong> To provide the tools, systems, and strategies needed to start, manage, and expand their tax businesses the right way.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why We Exist</h2>
          
          <p className="text-gray-700 mb-6">
            The tax industry can be overwhelming, especially for new professionals trying to establish themselves. Too often, talented preparers fail because they lack the business systems, marketing strategies, or support network to succeed long-term.
          </p>

          <p className="text-gray-700 mb-4">
            That's where Refund Connect comes in. We don't just provide a directory—we deliver a platform that equips tax professionals with:
          </p>

          <ul className="list-disc pl-6 mb-8 text-gray-700">
            <li>Proven marketing systems to attract and retain clients</li>
            <li>Business growth strategies to maximize profits</li>
            <li>Technology and tools that streamline operations</li>
            <li>Ongoing guidance from industry veterans who have built and scaled tax offices themselves</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Refund Connect Advantage</h2>
          
          <p className="text-gray-700 mb-8">
            Unlike other directories, Refund Connect is built by tax professionals, for tax professionals. We know what clients look for in a preparer and what preparers need to build thriving practices. By bridging both sides, we create a win-win: clients get reliable tax help, and preparers get the support to grow their businesses with confidence.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Promise</h2>
          
           <p className="text-gray-700 mb-12">
             When you choose Refund Connect, you're not just signing up for a listing—you're joining a movement to elevate the tax profession. Whether you're a new preparer starting out or a seasoned professional looking to expand, Refund Connect is here to guide you every step of the way.
           </p>
           
           {/* Call to Action Buttons */}
           <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 border-t border-gray-200">
             <Link to="/find-professionals">
               <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                 Find Tax Help
               </Button>
             </Link>
             <Link to="/join-platform">
               <Button size="lg" variant="outline" className="w-full sm:w-auto border-blue-600 text-blue-600 hover:bg-blue-50">
                 Join as Professional
               </Button>
             </Link>
           </div>
         </div>
      </div>
    </AppLayout>
  );
};

export default OurStory;