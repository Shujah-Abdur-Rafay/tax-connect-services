import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarIcon,
  DownloadIcon,
  DollarSignIcon,
  UsersIcon,
  StarIcon,
  TrendingUpIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { MetricCard } from "@/components/analytics/MetricCard";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { BookingsChart } from "@/components/analytics/BookingsChart";
import { ServicesChart } from "@/components/analytics/ServicesChart";
import { RatingsChart } from "@/components/analytics/RatingsChart";
import { ConversionMetrics } from "@/components/analytics/ConversionMetrics";
import {
  fetchPlatformAnalytics,
  type AnalyticsResult,
} from "@/services/platformAnalyticsService";
import { useAuth } from "@/contexts/AuthContext";

const EMPTY: AnalyticsResult = {
  metrics: {
    totalBookings: 0,
    totalRevenue: 0,
    avgRating: 0,
    retentionRate: 0,
    profileViews: 0,
    conversionRate: 0,
  },
  deltas: {},
  revenueData: [],
  bookingsData: [],
  servicesData: [],
  ratingsData: [],
};

export function ProfessionalAnalyticsDashboard() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date(),
  });
  const [data, setData] = useState<AnalyticsResult>(EMPTY);
  const [loading, setLoading] = useState(true);

  const { metrics, deltas, revenueData, bookingsData, servicesData, ratingsData } = data;

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPlatformAnalytics(dateRange);
      setData(result);
    } catch (err) {
      console.error("[analytics] failed to load platform analytics:", err);
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [user, fetchAnalytics]);

  const exportReport = (fmt: "csv" | "pdf") => {
    if (fmt === "csv") {
      const csvContent =
        `Metric,Value\n` +
        `Total Bookings,${metrics.totalBookings}\n` +
        `Total Revenue,$${metrics.totalRevenue}\n` +
        `Average Rating,${metrics.avgRating}\n` +
        `Client Retention,${metrics.retentionRate}%\n` +
        `Profile Views,${metrics.profileViews}\n` +
        `Conversion Rate,${metrics.conversionRate}%\n`;
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const hasNoData =
    !loading &&
    metrics.totalBookings === 0 &&
    metrics.totalRevenue === 0 &&
    metrics.avgRating === 0 &&
    metrics.profileViews === 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live platform-wide metrics from Firestore
            {loading && (
              <Loader2 className="inline h-3 w-3 ml-2 animate-spin align-middle" />
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => exportReport("csv")}>
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {hasNoData && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          No platform activity in this date range yet. These numbers are computed
          live from real orders, appointments, reviews, payments and profile
          views in Firestore — they will populate as the platform is used.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Bookings"
          value={metrics.totalBookings}
          change={deltas.bookings}
          icon={<UsersIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Total Revenue"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          change={deltas.revenue}
          icon={<DollarSignIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Average Rating"
          value={metrics.avgRating}
          change={deltas.rating}
          icon={<StarIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Client Retention"
          value={`${metrics.retentionRate}%`}
          icon={<TrendingUpIcon className="h-4 w-4" />}
          description="Paying clients with repeat orders"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart data={revenueData} />
        <BookingsChart data={bookingsData} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ServicesChart data={servicesData} />
        <RatingsChart data={ratingsData} />
      </div>

      <ConversionMetrics
        profileViews={metrics.profileViews}
        bookings={metrics.totalBookings}
        conversionRate={metrics.conversionRate}
      />
    </div>
  );
}
