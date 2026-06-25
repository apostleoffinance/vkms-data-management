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

interface ServiceTypesResponse {
  default: string;
  presets: string[];
  allow_custom: boolean;
}

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

  const { data: types } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => apiGet<ServiceTypesResponse>("/api/v1/services/types"),
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

  const defaultName = types?.default ?? "Sunday Service";
  const selected = value || services.find((s) => s.service_name === defaultName)?.id || services[0]?.id;

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
              {service.service_name === defaultName ? " (default)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {services.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Only {defaultName} is scheduled today. Add more from Service Management.
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

  const { data: types } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => apiGet<ServiceTypesResponse>("/api/v1/services/types"),
  });

  const defaultName = types?.default ?? "Sunday Service";
  return services.find((s) => s.service_name === defaultName)?.id ?? services[0]?.id ?? "";
}
