"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ServiceSelector, useDefaultServiceId } from "@/components/services/service-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { AttendanceRecord } from "@/types";

export default function CheckOutPage() {
  const [tagNumber, setTagNumber] = useState("");
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const defaultServiceId = useDefaultServiceId();

  useEffect(() => {
    if (defaultServiceId) {
      setServiceId((current) => current || defaultServiceId);
    }
  }, [defaultServiceId]);

  const lookupTag = async () => {
    if (!tagNumber.trim()) return;
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<AttendanceRecord>(
        `/api/v1/attendance/tag/${tagNumber.padStart(3, "0")}?service_id=${serviceId}`,
      );
      setRecord(data);
      if (data.checked_out) {
        toast.warning("This child has already been checked out");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tag not found");
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!record) return;
    setLoading(true);
    try {
      const updated = await apiPost<AttendanceRecord>("/api/v1/attendance/check-out", {
        tag_number: record.tag_number,
        service_id: serviceId,
      });
      setRecord(updated);
      toast.success("Child released successfully");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-out failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">Check Out</h1>

        <Card>
          <CardHeader>
            <CardTitle>Enter Tag Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ServiceSelector value={serviceId} onChange={setServiceId} />

            <div className="space-y-2">
              <Label htmlFor="tag">Tag Number</Label>
              <div className="flex gap-2">
                <Input
                  id="tag"
                  placeholder="e.g. 001"
                  value={tagNumber}
                  onChange={(e) => setTagNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupTag()}
                />
                <Button onClick={lookupTag} disabled={loading}>
                  {loading ? "Looking up..." : "Lookup"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {record && (
          <Card>
            <CardHeader>
              <CardTitle>Child Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Child Name</p>
                  <p className="font-medium">{record.child_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Parent</p>
                  <p className="font-medium">{record.parent_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Class</p>
                  <p className="font-medium">{record.class_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-In Time</p>
                  <p className="font-medium">{formatDateTime(record.check_in_time)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tag</p>
                  <p className="font-medium text-2xl text-secondary">{record.tag_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className={`font-medium ${record.checked_out ? "text-green-600" : "text-amber-600"}`}>
                    {record.checked_out ? "Checked Out" : "Checked In"}
                  </p>
                </div>
              </div>

              {!record.checked_out && (
                <Button className="w-full" onClick={() => setConfirmOpen(true)}>
                  Release Child
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Release</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to release {record?.child_name} to {record?.parent_name}?
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
