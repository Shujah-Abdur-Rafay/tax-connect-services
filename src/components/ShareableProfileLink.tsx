import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ShareableProfileLinkProps {
  /** Preferred human-readable slug → /preparer/{slug}. */
  slug?: string | null;
  /** Fallback uid → /professional/{id} when no slug exists yet. */
  professionalId?: string | null;
  /** Compact (icon button only) vs. full (input + copy + open). */
  variant?: 'compact' | 'full';
  className?: string;
  /** Optional heading shown above the link in `full` mode. */
  label?: string;
}

/**
 * Builds and copies a professional's public landing-page URL. Prefers the
 * clean `/preparer/{slug}` form and transparently falls back to the legacy
 * `/professional/{uid}` alias when a slug hasn't been assigned yet.
 */
const ShareableProfileLink: React.FC<ShareableProfileLinkProps> = ({
  slug,
  professionalId,
  variant = 'full',
  className,
  label = 'Your shareable profile link',
}) => {
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://refund-connect.com';
    const path = slug
      ? `/preparer/${slug}`
      : professionalId
        ? `/professional/${professionalId}`
        : '';
    return path ? `${origin}${path}` : '';
  }, [slug, professionalId]);

  if (!url) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Profile link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — long-press or select the link to copy it.');
    }
  };

  if (variant === 'compact') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className={className}
        aria-label="Copy shareable profile link"
      >
        {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
        <span className="ml-2">{copied ? 'Copied' : 'Share'}</span>
      </Button>
    );
  }

  return (
    <div className={className}>
      {label && <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>}
      <div className="flex items-center gap-2">
        <Input value={url} readOnly onFocus={(e) => e.currentTarget.select()} className="text-sm" />
        <Button type="button" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
        <Button type="button" variant="outline" size="icon" asChild className="shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open profile in a new tab">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
};

export default ShareableProfileLink;
