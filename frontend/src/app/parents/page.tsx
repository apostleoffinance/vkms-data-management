"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";
import { apiGet } from "@/lib/api";
import type { Parent } from "@/types";

export default function ParentsPage() {
  const [query, setQuery] = useState("");

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
        <h1 className="text-3xl font-bold">Parent Directory</h1>

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
                  <p className="font-medium">{parent.first_name} {parent.last_name}</p>
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
