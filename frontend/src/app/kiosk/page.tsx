"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Baby, LogOut, Phone, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { PhotoCapture } from "@/components/pickup/photo-capture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/loading";
import { BRAND } from "@/lib/brand";
import {
  kioskAddPickup,
  kioskCheckIn,
  kioskCheckOut,
  KioskApiError,
  kioskGetPickupContacts,
  kioskGetTodayService,
  kioskLookup,
  kioskRegister,
  type KioskCheckOutResult,
  type KioskChildStatus,
  type KioskLookupResponse,
  type KioskPickupContact,
  type KioskService,
  type KioskTagResult,
} from "@/lib/kiosk-api";

type Screen =
  | "home"
  | "phone"
  | "register"
  | "pickup-phone"
  | "pickup-contact"
  | "checkin-photo"
  | "add-pickup"
  | "success-checkin"
  | "success-checkout";

function FrontDeskNote() {
  return (
    <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
      No phone or internet? See the front desk — staff can help you check in or pick up.
    </p>
  );
}

export default function KioskPage() {
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<KioskService | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<KioskLookupResponse | null>(null);
  const [tag, setTag] = useState<KioskTagResult | null>(null);
  const [checkout, setCheckout] = useState<KioskCheckOutResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  const [selectedChild, setSelectedChild] = useState<KioskChildStatus | null>(null);
  const [pickupContacts, setPickupContacts] = useState<KioskPickupContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [pickupPhoto, setPickupPhoto] = useState<string | null>(null);
  const [checkinPhoto, setCheckinPhoto] = useState<string | null>(null);

  const [parentPhoto, setParentPhoto] = useState<string | null>(null);
  const [showAdditionalPickup, setShowAdditionalPickup] = useState(false);
  const [additionalPhoto, setAdditionalPhoto] = useState<string | null>(null);
  const [additionalPickup, setAdditionalPickup] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    relationship: "Guardian",
  });

  const [addPickupForm, setAddPickupForm] = useState({
    first_name: "",
    last_name: "",
    contact_phone: "",
    relationship: "Guardian",
  });
  const [addPickupPhoto, setAddPickupPhoto] = useState<string | null>(null);

  const [registerForm, setRegisterForm] = useState({
    child_first_name: "",
    child_last_name: "",
    gender: "male",
    date_of_birth: "",
    parent_first_name: "",
    parent_last_name: "",
    parent_phone: "",
    parent_email: "",
    medical_notes: "",
  });

  useEffect(() => {
    kioskGetTodayService()
      .then(setService)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not load service");
      })
      .finally(() => setLoading(false));
  }, []);

  const reset = () => {
    setScreen("home");
    setTag(null);
    setCheckout(null);
    setLookup(null);
    setPhone("");
    setLookupFailed(false);
    setSelectedChild(null);
    setPickupContacts([]);
    setSelectedContactId("");
    setPickupPhoto(null);
    setCheckinPhoto(null);
    setAddPickupPhoto(null);
  };

  const handlePhoneLookup = async (forPickup = false) => {
    if (!phone.trim()) {
      toast.error("Enter your phone number");
      return;
    }
    setBusy(true);
    setLookupFailed(false);
    try {
      const result = await kioskLookup(phone.trim());
      if (!result || result.children.length === 0) {
        setLookup(null);
        setLookupFailed(true);
        return;
      }
      setLookup(result);
      if (forPickup) {
        const ready = result.children.filter((c) => c.ready_for_pickup);
        if (ready.length === 0) {
          toast.error("No children are checked in and waiting for pickup");
          setLookup(null);
          return;
        }
        if (ready.length === 1) {
          await startPickupFlow(ready[0]);
        } else {
          setScreen("pickup-contact");
        }
      } else {
        setRegisterForm((f) => ({
          ...f,
          parent_phone: phone.trim(),
          parent_first_name: result.parent_name.split(" ")[0] || "",
          parent_last_name: result.parent_name.split(" ").slice(1).join(" ") || "",
        }));
      }
    } catch (err) {
      toast.error(err instanceof KioskApiError ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  const startCheckIn = async (child: KioskChildStatus) => {
    if (child.checked_in_today && child.tag_number && !child.checked_out) {
      setTag({
        tag_number: child.tag_number,
        child_name: child.full_name,
        class_name: child.class_name,
        child_code: child.child_code,
        check_in_time: child.check_in_time || new Date().toISOString(),
        service_name: service?.service_name || "Today's service",
        already_checked_in: true,
      });
      setScreen("success-checkin");
      return;
    }

    setSelectedChild(child);
    setBusy(true);
    try {
      // Backend reuses an existing parent photo from any sibling for this phone.
      const result = await kioskCheckIn(child.id, phone.trim());
      setTag(result);
      setScreen("success-checkin");
    } catch (err) {
      const message = err instanceof KioskApiError ? err.message : "Check-in failed";
      if (message.toLowerCase().includes("photo")) {
        setScreen("checkin-photo");
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmCheckInWithPhoto = async () => {
    if (!selectedChild || !checkinPhoto) {
      toast.error("Please take a photo to continue");
      return;
    }
    setBusy(true);
    try {
      const result = await kioskCheckIn(selectedChild.id, phone.trim(), checkinPhoto);
      setTag(result);
      setScreen("success-checkin");
    } catch (err) {
      toast.error(err instanceof KioskApiError ? err.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  };

  const startPickupFlow = async (child: KioskChildStatus) => {
    setSelectedChild(child);
    setBusy(true);
    try {
      const contacts = await kioskGetPickupContacts(child.id, phone.trim());
      setPickupContacts(contacts);
      setSelectedContactId(contacts.find((c) => c.relationship === "Parent")?.id || contacts[0]?.id || "");
      setPickupPhoto(null);
      setScreen("pickup-contact");
    } catch (err) {
      toast.error(err instanceof KioskApiError ? err.message : "Could not load pickup contacts");
    } finally {
      setBusy(false);
    }
  };

  const confirmCheckout = async () => {
    if (!selectedChild || !selectedContactId) {
      toast.error("Select who is picking up");
      return;
    }
    const contact = pickupContacts.find((c) => c.id === selectedContactId);
    if (contact && !contact.has_photo && !pickupPhoto) {
      toast.error("Please take a photo of the person picking up");
      return;
    }
    setBusy(true);
    try {
      const result = await kioskCheckOut(
        selectedChild.id,
        phone.trim(),
        selectedContactId,
        pickupPhoto || undefined,
      );
      setCheckout(result);
      setScreen("success-checkout");
    } catch (err) {
      const message = err instanceof KioskApiError ? err.message : "Check-out failed";
      if (message.toLowerCase().includes("photo")) {
        toast.error(message);
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentPhoto) {
      toast.error("A photo of the parent or guardian is required");
      return;
    }
    if (showAdditionalPickup) {
      if (!additionalPickup.first_name || !additionalPickup.last_name || !additionalPickup.phone) {
        toast.error("Complete the additional pickup person details");
        return;
      }
      if (!additionalPhoto) {
        toast.error("A photo of the additional pickup person is required");
        return;
      }
    }
    setBusy(true);
    try {
      const result = await kioskRegister({
        ...registerForm,
        parent_email: registerForm.parent_email || undefined,
        medical_notes: registerForm.medical_notes || undefined,
        parent_photo_base64: parentPhoto,
        additional_pickup: showAdditionalPickup
          ? {
              ...additionalPickup,
              photo_base64: additionalPhoto!,
            }
          : undefined,
      });
      setTag(result);
      setScreen("success-checkin");
    } catch (err) {
      toast.error(err instanceof KioskApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAddPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || !addPickupPhoto) {
      toast.error("Photo is required for authorized pickup people");
      return;
    }
    setBusy(true);
    try {
      await kioskAddPickup({
        phone: phone.trim(),
        child_id: selectedChild.id,
        first_name: addPickupForm.first_name,
        last_name: addPickupForm.last_name,
        contact_phone: addPickupForm.contact_phone,
        relationship: addPickupForm.relationship,
        photo_base64: addPickupPhoto,
      });
      toast.success("Pickup person added");
      const contacts = await kioskGetPickupContacts(selectedChild.id, phone.trim());
      setPickupContacts(contacts);
      setAddPickupPhoto(null);
      setAddPickupForm({ first_name: "", last_name: "", contact_phone: "", relationship: "Guardian" });
      setScreen("pickup-contact");
    } catch (err) {
      toast.error(err instanceof KioskApiError ? err.message : "Could not add pickup person");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Check-in not open yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <p>No service is scheduled for today.</p>
            <p>Please see the front desk for help.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screen === "success-checkin" && tag) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6"
        style={{ backgroundColor: BRAND.yellow, color: BRAND.black }}
      >
        <div className="w-full max-w-md space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-80">
            {tag.already_checked_in ? "Already checked in" : "Checked in!"}
          </p>
          <div className="rounded-3xl border-4 border-black bg-white px-6 py-10 shadow-lg">
            <p className="text-sm font-medium text-muted-foreground">Your tag number</p>
            <p className="my-2 text-7xl font-black tabular-nums tracking-tight">{tag.tag_number}</p>
            <p className="text-2xl font-bold">{tag.child_name}</p>
            <p className="mt-1 text-lg text-muted-foreground">{tag.class_name}</p>
            <p className="mt-4 text-sm">{tag.service_name}</p>
          </div>
          <p className="text-lg font-semibold">Show this tag number at the front desk</p>
          <p className="text-sm opacity-80">
            Keep this screen visible when you drop off your child.
          </p>
          <Button type="button" className="w-full bg-black text-white hover:bg-black/90" onClick={reset}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (screen === "success-checkout" && checkout) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6"
        style={{ backgroundColor: BRAND.yellow, color: BRAND.black }}
      >
        <div className="w-full max-w-md space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-80">
            {checkout.already_checked_out ? "Already checked out" : "Ready for pickup!"}
          </p>
          <div className="rounded-3xl border-4 border-black bg-white px-6 py-10 shadow-lg">
            <p className="text-sm font-medium text-muted-foreground">Tag number</p>
            <p className="my-2 text-6xl font-black tabular-nums tracking-tight">{checkout.tag_number}</p>
            <p className="text-2xl font-bold">{checkout.child_name}</p>
            <p className="mt-1 text-lg text-muted-foreground">{checkout.class_name}</p>
            <p className="mt-4 text-base font-semibold">Picking up: {checkout.pickup_person_name}</p>
            <p className="mt-2 text-sm text-muted-foreground">{checkout.service_name}</p>
          </div>
          <p className="text-lg font-semibold">Show this screen at the front desk</p>
          <p className="text-sm opacity-80">
            A team member will bring your child to you.
          </p>
          <Button type="button" className="w-full bg-black text-white hover:bg-black/90" onClick={reset}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const pickupReadyChildren = lookup?.children.filter((c) => c.ready_for_pickup) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header
        className="px-6 py-5 text-center"
        style={{ backgroundColor: BRAND.yellow, color: BRAND.black }}
      >
        <p className="text-sm font-semibold uppercase tracking-wide">Votage Kids</p>
        <h1 className="text-2xl font-bold">Parent Check-in</h1>
        <p className="mt-1 text-sm opacity-80">
          {service.service_name} · {format(new Date(service.service_date), "EEEE, MMM d")}
        </p>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-6 p-6">
        {screen === "home" && (
          <>
            <p className="text-center text-muted-foreground">
              Check in your child, pick them up, or register a first-time visitor.
            </p>
            <div className="grid gap-3">
              <Button type="button" size="lg" className="h-auto justify-start gap-4 py-5" onClick={() => setScreen("phone")}>
                <Phone className="h-6 w-6 shrink-0" />
                <span className="text-left">
                  <span className="block font-semibold">Check in</span>
                  <span className="text-sm font-normal opacity-80">Look up by parent phone</span>
                </span>
              </Button>
              <Button type="button" size="lg" variant="outline" className="h-auto justify-start gap-4 py-5" onClick={() => setScreen("pickup-phone")}>
                <LogOut className="h-6 w-6 shrink-0" />
                <span className="text-left">
                  <span className="block font-semibold">Pick up my child</span>
                  <span className="text-sm font-normal opacity-80">Start checkout and show confirmation at desk</span>
                </span>
              </Button>
              <Button type="button" size="lg" variant="outline" className="h-auto justify-start gap-4 py-5" onClick={() => setScreen("register")}>
                <UserPlus className="h-6 w-6 shrink-0" />
                <span className="text-left">
                  <span className="block font-semibold">Register new child</span>
                  <span className="text-sm font-normal opacity-80">First time visiting</span>
                </span>
              </Button>
            </div>
            <FrontDeskNote />
          </>
        )}

        {(screen === "phone" || screen === "pickup-phone") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {screen === "pickup-phone" ? "Pick up — find your children" : "Check in — find your children"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Parent phone number</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  placeholder="07012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={busy}
                onClick={() => void handlePhoneLookup(screen === "pickup-phone")}
              >
                {busy ? "Searching…" : "Find children"}
              </Button>
              {lookupFailed && screen === "phone" && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                  <p>No children found for this phone number.</p>
                  <Button type="button" variant="outline" className="w-full" onClick={() => { setRegisterForm((f) => ({ ...f, parent_phone: phone.trim() })); setScreen("register"); }}>
                    Register a new child
                  </Button>
                </div>
              )}
              {lookup && screen === "phone" && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">{lookup.parent_name} · {lookup.phone}</p>
                  {lookup.children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                      <div>
                        <p className="font-medium">{child.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {child.child_code} · {child.class_name}
                          {child.checked_in_today && child.tag_number ? ` · Tag ${child.tag_number}` : ""}
                        </p>
                      </div>
                      <Button type="button" disabled={busy} onClick={() => void startCheckIn(child)}>
                        {child.checked_in_today && !child.checked_out ? "Show tag" : "Check in"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {lookup && screen === "pickup-phone" && pickupReadyChildren.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">Select a child to pick up</p>
                  {pickupReadyChildren.map((child) => (
                    <div key={child.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                      <div>
                        <p className="font-medium">{child.full_name}</p>
                        <p className="text-sm text-muted-foreground">Tag {child.tag_number} · {child.class_name}</p>
                      </div>
                      <Button type="button" disabled={busy} onClick={() => void startPickupFlow(child)}>
                        Pick up
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setLookup(null); setScreen("home"); }}>
                Back
              </Button>
              <FrontDeskNote />
            </CardContent>
          </Card>
        )}

        {screen === "checkin-photo" && selectedChild && (
          <Card>
            <CardHeader>
              <CardTitle>Photo required — {selectedChild.full_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We need a one-time photo of the parent or guardian for authorized pickup. This is stored securely and not taken again each week.
              </p>
              <PhotoCapture label="Parent / guardian photo" value={checkinPhoto} onChange={setCheckinPhoto} />
              <Button type="button" className="w-full" disabled={busy || !checkinPhoto} onClick={() => void confirmCheckInWithPhoto()}>
                {busy ? "Checking in…" : "Continue check-in"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setScreen("phone")}>
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {screen === "pickup-contact" && selectedChild && (
          <Card>
            <CardHeader>
              <CardTitle>Pick up {selectedChild.full_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pickupReadyChildren.length > 1 && !pickupContacts.length && (
                <div className="space-y-2">
                  <Label>Select child</Label>
                  {pickupReadyChildren.map((child) => (
                    <Button key={child.id} variant="outline" className="w-full justify-start" onClick={() => void startPickupFlow(child)}>
                      {child.full_name} · Tag {child.tag_number}
                    </Button>
                  ))}
                </div>
              )}
              {pickupContacts.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Who is picking up?</Label>
                    <Select value={selectedContactId} onValueChange={(v) => { setSelectedContactId(v); setPickupPhoto(null); }}>
                      <SelectTrigger><SelectValue placeholder="Select pickup person" /></SelectTrigger>
                      <SelectContent>
                        {pickupContacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name} ({c.relationship}){c.has_photo ? "" : " — photo needed"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedContactId && !pickupContacts.find((c) => c.id === selectedContactId)?.has_photo && (
                    <PhotoCapture
                      label="Photo of person picking up (one-time)"
                      value={pickupPhoto}
                      onChange={setPickupPhoto}
                    />
                  )}
                  <Button type="button" className="w-full" disabled={busy} onClick={() => void confirmCheckout()}>
                    {busy ? "Processing…" : "Confirm pickup"}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setScreen("add-pickup")}>
                    <Users className="mr-2 h-4 w-4" />
                    Add someone who can pick up
                  </Button>
                </>
              )}
              <Button type="button" variant="ghost" className="w-full" onClick={() => setScreen("pickup-phone")}>
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {screen === "add-pickup" && selectedChild && (
          <Card>
            <CardHeader>
              <CardTitle>Add authorized pickup person</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleAddPickup}>
                <p className="text-sm text-muted-foreground">
                  New pickup people need a one-time photo on file for {selectedChild.full_name}.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>First name</Label>
                    <Input required value={addPickupForm.first_name} onChange={(e) => setAddPickupForm((f) => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last name</Label>
                    <Input required value={addPickupForm.last_name} onChange={(e) => setAddPickupForm((f) => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input required inputMode="tel" value={addPickupForm.contact_phone} onChange={(e) => setAddPickupForm((f) => ({ ...f, contact_phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Input required value={addPickupForm.relationship} onChange={(e) => setAddPickupForm((f) => ({ ...f, relationship: e.target.value }))} />
                </div>
                <PhotoCapture label="Photo (required)" value={addPickupPhoto} onChange={setAddPickupPhoto} />
                <Button type="submit" className="w-full" disabled={busy}>Save pickup person</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setScreen("pickup-contact")}>Back</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {screen === "register" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Baby className="h-5 w-5" />
                Register & check in
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Child first name</Label>
                    <Input required value={registerForm.child_first_name} onChange={(e) => setRegisterForm((f) => ({ ...f, child_first_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Child last name</Label>
                    <Input required value={registerForm.child_last_name} onChange={(e) => setRegisterForm((f) => ({ ...f, child_last_name: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={registerForm.gender} onValueChange={(v) => setRegisterForm((f) => ({ ...f, gender: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of birth</Label>
                    <Input required type="date" value={registerForm.date_of_birth} onChange={(e) => setRegisterForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Parent first name</Label>
                    <Input required value={registerForm.parent_first_name} onChange={(e) => setRegisterForm((f) => ({ ...f, parent_first_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Parent last name</Label>
                    <Input required value={registerForm.parent_last_name} onChange={(e) => setRegisterForm((f) => ({ ...f, parent_last_name: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Parent phone</Label>
                  <Input required inputMode="tel" value={registerForm.parent_phone} onChange={(e) => setRegisterForm((f) => ({ ...f, parent_phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email (optional)</Label>
                  <Input type="email" value={registerForm.parent_email} onChange={(e) => setRegisterForm((f) => ({ ...f, parent_email: e.target.value }))} />
                </div>

                <hr />
                <p className="text-sm font-medium">Authorized pickup photos (one-time)</p>
                <PhotoCapture label="Parent / guardian photo (required)" value={parentPhoto} onChange={setParentPhoto} />

                <Button type="button" variant="outline" className="w-full" onClick={() => setShowAdditionalPickup(!showAdditionalPickup)}>
                  {showAdditionalPickup ? "Remove second pickup person" : "Add another pickup person (optional)"}
                </Button>

                {showAdditionalPickup && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First name" value={additionalPickup.first_name} onChange={(e) => setAdditionalPickup((f) => ({ ...f, first_name: e.target.value }))} />
                      <Input placeholder="Last name" value={additionalPickup.last_name} onChange={(e) => setAdditionalPickup((f) => ({ ...f, last_name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Phone" inputMode="tel" value={additionalPickup.phone} onChange={(e) => setAdditionalPickup((f) => ({ ...f, phone: e.target.value }))} />
                      <Input placeholder="Relationship" value={additionalPickup.relationship} onChange={(e) => setAdditionalPickup((f) => ({ ...f, relationship: e.target.value }))} />
                    </div>
                    <PhotoCapture label="Their photo (required)" value={additionalPhoto} onChange={setAdditionalPhoto} />
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Registering…" : "Register & get tag"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setScreen("home")}>Back</Button>
                <FrontDeskNote />
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
