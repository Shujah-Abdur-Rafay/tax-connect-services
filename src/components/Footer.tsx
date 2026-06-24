import React from 'react';
import { Link } from 'react-router-dom';
const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <img 
              src="https://d64gsuwffb70l.cloudfront.net/68a37e37fed4ba77da23cd1a_1755550609267_7c845701.png" 
              alt="Refund Connect" 
              className="h-8 w-auto mb-4 filter brightness-0 invert"
            />
            <p className="text-gray-400 text-sm">
              Connecting clients with trusted tax professionals nationwide.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">For Clients</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/find-professionals" className="hover:text-white">Find Professionals</Link></li>
              <li><Link to="/how-it-works" className="hover:text-white">How It Works</Link></li>
              <li><Link to="/tax-resources" className="hover:text-white">Tax Resources</Link></li>
              <li><Link to="/support" className="hover:text-white">Support</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">For Professionals</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/join-platform" className="hover:text-white">Join Our Network</Link></li>
              <li><Link to="/member-portal" className="hover:text-white">Member Portal</Link></li>
              <li><a href="#" className="hover:text-white">Professional Network</a></li>
              <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><a href="#" className="hover:text-white">Partner Offers</a></li>

            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/about" className="hover:text-white">About Us</Link></li>
              <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              <li><Link to="/support" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2026 Refund Connect. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;