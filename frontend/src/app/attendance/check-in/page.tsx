"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ServiceSelector, useDefaultServiceId } from "@/components/services/service-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, PageLoader } from "@/components/ui/loading";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { ChildDetail, ChildSearchResult, TagPrint } from "@/types";

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <PageLoader />
        </DashboardLayout>
      }
    >
      <CheckInContent />
    </Suspense>
  );
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const preselectedChildId = searchParams.get("child");

  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<TagPrint | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const defaultServiceId = useDefaultServiceId();

  useEffect(() => {
    if (defaultServiceId) {
      setServiceId((current) => current || defaultServiceId);
    }
  }, [defaultServiceId]);

  const { data: preselectedChild } = useQuery({
    queryKey: ["child", preselectedChildId],
    queryFn: () => apiGet<ChildDetail>(`/api/v1/children/${preselectedChildId}`),
    enabled: !!preselectedChildId,
  });

  useEffect(() => {
    if (preselectedChild) {
      setQuery(preselectedChild.child_code);
    }
  }, [preselectedChild]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["child-search", query],
    queryFn: () => apiGet<ChildSearchResult[]>(`/api/v1/children/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  const handleCheckIn = async (childId: string) => {
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }
    setCheckingIn(childId);
    try {
      const result = await apiPost<TagPrint>("/api/v1/attendance/check-in", {
        child_id: childId,
        service_id: serviceId,
      });
      setTag(result);
      toast.success(`Checked in with tag ${result.tag_number}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Check-in failed";
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        message.toLowerCase().includes("already")
      ) {
        toast.warning(message);
      } else {
        toast.error(message);
      }
    } finally {
      setCheckingIn(null);
    }
  };

  const handleQrSearch = async () => {
    const code = query.replace("VKMS:", "").split(":")[0] || query;
    if (code.startsWith("VK-")) {
      try {
        const child = await apiGet<ChildSearchResult>(`/api/v1/children/qr/${code}`);
        await handleCheckIn(child.id);
      } catch {
        toast.error("QR code not found");
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Check In</h1>
        <p className="text-muted-foreground">
          Service tags are assigned here in check-in order for the selected service.
        </p>

        {preselectedChild && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Newly registered child</p>
              <p className="font-medium">
                {preselectedChild.first_name} {preselectedChild.last_name} ({preselectedChild.child_code})
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Select today&apos;s service and check in to receive a tag number.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Search Child</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ServiceSelector value={serviceId} onChange={setServiceId} />

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Search by name, code, or parent phone..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {query.startsWith("VKMS:") || query.startsWith("VK-") ? (
                <Button onClick={handleQrSearch}>QR Check In</Button>
              ) : null}
            </div>

            {query.length >= 2 && !isFetching && results.length === 0 && (
              <EmptyState title="No children found" description="Try a different search term" />
            )}

            <div className="space-y-2">
              {preselectedChild && !results.some((child) => child.id === preselectedChild.id) && (
                <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div>
                    <p className="font-medium">
                      {preselectedChild.first_name} {preselectedChild.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {preselectedChild.child_code} · {preselectedChild.class_name}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleCheckIn(preselectedChild.id)}
                    disabled={checkingIn === preselectedChild.id}
                  >
                    {checkingIn === preselectedChild.id ? "Checking in..." : "Check In"}
                  </Button>
                </div>
              )}
              {results.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50"
                >
                  <div>
                    <p className="font-medium">{child.first_name} {child.last_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {child.child_code} · {child.class_name} · {child.parent_name} ({child.parent_phone})
                    </p>
                  </div>
                  <Button
                    onClick={() => handleCheckIn(child.id)}
                    disabled={checkingIn === child.id}
                  >
                    {checkingIn === child.id ? "Checking in..." : "Check In"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {tag && (
          <Card className="border-2 border-primary print:border-black" id="printable-tag">
            <CardContent className="p-8 text-center">
              <p className="text-6xl font-bold text-secondary mb-4">{tag.tag_number}</p>
              <p className="text-2xl font-semibold">{tag.child_name}</p>
              <p className="text-lg text-muted-foreground">{tag.class_name}</p>
              <p className="text-sm mt-2">{new Date(tag.check_in_time).toLocaleTimeString()}</p>
              <div className="mt-4 flex justify-center">
                <QRCodeSVG value={tag.child_code} size={80} />
              </div>
              <Button className="mt-4 print:hidden" onClick={() => window.print()}>
                Print Tag
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
