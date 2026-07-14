"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import Link from "next/link";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";
import { apiDownload, apiGet } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { Parent } from "@/types";

export default function ParentsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const isAdmin = user?.role === "admin";

  const { data: parents = [], isFetching } = useQuery({
    queryKey: ["parents", query],
    queryFn: () =>
      apiGet<Parent[]>(
        query ? `/api/v1/parents?q=${encodeURIComponent(query)}` : "/api/v1/parents",
      ),
  });

  const downloadContacts = async (format: "csv" | "excel") => {
    const ext = format === "excel" ? "xlsx" : "csv";
    await apiDownload(`/api/v1/parents/export?format=${format}`, `vkms-parents-contacts.${ext}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Parent Directory</h1>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void downloadContacts("csv")}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
              <Button variant="outline" onClick={() => void downloadContacts("excel")}>
                <Download className="h-4 w-4 mr-2" />
                Download Excel
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Parents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by name, phone, or email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {!isFetching && parents.length === 0 && (
              <EmptyState title="No parents found" />
            )}

            <div className="space-y-2">
              {parents.map((parent) => (
                <Link
                  key={parent.id}
                  href={`/parents/${parent.id}`}
                  className="block rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                >
                  <p className="font-medium">
                    {parent.first_name} {parent.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {parent.phone} {parent.email && `· ${parent.email}`}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
