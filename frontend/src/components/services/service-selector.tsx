"use client";

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
    return null;
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

export function useDefaultServiceId() {
  const { data: services = [] } = useQuery({
    queryKey: ["services-today"],
    queryFn: () => apiGet<Service[]>("/api/v1/services/today/all"),
  });

  return services[0]?.id ?? "";
}
