"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { ChartDataPoint, ExecutiveReportData } from "@/types";

const REPORT_COLORS = [
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#0a0a0a",
] as const;

interface ExecutiveReportViewProps {
  data: ExecutiveReportData;
  className?: string;
  id?: string;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}) {
  return (
    <div
      className={cn(
        "kpi-card relative overflow-hidden rounded-xl p-4 shadow-md",
        "text-white",
        gradient,
        "print:border-2 print:border-neutral-900 print:bg-white print:text-neutral-900 print:shadow-none",
      )}
    >
      <div className="absolute -right-2 -top-2 opacity-20 print:hidden">
        <Icon className="h-16 w-16" />
      </div>
      <p className="kpi-label text-xs font-semibold uppercase tracking-wide text-white print:text-neutral-700">
        {label}
      </p>
      <p className="kpi-value mt-1 text-3xl font-bold tabular-nums print:text-neutral-900">{value}</p>
      {sub ? (
        <p className="kpi-sub mt-1 text-xs font-medium text-white/90 print:text-neutral-600">{sub}</p>
      ) : null}
    </div>
  );
}

function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-5 w-1 rounded-full", accent)} />
      <h3 className="text-lg font-bold text-neutral-900 print:text-xl">{children}</h3>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-lg">
      {label ? <p className="font-medium text-neutral-900">{label}</p> : null}
      <p className="font-semibold text-amber-700">
        {payload[0].value}
        {suffix}
      </p>
    </div>
  );
}

