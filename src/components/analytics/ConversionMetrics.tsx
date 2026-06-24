import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ConversionMetricsProps {
  profileViews: number;
  bookings: number;
  conversionRate: number;
}

export function ConversionMetrics({ profileViews, bookings, conversionRate }: ConversionMetricsProps) {
  const bookingsPct = profileViews > 0 ? Math.min(100, (bookings / profileViews) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Profile Views</span>
            <span className="text-sm text-muted-foreground">{profileViews.toLocaleString()}</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Bookings</span>
            <span className="text-sm text-muted-foreground">{bookings.toLocaleString()}</span>
          </div>
          <Progress value={bookingsPct} className="h-2" />
        </div>
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Conversion Rate</span>
            <span className="text-2xl font-bold text-primary">{conversionRate.toFixed(2)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
