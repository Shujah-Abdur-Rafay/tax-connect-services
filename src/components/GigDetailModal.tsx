import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Star, Check, Clock, RefreshCw, Zap, MessageCircle, FileText, Users, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ProBadge, SpeedIndicator } from './ProBadges';
import type { TaxGig, GigTier } from '@/data/taxGigs';

interface GigDetailModalProps {
  gig: TaxGig | null;
  open: boolean;
  onClose: () => void;
  onStartBrief?: (gig: TaxGig, tier: GigTier) => void;
}

const GigDetailModal: React.FC<GigDetailModalProps> = ({ gig, open, onClose, onStartBrief }) => {
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<'Basic' | 'Standard' | 'Premium'>('Standard');

  if (!gig) return null;

  const tier = gig.tiers.find((t) => t.name === selectedTier) ?? gig.tiers[1] ?? gig.tiers[0];

  const handleContinue = () => {
    onStartBrief?.(gig, tier);
  };

  const handleMessage = () => {
    toast({
      title: 'Message sent',
      description: `${gig.proName} typically replies ${gig.responseTime.toLowerCase()}.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
        <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
          {/* LEFT: gig presentation */}
          <div className="p-6 md:p-8">
            <DialogHeader>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ProBadge type={gig.proBadge} />
                {gig.availableNow && (
                  <Badge className="gap-1 bg-green-100 text-green-700 border-green-200" variant="outline">
                    <Zap className="h-3 w-3" /> Available now
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-left text-2xl leading-tight">{gig.title}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={gig.proAvatar} alt={gig.proName} />
                <AvatarFallback>{gig.proName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-gray-900">{gig.proName}</p>
                <p className="text-sm text-gray-500">{gig.proTitle}</p>
              </div>
              <div className="ml-auto flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{gig.rating}</span>
                <span className="text-gray-500">({gig.reviewCount.toLocaleString()})</span>
              </div>
            </div>

            <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-gray-100">
              <img src={gig.image} alt={gig.title} className="h-full w-full object-cover" />
            </div>

            {/* social proof stats */}
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border bg-gray-50 p-4">
              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500"><FileText className="h-3 w-3" /> Filed this season</div>
                <div className="text-lg font-bold text-gray-900">{gig.filedThisSeason}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500"><Users className="h-3 w-3" /> In queue</div>
                <div className="text-lg font-bold text-gray-900">{gig.ordersInQueue} orders</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500"><TrendingUp className="h-3 w-3" /> Repeat clients</div>
                <div className="text-lg font-bold text-gray-900">{Math.round(gig.reviewCount * 0.6)}+</div>
              </div>
            </div>

            <Tabs defaultValue="about" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="about" className="flex-1">About this gig</TabsTrigger>
                <TabsTrigger value="compare" className="flex-1">Compare tiers</TabsTrigger>
                <TabsTrigger value="faq" className="flex-1">FAQ</TabsTrigger>
              </TabsList>
              <TabsContent value="about" className="mt-4 space-y-3 text-sm leading-relaxed text-gray-700">
                <p>{gig.shortDescription}</p>
                <div className="flex flex-wrap gap-1.5">
                  {gig.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                  ))}
                </div>
                <SpeedIndicator responseTime={gig.responseTime} availableNow={gig.availableNow} />
              </TabsContent>
              <TabsContent value="compare" className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-semibold"> </th>
                      {gig.tiers.map((t) => (
                        <th key={t.name} className="py-2 px-2 text-center font-semibold">{t.name}<br/><span className="text-blue-600">${t.price}</span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">Delivery</td>
                      {gig.tiers.map((t) => <td key={t.name} className="py-2 text-center">{t.deliveryDays} days</td>)}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">Revisions</td>
                      {gig.tiers.map((t) => <td key={t.name} className="py-2 text-center">{t.revisions}</td>)}
                    </tr>
                  </tbody>
                </table>
              </TabsContent>
              <TabsContent value="faq" className="mt-4 space-y-3 text-sm text-gray-700">
                <div>
                  <p className="font-semibold text-gray-900">How does payment work?</p>
                  <p className="text-gray-600">Funds are held in escrow and released when you accept the delivered return.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">What if I need changes?</p>
                  <p className="text-gray-600">Each tier includes revisions. You can also message your pro any time.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Is my data secure?</p>
                  <p className="text-gray-600">All documents are encrypted at rest and shared via secure portals only.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT: tiered package selector (sticky on desktop) */}
          <div className="border-t bg-gray-50 p-6 md:border-l md:border-t-0 md:p-8">
            <Tabs value={selectedTier} onValueChange={(v) => setSelectedTier(v as 'Basic' | 'Standard' | 'Premium')}>
              <TabsList className="grid w-full grid-cols-3">
                {gig.tiers.map((t) => (
                  <TabsTrigger key={t.name} value={t.name}>{t.name}</TabsTrigger>
                ))}
              </TabsList>
              {gig.tiers.map((t) => (
                <TabsContent key={t.name} value={t.name} className="mt-4">
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <div className="mb-2 flex items-baseline justify-between">
                      <h3 className="text-lg font-bold text-gray-900">{t.name} Package</h3>
                      <span className="text-2xl font-bold text-blue-600">${t.price}</span>
                    </div>
                    <p className="mb-4 text-sm text-gray-600">{t.description}</p>

                    <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span><strong>{t.deliveryDays}</strong> day{t.deliveryDays > 1 ? 's' : ''} delivery</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <RefreshCw className="h-4 w-4 text-blue-600" />
                        <span><strong>{t.revisions}</strong> revision{t.revisions !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    <ul className="space-y-2 text-sm">
                      {t.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                          <span className="text-gray-700">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="mt-5 space-y-2">
              <Button
                onClick={handleContinue}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                Continue (${tier.price}) <Zap className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={handleMessage} variant="outline" className="w-full" size="lg">
                <MessageCircle className="mr-2 h-4 w-4" /> Message {gig.proName.split(',')[0]}
              </Button>
              <p className="text-center text-xs text-gray-500">Free to message · Pay only when you accept</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GigDetailModal;
