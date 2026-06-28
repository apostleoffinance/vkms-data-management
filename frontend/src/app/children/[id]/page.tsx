"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AuthorizedPickupManager } from "@/components/pickup/authorized-pickup-manager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/loading";
import { apiGet, apiPut } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { AttendanceRecord, ChildDetail } from "@/types";
import { useAuth } from "@/contexts/auth-context";

export default function ChildProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [updating, setUpdating] = useState(false);

  const { data: child, isLoading } = useQuery({
    queryKey: ["child", id],
    queryFn: () => apiGet<ChildDetail>(`/api/v1/children/${id}`),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["child-attendance", id],
    queryFn: () => apiGet<AttendanceRecord[]>(`/api/v1/attendance?child_id=${id}`),
    enabled: !!id,
  });

  const setActive = async (isActive: boolean) => {
    setUpdating(true);
    try {
      await apiPut(`/api/v1/children/${id}`, { is_active: isActive });
      await queryClient.invalidateQueries({ queryKey: ["child", id] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-charts"] });
      toast.success(isActive ? "Child profile reactivated" : "Child profile deactivated");
      if (!isActive) {
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>;
  if (!child) return <DashboardLayout><p>Child not found</p></DashboardLayout>;

  const statusColors: Record<string, string> = {
    checked_in: "text-amber-600",
    checked_out: "text-green-600",
    not_present: "text-muted-foreground",
  };

  const isAdmin = user?.role === "admin";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{child.first_name} {child.last_name}</h1>
            {!child.is_active && (
              <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                Deactivated
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
              Child ID: {child.child_code}
            </span>
            {isAdmin && (
              child.is_active ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={updating}>
                      Deactivate Profile
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deactivate this child profile?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {child.first_name} will be hidden from check-in and search. Attendance
                        history is kept and the profile can be reactivated later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => setActive(false)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Deactivate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={() => setActive(true)} disabled={updating}>
                  Reactivate Profile
                </Button>
              )
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Gender</p><p className="capitalize">{child.gender}</p></div>
                <div><p className="text-sm text-muted-foreground">Date of Birth</p><p>{formatDate(child.date_of_birth)}</p></div>
                <div><p className="text-sm text-muted-foreground">Class</p><p>{child.class_name}</p></div>
                <div><p className="text-sm text-muted-foreground">Registration</p><p>{formatDate(child.registration_date)}</p></div>
                <div><p className="text-sm text-muted-foreground">Total Visits</p><p className="text-2xl font-bold">{child.total_visits}</p></div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <p className={`capitalize font-medium ${statusColors[child.current_status]}`}>
                    {child.current_status.replace("_", " ")}
                  </p>
                </div>
                {child.today_tag_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Today&apos;s Service Tag</p>
                    <p className="text-2xl font-bold font-mono text-secondary">{child.today_tag_number}</p>
                    {child.today_service_name && (
                      <p className="text-xs text-muted-foreground">{child.today_service_name}</p>
                    )}
                  </div>
                )}
                <div><p className="text-sm text-muted-foreground">Last Attendance</p>
                  <p>{child.last_attendance_date ? formatDateTime(child.last_attendance_date) : "Never"}</p>
                </div>
                {child.medical_notes && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Medical Notes</p>
                    <p>{child.medical_notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>QR Code</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center">
              <QRCodeSVG value={child.qr_code_data || child.child_code} size={160} />
              <p className="mt-2 text-sm text-muted-foreground">Child ID: {child.child_code}</p>
              <p className="text-xs text-muted-foreground">Service tags are assigned at check-in only</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Parent Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-muted-foreground">Name</p>
                <Link
                  href={`/parents/${child.parent.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {child.parent.first_name} {child.parent.last_name}
                </Link>
              </div>
              <div><p className="text-sm text-muted-foreground">Phone</p><p>{child.parent.phone}</p></div>
              {child.parent.email && <div><p className="text-sm text-muted-foreground">Email</p><p>{child.parent.email}</p></div>}
              {child.parent.address && <div><p className="text-sm text-muted-foreground">Address</p><p>{child.parent.address}</p></div>}
            </div>
          </CardContent>
        </Card>

        <AuthorizedPickupManager childId={id} readOnly={!isAdmin} />

        <Card>
          <CardHeader><CardTitle>Attendance History</CardTitle></CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No attendance records</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Tag</th>
                      <th className="text-left p-2">Check In</th>
                      <th className="text-left p-2">Check Out</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id} className="border-b">
                        <td className="p-2 font-mono">{a.tag_number}</td>
                        <td className="p-2">{formatDateTime(a.check_in_time)}</td>
                        <td className="p-2">{a.check_out_time ? formatDateTime(a.check_out_time) : "-"}</td>
                        <td className="p-2">{a.checked_out ? "Out" : "In"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
