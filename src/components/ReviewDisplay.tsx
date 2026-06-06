import { useState, useEffect } from 'react';
import { Star, ThumbsUp, ThumbsDown, CheckCircle, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ReviewResponseForm } from './ReviewResponseForm';

interface Review {
  id: string;
  client_name: string;
  rating: number;
  title: string;
  review_text: string;
  service_type: string | null;
  service_date: string | null;
  is_verified: boolean;
  helpful_count: number;
  not_helpful_count: number;
  professional_response: string | null;
  professional_response_date: string | null;
  created_at: string;
}

interface ReviewDisplayProps {
  professionalId: string;
  isProfessionalView?: boolean;
}

export function ReviewDisplay({ professionalId, isProfessionalView = false }: ReviewDisplayProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
    if (user) fetchUserVotes();
  }, [professionalId, user]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('professional_id', professionalId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserVotes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('review_votes')
        .select('review_id, vote_type')
        .eq('user_id', user.uid);

      if (error) throw error;
      
      const votesMap: Record<string, string> = {};
      data?.forEach(vote => {
        votesMap[vote.review_id] = vote.vote_type;
      });
      setUserVotes(votesMap);
    } catch (error) {
      console.error('Error fetching user votes:', error);
    }
  };

  const handleVote = async (reviewId: string, voteType: 'helpful' | 'not_helpful') => {
    if (!user) {
      toast.error('Please log in to vote');
      return;
    }

    const currentVote = userVotes[reviewId];
    
    try {
      if (currentVote === voteType) {
        await supabase.from('review_votes').delete().match({ review_id: reviewId, user_id: user.uid });
        const newVotes = { ...userVotes };
        delete newVotes[reviewId];
        setUserVotes(newVotes);
      } else {
        await supabase.from('review_votes').upsert({
          review_id: reviewId,
          user_id: user.uid,
          vote_type: voteType
        }, { onConflict: 'review_id,user_id' });
        setUserVotes({ ...userVotes, [reviewId]: voteType });
      }
      
      fetchReviews();
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to record vote');
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  if (loading) return <div>Loading reviews...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-4xl font-bold">{avgRating}</div>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(parseFloat(avgRating))
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{reviews.length} reviews</div>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id} className="p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{review.client_name}</span>
                  {review.is_verified && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>

            <h4 className="font-semibold mb-2">{review.title}</h4>
            <p className="text-muted-foreground mb-3">{review.review_text}</p>

            {review.service_type && (
              <Badge variant="outline" className="mb-3">{review.service_type}</Badge>
            )}

            <div className="flex gap-4 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote(review.id, 'helpful')}
                className={userVotes[review.id] === 'helpful' ? 'text-green-600' : ''}
              >
                <ThumbsUp className="w-4 h-4 mr-1" />
                Helpful ({review.helpful_count})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote(review.id, 'not_helpful')}
                className={userVotes[review.id] === 'not_helpful' ? 'text-red-600' : ''}
              >
                <ThumbsDown className="w-4 h-4 mr-1" />
                Not Helpful ({review.not_helpful_count})
              </Button>
              {isProfessionalView && !review.professional_response && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRespondingTo(review.id)}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Respond
                </Button>
              )}
            </div>

            {review.professional_response && (
              <div className="mt-4 pl-4 border-l-2 border-primary">
                <div className="font-semibold text-sm mb-1">Professional Response</div>
                <p className="text-sm text-muted-foreground">{review.professional_response}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.professional_response_date!).toLocaleDateString()}
                </span>
              </div>
            )}

            {respondingTo === review.id && (
              <div className="mt-4">
                <ReviewResponseForm
                  reviewId={review.id}
                  onSuccess={() => {
                    setRespondingTo(null);
                    fetchReviews();
                  }}
                  onCancel={() => setRespondingTo(null)}
                />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
