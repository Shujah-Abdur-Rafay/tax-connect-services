import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Users, TrendingUp, Shield, Award } from 'lucide-react';

const MemberBenefits: React.FC = () => {
  return (
    <div className="py-12 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center mb-12">MEMBER BENEFITS</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Business Growth Tools */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                <CardTitle>1. Business Growth Tools</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Free Directory Listing</strong> – Reach clients searching for trusted tax preparers.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Lead Generation</strong> – We promote you through our website, social media, and campaigns.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Custom Marketing Package</strong> – Landing page, email templates, and branded marketing flyers.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Secure Client Portal</strong> – Clients can upload tax documents safely online.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Support & Resources */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-6 w-6 text-blue-600" />
                <CardTitle>2. Professional Support & Resources</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Tax Software Discounts</strong> – Negotiated rates on industry leaders like TaxSlayer Pro, CrossLink, and more.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Year-Round Support</strong> – Technical and compliance assistance, especially during peak season.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>IRS Resolution Support</strong> – Tools and guidance for audits, tax debt, and client IRS letters.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Continuing Education (CE) Credits</strong> – Free or discounted training, webinars, and IRS-approved courses.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Knowledge Hub</strong> – Tax law updates, client engagement scripts, and best-practice guides.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recognition & Community */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Award className="h-6 w-6 text-blue-600" />
                <CardTitle>3. Recognition & Community</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Exclusive Member Badge</strong> – "Trusted Member" or "Verified Preparer" badge to boost credibility.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Spotlight Features</strong> – Top preparers highlighted in our directory, newsletters, and social media.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Networking Opportunities</strong> – Online forums, annual events, and meetups.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Member Rewards Program</strong> – Earn points for every return, redeemable for discounts, training, or gift cards.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Incentives */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="h-6 w-6 text-blue-600" />
                <CardTitle>4. Financial Incentives</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Higher Revenue Share</strong> – Maximize your income with free/discounted software and competitive ERO fees.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Early-Bird Discounts</strong> – Save on membership and software fees when you join before December 1st.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Referral Bonuses</strong> – Earn cash for referring other professionals.
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <strong>Access to Bank Products</strong> – Refund advances, refund transfers, and prep fee withholding—helping you grow income and attract more clients.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MemberBenefits;