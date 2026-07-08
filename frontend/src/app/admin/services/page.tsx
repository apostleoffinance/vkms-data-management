"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, ExternalLink, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getKioskPageUrl } from "@/lib/kiosk-api";
import { formatDate } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import type { Service } from "@/types";
import { useAuth } from "@/contexts/auth-context";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

const CUSTOM_TYPE = "custom";

interface ServiceTypesResponse {
  default: string;
  presets: string[];
  allow_custom: boolean;
}

function CheckInPoster({ value, preview = false }: { value: string; preview?: boolean }) {
  return (
    <div
      className="w-full max-w-[520px] overflow-hidden rounded-3xl border-2 border-black bg-white text-center"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <div className="px-6 py-6" style={{ backgroundColor: BRAND.yellow, color: BRAND.black }}>
        <p className="text-sm font-bold uppercase tracking-[0.2em]">Votage Kids</p>
        <h2 className="mt-1 text-3xl font-black">Check In Here</h2>
      </div>
      <div className="flex flex-col items-center gap-5 px-6 py-8">
        <p className="text-lg font-semibold text-black">
          Scan with your phone camera to check in your child
        </p>
        <div className="rounded-2xl border-2 border-black p-4">
          <QRCodeSVG value={value} size={preview ? 220 : 320} level="M" />
        </div>
        <ol className="mx-auto max-w-sm space-y-2 text-left text-base font-medium text-black">
          <li className="flex gap-3">
            <span className="font-black">1.</span>
            <span>Scan this code with your phone camera</span>
          </li>
          <li className="flex gap-3">
            <span className="font-black">2.</span>
            <span>Enter your phone number (or register a first-time child)</span>
          </li>
          <li className="flex gap-3">
            <span className="font-black">3.</span>
            <span>Show your tag number at the front desk</span>
          </li>
        </ol>
        <p className="text-sm text-neutral-600">
          Need help? Please see a Votage Kids team member at the front desk.
        </p>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [serviceType, setServiceType] = useState("Sunday Service");
  const [customName, setCustomName] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [kioskUrl, setKioskUrl] = useState("");
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKioskUrl(getKioskPageUrl());
  }, []);

  const handlePrintPoster = () => {
    window.print();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(kioskUrl);
      toast.success("Check-in link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleDownloadQr = () => {
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("QR code not ready yet");
      return;
    }
    const link = document.createElement("a");
    link.download = "votage-kids-checkin-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const { data: types } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => apiGet<ServiceTypesResponse>("/api/v1/services/types"),
    enabled: user?.role === "admin",
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: () => apiGet<Service[]>("/api/v1/services"),
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <p className="text-center text-muted-foreground py-12">Admin access required</p>
      </DashboardLayout>
    );
  }

  const defaultService = types?.default ?? "Sunday Service";
  const presets = types?.presets ?? [defaultService, "Midweek Service", "Special Program"];

  const resetForm = () => {
    setServiceType(defaultService);
    setCustomName("");
    setServiceDate("");
  };

  const invalidateServices = () => {
    queryClient.invalidateQueries({ queryKey: ["services"] });
    queryClient.invalidateQueries({ queryKey: ["services-today"] });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;

    const serviceName = serviceType === CUSTOM_TYPE ? customName.trim() : serviceType;
    if (!serviceName) {
      toast.error("Please enter a service name");
      return;
    }

    if (!serviceDate) {
      toast.error("Please select a date");
      return;
    }

    const existing = services.find((s) => s.service_date === serviceDate);
    if (existing) {
      toast.error(
        `A service already exists for this date: "${existing.service_name}". Rename it or pick another date.`,
      );
      return;
    }

    setCreating(true);
    try {
      await apiPost("/api/v1/services", {
        service_name: serviceName,
        service_date: serviceDate,
      });
      toast.success("Service created");
      setShowForm(false);
      resetForm();
      invalidateServices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create service");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setEditName(service.service_name);
  };

  const handleRename = async () => {
    if (!editingService) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Service name is required");
      return;
    }
    setSavingEdit(true);
    try {
      await apiPut(`/api/v1/services/${editingService.id}`, { service_name: name });
      toast.success("Service renamed");
      invalidateServices();
      setEditingService(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename service");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await apiDelete(`/api/v1/services/${confirmDelete.id}`);
      toast.success("Service deleted");
      invalidateServices();
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete service");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Service Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Schedule one service per date. Create today&apos;s service before check-in — nothing is
              auto-created.
            </p>
          </div>
          <Button
            onClick={() => {
              if (showForm) resetForm();
              setShowForm(!showForm);
            }}
          >
            {showForm ? "Cancel" : "Add Service"}
          </Button>
        </div>

        <Card className="no-print">
          <CardHeader>
            <CardTitle>Parent check-in poster</CardTitle>
            <CardDescription>
              Print or download the poster below and mount it at the entrance. One permanent QR —
              parents scan it every service. Staff check-in at the front desk still works for anyone
              without a phone or internet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handlePrintPoster}>
                <Printer className="mr-2 h-4 w-4" />
                Print poster
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadQr}>
                <Download className="mr-2 h-4 w-4" />
                Download QR (PNG)
              </Button>
              <Button type="button" variant="ghost" asChild>
                <a href="/kiosk" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Test check-in page
                </a>
              </Button>
              <Button type="button" variant="ghost" onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground break-all">{kioskUrl}</p>
          </CardContent>
        </Card>

        {/* High-resolution QR used only for PNG download (kept off-screen) */}
        <div ref={qrCanvasRef} aria-hidden className="pointer-events-none absolute -left-[9999px] top-0">
          <QRCodeCanvas value={kioskUrl || "/kiosk"} size={1024} marginSize={4} level="M" />
        </div>

        {/* Parent-facing poster: previewed on screen, the only thing printed */}
        <div className="flex justify-center no-print">
          <CheckInPoster value={kioskUrl || "/kiosk"} preview />
        </div>
        <div id="checkin-poster" className="hidden print:block">
          <CheckInPoster value={kioskUrl || "/kiosk"} />
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Service</CardTitle>
              <CardDescription>
                Schedule a service for a specific date. Only one service is allowed per calendar
                date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 max-w-lg sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Service Type</Label>
                  <Select
                    value={serviceType}
                    onValueChange={(value) => {
                      setServiceType(value);
                      if (value !== CUSTOM_TYPE) setCustomName("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((preset) => (
                        <SelectItem key={preset} value={preset}>
                          {preset}
                          {preset === defaultService ? " (default preset)" : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_TYPE}>Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {serviceType === CUSTOM_TYPE && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="custom-service">Custom Service Name</Label>
                    <Input
                      id="custom-service"
                      placeholder="e.g. Easter Program, Youth Revival"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="service-date">Date</Label>
                  <Input
                    id="service-date"
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-end sm:col-span-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create Service"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Scheduled Services</CardTitle>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No services scheduled yet</p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-4 gap-4">
                    <div>
                      <span className="font-medium">{s.service_name}</span>
                      <p className="text-sm text-muted-foreground mt-1">{formatDate(s.service_date)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(s)}
                        aria-label={`Rename ${s.service_name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === s.id}
                        onClick={() => setConfirmDelete(s)}
                        aria-label={`Delete ${s.service_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete service?</AlertDialogTitle>
              <AlertDialogDescription>
                Delete {confirmDelete?.service_name} on{" "}
                {confirmDelete ? formatDate(confirmDelete.service_date) : ""}? You can delete after
                all children are checked out. Attendance history for this service will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                {deletingId ? "Deleting..." : "Delete Service"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rename service</AlertDialogTitle>
              <AlertDialogDescription>
                {editingService
                  ? `Update the name for ${formatDate(editingService.service_date)}`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label htmlFor="edit-service-name">Service name</Label>
              <Input
                id="edit-service-name"
                className="mt-2"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRename} disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
