"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Search, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AuthorizedPickupPhoto } from "@/components/pickup/authorized-pickup-photo";
import { ServiceSelector, useDefaultServiceId, useHasTodayService } from "@/components/services/service-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageLoader } from "@/components/ui/loading";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { AuthorizedPickupContact, ChildDetail, ChildSearchResult, TagPrint } from "@/types";

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const preselectedChildId = searchParams.get("child");

  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<TagPrint | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [pendingChild, setPendingChild] = useState<ChildSearchResult | null>(null);
  const [droppedOffContactId, setDroppedOffContactId] = useState("");
  const defaultServiceId = useDefaultServiceId();
  const { hasService } = useHasTodayService();

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

  const pendingChildId = pendingChild?.id ?? "";
  const { data: pickupContacts = [] } = useQuery({
    queryKey: ["authorized-pickups", pendingChildId],
    queryFn: () => apiGet<AuthorizedPickupContact[]>(`/api/v1/authorized-pickups/children/${pendingChildId}`),
    enabled: !!pendingChildId,
  });

  useEffect(() => {
    if (pickupContacts.length > 0 && !droppedOffContactId) {
      const primary = pickupContacts.find((c) => c.is_primary) ?? pickupContacts[0];
      setDroppedOffContactId(primary.id);
    }
  }, [pickupContacts, droppedOffContactId]);

  const startCheckIn = (child: ChildSearchResult) => {
    setPendingChild(child);
    setDroppedOffContactId("");
    setTag(null);
  };

  const handleCheckIn = async () => {
    if (!pendingChild || !serviceId) {
      toast.error("Please select a service");
      return;
    }
    if (!droppedOffContactId) {
      toast.error("Select who dropped off the child");
      return;
    }
    setCheckingIn(pendingChild.id);
    try {
      const result = await apiPost<TagPrint>("/api/v1/attendance/check-in", {
        child_id: pendingChild.id,
        service_id: serviceId,
        dropped_off_contact_id: droppedOffContactId,
      });
      setTag(result);
      setPendingChild(null);
      toast.success(`Checked in with tag ${result.tag_number}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Check-in failed";
      if (err instanceof ApiError && err.status === 400 && message.toLowerCase().includes("already")) {
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
        startCheckIn(child);
      } catch {
        toast.error("QR code not found");
      }
    }
  };

  const childRow = (child: ChildSearchResult, highlight = false) => (
    <div
      key={child.id}
      className={`flex items-center justify-between rounded-lg border p-4 ${
        highlight ? "border-primary/30 bg-primary/5" : "hover:bg-accent/50"
      }`}
    >
      <div>
        <p className="font-medium">{child.first_name} {child.last_name}</p>
        <p className="text-sm text-muted-foreground">
          {child.child_code} · {child.class_name} · {child.parent_name} ({child.parent_phone})
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {isAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/children/${child.id}#pickup`}>
              <User className="h-4 w-4 mr-1" />
              Pickup photos
            </Link>
          </Button>
        )}
        <Button onClick={() => startCheckIn(child)} disabled={!hasService || checkingIn === child.id}>
          Check In
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Check In</h1>
        <p className="text-muted-foreground">
          Record who dropped off the child, then assign a service tag.
        </p>

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
              {preselectedChild && !results.some((child) => child.id === preselectedChild.id) &&
                childRow(
                  {
                    id: preselectedChild.id,
                    child_code: preselectedChild.child_code,
                    first_name: preselectedChild.first_name,
                    last_name: preselectedChild.last_name,
                    class_name: preselectedChild.class_name,
                    parent_name: `${preselectedChild.parent.first_name} ${preselectedChild.parent.last_name}`,
                    parent_phone: preselectedChild.parent.phone,
                    is_active: preselectedChild.is_active,
                  },
                  true,
                )}
              {results.map((child) => childRow(child))}
            </div>
          </CardContent>
        </Card>

        {pendingChild && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle>Who dropped off {pendingChild.first_name}?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pickupContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading authorized contacts...</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Authorized drop-off person</Label>
                    <Select value={droppedOffContactId} onValueChange={setDroppedOffContactId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        {pickupContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.full_name} ({contact.relationship})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {droppedOffContactId && (
                    <div className="flex items-center gap-4 rounded-lg border p-4 bg-muted/30">
                      {(() => {
                        const selected = pickupContacts.find((c) => c.id === droppedOffContactId);
                        if (!selected) return null;
                        return (
                          <>
                            <AuthorizedPickupPhoto contactId={selected.id} name={selected.full_name} />
                            <div>
                              <p className="font-medium">{selected.full_name}</p>
                              <p className="text-sm text-muted-foreground">{selected.relationship}</p>
                              <p className="text-sm text-muted-foreground">{selected.phone}</p>
                              {!selected.has_photo && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs text-amber-600">
                                    No photo on file — verify ID manually
                                  </p>
                                  {isAdmin && pendingChild && (
                                    <Link
                                      href={`/children/${pendingChild.id}#pickup`}
                                      className="text-xs font-medium text-primary underline underline-offset-2"
                                    >
                                      Add pickup photo now
                                    </Link>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handleCheckIn} disabled={!!checkingIn}>
                      {checkingIn ? "Checking in..." : "Confirm check-in"}
                    </Button>
                    <Button variant="outline" onClick={() => setPendingChild(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

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
