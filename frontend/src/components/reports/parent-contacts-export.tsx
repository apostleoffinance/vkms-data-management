"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiDownload } from "@/lib/api";

const ALWAYS_INCLUDED = ["first_name", "last_name", "phone"] as const;

const OPTIONAL_FIELDS = [
  { id: "alternative_phone", label: "Alternative phone" },
  { id: "email", label: "Email" },
  { id: "address", label: "Address" },
] as const;

type OptionalFieldId = (typeof OPTIONAL_FIELDS)[number]["id"];

export function ParentContactsExport() {
  const [optional, setOptional] = useState<Record<OptionalFieldId, boolean>>({
    alternative_phone: false,
    email: false,
    address: false,
  });

  const toggle = (id: OptionalFieldId) => {
    setOptional((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedFields = [
    ...ALWAYS_INCLUDED,
    ...OPTIONAL_FIELDS.filter((f) => optional[f.id]).map((f) => f.id),
  ];

  const download = async (format: "csv" | "excel") => {
    const ext = format === "excel" ? "xlsx" : "csv";
    const params = new URLSearchParams({
      format,
      fields: selectedFields.join(","),
    });
    await apiDownload(`/api/v1/parents/export?${params}`, `vkms-parents-contacts.${ext}`);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Files include first name, last name, and phone. Check below only if you also need those
        fields in the download.
      </p>
      <div className="flex flex-wrap gap-4">
        {OPTIONAL_FIELDS.map((field) => (
          <label key={field.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border"
              checked={optional[field.id]}
              onChange={() => toggle(field.id)}
            />
            <span>{field.label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void download("csv")}>
          <Download className="h-4 w-4 mr-2" />
          Parents CSV
        </Button>
        <Button variant="outline" onClick={() => void download("excel")}>
          <Download className="h-4 w-4 mr-2" />
          Parents Excel
        </Button>
      </div>
    </div>
  );
}
