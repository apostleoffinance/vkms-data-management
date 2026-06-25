"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { apiGet, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Service } from "@/types";
import { useAuth } from "@/contexts/auth-context";

const CUSTOM_TYPE = "custom";

interface ServiceTypesResponse {
  default: string;
  presets: string[];
  allow_custom: boolean;
}

export default function ServicesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [serviceType, setServiceType] = useState("Sunday Service");
  const [customName, setCustomName] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [creating, setCreating] = useState(false);

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

    const alreadyScheduled = services.some(
      (s) => s.service_name === serviceName && s.service_date === serviceDate,
    );
    if (alreadyScheduled) {
      toast.error(`${serviceName} is already scheduled for this date`);
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
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["services-today"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create service");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Service Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {defaultService} is the default service type. You can also schedule custom services.
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

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Service</CardTitle>
              <CardDescription>
                Choose a service type or enter a custom name for special events.
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
                          {preset === defaultService ? " (default)" : ""}
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
                  <div key={s.id} className="flex justify-between rounded-lg border p-4">
                    <span className="font-medium">
                      {s.service_name}
                      {s.service_name === defaultService && (
                        <span className="ml-2 text-xs text-muted-foreground">(default type)</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">{formatDate(s.service_date)}</span>
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
