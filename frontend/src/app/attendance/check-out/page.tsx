"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";

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
import { EmptyState } from "@/components/ui/loading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiGet, apiPost } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { AttendanceRecord, AuthorizedPickupContact } from "@/types";

function isTagQuery(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export default function CheckOutPage() {
  const [query, setQuery] = useState("");
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [pickedUpContactId, setPickedUpContactId] = useState("");
  const defaultServiceId = useDefaultServiceId();
  const { hasService } = useHasTodayService();

  useEffect(() => {
    if (defaultServiceId) {
      setServiceId((current) => current || defaultServiceId);
    }
  }, [defaultServiceId]);

  useEffect(() => {
    setRecord(null);
    setPickedUpContactId("");
  }, [query, serviceId]);

  const tagSearch = isTagQuery(query);

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ["attendance-search", query, serviceId],
    queryFn: () =>
      apiGet<AttendanceRecord[]>(
        `/api/v1/attendance/search?q=${encodeURIComponent(query.trim())}&service_id=${serviceId}`,
      ),
    enabled: query.trim().length >= 2 && !tagSearch && !!serviceId,
  });

  const { data: pickupContacts = [] } = useQuery({
    queryKey: ["authorized-pickups", record?.child_id],
    queryFn: () =>
      apiGet<AuthorizedPickupContact[]>(`/api/v1/authorized-pickups/children/${record!.child_id}`),
    enabled: !!record?.child_id,
  });

  useEffect(() => {
    if (pickupContacts.length > 0 && !pickedUpContactId) {
      const droppedOff = record?.dropped_off_contact_id;
      const match = droppedOff ? pickupContacts.find((c) => c.id === droppedOff) : null;
      const primary = pickupContacts.find((c) => c.is_primary) ?? pickupContacts[0];
      setPickedUpContactId(match?.id ?? primary.id);
    }
  }, [pickupContacts, pickedUpContactId, record?.dropped_off_contact_id]);

  const selectRecord = (data: AttendanceRecord) => {
    setRecord(data);
    setPickedUpContactId("");
    if (data.checked_out) {
      toast.warning("This child has already been checked out");
    }
  };

  const lookup = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }

    setLoading(true);
    try {
      if (tagSearch) {
        const data = await apiGet<AttendanceRecord>(
          `/api/v1/attendance/tag/${trimmed.padStart(3, "0")}?service_id=${serviceId}`,
        );
        selectRecord(data);
        return;
      }

      if (searchResults.length === 1) {
        selectRecord(searchResults[0]);
        return;
      }

      if (searchResults.length > 1) {
        toast.info("Multiple children found — select one from the list below");
        return;
      }

      toast.error("No checked-in child found for this service");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!record || !pickedUpContactId) {
      toast.error("Select who is picking up the child");
      return;
    }
    setLoading(true);
    try {
      const updated = await apiPost<AttendanceRecord>("/api/v1/attendance/check-out", {
        tag_number: record.tag_number,
        service_id: serviceId,
        picked_up_contact_id: pickedUpContactId,
      });
      setRecord(updated);
      setQuery("");
      toast.success("Child released successfully");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-out failed");
    } finally {
      setLoading(false);
    }
  };

  const selectedPickup = pickupContacts.find((c) => c.id === pickedUpContactId);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">Check Out</h1>
        <p className="text-muted-foreground">
          Verify the pickup person against their photo before releasing the child.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Find Child</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ServiceSelector value={serviceId} onChange={setServiceId} />

            <div className="space-y-2">
              <Label htmlFor="checkout-search">Tag number or child name</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="checkout-search"
                    className="pl-10"
                    placeholder="e.g. 001 or Emma Johnson"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && lookup()}
                  />
                </div>
                <Button onClick={lookup} disabled={!hasService || loading || isFetching}>
                  {loading || isFetching ? "Looking up..." : "Lookup"}
                </Button>
              </div>
            </div>

            {!tagSearch && query.trim().length >= 2 && !isFetching && searchResults.length === 0 && (
              <EmptyState
                title="No checked-in children found"
                description="Try a different name or confirm the correct service is selected"
              />
            )}

            {!tagSearch && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50"
                  >
                    <div>
                      <p className="font-medium">{item.child_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Tag {item.tag_number} · {item.class_name}
                      </p>
                    </div>
                    <Button variant={record?.id === item.id ? "default" : "outline"} onClick={() => selectRecord(item)}>
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {record && (
          <Card>
            <CardHeader>
              <CardTitle>{record.child_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tag</p>
                  <p className="text-2xl font-bold text-secondary">{record.tag_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Class</p>
                  <p className="font-medium">{record.class_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Check-In Time</p>
                  <p className="font-medium">{formatDateTime(record.check_in_time)}</p>
                </div>
                {record.dropped_off_contact_name && (
                  <div>
                    <p className="text-muted-foreground">Dropped off by</p>
                    <p className="font-medium">{record.dropped_off_contact_name}</p>
                  </div>
                )}
              </div>

              {!record.checked_out && (
                <>
                  <div className="space-y-2">
                    <Label>Who is picking up?</Label>
                    <Select value={pickedUpContactId} onValueChange={setPickedUpContactId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select authorized pickup person" />
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

                  {selectedPickup && (
                    <div className="rounded-lg border p-4 bg-amber-50/50 space-y-2">
                      <p className="text-sm font-medium">Verify pickup person</p>
                      <div className="flex items-center gap-4">
                        <AuthorizedPickupPhoto contactId={selectedPickup.id} name={selectedPickup.full_name} className="h-24 w-24" />
                        <div>
                          <p className="font-semibold text-lg">{selectedPickup.full_name}</p>
                          <p className="text-sm text-muted-foreground">{selectedPickup.relationship}</p>
                          <p className="text-sm text-muted-foreground">{selectedPickup.phone}</p>
                          {!selectedPickup.has_photo && (
                            <p className="text-xs text-amber-700 mt-1">No photo — verify ID manually</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={!pickedUpContactId}>
                    Release Child
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Release</AlertDialogTitle>
              <AlertDialogDescription>
                Release {record?.child_name} to {selectedPickup?.full_name} ({selectedPickup?.relationship})?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCheckOut}>Release Child</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
