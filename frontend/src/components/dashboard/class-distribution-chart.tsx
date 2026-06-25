"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CLASS_CHART_COLORS } from "@/lib/brand";
import type { ChartDataPoint } from "@/types";

interface ClassDistributionChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { percent: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground">{item.value}</span> children
        {" · "}
        <span className="font-semibold text-secondary">{item.payload.percent}%</span>
      </p>
    </div>
  );
}

export function ClassDistributionChart({ data, loading }: ClassDistributionChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartData = data.map((d) => ({
    name: d.label,
    value: d.value,
    percent: total > 0 ? Math.round((d.value / total) * 100) : 0,
  }));

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-semibold">Class Distribution</CardTitle>
        <p className="text-sm text-muted-foreground">Children enrolled per age group</p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            No class data available
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 items-center">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {chartData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CLASS_CHART_COLORS[index % CLASS_CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-3" aria-label="Class breakdown">
              {chartData.map((item, index) => (
                <li key={item.name} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: CLASS_CHART_COLORS[index % CLASS_CHART_COLORS.length] }}
                      aria-hidden="true"
                    />
                    <span className="font-medium truncate">{item.name}</span>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span className="font-semibold">{item.value}</span>
                    <span className="text-muted-foreground ml-2">({item.percent}%)</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
