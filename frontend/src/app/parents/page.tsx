"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ParentContactsExport } from "@/components/reports/parent-contacts-export";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";
import { apiGet } from "@/lib/api";
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">Parent Directory</h1>
          {isAdmin ? (
            <div className="max-w-md">
              <ParentContactsExport />
            </div>
          ) : null}
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
