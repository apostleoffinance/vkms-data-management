"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Printer, Sparkles } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  ExecutiveReportView,
  printExecutiveReport,
} from "@/components/reports/executive-report-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDownload, apiGet } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { ExecutiveReportData } from "@/types";

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState("daily");
  const [report, setReport] = useState("attendance");
  const [execPeriod, setExecPeriod] = useState("daily");
  const [targetDate, setTargetDate] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["report", reportType, report],
    queryFn: () => {
      if (report === "worker") {
        return apiGet<Record<string, string>[]>("/api/v1/reports/worker-attendance");
      }
      return apiGet<Record<string, string>[]>(`/api/v1/reports/attendance?report_type=${reportType}`);
    },
    enabled: user?.role === "admin",
  });

  const execDateParam = targetDate ? `&target_date=${targetDate}` : "";
  const { data: executive, isLoading: execLoading } = useQuery({
    queryKey: ["executive-report", execPeriod, targetDate],
    queryFn: () =>
      apiGet<ExecutiveReportData>(
        `/api/v1/reports/executive?period=${execPeriod}${execDateParam}`,
      ),
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <p className="text-center text-muted-foreground py-12">Admin access required</p>
      </DashboardLayout>
    );
  }

  const handleExport = async (format: string) => {
    const params = new URLSearchParams({ report_type: reportType, format, report });
    const ext = format === "excel" ? "xlsx" : format;
    await apiDownload(`/api/v1/reports/export?${params.toString()}`, `vkms-${report}.${ext}`);
  };

  const handleExecutiveServerPdf = async () => {
    const params = new URLSearchParams({ period: execPeriod });
    if (targetDate) params.set("target_date", targetDate);
    const label = targetDate || new Date().toISOString().slice(0, 10);
    await apiDownload(
      `/api/v1/reports/executive/export?${params.toString()}`,
      `vkms-executive-${execPeriod}-${label}.pdf`,
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold no-print">Reports</h1>

        <div className="space-y-4 no-print">
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-600" />
                Executive Report
              </CardTitle>
              <CardDescription>
                AI-powered ministry summary with KPIs, retention metrics, charts, worker attendance,
                and follow-up list for children absent 2+ services.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="exec-period">Period</Label>
                  <Select value={execPeriod} onValueChange={setExecPeriod}>
                    <SelectTrigger id="exec-period" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Today / Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="target-date">Target date</Label>
                  <Input
                    id="target-date"
                    type="date"
                    className="w-44"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
                <Button onClick={printExecutiveReport} disabled={!executive}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print / Save PDF
                </Button>
                <Button variant="outline" onClick={handleExecutiveServerPdf} disabled={!executive}>
                  <FileText className="h-4 w-4 mr-2" />
                  Basic PDF
                </Button>
              </div>
              {execLoading ? (
                <p className="mt-4 text-sm text-muted-foreground">Generating report...</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {!execLoading && executive ? <ExecutiveReportView data={executive} /> : null}

        <Card className="no-print">
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <Select value={report} onValueChange={setReport}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="worker">Worker Attendance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {report === "attendance" && (
                <div>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleExport("csv")}>
                  <Download className="h-4 w-4 mr-2" /> CSV
                </Button>
                <Button variant="outline" onClick={() => handleExport("excel")}>
                  <Download className="h-4 w-4 mr-2" /> Excel
                </Button>
                <Button variant="outline" onClick={() => handleExport("pdf")}>
                  <Download className="h-4 w-4 mr-2" /> PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="no-print">
          <CardHeader>
            <CardTitle>Report Data</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : data.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No data for selected period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(data[0]).map((key) => (
                        <th key={key} className="text-left p-2 capitalize">{key.replace(/_/g, " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i} className="border-b">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="p-2">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
