"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import type { AttendanceRecord } from "@/types";

interface RecentActivityProps {
  checkIns: AttendanceRecord[];
  checkOuts: AttendanceRecord[];
  loading?: boolean;
}

function ActivityTable({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: AttendanceRecord[];
  mode: "in" | "out";
}) {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-md h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Latest {mode === "in" ? "check-ins" : "check-outs"} for today&apos;s service
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Child</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground hidden sm:table-cell">Class</th>
                  {mode === "out" && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground hidden md:table-cell">
                      Released By
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Tag</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-6 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDateTime(mode === "in" ? row.check_in_time : row.check_out_time ?? row.check_in_time)}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.child_name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{row.class_name}</td>
                    {mode === "out" && (
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {row.checked_out_by_name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono font-semibold text-secondary">{row.tag_number}</td>
                    <td className="px-6 py-3">
                      <Badge variant={row.checked_out ? "muted" : "success"}>
                        {row.checked_out ? "Checked Out" : "Checked In"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentActivity({ checkIns, checkOuts, loading }: RecentActivityProps) {
  if (loading) {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ActivityTable title="Recent Check-Ins" rows={checkIns} mode="in" />
      <ActivityTable title="Recent Check-Outs" rows={checkOuts} mode="out" />
    </div>
  );
}
