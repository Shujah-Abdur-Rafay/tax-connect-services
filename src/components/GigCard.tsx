import React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Star, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProBadge, SpeedIndicator } from './ProBadges';
import type { TaxGig } from '@/data/taxGigs';

interface GigCardProps {
  gig: TaxGig;
  onSelect?: (gig: TaxGig) => void;
  saved?: boolean;
  onToggleSave?: (id: string) => void;
}

const GigCard: React.FC<GigCardProps> = ({ gig, onSelect, saved, onToggleSave }) => {
  const basicPrice = gig.tiers.find((t) => t.name === 'Basic')?.price ?? gig.tiers[0].price;

  return (
    <Card
      className="group flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
      onClick={() => onSelect?.(gig)}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
        <img
          src={gig.image}
          alt={gig.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSave?.(gig.id); }}
          aria-label="Save gig"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:bg-white"
        >
          <Heart className={`h-4 w-4 ${saved ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
        </button>
        <div className="absolute left-3 top-3 flex flex-col gap-1">
          <ProBadge type={gig.proBadge} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={gig.proAvatar} alt={gig.proName} />
            <AvatarFallback>{gig.proName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{gig.proName}</p>
            <p className="truncate text-xs text-gray-500">{gig.proTitle}</p>
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-blue-600">
          {gig.title}
        </h3>

        <div className="flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold text-gray-900">{gig.rating}</span>
          <span className="text-gray-500">({gig.reviewCount.toLocaleString()})</span>
        </div>

        <SpeedIndicator responseTime={gig.responseTime} availableNow={gig.availableNow} />

        <div className="mt-auto flex items-end justify-between border-t border-gray-100 pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Starting at</p>
            <p className="text-xl font-bold text-gray-900">${basicPrice}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            onClick={(e) => { e.stopPropagation(); onSelect?.(gig); }}
          >
            View <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default GigCard;