function AttendanceTrendPanel({ data }: { data: ChartDataPoint[] }) {
  if (!data.length || !data.some((p) => p.value > 0)) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
        No trend data for this period
      </div>
    );
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#525252" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#525252" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip suffix=" children" />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={BRAND.yellow}
            strokeWidth={3}
            dot={{ fill: BRAND.black, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: BRAND.yellowDark }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClassDistributionPanel({ data }: { data: ChartDataPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartData = data.map((d) => ({
    name: d.label,
    value: d.value,
    percent: total > 0 ? Math.round((d.value / total) * 100) : 0,
  }));

  if (!chartData.length) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
        No class data available
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 items-center">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={index}
                  fill={REPORT_COLORS[index % REPORT_COLORS.length]}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip suffix=" registered" />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {chartData.map((item, index) => (
          <li key={item.name} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: REPORT_COLORS[index % REPORT_COLORS.length] }}
              />
              <span className="truncate font-medium text-neutral-900">{item.name}</span>
            </div>
            <span className="shrink-0 tabular-nums text-neutral-600">
              {item.value} ({item.percent}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClassAttendanceBar({ data }: { data: ExecutiveReportData["metrics"]["class_breakdown"] }) {
  if (!data.length) return null;

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis
            dataKey="class_name"
            tick={{ fontSize: 10, fill: "#525252" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#525252" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="present" name="Present" fill={BRAND.yellow} radius={[6, 6, 0, 0]} />
          <Bar dataKey="registered" name="Registered" fill={BRAND.black} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExecutiveReportView({ data, className, id = "executive-report" }: ExecutiveReportViewProps) {
  const { metrics, summary } = data;
  const { kpis, retention, charts } = metrics;
  const isDaily = metrics.report_period === "daily";

  const growthDisplay = kpis.attendance_growth_pct != null
    ? `${kpis.attendance_growth_pct > 0 ? "+" : ""}${kpis.attendance_growth_pct}% vs ${kpis.attendance_growth_vs ?? "prior"}`
    : kpis.attendance_growth_note ?? "—";

  return (
    <article
      id={id}
      className={cn(
        "executive-report-document overflow-hidden rounded-2xl border border-amber-200/60 bg-white shadow-xl",
        className,
      )}
    >
      {/* Header */}
      <header className="executive-report-header relative bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 px-6 py-8 text-white print:break-inside-avoid print:border-b-4 print:border-amber-700 print:bg-amber-100 print:text-neutral-900">
        <div className="absolute inset-0 opacity-10 print:hidden">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white" />
          <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white" />
        </div>
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-100 print:text-neutral-700">
                <Sparkles className="h-4 w-4 print:text-amber-700" />
                Ministry Intelligence Report
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight print:text-neutral-900">Votage Kids</h2>
              <p className="mt-1 text-lg font-medium text-amber-50 print:text-neutral-800">Executive Summary</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-3 text-right backdrop-blur-sm print:border print:border-neutral-400 print:bg-white">
              <p className="text-sm font-bold print:text-neutral-900">{metrics.period_label}</p>
              <p className="text-xs font-medium text-amber-100 print:text-neutral-700">{metrics.service_name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-8 p-6">
        {/* KPI Grid */}
        <section className="print:break-inside-avoid">
          <SectionTitle accent="bg-amber-500">Key Performance Indicators</SectionTitle>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Children Present"
              value={kpis.children_present}
              sub={`of ${kpis.registered_children} registered`}
              icon={Users}
              gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            />
            <KpiCard
              label="Check-in Rate"
              value={`${kpis.check_in_rate_pct}%`}
              icon={UserCheck}
              gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            />
            <KpiCard
              label="Workers Present"
              value={kpis.workers_present}
              sub={
                kpis.worker_to_child_ratio != null
                  ? `${kpis.worker_to_child_ratio} children per worker`
                  : undefined
              }
              icon={Target}
              gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            />
            <KpiCard
              label="Follow-up Needed"
              value={metrics.absent_two_services_count}
              sub="Absent 2+ services"
              icon={AlertTriangle}
              gradient="bg-gradient-to-br from-rose-500 to-red-600"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="executive-kpi-secondary rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 print:border-neutral-900">
              <p className="text-xs font-semibold text-neutral-700">New Registrations (Month)</p>
              <p className="text-xl font-bold text-neutral-900">{kpis.new_registrations_this_month}</p>
            </div>
            <div className="executive-kpi-secondary rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 print:border-neutral-900">
              <p className="text-xs font-semibold text-neutral-700">Avg Weekly Attendance</p>
              <p className="text-xl font-bold text-neutral-900">{kpis.average_weekly_attendance}</p>
            </div>
            {kpis.check_out_completion_pct != null ? (
              <div className="executive-kpi-secondary rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 print:border-neutral-900">
                <p className="text-xs font-semibold text-neutral-700">Check-out Completion</p>
                <p className="text-xl font-bold text-neutral-900">{kpis.check_out_completion_pct}%</p>
              </div>
            ) : null}
            <div className="executive-kpi-secondary rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 print:border-neutral-900">
              <p className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Attendance Growth
              </p>
              <p className="text-sm font-bold leading-snug text-neutral-900">{growthDisplay}</p>
            </div>
          </div>
        </section>

        {/* Executive Summary */}
        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 print:break-inside-avoid print:border-neutral-900">
          <SectionTitle accent="bg-amber-500">Executive Summary</SectionTitle>
          <p className="mt-3 text-base leading-relaxed font-medium text-neutral-900 whitespace-pre-line">
            {summary.executive_summary}
          </p>
        </section>

        {/* Charts */}
        <section className="grid gap-6 lg:grid-cols-2 print:break-inside-avoid">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-600" />
              <h4 className="font-semibold text-neutral-900">Attendance Trend</h4>
            </div>
            <AttendanceTrendPanel data={charts.attendance_trend} />
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              <h4 className="font-semibold text-neutral-900">Registered by Class</h4>
            </div>
            <ClassDistributionPanel data={charts.class_distribution} />
          </div>
        </section>

        {/* Retention */}
        <section className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 print:break-inside-avoid print:border-neutral-900">
          <SectionTitle accent="bg-emerald-500">Retention Analysis</SectionTitle>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold text-neutral-700">
                {isDaily ? "Returned From Previous Service" : "Returning Children"}
              </p>
              <p className="text-2xl font-extrabold text-emerald-800">{retention.returning_count}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold text-neutral-700">First Check-in Ever</p>
              <p className="text-2xl font-extrabold text-emerald-800">{retention.first_check_in_ever_count}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold text-neutral-700">Unique Present</p>
              <p className="text-2xl font-extrabold text-emerald-800">{retention.unique_children_present}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold text-neutral-700">Retention Rate</p>
              <p className="text-2xl font-extrabold text-emerald-800">
                {retention.retention_rate_pct != null ? `${retention.retention_rate_pct}%` : "—"}
              </p>
              {retention.retention_note ? (
                <p className="mt-1 text-xs font-medium text-neutral-700">{retention.retention_note}</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Class breakdown chart + table */}
        {metrics.class_breakdown.length > 0 ? (
          <section className="rounded-xl border bg-white p-5 shadow-sm print:break-inside-avoid">
            <SectionTitle accent="bg-violet-500">Class Attendance Breakdown</SectionTitle>
            <div className="mt-4">
              <ClassAttendanceBar data={metrics.class_breakdown} />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-900 text-white">
                    <th className="rounded-tl-lg p-2 text-left font-medium">Class</th>
                    <th className="p-2 text-right font-medium">Present</th>
                    <th className="rounded-tr-lg p-2 text-right font-medium">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.class_breakdown.map((row, i) => (
                    <tr
                      key={row.class_name}
                      className={cn("border-b", i % 2 === 0 ? "bg-amber-50/40" : "bg-white")}
                    >
                      <td className="p-2 font-medium text-neutral-900">{row.class_name}</td>
                      <td className="p-2 text-right tabular-nums text-neutral-800">{row.present}</td>
                      <td className="p-2 text-right tabular-nums text-neutral-800">{row.registered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Workers — counts only (no names) */}
        {metrics.workers_on_duty.length > 0 ? (
          <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 print:break-inside-avoid">
            <SectionTitle accent="bg-blue-500">Workers on Duty</SectionTitle>
            <p className="mt-3 text-base font-medium text-neutral-800">
              <span className="text-3xl font-extrabold text-blue-800">
                {metrics.workers_on_duty.length}
              </span>{" "}
              worker{metrics.workers_on_duty.length === 1 ? "" : "s"} checked in for this period
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              Individual worker names are omitted from this report for privacy.
            </p>
          </section>
        ) : null}

        {/* Follow-up — aggregate only (no names or phones) */}
        <section className="rounded-xl border border-red-200 bg-red-50/30 p-5 print:break-inside-avoid">
          <SectionTitle accent="bg-red-500">
            Follow-up: Absent 2+ Consecutive Services
          </SectionTitle>
          <p className="mt-3 text-base font-medium text-neutral-800">
            <span className="text-3xl font-extrabold text-red-700">
              {metrics.absent_two_services_count}
            </span>{" "}
            child{metrics.absent_two_services_count === 1 ? "" : "ren"} need follow-up
          </p>
          {metrics.absent_two_services_count > 0 ? (
            <>
              {(() => {
                const byClass = metrics.absent_two_services.reduce<Record<string, number>>(
                  (acc, row) => {
                    acc[row.class_name] = (acc[row.class_name] || 0) + 1;
                    return acc;
                  },
                  {},
                );
                const entries = Object.entries(byClass).sort((a, b) => b[1] - a[1]);
                return entries.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-red-600 text-white">
                          <th className="p-2 text-left font-medium">Class</th>
                          <th className="p-2 text-right font-medium">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(([className, count]) => (
                          <tr key={className} className="border-b bg-white even:bg-red-50/50">
                            <td className="p-2 font-medium text-neutral-900">{className}</td>
                            <td className="p-2 text-right tabular-nums text-neutral-800">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null;
              })()}
              <p className="mt-3 text-xs text-neutral-600">
                Child names, parent names, and phone numbers are not included on this report. Download
                follow-up contacts separately when calling families.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-neutral-600">
              No children require follow-up at this time.
            </p>
          )}
        </section>

        {/* Insights & Recommendations */}
        <section className="grid gap-4 lg:grid-cols-2 print:break-inside-avoid">
          <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-5 print:border-neutral-900">
            <div className="flex items-center gap-2 text-indigo-950">
              <Lightbulb className="h-5 w-5" />
              <h4 className="text-base font-bold">Key Insights</h4>
            </div>
            <ul className="mt-3 space-y-2">
              {summary.key_insights.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm font-medium leading-relaxed text-neutral-900">
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border-2 border-teal-300 bg-teal-50 p-5 print:border-neutral-900">
            <div className="flex items-center gap-2 text-teal-950">
              <Target className="h-5 w-5" />
              <h4 className="text-base font-bold">Recommendations</h4>
            </div>
            <ul className="mt-3 space-y-2">
              {summary.recommendations.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm font-medium leading-relaxed text-neutral-900">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="border-t-2 border-neutral-300 pt-4 text-center text-sm font-medium text-neutral-700 print:break-inside-avoid">
          Generated by VKMS · Votage Kids Management System · {new Date().toLocaleDateString()}
        </footer>
      </div>
    </article>
  );
}

export function printExecutiveReport() {
  window.print();
}
