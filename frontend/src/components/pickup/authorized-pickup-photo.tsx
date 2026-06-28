"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";

import { getAccessToken } from "@/lib/auth-token";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AuthorizedPickupPhotoProps {
  contactId: string;
  name: string;
  className?: string;
}

export function AuthorizedPickupPhoto({ contactId, name, className = "h-20 w-20" }: AuthorizedPickupPhotoProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const token = getAccessToken();

    fetch(`${API_BASE}/api/v1/authorized-pickups/${contactId}/photo`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.blob();
      })
      .then((blob) => {
        if (!blob) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contactId]);

  return (
    <div className={`rounded-lg border bg-muted overflow-hidden flex items-center justify-center ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <User className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
  );
}
