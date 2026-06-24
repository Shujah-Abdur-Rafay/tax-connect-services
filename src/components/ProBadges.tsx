import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Crown, Award, Sparkles, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type BadgeType = 'Verified Pro' | 'Premium Partner' | 'Top Rated' | 'New & Noted';

interface ProBadgeProps {
  type: BadgeType;
  className?: string;
}

const BADGE_CONFIG: Record<BadgeType, { icon: typeof ShieldCheck; classes: string; label: string }> = {
  'Verified Pro': {
    icon: ShieldCheck,
    classes: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    label: 'Verified Pro',
  },
  'Premium Partner': {
    icon: Crown,
    classes: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-300 hover:from-amber-200 hover:to-yellow-200',
    label: 'Premium Partner',
  },
  'Top Rated': {
    icon: Award,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    label: 'Top Rated',
  },
  'New & Noted': {
    icon: Sparkles,
    classes: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    label: 'New & Noted',
  },
};

export const ProBadge: React.FC<ProBadgeProps> = ({ type, className }) => {
  const config = BADGE_CONFIG[type];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 font-semibold', config.classes, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

interface SpeedIndicatorProps {
  responseTime: string;
  availableNow?: boolean;
  className?: string;
}

export const SpeedIndicator: React.FC<SpeedIndicatorProps> = ({ responseTime, availableNow, className }) => (
  <div className={cn('flex items-center gap-2 text-xs', className)}>
    {availableNow && (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
        </span>
        Available now
      </span>
    )}
    <span className="inline-flex items-center gap-1 text-gray-600">
      <Clock className="h-3 w-3" />
      {responseTime}
    </span>
  </div>
);

interface InstantBookProps {
  className?: string;
}

export const InstantBookBadge: React.FC<InstantBookProps> = ({ className }) => (
  <Badge className={cn('gap-1 bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200', className)} variant="outline">
    <Zap className="h-3 w-3 fill-current" />
    Instant Book
  </Badge>
);
