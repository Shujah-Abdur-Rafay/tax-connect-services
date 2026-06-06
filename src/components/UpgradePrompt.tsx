import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Star, TrendingUp } from 'lucide-react';

interface UpgradePromptProps {
  feature: string;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ feature }) => {
  const navigate = useNavigate();

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-full">
            <Lock className="w-6 h-6" />
          </div>
          <span>Upgrade Required</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-700">
          Access to <strong>{feature}</strong> is available with upgraded membership levels.
        </p>
        <div className="bg-white p-4 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-gray-900 mb-2">Upgrade Benefits:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Full access to all portal features
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Marketing materials & templates
            </li>
            <li className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Document management tools
            </li>
          </ul>
        </div>
        <Button 
          onClick={() => navigate('/upgrade-membership')}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          size="lg"
        >
          <Star className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );
};

export default UpgradePrompt;
