"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/loading";
import { apiGet } from "@/lib/api";
import type { Parent } from "@/types";

export default function ParentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: parent, isLoading } = useQuery({
    queryKey: ["parent", id],
    queryFn: () => apiGet<Parent>(`/api/v1/parents/${id}`),
  });

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>;
  if (!parent) return <DashboardLayout><p>Parent not found</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">{parent.first_name} {parent.last_name}</h1>

        <Card>
          <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><p className="text-sm text-muted-foreground">Phone</p><p>{parent.phone}</p></div>
            {parent.alternative_phone && (
              <div><p className="text-sm text-muted-foreground">Alt Phone</p><p>{parent.alternative_phone}</p></div>
            )}
            {parent.email && <div><p className="text-sm text-muted-foreground">Email</p><p>{parent.email}</p></div>}
            {parent.address && <div className="col-span-2"><p className="text-sm text-muted-foreground">Address</p><p>{parent.address}</p></div>}
          </CardContent>
        </Card>

        {parent.children && parent.children.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Children</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {parent.children.map((child) => (
                <div
                  key={child.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-accent/50"
                >
                  <Link href={`/children/${child.id}`} className="flex justify-between flex-1 min-w-0">
                    <span>{child.full_name} ({child.child_code})</span>
                    <span className="text-sm text-muted-foreground">{child.class_name}</span>
                  </Link>
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <Link href={`/children/${child.id}#pickup`}>Pickup photos</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
