"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import type { Service } from "@/types";

interface ServiceSelectorProps {
  value: string;
  onChange: (serviceId: string) => void;
  label?: string;
}

export function ServiceSelector({ value, onChange, label = "Service" }: ServiceSelectorProps) {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services-today"],
    queryFn: () => apiGet<Service[]>("/api/v1/services/today/all"),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">Loading services...</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
        <p className="text-sm font-medium text-amber-900">No service scheduled for today</p>
        <p className="text-sm text-amber-800">
          An admin must create or schedule today&apos;s service before check-in, check-out, or worker
          attendance can begin.
        </p>
        <Link
          href="/admin/services"
          className="inline-block text-sm font-medium text-primary underline underline-offset-2"
        >
          Go to Service Management
        </Link>
      </div>
    );
  }

  const selected = value || services[0]?.id;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={selected} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select service" />
        </SelectTrigger>
        <SelectContent>
          {services.map((service) => (
            <SelectItem key={service.id} value={service.id}>
              {service.service_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {services.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Today&apos;s service: {services[0].service_name}
        </p>
      )}
    </div>
  );
}

export function useTodayServices() {
  return useQuery({
    queryKey: ["services-today"],
    queryFn: () => apiGet<Service[]>("/api/v1/services/today/all"),
  });
}

export function useDefaultServiceId() {
  const { data: services = [] } = useTodayServices();
  return services[0]?.id ?? "";
}

export function useHasTodayService() {
  const { data: services = [], isLoading } = useTodayServices();
  return { hasService: services.length > 0, isLoading };
}
