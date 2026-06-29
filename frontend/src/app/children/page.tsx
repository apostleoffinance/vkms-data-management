"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Camera, Search, User } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";
import { apiGet } from "@/lib/api";
import type { ChildSearchResult } from "@/types";
import { useAuth } from "@/contexts/auth-context";

export default function ChildrenPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [query, setQuery] = useState("");
  const [missingPhotosOnly, setMissingPhotosOnly] = useState(false);

  const searchParams = new URLSearchParams();
  if (query.trim()) searchParams.set("q", query.trim());
  if (missingPhotosOnly) searchParams.set("missing_photos", "true");
  searchParams.set("limit", "100");

  const { data: children = [], isFetching } = useQuery({
    queryKey: ["children-search", query, missingPhotosOnly],
    queryFn: () =>
      apiGet<ChildSearchResult[]>(`/api/v1/children/search?${searchParams.toString()}`),
    enabled: !!user,
  });

  if (!user) {
    return (
      <DashboardLayout>
        <p className="text-center text-muted-foreground py-12">Please log in</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Children</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search registered children and manage authorized pickup photos on each profile.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Find a Child</CardTitle>
            <CardDescription>
              Search by child name, child ID (VK-#####), or parent phone. Leave search empty to
              browse all active children.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by name, child code, or parent phone..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant={missingPhotosOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMissingPhotosOnly((v) => !v)}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {missingPhotosOnly ? "Showing missing photos only" : "Show missing photos only"}
                </Button>
                {missingPhotosOnly && (
                  <p className="text-sm text-muted-foreground">
                    Children without any pickup photo on file
                  </p>
                )}
              </div>
            )}

            {isFetching ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
            ) : children.length === 0 ? (
              <EmptyState
                title="No children found"
                description={
                  missingPhotosOnly
                    ? "All matching children have at least one pickup photo"
                    : "Try a different search or register a new child"
                }
              />
            ) : (
              <div className="space-y-2">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {child.first_name} {child.last_name}
                        </p>
                        {!child.is_active && (
                          <Badge variant="muted">Inactive</Badge>
                        )}
                        {child.has_pickup_photo === false && (
                          <Badge variant="warning">No pickup photo</Badge>
                        )}
                        {child.has_pickup_photo && (
                          <Badge variant="success">Photo on file</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {child.child_code} · {child.class_name} · {child.parent_name} (
                        {child.parent_phone})
                      </p>
                      {isAdmin && child.pickup_contact_count != null && child.pickup_contact_count > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {child.pickup_photo_count} of {child.pickup_contact_count} pickup contact
                          {child.pickup_contact_count === 1 ? "" : "s"} with photo
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/children/${child.id}`}>
                          <User className="h-4 w-4 mr-1" />
                          Profile
                        </Link>
                      </Button>
                      {isAdmin && (
                        <Button size="sm" asChild>
                          <Link href={`/children/${child.id}#pickup`}>
                            <Camera className="h-4 w-4 mr-1" />
                            {child.has_pickup_photo ? "Pickup photos" : "Add pickup photo"}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
