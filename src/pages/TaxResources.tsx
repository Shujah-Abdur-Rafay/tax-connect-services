import React from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TaxResources: React.FC = () => {
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Tax Resources</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Essential tax information and resources to help you understand your tax obligations and maximize your refunds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Tax Deductions Guide</CardTitle>
                <CardDescription>Learn about common tax deductions you might be missing</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Discover legitimate deductions that could reduce your tax liability and increase your refund.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Filing Deadlines</CardTitle>
                <CardDescription>Important dates for tax filing and payments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Stay on top of critical tax deadlines to avoid penalties and interest charges.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tax Forms Library</CardTitle>
                <CardDescription>Access to commonly needed tax forms</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Download and access the most frequently used tax forms and instructions.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TaxResources;