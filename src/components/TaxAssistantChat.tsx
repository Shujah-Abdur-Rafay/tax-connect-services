import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, X, Send, Sparkles, Loader2, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type ChatRole = 'user' | 'assistant';
interface ChatMessage { role: ChatRole; content: string; }
interface Recommendation {
  tier?: 'basic' | 'standard' | 'premium';
  proType?: 'preparer' | 'ea' | 'cpa' | 'attorney';
  estimatedPrice?: string;
  summary?: string;
  urgency?: 'low' | 'medium' | 'high';
}

const QUICK_PROMPTS = [
  'I have a simple W-2 return',
  'I am self-employed / freelance',
  'I own a rental property',
  'I trade crypto',
  'I got an IRS notice',
];

// Lightweight rule-based fallback when the edge function is unavailable.
function localScopeResponse(text: string, history: ChatMessage[]): { reply: string; recommendation: Recommendation | null } {
  const t = text.toLowerCase();
  const turns = history.filter((m) => m.role === 'user').length;

  if (turns === 0) {
    if (t.match(/w-?2|simple|employee/)) {
      return {
        reply: "Got it — a W-2 return. Quick question: any itemized deductions, dependents, or multiple states? Or would the standard deduction work?",
        recommendation: null,
      };
    }
    if (t.match(/self|freelance|1099|contract|business|llc|s.?corp/)) {
      return {
        reply: "Self-employed work — nice. Roughly what was your revenue, and do you have a home office, vehicle, or significant business expenses?",
        recommendation: null,
      };
    }
    if (t.match(/rental|landlord|airbnb|schedule e/)) {
      return {
        reply: "Rental income, got it. How many properties, and do you actively manage them? Also — any 1031 exchanges or sales this year?",
        recommendation: null,
      };
    }
    if (t.match(/crypto|nft|defi|bitcoin|eth/)) {
      return {
        reply: "Crypto trader — we have specialists for this. Roughly how many transactions across how many exchanges/wallets? Any DeFi or NFTs?",
        recommendation: null,
      };
    }
    if (t.match(/audit|irs|notice|cp2000|letter/)) {
      return {
        reply: "IRS issue — let's get this handled. Is it a CP2000 notice, full audit, or something else? Do you have the notice in front of you?",
        recommendation: null,
      };
    }
    return {
      reply: "Happy to help! Quick scope: roughly what kind of income did you have this year — W-2 wages, 1099/freelance, business, rental, or investments?",
      recommendation: null,
    };
  }

  // turn 1+: produce a recommendation
  let rec: Recommendation = {
    tier: 'standard',
    proType: 'cpa',
    estimatedPrice: '$200-$500',
    summary: 'Mid-complexity return needing professional review',
    urgency: 'medium',
  };

  const allText = (history.map((m) => m.content).join(' ') + ' ' + text).toLowerCase();
  if (allText.match(/audit|cp2000|tax court|levy|lien/)) {
    rec = { tier: 'premium', proType: 'attorney', estimatedPrice: '$499-$4,999', summary: 'IRS resolution / audit defense', urgency: 'high' };
  } else if (allText.match(/crypto|defi|nft/)) {
    rec = { tier: 'premium', proType: 'cpa', estimatedPrice: '$299-$999', summary: 'Crypto reconciliation + Form 8949', urgency: 'medium' };
  } else if (allText.match(/rental|landlord|schedule e|1031/)) {
    rec = { tier: 'premium', proType: 'cpa', estimatedPrice: '$199-$699', summary: 'Schedule E with depreciation', urgency: 'medium' };
  } else if (allText.match(/self|1099|freelance|business|llc|s.?corp|schedule c/)) {
    rec = { tier: 'standard', proType: 'ea', estimatedPrice: '$249-$749', summary: 'Self-employed return with QBI optimization', urgency: 'medium' };
  } else if (allText.match(/simple|w-?2|standard deduction/)) {
    rec = { tier: 'basic', proType: 'preparer', estimatedPrice: '$89-$249', summary: 'Simple W-2 return', urgency: 'low' };
  }

  const reply = `Based on what you've shared, here's my read: **${rec.summary}**. I'd recommend a ${rec.tier!.toUpperCase()} tier (about ${rec.estimatedPrice}) with a ${rec.proType!.toUpperCase()}. Tap below to browse matching pros — or ask me anything else first.`;
  return { reply, recommendation: rec };
}

const TaxAssistantChat: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm Tax Buddy. Tell me a bit about your tax situation and I'll match you to the right pro & price tier. 🎯" },
  ]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    let reply = '';
    let rec: Recommendation | null = null;

    try {
      const { data, error } = await supabase.functions.invoke('tax-assistant-chat', {
        body: { messages: nextMessages.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (!error && data?.reply) {
        reply = data.reply;
        rec = data.recommendation || null;
      } else {
        const local = localScopeResponse(text, nextMessages.slice(0, -1));
        reply = local.reply; rec = local.recommendation;
      }
    } catch {
      const local = localScopeResponse(text, nextMessages.slice(0, -1));
      reply = local.reply; rec = local.recommendation;
    }

    setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    if (rec) setRecommendation(rec);
    setLoading(false);
  };

  const handleBrowse = () => {
    setOpen(false);
    navigate('/tax-gigs');
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-white shadow-2xl transition-all hover:scale-105 hover:shadow-blue-500/40"
          aria-label="Open Tax Buddy chat"
        >
          <div className="relative">
            <Bot className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-400 ring-2 ring-white" />
          </div>
          <span className="text-sm font-semibold">Ask Tax Buddy</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] max-h-[calc(100vh-3rem)] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 backdrop-blur">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold leading-tight">Tax Buddy</p>
                <p className="text-xs text-blue-100">AI tax concierge · online</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white border text-gray-800 rounded-bl-sm shadow-sm'
                  )}
                  // Render **bold** markdown
                  dangerouslySetInnerHTML={{
                    __html: m.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
                  }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border bg-white px-4 py-2 text-sm shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                </div>
              </div>
            )}

            {recommendation && !loading && (
              <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">My recommendation</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Tier</p>
                    <Badge className="bg-blue-600 capitalize">{recommendation.tier}</Badge>
                  </div>
                  <div>
                    <p className="text-gray-500">Pro type</p>
                    <Badge variant="outline" className="uppercase">{recommendation.proType}</Badge>
                  </div>
                  <div>
                    <p className="text-gray-500">Est. price</p>
                    <p className="font-bold text-gray-900">{recommendation.estimatedPrice}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Urgency</p>
                    <p className="font-semibold capitalize text-gray-900">{recommendation.urgency}</p>
                  </div>
                </div>
                <Button onClick={handleBrowse} size="sm" className="mt-3 w-full bg-blue-600 hover:bg-blue-700">
                  Browse matching pros
                </Button>
              </div>
            )}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t bg-white p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || loading} className="bg-blue-600 hover:bg-blue-700">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default TaxAssistantChat;
