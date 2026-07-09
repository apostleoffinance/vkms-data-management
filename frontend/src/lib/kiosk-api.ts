const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const BUILD_KIOSK_TOKEN = process.env.NEXT_PUBLIC_KIOSK_TOKEN || "";

function getKioskToken(): string {
  if (typeof window !== "undefined") {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    if (fromUrl) {
      return fromUrl;
    }
  }
  return BUILD_KIOSK_TOKEN;
}

export class KioskApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "KioskApiError";
  }
}

function kioskHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (getKioskToken()) {
    headers["X-Kiosk-Token"] = getKioskToken();
  }
  return headers;
}

function kioskUrl(path: string): string {
  const url = new URL(`${API_BASE}${path}`);
  const token = getKioskToken();
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: "Request failed" }));
    const message = typeof data.detail === "string" ? data.detail : "Request failed";
    throw new KioskApiError(response.status, message);
  }
  return response.json();
}

export interface KioskService {
  id: string;
  service_name: string;
  service_date: string;
}

export interface KioskChildStatus {
  id: string;
  child_code: string;
  full_name: string;
  class_name: string;
  checked_in_today: boolean;
  tag_number: string | null;
  checked_out: boolean;
  check_in_time: string | null;
  ready_for_pickup: boolean;
}

export interface KioskLookupResponse {
  parent_name: string;
  phone: string;
  children: KioskChildStatus[];
}

export interface KioskTagResult {
  tag_number: string;
  child_name: string;
  class_name: string;
  child_code: string;
  check_in_time: string;
  service_name: string;
  already_checked_in: boolean;
}

export interface KioskCheckOutResult {
  child_name: string;
  tag_number: string;
  class_name: string;
  pickup_person_name: string;
  check_out_time: string;
  service_name: string;
  already_checked_out: boolean;
}

export interface KioskPickupContact {
  id: string;
  full_name: string;
  relationship: string;
  has_photo: boolean;
}

export interface KioskPickupPerson {
  first_name: string;
  last_name: string;
  phone: string;
  relationship: string;
  photo_base64: string;
}

export async function kioskGetTodayService(): Promise<KioskService | null> {
  const response = await fetch(kioskUrl("/api/v1/kiosk/service/today"), {
    headers: kioskHeaders(),
  });
  return handleResponse<KioskService | null>(response);
}

export async function kioskLookup(phone: string): Promise<KioskLookupResponse | null> {
  const response = await fetch(kioskUrl("/api/v1/kiosk/lookup"), {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify({ phone }),
  });
  return handleResponse<KioskLookupResponse | null>(response);
}

export async function kioskGetPickupContacts(
  childId: string,
  phone: string,
): Promise<KioskPickupContact[]> {
  const url = new URL(kioskUrl(`/api/v1/kiosk/children/${childId}/pickup-contacts`));
  url.searchParams.set("phone", phone);
  const response = await fetch(url.toString(), { headers: kioskHeaders() });
  return handleResponse<KioskPickupContact[]>(response);
}

export async function kioskCheckIn(
  childId: string,
  phone: string,
  photoBase64?: string,
): Promise<KioskTagResult> {
  const response = await fetch(kioskUrl("/api/v1/kiosk/check-in"), {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify({
      child_id: childId,
      phone,
      photo_base64: photoBase64 || null,
    }),
  });
  return handleResponse<KioskTagResult>(response);
}

export async function kioskCheckOut(
  childId: string,
  phone: string,
  pickedUpContactId: string,
  photoBase64?: string,
): Promise<KioskCheckOutResult> {
  const response = await fetch(kioskUrl("/api/v1/kiosk/check-out"), {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify({
      child_id: childId,
      phone,
      picked_up_contact_id: pickedUpContactId,
      photo_base64: photoBase64 || null,
    }),
  });
  return handleResponse<KioskCheckOutResult>(response);
}

export async function kioskAddPickup(payload: {
  phone: string;
  child_id: string;
  first_name: string;
  last_name: string;
  contact_phone: string;
  relationship: string;
  photo_base64: string;
}): Promise<KioskPickupContact> {
  const response = await fetch(kioskUrl("/api/v1/kiosk/add-pickup"), {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<KioskPickupContact>(response);
}

export interface KioskRegisterPayload {
  child_first_name: string;
  child_last_name: string;
  gender: string;
  date_of_birth: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_phone: string;
  parent_email?: string;
  parent_photo_base64: string;
  medical_notes?: string;
  additional_pickup?: KioskPickupPerson;
}

export async function kioskRegister(payload: KioskRegisterPayload): Promise<KioskTagResult> {
  const response = await fetch(kioskUrl("/api/v1/kiosk/register"), {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<KioskTagResult>(response);
}

export function getKioskPageUrl(): string {
  if (typeof window === "undefined") {
    return "/kiosk";
  }
  const url = new URL("/kiosk", window.location.origin);
  const token = getKioskToken();
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}
