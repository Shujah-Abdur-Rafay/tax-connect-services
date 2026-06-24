import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface BulkPricingModalProps {
  onApply: (updates: { percentage: number; type: 'increase' | 'decrease' }) => void;
  onClose: () => void;
}

export const BulkPricingModal = ({ onApply, onClose }: BulkPricingModalProps) => {
  const [percentage, setPercentage] = useState<number>(10);
  const [type, setType] = useState<'increase' | 'decrease'>('increase');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({ percentage, type });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Pricing Update</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Adjustment Type</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as 'increase' | 'decrease')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="increase" id="increase" />
                <Label htmlFor="increase">Increase Prices</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="decrease" id="decrease" />
                <Label htmlFor="decrease">Decrease Prices</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Percentage (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(parseFloat(e.target.value))}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              All service prices will be {type === 'increase' ? 'increased' : 'decreased'} by {percentage}%
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Apply Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
