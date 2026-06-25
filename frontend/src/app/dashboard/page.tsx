"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck,
  LogIn,
  LogOut,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { AttendanceTrendChart } from "@/components/dashboard/attendance-trend-chart";
import { ClassDistributionChart } from "@/components/dashboard/class-distribution-chart";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import type { AttendanceRecord, DashboardCharts, DashboardStats } from "@/types";

export default function DashboardPage() {
  const [targetDate, setTargetDate] = useState("");
  const [period, setPeriod] = useState("weekly");

  const dateParam = targetDate ? `?target_date=${targetDate}` : "";

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", targetDate],
    queryFn: () => apiGet<DashboardStats>(`/api/v1/dashboard/stats${dateParam}`),
  });

  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ["dashboard-charts", period, targetDate],
    queryFn: () =>
      apiGet<DashboardCharts>(
        `/api/v1/dashboard/charts?period=${period}${targetDate ? `&target_date=${targetDate}` : ""}`,
      ),
  });

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["dashboard-attendance"],
    queryFn: () => apiGet<AttendanceRecord[]>("/api/v1/attendance"),
  });

  const { checkIns, checkOuts } = useMemo(() => {
    const sorted = [...attendance].sort(
      (a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime(),
    );
    return {
      checkIns: sorted.filter((r) => !r.checked_out).slice(0, 8),
      checkOuts: sorted
        .filter((r) => r.checked_out)
        .sort(
          (a, b) =>
            new Date(b.check_out_time ?? b.check_in_time).getTime() -
            new Date(a.check_out_time ?? a.check_in_time).getTime(),
        )
        .slice(0, 8),
    };
  }, [attendance]);

  if (statsLoading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  const s = stats!;

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-[1600px]">
        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[36px] font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live operations overview for today&apos;s children&apos;s church service
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="dashboard-date" className="text-sm font-medium">
                Date
              </Label>
              <Input
                id="dashboard-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-40"
                aria-label="Filter dashboard by date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Trend Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36" aria-label="Select trend period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        {/* Quick Actions — highest priority workflows */}
        <QuickActions />

        {/* Operational metrics — what workers need first */}
        <section aria-label="Today's operations">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">Today&apos;s Operations</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Children Present Today"
              value={s.children_present_today}
              icon={UserCheck}
              trend={`${s.currently_checked_in} still checked in`}
              highlight
            />
            <MetricCard
              label="Currently Checked In"
              value={s.currently_checked_in}
              icon={LogIn}
              trend="Awaiting checkout"
              highlight
            />
            <MetricCard
              label="Already Checked Out"
              value={s.already_checked_out}
              icon={LogOut}
              trend="Released to parents"
              highlight
            />
          </div>
        </section>

        {/* Secondary analytics metrics */}
        <section aria-label="Church statistics">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Registered Children"
              value={s.total_children}
              icon={Users}
              trend={`+${s.new_children_this_month} this month`}
              trendPositive={s.new_children_this_month > 0}
            />
            <MetricCard
              label="Workers Present Today"
              value={s.workers_present_today}
              icon={ClipboardCheck}
              trend="On duty now"
            />
            <MetricCard
              label="New Children This Month"
              value={s.new_children_this_month}
              icon={UserPlus}
              trend="New registrations"
              trendPositive={s.new_children_this_month > 0}
            />
            <MetricCard
              label="Avg Weekly Attendance"
              value={s.average_weekly_attendance.toFixed(1)}
              icon={TrendingUp}
              trend="Per service day"
            />
          </div>
        </section>

        {/* Charts */}
        <section aria-label="Analytics charts" className="grid gap-6 xl:grid-cols-2">
          <AttendanceTrendChart
            data={charts?.attendance_trend ?? []}
            period={period}
            loading={chartsLoading}
          />
          <ClassDistributionChart
            data={charts?.class_distribution ?? []}
            loading={chartsLoading}
          />
        </section>

        {/* Live activity feeds */}
        <section aria-label="Recent activity">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">Live Activity</h2>
          <RecentActivity
            checkIns={checkIns}
            checkOuts={checkOuts}
            loading={attendanceLoading}
          />
        </section>
      </div>
    </DashboardLayout>
  );
}
