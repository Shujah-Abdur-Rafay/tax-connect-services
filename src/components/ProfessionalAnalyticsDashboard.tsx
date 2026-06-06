import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, DownloadIcon, DollarSignIcon, UsersIcon, StarIcon, TrendingUpIcon } from "lucide-react";
import { format } from "date-fns";
import { MetricCard } from "@/components/analytics/MetricCard";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { BookingsChart } from "@/components/analytics/BookingsChart";
import { ServicesChart } from "@/components/analytics/ServicesChart";
import { RatingsChart } from "@/components/analytics/RatingsChart";
import { ConversionMetrics } from "@/components/analytics/ConversionMetrics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function ProfessionalAnalyticsDashboard() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date(),
  });
  const [metrics, setMetrics] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    avgRating: 0,
    retentionRate: 0,
    profileViews: 0,
    conversionRate: 0,
  });

  const [revenueData, setRevenueData] = useState([]);
  const [bookingsData, setBookingsData] = useState([]);
  const [servicesData, setServicesData] = useState([]);
  const [ratingsData, setRatingsData] = useState([]);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, dateRange]);

  const fetchAnalytics = async () => {
    // Fetch mock data - in production, this would query Supabase
    setMetrics({
      totalBookings: 127,
      totalRevenue: 45680,
      avgRating: 4.8,
      retentionRate: 78,
      profileViews: 1543,
      conversionRate: 8.2,
    });

    setRevenueData([
      { date: "Jan", revenue: 3200 },
      { date: "Feb", revenue: 3800 },
      { date: "Mar", revenue: 4200 },
      { date: "Apr", revenue: 3900 },
      { date: "May", revenue: 4500 },
      { date: "Jun", revenue: 5100 },
    ]);

    setBookingsData([
      { time: "Mon", bookings: 18 },
      { time: "Tue", bookings: 22 },
      { time: "Wed", bookings: 25 },
      { time: "Thu", bookings: 20 },
      { time: "Fri", bookings: 28 },
      { time: "Sat", bookings: 8 },
      { time: "Sun", bookings: 6 },
    ]);

    setServicesData([
      { name: "Tax Prep", value: 45 },
      { name: "Consulting", value: 30 },
      { name: "Bookkeeping", value: 15 },
      { name: "Audit Support", value: 10 },
    ]);

    setRatingsData([
      { month: "Jan", rating: 4.6 },
      { month: "Feb", rating: 4.7 },
      { month: "Mar", rating: 4.8 },
      { month: "Apr", rating: 4.7 },
      { month: "May", rating: 4.9 },
      { month: "Jun", rating: 4.8 },
    ]);
  };

  const exportReport = (format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      const csvContent = `Metric,Value\nTotal Bookings,${metrics.totalBookings}\nTotal Revenue,$${metrics.totalRevenue}\nAverage Rating,${metrics.avgRating}\nRetention Rate,${metrics.retentionRate}%\n`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="range" />
            </PopoverContent>
          </Popover>
          <Button onClick={() => exportReport('csv')}>
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Bookings"
          value={metrics.totalBookings}
          change={12.5}
          icon={<UsersIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Total Revenue"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          change={8.3}
          icon={<DollarSignIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Average Rating"
          value={metrics.avgRating}
          change={2.1}
          icon={<StarIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Client Retention"
          value={`${metrics.retentionRate}%`}
          change={5.2}
          icon={<TrendingUpIcon className="h-4 w-4" />}
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
