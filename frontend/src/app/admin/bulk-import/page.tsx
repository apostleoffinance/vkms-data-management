"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiUpload } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export default function BulkImportPage() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <p className="text-center text-muted-foreground py-12">Admin access required</p>
      </DashboardLayout>
    );
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiUpload<{ created: number; errors: string[] }>(
        "/api/v1/children/bulk-import",
        formData,
      );
      setResult(data);
      toast.success(`Imported ${data.created} children`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Bulk Import</h1>

        <Card>
          <CardHeader>
            <CardTitle>Import Children from Excel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a Google Form or Excel export (.xlsx). Column headers are detected automatically
              (Timestamp is ignored). Supports combined parent names, class aliases like Age 4-7 or
              Teens class, and auto-routes phone, email, and address fields.
            </p>
            <Button
              disabled={uploading}
              onClick={() => document.getElementById("bulk-upload")?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Select Excel File"}
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUpload}
              className="hidden"
              id="bulk-upload"
              disabled={uploading}
            />

            {result && (
              <div className="rounded-lg border p-4">
                <p className="font-medium text-green-600">Created: {result.created}</p>
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-destructive">Errors:</p>
                    <ul className="text-sm text-muted-foreground list-disc pl-4">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
