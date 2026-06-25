"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDownload, apiGet } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState("daily");
  const [report, setReport] = useState("attendance");

  const { data = [], isLoading } = useQuery({
    queryKey: ["report", reportType, report],
    queryFn: () => {
      if (report === "worker") {
        return apiGet<Record<string, string>[]>(`/api/v1/reports/worker-attendance`);
      }
      return apiGet<Record<string, string>[]>(`/api/v1/reports/attendance?report_type=${reportType}`);
    },
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Reports</h1>

        <Card>
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

        <Card>
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
